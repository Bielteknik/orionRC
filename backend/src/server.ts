import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import babel from '@babel/core';
import { initializeDatabase } from './database.ts';
import * as dataService from './dataService.ts';
import { DeviceConfig, SensorConfig, SensorStatus, ReadingPayload } from './types.ts';
import { GoogleGenAI } from '@google/genai';

// --- MAIN SETUP ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());


// --- On-the-fly TSX Transpilation Middleware ---
const projectRoot = path.join(__dirname, '..', '..');
const srcRoot = path.join(projectRoot, 'httpdocs');

// FIX: Use express.Request, express.Response, and express.NextFunction to avoid type conflicts with global DOM types.
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.endsWith('.tsx') || req.path.endsWith('.ts')) {
        const filePath = path.join(srcRoot, req.path);
        try {
            const source = fs.readFileSync(filePath, 'utf8');
            const result = await babel.transformAsync(source, {
                presets: ["@babel/preset-react", "@babel/preset-typescript"],
                filename: filePath
            });

            if (result?.code) {
                res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
                res.send(result.code);
            } else {
                next();
            }
        } catch (error) {
            console.error(`Babel Transpilation Error for ${req.path}:`, error);
            next(error);
        }
    } else {
        next();
    }
});

// --- STATIC FILE SERVING ---
app.use(express.static(srcRoot, {
    extensions: ['html', 'js', 'css', 'png', 'jpg', 'svg', 'ico'],
}));


// --- API ROUTES ---

app.post('/api/gemini-chat-stream', async (req: express.Request, res: express.Response) => {
    // ... (Gemini logic remains the same)
});

app.get('/api/config/:deviceId', async (req: express.Request, res: express.Response) => {
    const { deviceId } = req.params;
    console.log(`[Server] Yapılandırma isteği alındı: ${deviceId}`);
    
    try {
        const allSensors = await dataService.getAllSensors();
        const config: DeviceConfig = {
            sensors: allSensors.map(s => ({
                id: parseInt(s.id.replace('SEN','')), // Simple numeric ID for agent
                name: s.name,
                is_active: s.status === SensorStatus.Active, // Use enum for comparison
                interface: 'virtual', // Placeholder
                parser_config: { driver: 'mock' },
                config: {},
            }))
        };
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Sensör yapılandırması alınamadı.' });
    }
});

app.post('/api/submit-reading', async (req: express.Request, res: express.Response) => {
    const payload = req.body as ReadingPayload;
    // ... (logic remains the same)
});

// --- CRUD API for Frontend ---
app.get('/api/stations', async (req, res) => res.json(await dataService.getAllStations()));
app.get('/api/sensors', async (req, res) => res.json(await dataService.getAllSensors()));
app.get('/api/cameras', async (req, res) => res.json(await dataService.getAllCameras()));

app.post('/api/stations', async (req, res) => res.status(201).json(await dataService.createStation(req.body)));
app.post('/api/sensors', async (req, res) => res.status(201).json(await dataService.createSensor(req.body)));
app.post('/api/cameras', async (req, res) => res.status(201).json(await dataService.createCamera(req.body)));


// --- SPA Fallback ---
app.get('*', (req: express.Request, res: express.Response) => {
    const indexPath = path.join(srcRoot, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Ana sayfa dosyası bulunamadı.');
    }
});


// --- SERVER INITIALIZATION ---
async function startServer() {
    try {
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`[Server] Backend sunucusu http://localhost:${PORT} üzerinde çalışıyor`);
            console.log(`[Server] Ön yüz dosyaları şuradan sunuluyor: ${srcRoot}`);
        });

    } catch (error) {
        console.error("[Server] Sunucu BAŞLATILAMADI:", error);
        process.exit(1);
    }
}

startServer();