// backend/src/server.ts
// Fix: Use standard Request and Response types from express to avoid type conflicts.
import express, { Request, Response, NextFunction } from 'express';
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

// Projenin ana dizinini doğru bir şekilde bul
const projectRoot = path.resolve(__dirname, '..', '..');

// --- API Yönlendiricisi ---
const apiRouter = express.Router();

apiRouter.get('/stations', async (req: Request, res: Response) => {
    try {
        const stations = await dataService.getStations();
        res.json(stations);
    } catch (error) {
        console.error("Failed to fetch stations:", error);
        res.status(500).json({ message: "İstasyonlar alınamadı." });
    }
});

apiRouter.post('/stations', async (req: Request, res: Response) => {
    try {
        const newStation = await dataService.createStation(req.body);
        res.status(201).json(newStation);
    } catch (error) {
        console.error("Failed to create station:", error);
        res.status(500).json({ message: 'İstasyon oluşturulamadı.' });
    }
});

apiRouter.delete('/stations/:id', async (req: Request, res: Response) => {
    try {
        await dataService.deleteStation(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete station:", error);
        res.status(500).json({ message: 'İstasyon silinemedi.' });
    }
});

apiRouter.get('/sensors', async (req: Request, res: Response) => {
    try {
        const sensors = await dataService.getSensors();
        res.json(sensors);
    } catch (error) {
        console.error("Failed to fetch sensors:", error);
        res.status(500).json({ message: "Sensörler alınamadı." });
    }
});

apiRouter.post('/sensors', async (req: Request, res: Response) => {
    try {
        const newSensor = await dataService.createSensor(req.body);
        res.status(201).json(newSensor);
    } catch (error) {
        console.error("Failed to create sensor:", error);
        res.status(500).json({ message: 'Sensör oluşturulamadı.' });
    }
});

apiRouter.delete('/sensors/:id', async (req: Request, res: Response) => {
    try {
        await dataService.deleteSensor(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete sensor:", error);
        res.status(500).json({ message: 'Sensör silinemedi.' });
    }
});

apiRouter.get('/cameras', async (req: Request, res: Response) => {
    try {
        const cameras = await dataService.getCameras();
        res.json(cameras);
    } catch (error) {
        console.error("Failed to fetch cameras:", error);
        res.status(500).json({ message: "Kameralar alınamadı." });
    }
});

apiRouter.post('/cameras', async (req: Request, res: Response) => {
    try {
        const newCamera = await dataService.createCamera(req.body);
        res.status(201).json(newCamera);
    } catch (error) {
        console.error("Failed to create camera:", error);
        res.status(500).json({ message: 'Kamera oluşturulamadı.' });
    }
});

apiRouter.delete('/cameras/:id', async (req: Request, res: Response) => {
    try {
        await dataService.deleteCamera(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete camera:", error);
        res.status(500).json({ message: 'Kamera silinemedi.' });
    }
});

apiRouter.get('/notifications', async (req: Request, res: Response) => {
    try {
        const notifications = await dataService.getNotifications();
        res.json(notifications);
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        res.status(500).json({ message: "Bildirimler alınamadı." });
    }
});

apiRouter.post('/gemini-chat-stream', async (req: Request, res: Response) => {
    if (!ai) return res.status(500).json({ error: 'API_KEY ayarlanmamış.' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mesaj gerekli.' });

    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
                systemInstruction: 'Sen ORION meteoroloji platformu için yardımcı bir asistansın.',
            }
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        for await (const chunk of result) {
            res.write(chunk.text);
        }
        res.end();
    } catch (error) {
        console.error('Gemini akış hatası:', error);
        res.status(500).end();
    }
});

apiRouter.get('/config/:deviceId', async (req: Request, res: Response) => {
    try {
        const config = await dataService.getDeviceConfig(req.params.deviceId);
        res.json(config);
    } catch (error) {
        console.error("Cihaz yapılandırması alınamadı:", error);
        res.status(500).json({ message: "Cihaz yapılandırması alınamadı" });
    }
});

apiRouter.post('/submit-reading', async (req: Request, res: Response) => {
    try {
        await dataService.submitReading(req.body);
        res.status(200).json({ message: 'Veri alındı' });
    } catch (error) {
        console.error("Okuma işlenemedi:", error);
        res.status(500).json({ message: 'Okuma işlenemedi' });
    }
});

// --- Sunucu Yapılandırması ve Başlatma ---

// 1. ADIM: Tüm API isteklerini `/api` altında topla
app.use('/api', apiRouter);

// 2. ADIM: `.tsx` dosyalarını anlık olarak derle
app.get('*.tsx', async (req: Request, res: Response, next: NextFunction) => {
    const filePath = path.join(projectRoot, req.path);
    try {
        const source = await fs.readFile(filePath, 'utf-8');
        const result = await babel.transformAsync(source, {
            presets: [['@babel/preset-react', { runtime: 'automatic' }], '@babel/preset-typescript'],
            filename: filePath,
        });
        if (result?.code) {
            res.type('application/javascript').send(result.code);
        } else {
            next();
        }
    } catch (error) {
        next();
    }
});

// 3. ADIM: Geriye kalan tüm statik dosyaları (`.html`, `.css`, resimler vb.) sun
app.use(express.static(projectRoot));

// 4. ADIM: Hiçbir kurala uymayan istekleri SPA'nın çalışması için `index.html`'e yönlendir
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(projectRoot, 'index.html'));
});

async function startServer() {
    try {
        console.log('[Server] Veritabanı başlatılıyor...');
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
