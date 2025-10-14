// backend/src/server.ts
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction, Router } from 'express';
import path from 'path';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { initializeDatabase, seedDatabase } from './database';
import * as dataService from './dataService';
import * as babel from '@babel/core';
import fs from 'fs/promises';

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

const projectRoot = path.resolve(__dirname, '..', '..');

// --- API Routes ---
const apiRouter = Router();

apiRouter.get('/stations', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const stations = await dataService.getStations();
        res.json(stations);
    } catch (error) {
        console.error("Failed to fetch stations:", error);
        res.status(500).json({ message: "Failed to fetch stations" });
    }
});

apiRouter.post('/stations', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const newStation = await dataService.createStation(req.body);
        res.status(201).json(newStation);
    } catch (error) {
        console.error("Failed to create station:", error);
        res.status(500).json({ message: 'Failed to create station' });
    }
});

apiRouter.delete('/stations/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await dataService.deleteStation(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete station:", error);
        res.status(500).json({ message: 'Failed to delete station' });
    }
});

apiRouter.get('/sensors', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const sensors = await dataService.getSensors();
        res.json(sensors);
    } catch (error) {
        console.error("Failed to fetch sensors:", error);
        res.status(500).json({ message: "Failed to fetch sensors" });
    }
});

apiRouter.post('/sensors', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const newSensor = await dataService.createSensor(req.body);
        res.status(201).json(newSensor);
    } catch (error) {
        console.error("Failed to create sensor:", error);
        res.status(500).json({ message: 'Failed to create sensor' });
    }
});

apiRouter.delete('/sensors/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await dataService.deleteSensor(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete sensor:", error);
        res.status(500).json({ message: 'Failed to delete sensor' });
    }
});

apiRouter.get('/cameras', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const cameras = await dataService.getCameras();
        res.json(cameras);
    } catch (error) {
        console.error("Failed to fetch cameras:", error);
        res.status(500).json({ message: "Failed to fetch cameras" });
    }
});

apiRouter.post('/cameras', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const newCamera = await dataService.createCamera(req.body);
        res.status(201).json(newCamera);
    } catch (error) {
        console.error("Failed to create camera:", error);
        res.status(500).json({ message: 'Failed to create camera' });
    }
});

apiRouter.delete('/cameras/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await dataService.deleteCamera(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete camera:", error);
        res.status(500).json({ message: 'Failed to delete camera' });
    }
});

apiRouter.get('/notifications', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const notifications = await dataService.getNotifications();
        res.json(notifications);
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
});


apiRouter.post('/gemini-chat-stream', async (req: ExpressRequest, res: ExpressResponse) => {
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

apiRouter.get('/config/:deviceId', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const config = await dataService.getDeviceConfig(req.params.deviceId);
        res.json(config);
    } catch (error) {
        console.error("Failed to get device config:", error);
        res.status(500).json({ message: "Failed to get device config" });
    }
});

apiRouter.post('/submit-reading', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await dataService.submitReading(req.body);
        res.status(200).json({ message: 'Data received' });
    } catch (error) {
        console.error("Failed to process reading:", error);
        res.status(500).json({ message: 'Failed to process reading' });
    }
});

// --- Static File Serving & SPA Fallback ---
// The order is important: API first, then specific file handlers, then general static, then fallback.

// 1. API Router: Handle all API calls before any file serving.
app.use('/api', apiRouter);

// 2. Handle .ts and .tsx file requests with on-the-fly Babel transpilation.
app.get(/\.(ts|tsx)$/, async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    const filePath = path.join(projectRoot, req.path);
    try {
        await fs.access(filePath); // Check if file exists
        
        const source = await fs.readFile(filePath, 'utf8');
        const result = await babel.transformAsync(source, {
            presets: [['@babel/preset-react', {runtime: 'automatic'}], '@babel/preset-typescript'],
            filename: filePath
        });

        if (result && result.code) {
            res.setHeader('Content-Type', 'application/javascript');
            res.send(result.code);
        } else {
            next();
        }
    } catch (error: unknown) {
        const isNodeError = (e: any): e is NodeJS.ErrnoException => 'code' in e;

        if (isNodeError(error) && error.code === 'ENOENT') {
            // File not found, let the next handler (static or SPA fallback) deal with it.
        } else {
            console.error(`Error processing ${filePath}:`, error);
        }
        next();
    }
});

// 3. Serve other static assets from the project root.
// This will handle .js, .css, images, and also serve index.html for the '/' route by default.
app.use(express.static(projectRoot));

// 4. SPA Fallback: For any GET request that hasn't been handled yet, serve index.html.
// This is crucial for client-side routing (e.g., refreshing on /stations).
app.get('*', (req: ExpressRequest, res: ExpressResponse) => {
    res.sendFile(path.join(projectRoot, 'index.html'));
});


// --- Server Initialization ---
async function startServer() {
    try {
        console.log('[Server] Initializing...');
        const db = await initializeDatabase();
        await seedDatabase(db);
        
        app.listen(PORT, () => {
            console.log(`[Server] 🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
        });
    } catch (error) {
        console.error('[Server] Sunucu başlatılamadı:', error);
        process.exit(1);
    }
}

startServer();