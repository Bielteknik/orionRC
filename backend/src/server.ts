import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DeviceConfig } from './types';
import { MOCK_STATIONS_DATA, MOCK_SENSORS_DATA, MOCK_CAMERAS_DATA } from './mockData';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// --- Middlewares ---

// Enable Cross-Origin Resource Sharing
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Parse incoming JSON requests
app.use(express.json());

// Simple logging middleware
// FIX: Explicitly added types to the middleware function parameters to resolve overload ambiguity.
// FIX: Changed to use express.Request, express.Response, express.NextFunction to avoid type conflicts with global types.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Simple token authentication middleware for devices
const authenticateDevice = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Token ${process.env.DEVICE_AUTH_TOKEN}`;

    if (!authHeader || authHeader !== expectedToken) {
        console.warn(`Authentication failed. Invalid token provided from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
};


// --- API Routes ---

// [Agent Endpoint] Get device configuration
app.get('/api/v3/device/:deviceId/config/', authenticateDevice, (req: express.Request, res: express.Response) => {
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
app.post('/api/v3/readings/submit/', authenticateDevice, (req: express.Request, res: express.Response) => {
    const reading = req.body;
    
    // In a real application, you would validate this data and save it to a database.
    // For now, we just log it to the console to confirm it's working.
    console.log('✅ Received sensor reading:', JSON.stringify(reading, null, 2));

    res.status(204).send(); // 204 No Content is a good response for "I received it, thanks"
});


// [Frontend Endpoint] Get all stations
app.get('/api/v3/stations', (req: express.Request, res: express.Response) => {
    res.json(MOCK_STATIONS_DATA);
});

// [Frontend Endpoint] Get all sensors
app.get('/api/v3/sensors', (req: express.Request, res: express.Response) => {
    res.json(MOCK_SENSORS_DATA);
});

// [Frontend Endpoint] Get all cameras
app.get('/api/v3/cameras', (req: express.Request, res: express.Response) => {
    res.json(MOCK_CAMERAS_DATA);
});


// --- Root Route for Health Check ---
// FIX: Explicitly added types to the route handler parameters for type safety and consistency.
app.get('/', (req: express.Request, res: express.Response) => {
    res.send('<h1>Meteoroloji Platformu Backend</h1><p>API is running.</p>');
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
    if (!process.env.DEVICE_AUTH_TOKEN || process.env.DEVICE_AUTH_TOKEN === 'REPLACE_WITH_YOUR_SECURE_TOKEN') {
        console.warn('⚠️  SECURITY WARNING: DEVICE_AUTH_TOKEN is not set or is set to the default value. Please set a strong secret in your .env file.');
    }
});