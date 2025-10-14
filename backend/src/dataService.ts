import { getDb } from './database';
import { Station, Sensor, Camera, SensorStatus, CameraStatus, DeviceConfig, ReadingPayload } from './types';

// --- Data Seeding ---

const INITIAL_STATIONS: Omit<Station, 'sensorCount' | 'cameraCount' | 'activeAlerts' | 'lastUpdate'>[] = [
    { id: 'STATION001', name: 'Merkez İstasyon', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.9086, lng: 41.2655 }, status: 'active' },
    { id: 'STATION002', name: 'Palandöken Zirve', location: 'Palandöken, Erzurum', locationCoords: { lat: 39.8584, lng: 41.2917 }, status: 'active' },
    { id: 'STATION003', name: 'Tortum Şelalesi', location: 'Tortum, Erzurum', locationCoords: { lat: 40.2986, lng: 41.6508 }, status: 'maintenance' },
    { id: 'STATION004', name: 'Atatürk Üniversitesi', location: 'Yakutiye, Erzurum', locationCoords: { lat: 39.9079, lng: 41.2025 }, status: 'inactive' },
];

const INITIAL_SENSORS: Omit<Sensor, 'lastUpdate' | 'value' | 'unit' | 'battery'>[] = [
    // Station 1
    { id: 'SENSOR01', name: 'Sıcaklık Sensörü A', type: 'Sıcaklık', stationId: 'STATION001', status: SensorStatus.Active },
    { id: 'SENSOR02', name: 'Nem Sensörü A', type: 'Nem', stationId: 'STATION001', status: SensorStatus.Active },
    { id: 'SENSOR03', name: 'Rüzgar Hızı A', type: 'Rüzgar Hızı', stationId: 'STATION001', status: SensorStatus.Error },
    { id: 'SENSOR04', name: 'Basınç Sensörü A', type: 'Basınç', stationId: 'STATION001', status: SensorStatus.Active },
    { id: 'SENSOR11', name: 'Rüzgar Yönü A', type: 'Rüzgar Yönü', stationId: 'STATION001', status: SensorStatus.Active },

    // Station 2
    { id: 'SENSOR05', name: 'Sıcaklık Sensörü B', type: 'Sıcaklık', stationId: 'STATION002', status: SensorStatus.Active },
    { id: 'SENSOR06', name: 'Nem Sensörü B', type: 'Nem', stationId: 'STATION002', status: SensorStatus.Inactive },
    { id: 'SENSOR07', name: 'Rüzgar Hızı B', type: 'Rüzgar Hızı', stationId: 'STATION002', status: SensorStatus.Active },
    { id: 'SENSOR12', name: 'Rüzgar Yönü B', type: 'Rüzgar Yönü', stationId: 'STATION002', status: SensorStatus.Active },

    // Station 3
    { id: 'SENSOR08', name: 'Yağış Miktarı', type: 'Yağış', stationId: 'STATION003', status: SensorStatus.Maintenance },
    { id: 'SENSOR09', name: 'UV İndeksi', type: 'UV İndeksi', stationId: 'STATION003', status: SensorStatus.Maintenance },
    
    // Unassigned
    { id: 'SENSOR10', name: 'Atanmamış Sıcaklık', type: 'Sıcaklık', stationId: '', status: SensorStatus.Inactive },
];

const INITIAL_CAMERAS: Omit<Camera, 'photos' | 'fps' | 'streamUrl'>[] = [
    { id: 'CAM001', name: 'Giriş Kamerası', stationId: 'STATION001', status: CameraStatus.Online, rtspUrl: 'rtsp://mock.stream/1', cameraType: 'Sabit Dome Kamera', viewDirection: 'Kuzey Kapısı' },
    { id: 'CAM002', name: 'Zirve Panoramik', stationId: 'STATION002', status: CameraStatus.Recording, rtspUrl: 'rtsp://mock.stream/2', cameraType: 'PTZ Kamera', viewDirection: '360 Derece' },
    { id: 'CAM003', name: 'Şelale Gözlem', stationId: 'STATION003', status: CameraStatus.Offline, rtspUrl: 'rtsp://mock.stream/3', cameraType: 'Geniş Açılı Kamera', viewDirection: 'Şelale Akış Yönü' },
    { id: 'CAM004', name: 'Atanmamış Kamera', stationId: '', status: CameraStatus.Offline, rtspUrl: 'rtsp://mock.stream/4', cameraType: 'Termal Kamera', viewDirection: 'Depo Alanı' },
];

function getRandomValue(type: string): { value: number, unit: string } {
    switch (type) {
        case 'Sıcaklık': return { value: parseFloat((15 + Math.random() * 10).toFixed(1)), unit: '°C' };
        case 'Nem': return { value: parseFloat((40 + Math.random() * 30).toFixed(1)), unit: '%' };
        case 'Rüzgar Hızı': return { value: parseFloat((5 + Math.random() * 20).toFixed(1)), unit: 'km/h' };
        case 'Basınç': return { value: parseFloat((1000 + Math.random() * 25).toFixed(1)), unit: 'hPa' };
        case 'Yağış': return { value: parseFloat((Math.random() * 5).toFixed(1)), unit: 'mm' };
        case 'UV İndeksi': return { value: parseFloat((Math.random() * 8).toFixed(1)), unit: '' };
        case 'Rüzgar Yönü': return { value: Math.floor(Math.random() * 360), unit: '°' };
        default: return { value: 0, unit: '' };
    }
}

export async function seedDatabase() {
    const db = getDb();
    const stationsCountResult = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM stations');
    if (stationsCountResult && stationsCountResult.count > 0) {
        console.log('[DataService] Veritabanı zaten dolu, seed işlemi atlanıyor.');
        return;
    }

    console.log('[DataService] Veritabanı boş, başlangıç verileri ekleniyor...');
    
    await db.run('BEGIN TRANSACTION');
    try {
        for (const s of INITIAL_STATIONS) {
            await db.run(
                'INSERT INTO stations (id, name, location, lat, lng, status, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?)',
                s.id, s.name, s.location, s.locationCoords.lat, s.locationCoords.lng, s.status, new Date().toISOString()
            );
        }
        for (const s of INITIAL_SENSORS) {
            const { value, unit } = getRandomValue(s.type);
            await db.run(
                'INSERT INTO sensors (id, name, type, stationId, status, value, unit, battery, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                s.id, s.name, s.type, s.stationId || null, s.status, value, unit, Math.floor(80 + Math.random() * 20), new Date().toISOString()
            );
        }
        for (const c of INITIAL_CAMERAS) {
            await db.run(
                'INSERT INTO cameras (id, name, stationId, status, streamUrl, rtspUrl, cameraType, viewDirection, fps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                c.id, c.name, c.stationId || null, c.status, (c.status !== CameraStatus.Offline) ? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' : '', c.rtspUrl, c.cameraType, c.viewDirection, 30
            );
        }
        await db.run('COMMIT');
        console.log('[DataService] Başlangıç verileri başarıyla eklendi.');
    } catch (e) {
        await db.run('ROLLBACK');
        console.error('[DataService] Seed işlemi sırasında hata oluştu, geri alınıyor.', e);
        throw e;
    }
}


// --- Data Fetching Functions ---

export async function getAllStations(): Promise<Station[]> {
    const db = getDb();
    const stations = await db.all<any[]>('SELECT * FROM stations');
    
    // Calculate counts for each station
    const sensorCounts = await db.all<{ stationId: string, count: number }>('SELECT stationId, COUNT(*) as count FROM sensors WHERE stationId IS NOT NULL GROUP BY stationId');
    const cameraCounts = await db.all<{ stationId: string, count: number }>('SELECT stationId, COUNT(*) as count FROM cameras WHERE stationId IS NOT NULL GROUP BY stationId');
    
    const sensorCountMap = new Map(sensorCounts.map(i => [i.stationId, i.count]));
    const cameraCountMap = new Map(cameraCounts.map(i => [i.stationId, i.count]));

    return stations.map(s => ({
        ...s,
        locationCoords: { lat: s.lat, lng: s.lng },
        sensorCount: sensorCountMap.get(s.id) || 0,
        cameraCount: cameraCountMap.get(s.id) || 0,
        activeAlerts: 0, // Mock value
    }));
}

export async function getAllSensors(): Promise<Sensor[]> {
    const db = getDb();
    // Simulate data fluctuation for active sensors
    const sensors = await db.all<Sensor[]>('SELECT * FROM sensors');
    for (const sensor of sensors) {
        if (sensor.status === SensorStatus.Active) {
            const { value, unit } = getRandomValue(sensor.type);
            const battery = Math.max(0, sensor.battery - Math.random() * 0.1);
            sensor.value = value;
            sensor.unit = unit;
            sensor.lastUpdate = new Date().toISOString();
            sensor.battery = parseFloat(battery.toFixed(0));

            await db.run(
                'UPDATE sensors SET value = ?, unit = ?, lastUpdate = ?, battery = ? WHERE id = ?',
                sensor.value, sensor.unit, sensor.lastUpdate, sensor.battery, sensor.id
            );
        }
    }
    return db.all<Sensor[]>('SELECT * FROM sensors');
}

export async function getAllCameras(): Promise<Camera[]> {
    const db = getDb();
    const cameras = await db.all<Camera[]>('SELECT * FROM cameras');
    // Ensure streamUrl is present for online cameras
    return cameras.map(c => ({
        ...c,
        streamUrl: (c.status !== CameraStatus.Offline) ? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' : ''
    }));
}

export async function getDeviceConfig(deviceId: string): Promise<DeviceConfig> {
    // This is a mock implementation for the agent's configuration.
    // In a real system, this would be customized per deviceId.
    console.log(`[DataService] Cihaz için yapılandırma oluşturuluyor: ${deviceId}`);
    return {
        sensors: [
            {
                id: 1,
                name: "Oda Sıcaklığı/Nem (SHT3x)",
                is_active: true,
                interface: 'i2c',
                parser_config: { driver: "sht3x" },
                config: { address: "0x44", bus: 1 }
            },
            {
                id: 2,
                name: "Mesafe Sensörü (Lidar)",
                is_active: true,
                interface: 'serial',
                parser_config: { driver: "dfrobot_ult" },
                config: { port: "/dev/ttyUSB0", baudrate: 115200 }
            },
             {
                id: 3,
                name: "Ağırlık Sensörü (HX711)",
                is_active: false, // Inactive by default
                interface: 'serial',
                parser_config: { driver: "hx711_load_cell" },
                config: { port: "/dev/ttyAMA0", baudrate: 9600 }
            }
        ]
    };
}

export async function saveSensorReading(payload: ReadingPayload) {
    const db = getDb();
    const { sensor: sensorAgentId, value: readingValue } = payload;
    
    console.log(`[DataService] Veri alindi: Sensör ID ${sensorAgentId}, Değer: ${JSON.stringify(readingValue)}`);

    // In a real system, you'd map the agent's sensor ID (e.g., 1, 2, 3) to your main database's sensor IDs (e.g., SENSOR01, SENSOR05).
    // For this mock, we'll just log it and maybe update a known sensor for demo purposes.
    
    // Example logic to update a sensor:
    // Let's assume agent sensor ID 1 corresponds to DB sensor ID 'SENSOR01'
    if (sensorAgentId === 1 && readingValue.temperature && readingValue.humidity) {
        const tempSensorId = 'SENSOR01';
        const humiditySensorId = 'SENSOR02';

        await db.run(
            'UPDATE sensors SET value = ?, lastUpdate = ? WHERE id = ?',
            readingValue.temperature, new Date().toISOString(), tempSensorId
        );
         await db.run(
            'UPDATE sensors SET value = ?, lastUpdate = ? WHERE id = ?',
            readingValue.humidity, new Date().toISOString(), humiditySensorId
        );
        console.log(`[DataService] Updated temperature and humidity sensors.`);
    }
    
    return { success: true, message: "Veri alındı." };
}
