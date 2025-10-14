import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DeviceConfig } from './types';
import { MOCK_STATIONS_DATA, MOCK_SENSORS_DATA, MOCK_CAMERAS_DATA } from './mockData';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 8000;
const DEVICE_AUTH_TOKEN = process.env.DEVICE_AUTH_TOKEN || 'SECRET_AGENT_TOKEN_123';

// --- Middlewares ---

// Enable Cross-Origin Resource Sharing
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Parse incoming JSON requests
app.use(express.json());

// Simple logging middleware
// FIX: Explicitly added types to the middleware function parameters to resolve overload ambiguity and allow access to properties like `method` and `path`.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Simple token authentication middleware for devices
// FIX: Added explicit types to middleware parameters to resolve type errors on `req.headers`, `req.ip`, `res.status`, and `res.json`.
const authenticateDevice = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Token ${DEVICE_AUTH_TOKEN}`;

    if (!authHeader || authHeader !== expectedToken) {
        console.warn(`Authentication failed. Invalid token provided from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
};


// --- API Routes ---

// [Agent Endpoint] Get device configuration
// FIX: Added explicit types to route handler parameters to resolve type errors on `req.params` and `res.json`.
app.get('/device/:deviceId/config/', authenticateDevice, (req: express.Request, res: express.Response) => {
    const { deviceId } = req.params;
    console.log(`Configuration requested for device: ${deviceId}`);

    // --- MOCK CONFIGURATION ---
    // This is the configuration your Raspberry Pi will receive.
    // It tells the agent which sensors to read and how to read them.
    const mockConfig: DeviceConfig = {
        sensors: [
            {
                id: 1,
                name: "SHT3x Sıcaklık ve Nem Sensörü",
                is_active: true,
                interface: 'i2c',
                parser_config: {
                    driver: "sht3x" // This must match the driver filename on the Pi (sht3x.driver.ts)
                },
                config: {
                    address: "0x44", // Default address for SHT3x
                    bus: 1           // Default I2C bus on Raspberry Pi
                }
            },
            // You can add more sensor configurations here later
            // {
            //     id: 2,
            //     name: "DFRobot Lidar Sensör",
            //     is_active: false, // Disabled for now
            //     interface: 'serial',
            //     parser_config: {
            //         driver: "dfrobot_ult"
            //     },
            //     config: {
            //         port: "/dev/ttyUSB0",
            //         baudrate: 115200
            //     }
            // }
        ]
    };

    res.json(mockConfig);
});

// [Agent Endpoint] Submit sensor readings
// FIX: Added explicit types to route handler parameters to resolve type errors on `req.body` and `res.status`.
app.post('/readings/submit/', authenticateDevice, (req: express.Request, res: express.Response) => {
    const reading = req.body;
    
    console.log('✅ Received sensor reading:', JSON.stringify(reading, null, 2));

    // --- DYNAMIC DATA UPDATE LOGIC ---
    try {
        const { sensor: sensorId, value } = reading;

        // The agent sends sensor ID `1` for the SHT3x, which provides both temperature and humidity.
        // We need to map this single reading to our two separate mock sensors.
        if (sensorId === 1 && value && typeof value.temperature === 'number' && typeof value.humidity === 'number') {
            let stationIdToUpdate: string | null = null;

            // Find and update the temperature sensor (hardcoded ID 'S001' for this demo)
            const tempSensor = MOCK_SENSORS_DATA.find(s => s.id === 'S001');
            if (tempSensor) {
                tempSensor.value = value.temperature;
                tempSensor.lastUpdate = new Date().toISOString();
                stationIdToUpdate = tempSensor.stationId;
                console.log(`Updated Temperature Sensor (S001) to: ${tempSensor.value}°C`);
            }

            // Find and update the humidity sensor (hardcoded ID 'S002' for this demo)
            const humSensor = MOCK_SENSORS_DATA.find(s => s.id === 'S002');
            if (humSensor) {
                humSensor.value = value.humidity;
                humSensor.lastUpdate = new Date().toISOString();
                if (!stationIdToUpdate) stationIdToUpdate = humSensor.stationId; // Fallback
                console.log(`Updated Humidity Sensor (S002) to: ${humSensor.value}%`);
            }
            
            // Also update the station's lastUpdate time
            if (stationIdToUpdate) {
                const station = MOCK_STATIONS_DATA.find(st => st.id === stationIdToUpdate);
                if(station) {
                    station.lastUpdate = new Date().toISOString();
                }
            }
        }
    } catch (e) {
        console.error("Error processing incoming reading:", e);
    }
    // --- END DYNAMIC DATA UPDATE ---


    res.status(204).send(); // 204 No Content is a good response for "I received it, thanks"
});


// [Frontend Endpoint] Get all stations
// FIX: Added explicit types to route handler parameters to resolve type error on `res.json`.
app.get('/stations', (req: express.Request, res: express.Response) => {
    res.json(MOCK_STATIONS_DATA);
});

// [Frontend Endpoint] Get all sensors
// FIX: Added explicit types to route handler parameters to resolve type error on `res.json`.
app.get('/sensors', (req: express.Request, res: express.Response) => {
    res.json(MOCK_SENSORS_DATA);
});

// [Frontend Endpoint] Get all cameras
// FIX: Added explicit types to route handler parameters to resolve type error on `res.json`.
app.get('/cameras', (req: express.Request, res: express.Response) => {
    res.json(MOCK_CAMERAS_DATA);
});


// --- Root Route for Health Check ---
// FIX: Added explicit types to the route handler parameters to resolve type error on `res.send`.
app.get('/', (req: express.Request, res: express.Response) => {
    res.send('<h1>Meteoroloji Platformu Backend</h1><p>API is running.</p>');
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
    if (!process.env.DEVICE_AUTH_TOKEN || process.env.DEVICE_AUTH_TOKEN === 'REPLACE_WITH_YOUR_SECURE_TOKEN') {
        console.warn(`⚠️  SECURITY WARNING: Using default DEVICE_AUTH_TOKEN. For production, set a strong secret in your .env file.`);
    }
});
