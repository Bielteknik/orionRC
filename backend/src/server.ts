import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Make sure to have dotenv installed and a .env file with API_KEY
import { GoogleGenAI } from '@google/genai';
import * as dataService from './dataService';
import { DeviceConfig } from './types';

// Let TypeScript infer the type of the express app to avoid overload resolution issues.
const app = express();
// The frontend and backend will be served from the same origin in production.
// For development, you might run them on different ports and need CORS.
app.use(cors()); 
app.use(express.json());

// --- Gemini API Setup ---
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// --- API Routes ---

// Serve data for the frontend dashboard
app.get('/api/stations', (req, res) => {
    try {
        res.json(dataService.getAllStations());
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve stations.' });
    }
});

app.get('/api/sensors', (req, res) => {
    try {
        res.json(dataService.getAllSensors());
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve sensors.' });
    }
});

app.get('/api/cameras', (req, res) => {
    try {
        res.json(dataService.getAllCameras());
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve cameras.' });
    }
});

// Gemini Chat Stream Endpoint
app.post('/api/gemini-chat-stream', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'A valid "message" string is required in the request body.' });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            // The `contents` field for a single text prompt should be a string for `generateContentStream`.
            contents: message,
        });

        // Write each chunk to the response as it arrives
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                res.write(chunkText);
            }
        }
        
        res.end(); // End the stream when Gemini is done

    } catch (error) {
        console.error('Error during Gemini stream:', error);
        // Ensure the stream is ended even if an error occurs mid-stream.
        if (!res.headersSent) {
             res.status(500).json({ error: 'Failed to get response from Gemini API.' });
        } else {
             res.end();
        }
    }
});


// --- Agent-Facing API Routes ---

app.get('/api/config/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    console.log(`[Server] Configuration requested for device: ${deviceId}`);
    const config: DeviceConfig = dataService.getDeviceConfig(deviceId);
    res.json(config);
});

app.post('/api/submit-reading', (req, res) => {
    const { sensor, value } = req.body;
    console.log(`[Server] Received reading for sensor ${sensor}:`, value);
    // Here you would typically validate and save the reading to a database.
    // For now, we just log it and send a success response.
    if (sensor === undefined || value === undefined) {
        return res.status(400).json({ error: 'Missing sensor ID or value.' });
    }
    dataService.updateSensorValue(sensor, value);
    res.status(200).json({ message: 'Reading received successfully.' });
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});