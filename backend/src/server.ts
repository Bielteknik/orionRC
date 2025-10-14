// backend/src/server.ts
// Fix: Removed named imports for Request, Response, NextFunction to avoid conflicts with global DOM/Fetch types.
import express from 'express';
import path from 'path';
import 'dotenv/config';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { initializeDatabase } from './database';
import * as dataService from './dataService';

const app = express();
const PORT = process.env.PORT || 3001;

let ai: GoogleGenAI | null = null;
if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Gemini Assistant will not work.");
} else {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// --- Middleware ---
app.use(express.json());

// Custom middleware for on-the-fly TSX/TS transpilation
const babel = require('@babel/core');
const fs = require('fs/promises');

// Fix: Used express.Request, express.Response, and express.NextFunction to specify Express types and resolve conflicts.
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.endsWith('.tsx') || req.path.endsWith('.ts')) {
        try {
            const filePath = path.join(__dirname, '..', '..', 'httpdocs', req.path);
            const source = await fs.readFile(filePath, 'utf8');
            const result = await babel.transformAsync(source, {
                presets: ['@babel/preset-react', '@babel/preset-typescript'],
                filename: req.path // Important for presets to work correctly
            });
            if (result && result.code) {
                res.setHeader('Content-Type', 'application/javascript');
                res.send(result.code);
            } else {
                next();
            }
        } catch (error) {
            console.error(`Babel transpilation error for ${req.path}:`, error);
            next(error);
        }
    } else {
        next();
    }
});

// Serve static files from the httpdocs directory
const httpdocsPath = path.join(__dirname, '..', '..', 'httpdocs');
app.use(express.static(httpdocsPath, {
    extensions: ['html', 'htm', 'tsx', 'ts'],
    setHeaders: (res, filePath) => {
        if (path.extname(filePath) === '.tsx' || path.extname(filePath) === '.ts') {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));


// --- API Routes ---
const apiRouter = express.Router();

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.get('/stations', async (req: express.Request, res: express.Response) => {
    try {
        const stations = await dataService.getStations();
        res.json(stations);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch stations" });
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.post('/stations', async (req: express.Request, res: express.Response) => {
    try {
        await dataService.createStation(req.body);
        res.status(201).json({ message: 'Station created' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create station' });
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.get('/sensors', async (req: express.Request, res: express.Response) => {
    try {
        const sensors = await dataService.getSensors();
        res.json(sensors);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch sensors" });
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.post('/sensors', async (req: express.Request, res: express.Response) => {
    try {
        await dataService.createSensor(req.body);
        res.status(201).json({ message: 'Sensor created' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create sensor' });
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.get('/cameras', async (req: express.Request, res: express.Response) => {
    try {
        const cameras = await dataService.getCameras();
        res.json(cameras);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch cameras" });
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.post('/cameras', async (req: express.Request, res: express.Response) => {
    try {
        await dataService.createCamera(req.body);
        res.status(201).json({ message: 'Camera created' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create camera' });
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.post('/gemini-chat-stream', async (req: express.Request, res: express.Response) => {
    if (!ai) return res.status(500).json({ error: 'API_KEY not configured.' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
                systemInstruction: 'You are a helpful assistant for the ORION meteorological platform.',
            }
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        for await (const chunk of result) {
            res.write(chunk.text);
        }
        res.end();
    } catch (error) {
        console.error('Error streaming from Gemini:', error);
        if (!res.headersSent) res.status(500).json({ error: 'AI assistant error.' });
        else res.end();
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.get('/config/:deviceId', async (req: express.Request, res: express.Response) => {
    try {
        const config = await dataService.getDeviceConfig(req.params.deviceId);
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: "Failed to get device config" });
    }
});

// Fix: Used express.Request and express.Response for all route handlers.
apiRouter.post('/submit-reading', async (req: express.Request, res: express.Response) => {
    try {
        await dataService.submitReading(req.body);
        res.status(200).json({ message: 'Data received' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to process reading' });
    }
});

app.use('/api', apiRouter);

// --- Serve React App for all non-API routes ---
// Fix: Used express.Request and express.Response for all route handlers.
app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(httpdocsPath, 'index.html'));
});

// --- Server Initialization ---
async function startServer() {
    try {
        console.log('[Server] Initializing...');
        await initializeDatabase();
        // The call to populateDatabaseWithMockData() has been removed.
        
        app.listen(PORT, () => {
            console.log(`[Server] 🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
        });
    } catch (error) {
        console.error('[Server] Sunucu başlatılamadı:', error);
        process.exit(1);
    }
}

startServer();
