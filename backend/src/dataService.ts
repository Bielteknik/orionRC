// backend/src/dataService.ts
import { getDb } from './database';
import { Station, Sensor, Camera, DeviceConfig, ReadingPayload, SensorStatus, CameraStatus } from './types';

// --- Frontend API Functions ---

export async function getStations(): Promise<Station[]> {
    const db = getDb();
    const stations = await db.all<any[]>(`
        SELECT 
            s.id, s.name, s.location, s.lat, s.lng, s.status, s.lastUpdate,
            (SELECT COUNT(*) FROM sensors WHERE stationId = s.id) as sensorCount,
            (SELECT COUNT(*) FROM cameras WHERE stationId = s.id) as cameraCount
        FROM stations s
    `);
    
    return stations.map((s: any) => ({
        id: s.id,
        name: s.name,
        location: s.location,
        locationCoords: { lat: s.lat, lng: s.lng },
        status: s.status,
        lastUpdate: s.lastUpdate,
        sensorCount: s.sensorCount,
        cameraCount: s.cameraCount,
        activeAlerts: 0,
        systemHealth: 100,
        avgBattery: 100,
        dataFlow: 0,
        activeSensorCount: 0,
        onlineCameraCount: 0,
    }));
}

export async function getSensors(): Promise<Sensor[]> {
    const db = getDb();
    return await db.all<Sensor[]>('SELECT * FROM sensors');
}

export async function getCameras(): Promise<Camera[]> {
    const db = getDb();
    const cameras = await db.all<Omit<Camera, 'photos'>[]>('SELECT * FROM cameras');
    return cameras.map(c => ({...c, photos: []}));
}

export async function createStation(stationData: any): Promise<void> {
    const db = getDb();
    await db.run(
        'INSERT INTO stations (id, name, location, lat, lng, status, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?)',
        stationData.id,
        stationData.name,
        stationData.location,
        stationData.locationCoords.lat,
        stationData.locationCoords.lng,
        'active',
        new Date().toISOString()
    );

    if (stationData.selectedSensorIds && stationData.selectedSensorIds.length > 0) {
        const placeholders = stationData.selectedSensorIds.map(() => '?').join(',');
        await db.run(`UPDATE sensors SET stationId = ? WHERE id IN (${placeholders})`, stationData.id, ...stationData.selectedSensorIds);
    }
    if (stationData.selectedCameraIds && stationData.selectedCameraIds.length > 0) {
        const placeholders = stationData.selectedCameraIds.map(() => '?').join(',');
        await db.run(`UPDATE cameras SET stationId = ? WHERE id IN (${placeholders})`, stationData.id, ...stationData.selectedCameraIds);
    }
}

export async function createSensor(sensorData: any): Promise<void> {
    const db = getDb();
    await db.run(
        'INSERT INTO sensors (id, name, type, stationId, status, value, unit, battery, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        sensorData.id,
        sensorData.name,
        sensorData.type,
        sensorData.stationId || null,
        sensorData.status || SensorStatus.Active,
        0, '', 100, new Date().toISOString()
    );
}

export async function createCamera(cameraData: any): Promise<void> {
    const db = getDb();
    await db.run(
        'INSERT INTO cameras (id, name, stationId, status, streamUrl, rtspUrl, cameraType, viewDirection, fps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        cameraData.id,
        cameraData.name,
        cameraData.stationId || null,
        cameraData.status || CameraStatus.Offline,
        '', cameraData.rtspUrl, cameraData.cameraType, cameraData.viewDirection, 30
    );
}


// --- Agent API Functions ---

export async function getDeviceConfig(deviceId: string): Promise<DeviceConfig> {
    console.log(`[DataService] Cihaz yapılandırması isteniyor: ${deviceId}`);
    // In a real system, you would query the database for sensors linked to this deviceId.
    // For now, returning a static config but based on real DB sensors.
    const allSensors = await getSensors();
    const activeSensors = allSensors.filter(s => s.status === SensorStatus.Active);
    
    // This mapping is now conceptual. We'd need a way to link DB sensors to agent numeric IDs.
    // For now, let's just return a default config if the DB is empty.
    if (activeSensors.length === 0) {
        return { sensors: [] };
    }

    const config: DeviceConfig = {
        sensors: [
            // Example of how a sensor from DB could be mapped to an agent config
            // This part needs a more robust mapping in a real scenario.
            {
                id: 1, // This ID would come from a mapping table or similar
                name: "SHT3x Sıcaklık/Nem",
                is_active: true,
                interface: "i2c",
                parser_config: { driver: "sht3x" },
                config: { address: "0x44", bus: 1 }
            }
        ]
    };
    return config;
}

export async function submitReading(payload: ReadingPayload): Promise<void> {
    const db = getDb();
    const { sensor: sensorNumericId, value } = payload;
    console.log(`[DataService] Veri alındı - Sensör ID: ${sensorNumericId}, Değer: ${JSON.stringify(value)}`);

    // This is still a simplified logic that needs a proper mapping between
    // the agent's numeric sensor ID and the database's string sensor ID.
    // For now, this will fail gracefully if no sensors are in the DB.
    
    const sensorToUpdate = await db.get<Sensor>('SELECT * FROM sensors LIMIT 1'); // Placeholder logic

    if(sensorToUpdate){
         if (value.temperature !== undefined) {
            await db.run(
                `UPDATE sensors SET value = ?, lastUpdate = ? WHERE type = ? AND stationId = ?`,
                [value.temperature, new Date().toISOString(), 'Sıcaklık', sensorToUpdate.stationId]
            );
        }
        if (value.humidity !== undefined) {
             await db.run(
                `UPDATE sensors SET value = ?, lastUpdate = ? WHERE type = ? AND stationId = ?`,
                [value.humidity, new Date().toISOString(), 'Nem', sensorToUpdate.stationId]
            );
        }
    } else {
        console.warn(`[DataService] Güncellenecek sensör bulunamadı. Veritabanı boş olabilir.`);
    }
}
