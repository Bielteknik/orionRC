import { MOCK_STATIONS_DATA, MOCK_SENSORS_DATA, MOCK_CAMERAS_DATA } from './mockData';
import { Station, Sensor, Camera, DeviceConfig, SensorConfig } from './types';

// Simple in-memory data store. In a real app, this would interact with a database.
let stations: Station[] = MOCK_STATIONS_DATA;
let sensors: Sensor[] = MOCK_SENSORS_DATA;
let cameras: Camera[] = MOCK_CAMERAS_DATA;

// --- Frontend Data Services ---

export const getAllStations = (): Station[] => {
    // Simulate dynamic data by updating counts on each request
    return stations.map(station => ({
        ...station,
        sensorCount: sensors.filter(s => s.stationId === station.id).length,
        cameraCount: cameras.filter(c => c.stationId === station.id).length,
    }));
};

export const getAllSensors = (): Sensor[] => {
    return sensors;
};

export const getAllCameras = (): Camera[] => {
    return cameras;
};

// --- Agent Data Services ---

export const getDeviceConfig = (deviceId: string): DeviceConfig => {
    // In a real system, you'd look up the deviceId and return its specific configuration.
    // For this mock, we'll assume the deviceId corresponds to 'STN001' and create a sample config.
    const stationSensors = sensors.filter(s => s.stationId === 'STN001');

    const sensorConfigs: SensorConfig[] = stationSensors.map((sensor, index) => {
        // Mocking some config based on sensor type
        let driver = 'virtual';
        let config: any = {};
        if (sensor.type === 'Sıcaklık' || sensor.type === 'Nem') {
            driver = 'sht3x';
            config = { address: '0x44', bus: 1 };
        } else if (sensor.type === 'Basınç') {
            driver = 'hx711_load_cell';
            config = { port: '/dev/ttyUSB0' };
        }
        
        return {
            id: index + 1, // Agent might use a different ID system
            name: sensor.name,
            is_active: true,
            interface: config.address ? 'i2c' : 'serial',
            parser_config: {
                driver: driver,
            },
            config: config
        };
    });

    return {
        sensors: sensorConfigs,
    };
};

export const updateSensorValue = (sensorId: number, reading: Record<string, any>) => {
    // This is a mock function. It maps the agent's sensor ID back to our mock sensor data.
    // A real implementation would have a more robust mapping.
    // Let's assume sensorId 1 is 'SEN01', 2 is 'SEN02' etc. for STN001
    const sensorToUpdate = sensors.find(s => s.id === `SEN0${sensorId}`);
    if (sensorToUpdate) {
        // A simple update logic, could be more complex
        const key = Object.keys(reading)[0];
        if (key && typeof reading[key] === 'number') {
            sensorToUpdate.value = reading[key];
            sensorToUpdate.lastUpdate = new Date().toISOString();
        }
    } else {
        console.warn(`[DataService] Could not find sensor with mock ID mapping for agent ID: ${sensorId}`);
    }
}
