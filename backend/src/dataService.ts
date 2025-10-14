import { getDb } from './database.ts';
// FIX: Added CameraStatus to the import list.
import { Station, Sensor, Camera, SensorStatus, CameraStatus, ReadingPayload } from './types.ts';

// --- CREATE Operations ---

export async function createStation(stationData: Omit<Station, 'id' | 'sensorCount' | 'cameraCount' | 'activeAlerts' | 'lastUpdate'> & { selectedSensorIds: string[], selectedCameraIds: string[] }): Promise<string> {
    const db = getDb();
    const newId = `STN${Date.now()}`;
    const now = new Date().toISOString();
    
    await db.run(
        'INSERT INTO stations (id, name, location, lat, lng, status, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?)',
        newId,
        stationData.name,
        stationData.location,
        stationData.locationCoords.lat,
        stationData.locationCoords.lng,
        'inactive', // New stations start as inactive until a device updates
        now
    );

    // Assign selected sensors and cameras to this new station
    if (stationData.selectedSensorIds.length > 0) {
        const placeholders = stationData.selectedSensorIds.map(() => '?').join(',');
        await db.run(`UPDATE sensors SET stationId = ? WHERE id IN (${placeholders})`, newId, ...stationData.selectedSensorIds);
    }
    if (stationData.selectedCameraIds.length > 0) {
        const placeholders = stationData.selectedCameraIds.map(() => '?').join(',');
        await db.run(`UPDATE cameras SET stationId = ? WHERE id IN (${placeholders})`, newId, ...stationData.selectedCameraIds);
    }

    return newId;
}

export async function createSensor(sensorData: Omit<Sensor, 'id' | 'value' | 'lastUpdate' | 'status'>): Promise<string> {
    const db = getDb();
    const newId = `SEN${Date.now()}`;
    const now = new Date().toISOString();

    await db.run(
        'INSERT INTO sensors (id, name, type, stationId, status, unit, battery, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        newId,
        sensorData.name,
        sensorData.type,
        sensorData.stationId || null,
        SensorStatus.Inactive, // New sensors start as inactive
        sensorData.unit,
        sensorData.battery,
        now
    );
    return newId;
}

export async function createCamera(cameraData: Omit<Camera, 'id' | 'photos'>): Promise<string> {
    const db = getDb();
    const newId = `CAM${Date.now()}`;

    await db.run(
        'INSERT INTO cameras (id, name, stationId, status, streamUrl, rtspUrl, cameraType, viewDirection, fps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        newId,
        cameraData.name,
        cameraData.stationId || null,
        cameraData.status,
        cameraData.streamUrl,
        cameraData.rtspUrl,
        cameraData.cameraType,
        cameraData.viewDirection,
        cameraData.fps
    );
    return newId;
}


// --- READ Operations ---

export async function getAllStations(): Promise<Station[]> {
    const db = getDb();
    const stations = await db.all<any[]>('SELECT * FROM stations ORDER BY name');
    
    const results: Station[] = [];
    for (const station of stations) {
        const sensors = await db.all('SELECT status, battery FROM sensors WHERE stationId = ?', station.id);
        const cameras = await db.all('SELECT status FROM cameras WHERE stationId = ?', station.id);
        
        const activeSensors = sensors.filter(s => s.status === SensorStatus.Active);
        
        results.push({
            ...station,
            status: station.status,
            sensorCount: sensors.length,
            cameraCount: cameras.length,
            activeAlerts: 0, // Placeholder
            locationCoords: { lat: station.lat, lng: station.lng },
            systemHealth: 100, // Placeholder
            avgBattery: activeSensors.length > 0 ? Math.round(activeSensors.reduce((acc, s) => acc + s.battery, 0) / activeSensors.length) : 0,
            dataFlow: 0, // Placeholder
            activeSensorCount: activeSensors.length,
            onlineCameraCount: cameras.filter(c => c.status === CameraStatus.Online || c.status === CameraStatus.Recording).length,
        });
    }
    return results;
}

export async function getAllSensors(): Promise<Sensor[]> {
    const db = getDb();
    return db.all<Sensor[]>('SELECT * FROM sensors ORDER BY name');
}

export async function getAllCameras(): Promise<Camera[]> {
    const db = getDb();
    const cameras = await db.all<Camera[]>('SELECT * FROM cameras ORDER BY name');
    return cameras.map(cam => ({ ...cam, photos: [] })); // Photos are not stored in DB
}


// --- UPDATE Operations ---

export async function updateSensorReading(agentSensorId: number, value: Record<string, any>) {
    const db = getDb();
    
    // In a real system, this mapping would come from the database
    // For now, it's hardcoded based on the agent's config in server.ts
    const sensorMapping: { [key: number]: { dbIds: string[], values: { [key: string]: string } } } = {
        1: { dbIds: ['SENSOR01', 'SENSOR02'], values: { 'Sıcaklık': 'temperature', 'Nem': 'humidity' } },
        // ... other mappings
    };
    
    const mapping = sensorMapping[agentSensorId];
    if (!mapping) return;

    for (const dbSensorId of mapping.dbIds) {
        const sensor = await db.get<Sensor>('SELECT id, name, type from sensors WHERE id = ?', dbSensorId);
        if (!sensor) continue;

        const valueKey = mapping.values[sensor.type];
        if (valueKey && typeof value[valueKey] === 'number') {
            const newValue = value[valueKey];
            await db.run(
                'UPDATE sensors SET value = ?, lastUpdate = ?, status = ? WHERE id = ?',
                newValue,
                new Date().toISOString(),
                SensorStatus.Active, // If we get a reading, it's active
                sensor.id
            );
             // Update the station's lastUpdate and status
            const sensorStation = await db.get<{ stationId: string }>('SELECT stationId FROM sensors WHERE id = ?', sensor.id);
            if (sensorStation?.stationId) {
                 await db.run(
                    'UPDATE stations SET lastUpdate = ?, status = ? WHERE id = ?',
                    new Date().toISOString(),
                    'active',
                    sensorStation.stationId
                );
            }
        }
    }
}