import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { getAllStations, getAllSensors, getAllCameras, updateSensorReading } from './dataService';
import { DeviceConfig, ReadingPayload } from './types';

// This is a mock backend server. In a real application, you'd use a proper logger,
// error handling middleware, and connect to a persistent database.

// Ensure the Gemini API key is available.
if (!process.env.API_KEY) {
    // In a real app, this would be a fatal error, but for this context we log it.
    console.error("CRITICAL: API_KEY environment variable not set. Gemini assistant will not work.");
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Frontend API Endpoints ---

app.get('/api/stations', async (req, res) => {
    try {
        const stations = await getAllStations();
        res.json(stations);
    } catch (e) {
        console.error("Error fetching stations:", e);
        res.status(500).json({ error: "Failed to fetch stations" });
    }
});

app.get('/api/sensors', async (req, res) => {
    try {
        const sensors = await getAllSensors();
        res.json(sensors);
    } catch (e) {
        console.error("Error fetching sensors:", e);
        res.status(500).json({ error: "Failed to fetch sensors" });
    }
});

app.get('/api/cameras', async (req, res) => {
    try {
        const cameras = await getAllCameras();
        res.json(cameras);
    } catch (e) {
        console.error("Error fetching cameras:", e);
        res.status(500).json({ error: "Failed to fetch cameras" });
    }
});

// --- Gemini Chat Stream Endpoint ---

// Initialize Gemini AI client only if the API key is present.
const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

app.post('/api/gemini-chat-stream', async (req, res) => {
    if (!ai) {
        return res.status(500).json({ error: 'AI Assistant is not configured on the server.' });
    }
    
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // Correctly call generateContentStream as per the guidelines
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: message,
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Stream the response chunks to the client
        for await (const chunk of responseStream) {
            // Ensure text exists before writing
            if (chunk.text) {
                res.write(chunk.text);
            }
        }
        res.end();

    } catch (error) {
        console.error('Error streaming from Gemini:', error);
        res.status(500).json({ error: 'Failed to get response from AI assistant.' });
    }
});


// --- Raspberry Pi Agent Endpoints ---

// Mock device config for the agent. In a real system, this would come from a database.
const MOCK_DEVICE_CONFIG: DeviceConfig = {
    sensors: [
        {
            id: 1, // Corresponds to SEN01
            name: "SHT3x Sıcaklık/Nem Sensörü (Merkez)",
            is_active: true,
            interface: 'i2c',
            parser_config: { driver: "sht3x" },
            config: { address: "0x44", bus: 1 }
        },
        {
            id: 12, // Corresponds to SEN12
            name: "DFRobot Lidar (Kar Kalınlığı)",
            is_active: true,
            interface: 'serial',
            parser_config: { driver: "dfrobot_ult" },
            config: { port: "/dev/ttyUSB0", baudrate: 115200 }
        },
        {
            id: 99, // Corresponds to SEN99
            name: "HX711 Yük Hücresi (Depo)",
            is_active: false,
            interface: 'serial',
            parser_config: { driver: "hx711_load_cell" },
            config: { port: "/dev/ttyAMA0", baudrate: 9600 }
        }
    ]
};

app.get('/api/config/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    console.log(`[API] Configuration requested for device: ${deviceId}`);
    // In a real app, you would look up the config for the specific deviceId
    res.json(MOCK_DEVICE_CONFIG);
});

app.post('/api/submit-reading', async (req, res) => {
    try {
        const reading = req.body as ReadingPayload;
        console.log(`[API] Received reading:`, JSON.stringify(reading));
        // In a real app, you would validate and store this reading.
        // For this mock, we'll try to update the in-memory database value.
        await updateSensorReading(reading.sensor, reading.value);
        res.status(200).json({ status: 'success', message: 'Reading received and processed' });
    } catch (error) {
        console.error('[API] Error processing reading:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process reading' });
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
