// Corrected Express import to properly resolve types and avoid conflicts.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { DeviceConfig } from './types';
import { MOCK_STATIONS_DATA, MOCK_SENSORS_DATA, MOCK_CAMERAS_DATA } from './mockData';
import { transformFileAsync } from '@babel/core';
import { GoogleGenAI, Chat } from "@google/genai";

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 8000;
const DEVICE_AUTH_TOKEN = process.env.DEVICE_AUTH_TOKEN || 'EjderMeteo_Rpi_SecretKey_2025!';
const GEMINI_API_KEY = process.env.API_KEY;

// --- Middlewares ---

// Enable Cross-Origin Resource Sharing
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Parse incoming JSON requests
app.use(express.json());

// Simple logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Simple token authentication middleware for devices
const authenticateDevice = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Token ${DEVICE_AUTH_TOKEN}`;

    if (!authHeader || authHeader !== expectedToken) {
        console.warn(`Authentication failed. Invalid token provided from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
};


// --- API Router Setup ---
const apiRouter = express.Router();
app.use('/api', apiRouter);


// --- API Routes ---

// API Health Check
apiRouter.get('/', (req: Request, res: Response) => {
    res.json({ status: 'API is running' });
});


// [Agent Endpoint] Get device configuration
apiRouter.get('/config/:deviceId', authenticateDevice, (req: Request, res: Response) => {
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
apiRouter.post('/submit-reading', authenticateDevice, (req: Request, res: Response) => {
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
apiRouter.get('/stations', (req: Request, res: Response) => {
    res.json(MOCK_STATIONS_DATA);
});

// [Frontend Endpoint] Get all sensors
apiRouter.get('/sensors', (req: Request, res: Response) => {
    res.json(MOCK_SENSORS_DATA);
});

// [Frontend Endpoint] Get all cameras
apiRouter.get('/cameras', (req: Request, res: Response) => {
    res.json(MOCK_CAMERAS_DATA);
});

// [Frontend Endpoint] Gemini Chat Proxy
let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;
if (GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const SYSTEM_INSTRUCTION = "Sen ORION platformu için geliştirilmiş, dünya standartlarında bir meteoroloji asistanısın. Kullanıcı sorularını açık ve öz bir şekilde yanıtla. Hava olaylarını açıklayabilir, sensör okumalarını yorumlayabilir ve trendlere göre tahminlerde bulunabilirsin. Cevaplarını her zaman Türkçe ver.";
    chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
    });
} else {
    console.warn('⚠️ GEMINI_API_KEY not set. Gemini Assistant will be disabled.');
}

apiRouter.post('/gemini-chat-stream', async (req: Request, res: Response) => {
    if (!chat) {
        return res.status(503).json({ error: 'Gemini assistant is not configured on the server.' });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    try {
        const stream = await chat.sendMessageStream({ message });
        
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        for await (const chunk of stream) {
            res.write(chunk.text);
        }
        res.end();

    } catch (error) {
        console.error('Error streaming from Gemini:', error);
        res.status(500).json({ error: 'Failed to get response from assistant.' });
    }
});


// --- Frontend Serving ---
const httpdocsPath = path.join(__dirname, '..', '..', 'httpdocs');

// Middleware to transpile TS/TSX files on the fly
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const filePath = path.join(httpdocsPath, req.path);

  // Try to resolve extensionless paths
  const possiblePaths = [
      filePath,
      `${filePath}.ts`,
      `${filePath}.tsx`,
  ];
  
  let actualPath: string | null = null;

  for (const p of possiblePaths) {
      try {
          await fs.access(p, fs.constants.F_OK);
          actualPath = p;
          break;
      } catch (e) {
          // File doesn't exist, try next
      }
  }

  if (actualPath && (actualPath.endsWith('.tsx') || actualPath.endsWith('.ts'))) {
    try {
      const result = await transformFileAsync(actualPath, {
        presets: [
          '@babel/preset-react', 
          ['@babel/preset-typescript', { allowDeclareFields: true, allExtensions: true, isTSX: true }]
        ],
        filename: actualPath, // Important for babel to know how to parse
        sourceMaps: 'inline'
      });

      if (result?.code) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(result.code);
      } else {
        res.sendStatus(500);
      }
    } catch (err: any) {
      console.error(`Babel transformation error for ${req.path}:\n`, err);
      res.status(500).send(`<pre>Error transforming ${req.path}:\n${err.message}</pre>`);
    }
  } else {
    next();
  }
});

// Serve other static files (images, css, etc.) from the httpdocs directory
app.use(express.static(httpdocsPath));

// For any other request that doesn't match an API route or a static file,
// serve the index.html file to support client-side routing.
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(httpdocsPath, 'index.html'));
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
    if (!process.env.DEVICE_AUTH_TOKEN || process.env.DEVICE_AUTH_TOKEN === 'REPLACE_WITH_YOUR_SECURE_TOKEN') {
        console.warn(`⚠️  SECURITY WARNING: Using default DEVICE_AUTH_TOKEN. For production, set a strong secret in your .env file.`);
    }
});
