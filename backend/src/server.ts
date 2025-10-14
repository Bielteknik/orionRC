// backend/src/server.ts
import express from 'express';
import path from 'path';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { initializeDatabase, seedDatabase, getDb } from './database';
import * as dataService from './dataService';
import babel from '@babel/core';
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
const apiRouter = express.Router();

apiRouter.get('/stations', async (req, res) => {
    try {
        const stations = await dataService.getStations();
        res.json(stations);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch stations" });
    }
});

apiRouter.post('/stations', async (req, res) => {
    try {
        const newStation = await dataService.createStation(req.body);
        res.status(201).json(newStation);
    } catch (error) {
        console.error("Failed to create station:", error);
        res.status(500).json({ message: 'Failed to create station' });
    }
});

apiRouter.delete('/stations/:id', async (req, res) => {
    try {
        await dataService.deleteStation(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete station:", error);
        res.status(500).json({ message: 'Failed to delete station' });
    }
});

apiRouter.get('/sensors', async (req, res) => {
    try {
        const sensors = await dataService.getSensors();
        res.json(sensors);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch sensors" });
    }
});

apiRouter.post('/sensors', async (req, res) => {
    try {
        const newSensor = await dataService.createSensor(req.body);
        res.status(201).json(newSensor);
    } catch (error) {
        console.error("Failed to create sensor:", error);
        res.status(500).json({ message: 'Failed to create sensor' });
    }
});

apiRouter.delete('/sensors/:id', async (req, res) => {
    try {
        await dataService.deleteSensor(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete sensor:", error);
        res.status(500).json({ message: 'Failed to delete sensor' });
    }
});

apiRouter.get('/cameras', async (req, res) => {
    try {
        const cameras = await dataService.getCameras();
        res.json(cameras);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch cameras" });
    }
});

apiRouter.post('/cameras', async (req, res) => {
    try {
        const newCamera = await dataService.createCamera(req.body);
        res.status(201).json(newCamera);
    } catch (error) {
        console.error("Failed to create camera:", error);
        res.status(500).json({ message: 'Failed to create camera' });
    }
});

apiRouter.delete('/cameras/:id', async (req, res) => {
    try {
        await dataService.deleteCamera(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete camera:", error);
        res.status(500).json({ message: 'Failed to delete camera' });
    }
});

apiRouter.get('/notifications', async (req, res) => {
    try {
        const notifications = await dataService.getNotifications();
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
});


apiRouter.post('/gemini-chat-stream', async (req, res) => {
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

apiRouter.get('/config/:deviceId', async (req, res) => {
    try {
        const config = await dataService.getDeviceConfig(req.params.deviceId);
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: "Failed to get device config" });
    }
});

apiRouter.post('/submit-reading', async (req, res) => {
    try {
        await dataService.submitReading(req.body);
        res.status(200).json({ message: 'Data received' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to process reading' });
    }
});

app.use('/api', apiRouter);


// --- Smart Static File + Transpilation Middleware ---
// 1. Serve static files like .js, .css from the root using express.static
// 2. A custom middleware handles on-the-fly .ts/.tsx transpilation.
// 3. A fallback route serves index.html for any other GET request (SPA behavior).

// Serve all static assets from the project root, but defer index.html to the SPA fallback
app.use(express.static(projectRoot, { index: false }));

// Handle .ts and .tsx file requests with Babel transpilation
app.get(/\.(ts|tsx)$/, async (req, res, next) => {
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
    } catch (error) {
        // Log transpilation errors, but for file not found, just pass to next handler
        if (error.code !== 'ENOENT') {
             console.error(`Error processing ${filePath}:`, error);
        }
        next();
    }
});


// --- SPA Fallback ---
// For any GET request that hasn't been handled yet, serve the main index.html file.
app.get('*', (req, res) => {
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