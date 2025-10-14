import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { initializeDatabase } from './database';
import * as dataService from './dataService';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(express.json());

// --- Gemini API Setup ---
// The API key MUST be obtained exclusively from the environment variable `process.env.API_KEY`.
if (!process.env.API_KEY) {
    console.error("FATAL ERROR: API_KEY environment variable is not set.");
    process.exit(1);
}
// FIX: Initialize GoogleGenAI with a named apiKey parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// --- API Routes ---

// GET /api/stations
app.get('/api/stations', async (req: Request, res: Response) => {
    try {
        const stations = await dataService.getAllStations();
        res.json(stations);
    } catch (error) {
        console.error("Error fetching stations:", error);
        res.status(500).json({ message: "İstasyon verileri alınırken bir sunucu hatası oluştu." });
    }
});

// GET /api/sensors
app.get('/api/sensors', async (req: Request, res: Response) => {
    try {
        const sensors = await dataService.getAllSensors();
        res.json(sensors);
    } catch (error) {
        console.error("Error fetching sensors:", error);
        res.status(500).json({ message: "Sensör verileri alınırken bir sunucu hatası oluştu." });
    }
});

// GET /api/cameras
app.get('/api/cameras', async (req: Request, res: Response) => {
    try {
        const cameras = await dataService.getAllCameras();
        res.json(cameras);
    } catch (error) {
        console.error("Error fetching cameras:", error);
        res.status(500).json({ message: "Kamera verileri alınırken bir sunucu hatası oluştu." });
    }
});

// POST /api/gemini-chat-stream
app.post('/api/gemini-chat-stream', async (req: Request, res: Response) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Mesaj içeriği boş olamaz.' });
    }

    try {
        // FIX: Use ai.models.generateContentStream for streaming responses.
        const streamingResponse = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: message,
        });
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        for await (const chunk of streamingResponse) {
            // FIX: Access the text directly from the chunk.
            if (chunk.text) {
                res.write(chunk.text);
            }
        }
        res.end();

    } catch (error) {
        console.error('Gemini API Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Yapay zeka asistanıyla iletişim kurulamadı.' });
        } else {
            res.end();
        }
    }
});


// --- Agent Routes ---

// GET /api/config/:deviceId
app.get('/api/config/:deviceId', async (req: Request, res: Response) => {
    try {
        const config = await dataService.getDeviceConfig(req.params.deviceId);
        res.json(config);
    } catch (error) {
        console.error(`Error getting config for device ${req.params.deviceId}:`, error);
        res.status(500).json({ message: "Cihaz yapılandırması alınamadı." });
    }
});

// POST /api/submit-reading
app.post('/api/submit-reading', async (req: Request, res: Response) => {
    try {
        const result = await dataService.saveSensorReading(req.body);
        res.status(200).json(result);
    } catch (error) {
        console.error("Error saving sensor reading:", error);
        res.status(500).json({ message: "Sensör verisi kaydedilemedi." });
    }
});

// --- Serve Frontend ---
// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, '..', '..', 'dist')));

// The "catchall" handler: for any request that doesn't match one above,
// send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
});


// --- Server Initialization ---
async function startServer() {
    try {
        console.log("Sunucu başlatılıyor...");
        await initializeDatabase();
        await dataService.seedDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
            console.log("Frontend build dosyaları sunuluyor. API endpointleri '/api' altında.");
        });
    } catch (error) {
        console.error("Sunucu başlatılamadı:", error);
        process.exit(1);
    }
}

startServer();
