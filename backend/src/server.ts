import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { initializeDatabase } from './database';
import * as dataService from './dataService';
import { DeviceConfig, ReadingPayload } from './types';

async function startServer() {
    try {
        console.log('[Server] Initializing database...');
        await initializeDatabase();
        console.log('[Server] Database initialized successfully.');

        const app = express();
        const port = process.env.PORT || 3001;

        // --- Middlewares ---
        app.use(cors());
        app.use(express.json());

        // --- Gemini AI Setup ---
        let ai: GoogleGenAI | null = null;
        if (process.env.API_KEY) {
            ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        } else {
            console.warn("[Server] API_KEY environment variable not found. Gemini Assistant will not work.");
        }

        // --- API Routes ---
        const apiRouter = express.Router();

        // Gemini Chat Stream Endpoint
        apiRouter.post('/gemini-chat-stream', async (req: express.Request, res: express.Response) => {
            if (!ai) {
                return res.status(500).json({ error: "API_KEY is not configured on the server." });
            }
            try {
                const { message } = req.body;
                if (!message) {
                    return res.status(400).json({ error: "Message is required." });
                }

                // FIX: systemInstruction should be inside a 'config' object.
                const result = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents: message,
                    config: {
                      systemInstruction: 'You are a helpful assistant for the ORION Observation Platform.'
                    }
                });

                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Transfer-Encoding', 'chunked');

                // FIX: Iterate over the result directly, not result.stream.
                // FIX: Access chunk.text as a property, not a function.
                for await (const chunk of result) {
                    res.write(chunk.text);
                }
                res.end();

            } catch (error) {
                console.error('[Gemini] Error streaming response:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to get response from Gemini API.' });
                } else {
                    res.end();
                }
            }
        });

        // Frontend Data Endpoints
        apiRouter.get('/stations', async (req: express.Request, res: express.Response) => {
            try {
                const stations = await dataService.getAllStations();
                res.json(stations);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch stations.' });
            }
        });

        // FIX: Add missing function to dataService and use it here
        apiRouter.post('/stations', async (req: express.Request, res: express.Response) => {
            try {
                const newStation = await dataService.createStation(req.body);
                res.status(201).json(newStation);
            } catch (error) {
                 console.error('[Server] Error creating station:', error);
                res.status(500).json({ message: 'Failed to create station.' });
            }
        });

        apiRouter.get('/sensors', async (req: express.Request, res: express.Response) => {
            try {
                const sensors = await dataService.getAllSensors();
                res.json(sensors);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch sensors.' });
            }
        });

        // FIX: Add missing function to dataService and use it here
        apiRouter.post('/sensors', async (req: express.Request, res: express.Response) => {
            try {
                const newSensor = await dataService.createSensor(req.body);
                res.status(201).json(newSensor);
            } catch (error) {
                 console.error('[Server] Error creating sensor:', error);
                res.status(500).json({ message: 'Failed to create sensor.' });
            }
        });

        apiRouter.get('/cameras', async (req: express.Request, res: express.Response) => {
            try {
                const cameras = await dataService.getAllCameras();
                res.json(cameras);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch cameras.' });
            }
        });
        
        // FIX: Add missing function to dataService and use it here
        apiRouter.post('/cameras', async (req: express.Request, res: express.Response) => {
            try {
                const newCamera = await dataService.createCamera(req.body);
                res.status(201).json(newCamera);
            } catch (error) {
                 console.error('[Server] Error creating camera:', error);
                res.status(500).json({ message: 'Failed to create camera.' });
            }
        });


        // Raspberry Pi Agent Endpoints
        apiRouter.get('/config/:deviceId', async (req: express.Request, res: express.Response) => {
            console.log(`[Server] Config requested for device: ${req.params.deviceId}`);
            // In a real app, you'd fetch this from the DB based on deviceId.
            // For now, we fetch ALL sensors and create a config.
             try {
                const allSensors = await dataService.getAllSensors();
                const deviceConfig: DeviceConfig = {
                    sensors: allSensors.map(s => ({
                        id: parseInt(s.id.replace(/\D/g, ''), 10), // Convert 'SEN01' to 1
                        name: s.name,
                        is_active: s.status === 'Aktif',
                        interface: 'i2c', // This should come from DB in the future
                        parser_config: { driver: 'sht3x' }, // This should come from DB in the future
                        config: { address: '0x44', bus: 1 } // This should come from DB in the future
                    }))
                };
                res.json(deviceConfig);
            } catch (error) {
                console.error('[Server] Error generating device config:', error);
                res.status(500).json({ message: 'Failed to generate device config.' });
            }
        });

        apiRouter.post('/submit-reading', async (req: express.Request, res: express.Response) => {
            try {
                const { sensor, value } = req.body as ReadingPayload;
                console.log(`[Server] Received reading for sensor ${sensor}:`, value);
                if (typeof sensor === 'undefined' || typeof value === 'undefined') {
                    return res.status(400).json({ message: 'Invalid payload. "sensor" and "value" are required.' });
                }
                await dataService.updateSensorReading(sensor, value);
                res.status(200).json({ message: 'Reading received.' });
            } catch (error) {
                console.error('[Server] Error processing sensor reading:', error);
                res.status(500).json({ message: 'Failed to process sensor reading.' });
            }
        });

        // Use the API router for all /api paths
        app.use('/api', apiRouter);

        // --- Frontend Serving ---
        // This must be after API routes
        const httpdocsPath = path.join(__dirname, '..', '..', 'httpdocs');
        
        // Serve static files from the httpdocs directory
        app.use(express.static(httpdocsPath));
        
        // On-the-fly TSX/TS transpilation middleware
        // FIX: Explicitly type req, res, next to avoid type conflicts with global fetch types.
        app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const filePath = path.join(httpdocsPath, req.path);
            if (req.path.endsWith('.tsx') || req.path.endsWith('.ts')) {
                try {
                    const babel = require('@babel/core');
                    const fs = require('fs').promises;
                    const code = await fs.readFile(filePath, 'utf-8');
                    const result = await babel.transformAsync(code, {
                        filename: req.path,
                        presets: ['@babel/preset-react', '@babel/preset-typescript'],
                    });
                    if (result?.code) {
                        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
                        res.send(result.code);
                    } else {
                        next();
                    }
                } catch (err) {
                    console.error(`Babel compilation error for ${req.path}:`, err);
                    next(err);
                }
            } else {
                next();
            }
        });


        // SPA Fallback: For any other GET request, serve index.html
        // FIX: Explicitly type req, res to avoid type conflicts.
        app.get('*', (req: express.Request, res: express.Response) => {
            res.sendFile(path.join(httpdocsPath, 'index.html'));
        });

        app.listen(port, () => {
            console.log(`[Server] Backend server running at http://localhost:${port}`);
        });

    } catch (error) {
        console.error('[Server] FAILED TO START SERVER:', error);
        process.exit(1);
    }
}

startServer();
