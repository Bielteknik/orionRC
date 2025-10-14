import { getDb } from './database';
import { Station, Sensor, Camera } from './types';

/**
 * Fetches all stations from the database and calculates sensor/camera counts.
 */
export async function getAllStations(): Promise<Station[]> {
    const db = await getDb();
    // In a real application, these counts would be more efficient, maybe with triggers or a view.
    const stations = await db.all('SELECT * FROM stations');
    
    const stationsWithCounts = await Promise.all(stations.map(async (station) => {
        const sensorCountResult = await db.get('SELECT COUNT(*) as count FROM sensors WHERE stationId = ?', station.id);
        const cameraCountResult = await db.get('SELECT COUNT(*) as count FROM cameras WHERE stationId = ?', station.id);
        
        // This makes the returned object match the frontend's expected `Station` type
        return {
            ...station,
            locationCoords: { lat: station.lat, lng: station.lng },
            sensorCount: sensorCountResult.count,
            cameraCount: cameraCountResult.count,
            // Mocking dynamic fields that aren't in the DB
            systemHealth: 98,
            avgBattery: 95,
            dataFlow: 12.5,
            activeSensorCount: sensorCountResult.count,
            onlineCameraCount: cameraCountResult.count,
        };
    }));

    return stationsWithCounts as unknown as Station[];
}

/**
 * Fetches all sensors from the database.
 */
export async function getAllSensors(): Promise<Sensor[]> {
    const db = await getDb();
    const sensors = await db.all('SELECT * FROM sensors');
    return sensors as Sensor[];
}

/**
 * Fetches all cameras from the database.
 */
export async function getAllCameras(): Promise<Camera[]> {
    const db = await getDb();
    const cameras = await db.all('SELECT * FROM cameras');
    // The `photos` array is not in the database schema, so we add it here.
    return cameras.map(cam => ({ ...cam, photos: [] })) as Camera[];
}

/**
 * Updates a sensor's value in the database based on a reading from the agent.
 */
export async function updateSensorReading(sensorId: number, valueData: Record<string, any>): Promise<void> {
    const db = await getDb();
    
    // Extract the primary numeric value from the complex value object.
    const mainValue = valueData.temperature ?? valueData.humidity ?? valueData.weight_kg ?? valueData.distance_cm ?? 0;
    
    // The agent uses numeric IDs from its config, but the DB uses string IDs (e.g., 'SEN01').
    // We need to find the correct string ID based on the numeric part.
    const sensors: { id: string }[] = await db.all('SELECT id FROM sensors');
    const targetSensor = sensors.find(s => {
        const numericPart = s.id.replace(/\D/g, ''); // Remove all non-digit characters
        return parseInt(numericPart, 10) === sensorId;
    });

    if (targetSensor) {
        await db.run(
            'UPDATE sensors SET value = ?, lastUpdate = ? WHERE id = ?',
            typeof mainValue === 'number' ? mainValue.toFixed(2) : mainValue,
            new Date().toISOString(),
            targetSensor.id
        );
        console.log(`[DataService] Updated sensor ${targetSensor.id} with value ${mainValue}`);
    } else {
        console.warn(`[DataService] Could not find sensor with numeric ID ${sensorId} to update.`);
    }
}
