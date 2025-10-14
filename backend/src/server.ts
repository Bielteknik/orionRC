import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DeviceConfig } from './types';
import { MOCK_STATIONS_DATA, MOCK_SENSORS_DATA, MOCK_CAMERAS_DATA } from './mockData';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 8000;
const DEVICE_AUTH_TOKEN = process.env.DEVICE_AUTH_TOKEN || 'EjderMeteo_Rpi_SecretKey_2025!';

// --- Middlewares ---

// Enable Cross-Origin Resource Sharing
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Parse incoming JSON requests
app.use(express.json());

// Simple logging middleware
// FIX: Using fully qualified types to avoid resolution issues.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Simple token authentication middleware for devices
// FIX: Using fully qualified types to avoid resolution issues.
const authenticateDevice = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Token ${DEVICE_AUTH_TOKEN}`;

    if (!authHeader || authHeader !== expectedToken) {
        console.warn(`Authentication failed. Invalid token provided from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
};


// --- API Router Setup ---
// FIX: Using express.Router() to create a router instance.
const apiRouter = express.Router();
app.use('/api', apiRouter);


// --- API Routes ---

// API Health Check
// FIX: Using fully qualified types to avoid resolution issues.
apiRouter.get('/', (req: express.Request, res: express.Response) => {
    res.json({ status: 'API is running' });
});


// [Agent Endpoint] Get device configuration
// FIX: Using fully qualified types to avoid resolution issues.
apiRouter.get('/config/:deviceId', authenticateDevice, (req: express.Request, res: express.Response) => {
    const { deviceId } = req.params;
    console.log(`Configuration requested for device: ${deviceId}`);

    const mockConfig: DeviceConfig = {
        sensors: [
            {
                id: 1,
                name: "SHT3x Sıcaklık ve Nem Sensörü",
                is_active: true,
                interface: 'i2c',
                parser_config: {
                    driver: "sht3x"
                },
                config: {
                    address: "0x44",
                    bus: 1
                }
            },
        ]
    };

    res.json(mockConfig);
});

// [Agent Endpoint] Submit sensor readings
// FIX: Using fully qualified types to avoid resolution issues.
apiRouter.post('/submit-reading', authenticateDevice, (req: express.Request, res: express.Response) => {
    const reading = req.body;
    
    console.log('✅ Received sensor reading:', JSON.stringify(reading, null, 2));

    try {
        const { sensor: sensorId, value } = reading;
        if (sensorId === 1 && value && typeof value.temperature === 'number' && typeof value.humidity === 'number') {
            let stationIdToUpdate: string | null = null;

            const tempSensor = MOCK_SENSORS_DATA.find(s => s.id === 'S001');
            if (tempSensor) {
                tempSensor.value = value.temperature;
                tempSensor.lastUpdate = new Date().toISOString();
                stationIdToUpdate = tempSensor.stationId;
                console.log(`Updated Temperature Sensor (S001) to: ${tempSensor.value}°C`);
            }

            const humSensor = MOCK_SENSORS_DATA.find(s => s.id === 'S002');
            if (humSensor) {
                humSensor.value = value.humidity;
                humSensor.lastUpdate = new Date().toISOString();
                if (!stationIdToUpdate) stationIdToUpdate = humSensor.stationId;
                console.log(`Updated Humidity Sensor (S002) to: ${humSensor.value}%`);
            }
            
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

    res.status(204).send();
});


// [Frontend Endpoint] Get all stations
// FIX: Using fully qualified types to avoid resolution issues.
apiRouter.get('/stations', (req: express.Request, res: express.Response) => {
    res.json(MOCK_STATIONS_DATA);
});

// [Frontend Endpoint] Get all sensors
// FIX: Using fully qualified types to avoid resolution issues.
apiRouter.get('/sensors', (req: express.Request, res: express.Response) => {
    res.json(MOCK_SENSORS_DATA);
});

// [Frontend Endpoint] Get all cameras
// FIX: Using fully qualified types to avoid resolution issues.
apiRouter.get('/cameras', (req: express.Request, res: express.Response) => {
    res.json(MOCK_CAMERAS_DATA);
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
    if (!process.env.DEVICE_AUTH_TOKEN || process.env.DEVICE_AUTH_TOKEN === 'REPLACE_WITH_YOUR_SECURE_TOKEN') {
        console.warn(`⚠️  SECURITY WARNING: Using default DEVICE_AUTH_TOKEN. For production, set a strong secret in your .env file.`);
    }
});
