// backend/src/dataService.ts
import { getDb } from './database';
import { Station, Sensor, Camera, DeviceConfig, ReadingPayload, SensorStatus, CameraStatus, Notification, Severity } from './types';

// --- Frontend API Functions ---

export async function getStations(): Promise<Station[]> {
    const db = getDb();
    const stations = await db.all<any[]>(`
        SELECT 
            s.id, s.name, s.location, s.lat as lat, s.lng as lng, s.status, s.lastUpdate,
            (SELECT COUNT(*) FROM sensors WHERE stationId = s.id) as sensorCount,
            (SELECT COUNT(*) FROM cameras WHERE stationId = s.id) as cameraCount
        FROM stations s
    `);
    
    // Veritabanından gelen lat/lng'yi doğru şekilde locationCoords altına yerleştir
    return stations.map((s: any) => ({
        id: s.id,
        name: s.name,
        location: s.location,
        locationCoords: { lat: s.lat, lng: s.lng },
        status: s.status,
        lastUpdate: s.lastUpdate,
        sensorCount: s.sensorCount,
        cameraCount: s.cameraCount,
        activeAlerts: 0, // Mocked for now
        systemHealth: 98,
        avgBattery: 95,
        dataFlow: 12,
        activeSensorCount: s.sensorCount,
        onlineCameraCount: s.cameraCount,
    }));
}

export async function getSensors(): Promise<Sensor[]> {
    const db = getDb();
    return await db.all<Sensor[]>('SELECT * FROM sensors ORDER BY lastUpdate DESC');
}

export async function getCameras(): Promise<Camera[]> {
    const db = getDb();
    const cameras = await db.all<Omit<Camera, 'photos'>[]>('SELECT * FROM cameras');
    return cameras.map(c => ({...c, photos: []})); // photos'u boş dizi olarak ekle
}

export async function getNotifications(): Promise<Notification[]> {
    const db = getDb();
    const notifications = await db.all<any[]>('SELECT * FROM notifications ORDER BY timestamp DESC');
    return notifications.map(n => ({
        ...n,
        isRead: n.isRead === 1,
    }));
}

export async function createStation(stationData: any): Promise<Station> {
    const db = getDb();
    const newStation: Station = {
        id: stationData.id || `STATION${Date.now()}`,
        name: stationData.name,
        location: stationData.location,
        locationCoords: stationData.locationCoords,
        status: 'active',
        lastUpdate: new Date().toISOString(),
        sensorCount: stationData.selectedSensorIds?.length || 0,
        cameraCount: stationData.selectedCameraIds?.length || 0,
        activeAlerts: 0,
    };

    await db.run(
        'INSERT INTO stations (id, name, location, lat, lng, status, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?)',
        newStation.id, newStation.name, newStation.location,
        newStation.locationCoords.lat, newStation.locationCoords.lng,
        newStation.status, newStation.lastUpdate
    );

    if (stationData.selectedSensorIds?.length > 0) {
        const placeholders = stationData.selectedSensorIds.map(() => '?').join(',');
        await db.run(`UPDATE sensors SET stationId = ? WHERE id IN (${placeholders})`, newStation.id, ...stationData.selectedSensorIds);
    }
    if (stationData.selectedCameraIds?.length > 0) {
        const placeholders = stationData.selectedCameraIds.map(() => '?').join(',');
        await db.run(`UPDATE cameras SET stationId = ? WHERE id IN (${placeholders})`, newStation.id, ...stationData.selectedCameraIds);
    }
    return newStation;
}


export async function deleteStation(id: string): Promise<void> {
    const db = getDb();
    // Foreign key constraint (ON DELETE SET NULL) will handle un-assigning devices.
    await db.run('DELETE FROM stations WHERE id = ?', id);
}

export async function createSensor(sensorData: Partial<Sensor>): Promise<Sensor> {
    const db = getDb();
    const newSensor: Sensor = {
        id: sensorData.id || `SENSOR${Date.now()}`,
        name: sensorData.name || 'İsimsiz Sensör',
        type: sensorData.type || 'Bilinmeyen',
        stationId: sensorData.stationId || '',
        status: sensorData.status || SensorStatus.Active,
        value: 0,
        unit: '',
        battery: 100,
        lastUpdate: new Date().toISOString(),
    };

    await db.run(
        'INSERT INTO sensors (id, name, type, stationId, status, value, unit, battery, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        newSensor.id, newSensor.name, newSensor.type, newSensor.stationId || null,
        newSensor.status, newSensor.value, newSensor.unit, newSensor.battery, newSensor.lastUpdate
    );
    return newSensor;
}


export async function deleteSensor(id: string): Promise<void> {
    const db = getDb();
    await db.run('DELETE FROM sensors WHERE id = ?', id);
}

export async function createCamera(cameraData: Partial<Camera>): Promise<Camera> {
    const db = getDb();
    const newCamera: Camera = {
        id: cameraData.id || `CAM${Date.now()}`,
        name: cameraData.name || 'İsimsiz Kamera',
        stationId: cameraData.stationId || '',
        status: cameraData.status || CameraStatus.Offline,
        streamUrl: '',
        rtspUrl: cameraData.rtspUrl || '',
        cameraType: cameraData.cameraType || 'Bilinmeyen',
        viewDirection: cameraData.viewDirection || '',
        fps: 30,
        photos: [],
    };
    await db.run(
        'INSERT INTO cameras (id, name, stationId, status, streamUrl, rtspUrl, cameraType, viewDirection, fps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        newCamera.id, newCamera.name, newCamera.stationId || null, newCamera.status,
        newCamera.streamUrl, newCamera.rtspUrl, newCamera.cameraType, newCamera.viewDirection, newCamera.fps
    );
    return newCamera;
}

export async function deleteCamera(id: string): Promise<void> {
    const db = getDb();
    await db.run('DELETE FROM cameras WHERE id = ?', id);
}

// --- Agent API Functions ---

export async function getDeviceConfig(deviceId: string): Promise<DeviceConfig> {
    console.log(`[DataService] Cihaz yapılandırması isteniyor: ${deviceId}`);
    // This is still a simplified logic. A real system would have a devices table
    // and link sensors to devices, not just stations.
    // For now, we return a hardcoded config for the known device ID.
    if (deviceId === 'ejder3200-01') {
        return {
            sensors: [
                {
                    id: 1, // Agent'ın anlayacağı numerik ID
                    name: "SHT3x Sıcaklık/Nem",
                    is_active: true,
                    interface: "i2c",
                    parser_config: { driver: "sht3x" },
                    config: { address: "0x44", bus: 1 }
                },
                {
                    id: 2,
                    name: "HX711 Yük Hücresi",
                    is_active: true,
                    interface: 'serial',
                    parser_config: { driver: 'hx711_load_cell' },
                    config: { port: '/dev/ttyS0', baudrate: 9600 }
                },
            ]
        };
    }
    return { sensors: [] }; // Bilinmeyen cihaz için boş config
}

export async function submitReading(payload: ReadingPayload): Promise<void> {
    const db = getDb();
    const { sensor: sensorNumericId, value } = payload;
    console.log(`[DataService] Veri alındı - Agent Sensör ID: ${sensorNumericId}, Değer: ${JSON.stringify(value)}`);

    // Bu demo için Agent ID'lerini veritabanındaki sensör tipleriyle eşleştiriyoruz.
    // Bu, gerçek bir sistemde daha dinamik bir eşleştirme tablosuyla yapılmalıdır.
    const now = new Date().toISOString();
    let sensorUpdated = false;

    // Agent ID 1 -> SHT3x, 'Merkez İstasyon' daki sıcaklık ve nem sensörlerini günceller
    if (sensorNumericId === 1 && value.temperature !== undefined && value.humidity !== undefined) {
        const tempRes = await db.run(`UPDATE sensors SET value = ?, lastUpdate = ? WHERE stationId = 'STATION001' AND type = 'Sıcaklık'`, value.temperature, now);
        const humRes = await db.run(`UPDATE sensors SET value = ?, lastUpdate = ? WHERE stationId = 'STATION001' AND type = 'Nem'`, value.humidity, now);
        if ((tempRes.changes ?? 0) > 0 || (humRes.changes ?? 0) > 0) {
            sensorUpdated = true;
        }
    }
    // Diğer agent sensör ID'leri için eşleştirmeler buraya eklenebilir.

    if (sensorUpdated) {
        await db.run(`UPDATE stations SET lastUpdate = ? WHERE id = 'STATION001'`, now);
        console.log(`[DataService] İstasyon 'STATION001' güncellendi.`);
    } else {
        console.warn(`[DataService] Eşleşen sensör bulunamadı. Gelen veri: ${JSON.stringify(payload)}`);
    }
}
