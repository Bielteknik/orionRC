// FIX: Resolve Node.js type errors by importing 'Buffer' and 'process' and use aliased Express types for ES modules.
import { Buffer } from 'buffer';
import process from 'process';
// Use aliased imports for Express types to avoid conflicts with global DOM types.
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import cors from 'cors';
import { openDb, db, migrate } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { DeviceConfig, SensorConfig, ReportSchedule } from './types.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
// Import Type for responseSchema
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// FIX: Define types for DB query results to avoid 'unknown' type errors.
interface ReadingForReport {
    timestamp: string;
    stationName: string;
    sensorName: string;
    sensorType: string;
    value: string; // JSON string from DB
    unit: string | null;
    interface: string;
}

interface SensorForProcessing {
    id: string;
    type: string;
    name: string;
    station_id: string;
    interface: string;
    unit: string | null;
    reference_value: number | null;
    reference_operation: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the root for file uploads. Use an environment variable if provided,
// otherwise assume it's in a sibling 'uploads' directory relative to the app's CWD.
const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(process.cwd(), '..', 'uploads');
console.log(`[Server] Uploads dizini olarak kullanılıyor: ${UPLOADS_ROOT}`);

const app = express();
const port = process.env.PORT || 8000;

// Helper to safely parse JSON that might be invalid or empty
const safeJSONParse = (str: string | null | undefined, fallback: any) => {
    if (str === null || str === undefined || str === '') {
        return fallback;
    }
    try {
        return JSON.parse(str);
    } catch (e) {
        console.warn(`[JSON Parse Hatası] Hatalı string: "${str}". Geri dönüş değeri kullanılıyor.`);
        return fallback;
    }
};


app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 image uploads

// Serve uploaded photos from the configured uploads path
app.use('/uploads', express.static(UPLOADS_ROOT));


// --- In-memory state for agent and commands ---
let agentStatus = {
    status: 'offline',
    lastUpdate: null as string | null,
};
let commandQueue: { [deviceId: string]: any[] } = {};

// Helper to queue a command for a device
const queueCommand = (deviceId: string, command_type: string, payload: any = {}) => {
    const command = { id: Date.now(), command_type, payload, status: 'pending' };
    if (!commandQueue[deviceId]) commandQueue[deviceId] = [];
    commandQueue[deviceId].push(command);
    console.log(`[COMMAND QUEUED] ${command_type} for device ${deviceId}`);
};


// --- AUTH MIDDLEWARE (simple token check) ---
// FIX: Add explicit types for req, res, and next parameters.
const agentAuth = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    // This token MUST match the one in the agent's config.json
    if (token && token === (process.env.DEVICE_AUTH_TOKEN || "EjderMeteo_Rpi_SecretKey_2025!")) { 
        agentStatus.status = 'online';
        agentStatus.lastUpdate = new Date().toISOString();
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
};

// --- API ROUTER SETUP ---
const apiRouter = express.Router();


// --- AGENT-FACING ENDPOINTS ---

// FIX: Add explicit types for req and res parameters.
apiRouter.get('/config/:deviceId', agentAuth, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { deviceId } = req.params;

        const station = await db.get("SELECT lat, lng FROM stations WHERE id = ?", deviceId);
        if (!station) {
            return res.status(404).json({ error: "Station with this device ID not found." });
        }

        const sensorsFromDb = await db.all("SELECT id, name, type, is_active, read_frequency, interface, parser_config, config, reference_value, reference_operation, read_order FROM sensors WHERE station_id = ?", deviceId);
        const cameras = await db.all("SELECT id, name, rtsp_url FROM cameras WHERE station_id = ?", deviceId);
        const globalFreq = await db.get("SELECT value FROM global_settings WHERE key = 'global_read_frequency_minutes'");
        
        const processedSensors = sensorsFromDb.map(s => {
            const sensorConfig = {
                ...s,
                is_active: !!s.is_active,
                parser_config: safeJSONParse(s.parser_config, {}),
                config: safeJSONParse(s.config, {}),
            };

            if (sensorConfig.interface === 'openweather') {
                sensorConfig.config = {
                    ...sensorConfig.config,
                    apikey: process.env.OPENWEATHER_API_KEY,
                    lat: station.lat,
                    lon: station.lng,
                };
            }

            return sensorConfig;
        });

        const config: DeviceConfig = {
            sensors: processedSensors,
            cameras: cameras,
            global_read_frequency_seconds: (parseInt(globalFreq?.value, 10) || 0) * 60,
            // FIX: Use process.env.API_KEY as per the coding guidelines.
            gemini_api_key: process.env.API_KEY,
        };
        res.json(config);
    } catch (error) {
        console.error("Error fetching config for device:", error);
        res.status(500).json({ error: "Could not fetch configuration." });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.post('/submit-reading', agentAuth, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { sensor: sensor_id, value, rawValue } = req.body;
        const timestamp = new Date().toISOString();

        if (sensor_id === undefined || value === undefined) {
            console.warn(`Bad request for /submit-reading: 'sensor' or 'value' field is missing.`, req.body);
            return res.status(400).json({ error: 'Bad Request: sensor and value fields are required.' });
        }
        
        const sensor = await db.get("SELECT id FROM sensors WHERE id = ?", sensor_id);
        if (!sensor) {
            console.warn(`Reading submitted for unknown sensor ID: ${sensor_id}`);
            return res.status(404).json({ error: 'Sensor not found.' });
        }

        // Store the processed value
        const valueStr = JSON.stringify(value);
        await db.run("INSERT INTO readings (sensor_id, value, timestamp) VALUES (?, ?, ?)", sensor_id, valueStr, timestamp);
        await db.run("UPDATE sensors SET value = ?, last_update = ?, health_status = ? WHERE id = ?", valueStr, timestamp, 'Sağlıklı', sensor_id);

        // Store the raw value if it was provided by the agent
        if (rawValue) {
            const rawValueStr = JSON.stringify(rawValue);
            await db.run("INSERT INTO raw_readings (sensor_id, raw_value, timestamp) VALUES (?, ?, ?)", sensor_id, rawValueStr, timestamp);
        }
        
        res.status(201).send('OK');
    } catch (error) {
        console.error("Error submitting reading:", error);
        res.status(500).json({ error: 'Failed to submit reading.' });
    }
});


// FIX: Add explicit types for req and res parameters.
apiRouter.get('/commands/:deviceId', agentAuth, (req: ExpressRequest, res: ExpressResponse) => {
    const { deviceId } = req.params;
    const pendingCommands = commandQueue[deviceId]?.filter(cmd => cmd.status === 'pending') || [];
    
    // Dequeue commands after sending them
    if (pendingCommands.length > 0) {
        res.json(pendingCommands);
        commandQueue[deviceId] = commandQueue[deviceId].filter(cmd => cmd.status !== 'pending');
    } else {
        res.status(204).send(); // Use 204 No Content for empty queue
    }
});


// FIX: Add explicit types for req and res parameters.
apiRouter.post('/commands/:id/:status', agentAuth, async (req: ExpressRequest, res: ExpressResponse) => {
    // This endpoint might be deprecated if command queue is cleared on GET, but can be kept for explicit updates.
    const { id, status } = req.params;
    // ... logic to update command status if needed for tracking ...
    res.status(200).send('OK');
});


// FIX: Add explicit types for req and res parameters.
apiRouter.post('/cameras/:cameraId/upload-photo', agentAuth, async (req: ExpressRequest, res: ExpressResponse) => {
    const { cameraId } = req.params;
    const { image, filename } = req.body; // base64 image and filename

    try {
        const UPLOADS_DIR = path.join(UPLOADS_ROOT, 'captures');
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        const imagePath = path.join(UPLOADS_DIR, filename);
        
        await fs.writeFile(imagePath, Buffer.from(image, 'base64'));

        const camera = await db.get("SELECT photos FROM cameras WHERE id = ?", cameraId);
        if (!camera) return res.status(404).json({ error: 'Camera not found' });
        
        const photos = safeJSONParse(camera.photos, []);
        const photoUrl = `/uploads/captures/${filename}`;
        photos.unshift(photoUrl); // Add to beginning of array

        await db.run("UPDATE cameras SET photos = ? WHERE id = ?", JSON.stringify(photos.slice(0, 20)), cameraId); // Limit to last 20 photos

        res.status(200).send('OK');
    } catch (error) {
        console.error(`Error saving photo for camera ${cameraId}:`, error);
        res.status(500).json({ error: 'Failed to save photo' });
    }
});

// Endpoint for analysis photos
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/analysis/upload-photo', agentAuth, async (req: ExpressRequest, res: ExpressResponse) => {
    const { cameraId, image, filename } = req.body;
    try {
        const uploadsDir = path.join(UPLOADS_ROOT, 'analysis');
        await fs.mkdir(uploadsDir, { recursive: true });
        const imagePath = path.join(uploadsDir, filename);
        await fs.writeFile(imagePath, Buffer.from(image, 'base64'));

        console.log(`[Analysis] Image saved for camera ${cameraId}: ${filename}`);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error saving analysis photo:', error);
        res.status(500).json({ error: 'Failed to save analysis photo' });
    }
});


// --- FRONTEND-FACING ENDPOINTS ---
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/agent-status', (req: ExpressRequest, res: ExpressResponse) => {
    // Check if lastUpdate is recent (e.g., within 90 seconds, allowing for polling intervals)
    if (agentStatus.lastUpdate && (new Date().getTime() - new Date(agentStatus.lastUpdate).getTime()) > 90000) {
        agentStatus.status = 'offline';
    }
    res.json(agentStatus);
});

// STATIONS
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/stations', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const stationsFromDb = await db.all(`
            SELECT 
                st.*,
                COUNT(DISTINCT s.id) as sensor_count,
                COUNT(DISTINCT c.id) as camera_count
            FROM stations st
            LEFT JOIN sensors s ON s.station_id = st.id
            LEFT JOIN cameras c ON c.station_id = st.id
            GROUP BY st.id
        `);
        const stations = stationsFromDb.map(s => ({
            ...s,
            sensorCount: s.sensor_count,
            cameraCount: s.camera_count,
            locationCoords: { lat: s.lat, lng: s.lng },
        }));
        res.json(stations);
    } catch (error) {
        console.error("Error fetching stations:", error);
        res.status(500).json({ error: "Failed to fetch stations." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/stations', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { id, name, location, locationCoords, selectedSensorIds = [], selectedCameraIds = [] } = req.body;
        await db.run(
            "INSERT INTO stations (id, name, location, lat, lng, last_update) VALUES (?, ?, ?, ?, ?, ?)",
            id, name, location, locationCoords.lat, locationCoords.lng, new Date().toISOString()
        );
        for (const sensorId of selectedSensorIds) {
            await db.run("UPDATE sensors SET station_id = ? WHERE id = ?", id, sensorId);
        }
        for (const cameraId of selectedCameraIds) {
            await db.run("UPDATE cameras SET station_id = ? WHERE id = ?", id, cameraId);
        }
        queueCommand(id, 'REFRESH_CONFIG');
        res.status(201).json({ id });
    } catch (error) {
        console.error("Error creating station:", error);
        res.status(500).json({ error: "Failed to create station." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.put('/stations/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        const fields = req.body;
        const updates: string[] = [];
        const params: any[] = [];

        if (fields.name !== undefined) { updates.push('name = ?'); params.push(fields.name); }
        if (fields.location !== undefined) { updates.push('location = ?'); params.push(fields.location); }
        if (fields.status !== undefined) { updates.push('status = ?'); params.push(fields.status); }
        if (fields.locationCoords !== undefined) {
            updates.push('lat = ?', 'lng = ?');
            params.push(fields.locationCoords.lat, fields.locationCoords.lng);
        }

        if (updates.length === 0) {
            return res.status(200).json({ id, message: 'No fields to update.' });
        }

        const sql = `UPDATE stations SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);

        await db.run(sql, ...params);
        queueCommand(id, 'REFRESH_CONFIG');
        res.status(200).json({ id });
    } catch (error) {
        console.error(`Error updating station ${id}:`, error);
        res.status(500).json({ error: "Failed to update station." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.delete('/stations/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await db.run("DELETE FROM stations WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting station ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete station." });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.post('/stations/:id/restart-agent', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id: deviceId } = req.params;
    try {
        const station = await db.get("SELECT id FROM stations WHERE id = ?", deviceId);
        if (!station) {
            return res.status(404).json({ error: 'Station not found.' });
        }
        queueCommand(deviceId, 'RESTART_AGENT');
        res.status(202).json({ message: 'Restart command queued successfully.' });
    } catch (error) {
        console.error(`Error queueing restart command for station ${deviceId}:`, error);
        res.status(500).json({ error: "Failed to queue restart command." });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.post('/stations/:id/stop-agent', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id: deviceId } = req.params;
    try {
        const station = await db.get("SELECT id FROM stations WHERE id = ?", deviceId);
        if (!station) {
            return res.status(404).json({ error: 'Station not found.' });
        }
        queueCommand(deviceId, 'STOP_AGENT');
        res.status(202).json({ message: 'Stop command queued successfully.' });
    } catch (error) {
        console.error(`Error queueing stop command for station ${deviceId}:`, error);
        res.status(500).json({ error: "Failed to queue stop command." });
    }
});


// SENSORS
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/sensors', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const unassigned = req.query.unassigned === 'true';
        const query = unassigned
            ? "SELECT * FROM sensors WHERE station_id IS NULL OR station_id = ''"
            : "SELECT * FROM sensors";
        const sensors = await db.all(query);
        res.json(sensors.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            stationId: s.station_id,
            status: s.status,
            value: safeJSONParse(s.value, null),
            unit: s.unit,
            battery: s.battery,
            lastUpdate: s.last_update,
            interface: s.interface,
            config: safeJSONParse(s.config, {}),
            parser_config: safeJSONParse(s.parser_config, {}),
            read_frequency: s.read_frequency,
            referenceValue: s.reference_value,
            referenceOperation: s.reference_operation,
            readOrder: s.read_order,
            healthStatus: s.health_status,
        })));
    } catch (error) {
        console.error("Error fetching sensors:", error);
        res.status(500).json({ error: "Failed to fetch sensors." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/sensors', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { name, stationId, interfaceType, parserConfig, interfaceConfig, type, unit, readFrequency, isActive, referenceValue, referenceOperation } = req.body;
        const id = `S${Date.now()}`;
        const parserConfigStr = typeof parserConfig === 'string' ? parserConfig : JSON.stringify(parserConfig || {});
        const interfaceConfigStr = typeof interfaceConfig === 'string' ? interfaceConfig : JSON.stringify(interfaceConfig || {});

        const maxOrderResult = await db.get("SELECT MAX(read_order) as maxOrder FROM sensors");
        const nextReadOrder = (maxOrderResult?.maxOrder || 0) + 1;

        await db.run(
            `INSERT INTO sensors (id, name, station_id, type, unit, status, interface, parser_config, config, read_frequency, is_active, last_update, reference_value, reference_operation, read_order) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id, name, stationId, type, unit, isActive ? 'Aktif' : 'Pasif', interfaceType, parserConfigStr, interfaceConfigStr, readFrequency, isActive, new Date().toISOString(), referenceValue, referenceOperation, nextReadOrder
        );
        if (stationId) queueCommand(stationId, 'REFRESH_CONFIG');
        res.status(201).json({ id });
    } catch (error) {
        console.error("Error creating sensor:", error);
        res.status(500).json({ error: "Failed to create sensor." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.put('/sensors/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        const oldSensor = await db.get("SELECT station_id FROM sensors WHERE id = ?", id);
        const fields = req.body;
        const updates: string[] = [];
        const params: any[] = [];

        if (fields.name !== undefined) { updates.push('name = ?'); params.push(fields.name); }
        if (fields.stationId !== undefined) { updates.push('station_id = ?'); params.push(fields.stationId); }
        if (fields.type !== undefined) { updates.push('type = ?'); params.push(fields.type); }
        if (fields.unit !== undefined) { updates.push('unit = ?'); params.push(fields.unit); }
        if (fields.interfaceType !== undefined) { updates.push('interface = ?'); params.push(fields.interfaceType); }
        if (fields.readFrequency !== undefined) { updates.push('read_frequency = ?'); params.push(fields.readFrequency); }
        if (fields.referenceValue !== undefined) { updates.push('reference_value = ?'); params.push(fields.referenceValue); }
        if (fields.referenceOperation !== undefined) { updates.push('reference_operation = ?'); params.push(fields.referenceOperation); }
        
        if (fields.parserConfig !== undefined) { 
            updates.push('parser_config = ?'); 
            const parserConfig = typeof fields.parserConfig === 'string' ? fields.parserConfig : JSON.stringify(fields.parserConfig || {});
            params.push(parserConfig); 
        }
        if (fields.interfaceConfig !== undefined) { 
            updates.push('config = ?'); 
            const interfaceConfig = typeof fields.interfaceConfig === 'string' ? fields.interfaceConfig : JSON.stringify(fields.interfaceConfig || {});
            params.push(interfaceConfig);
        }
        
        if (fields.isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(fields.isActive ? 1 : 0);
            updates.push('status = ?');
            params.push(fields.isActive ? 'Aktif' : 'Pasif');
        }

        if (updates.length === 0) {
            return res.status(200).json({ id, message: 'No fields to update.' });
        }

        const sql = `UPDATE sensors SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);
        
        await db.run(sql, ...params);

        // Tell old and new stations to refresh their config
        if (oldSensor?.station_id) queueCommand(oldSensor.station_id, 'REFRESH_CONFIG');
        if (fields.stationId && fields.stationId !== oldSensor?.station_id) {
            queueCommand(fields.stationId, 'REFRESH_CONFIG');
        }

        res.status(200).json({ id });
    } catch (error) {
        console.error(`Error updating sensor with ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to update sensor.' });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.delete('/sensors/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const sensor = await db.get("SELECT station_id FROM sensors WHERE id = ?", req.params.id);
        await db.run("DELETE FROM sensors WHERE id = ?", req.params.id);
        if (sensor?.station_id) queueCommand(sensor.station_id, 'REFRESH_CONFIG');
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting sensor ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete sensor." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/sensors/:id/read', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        const sensor = await db.get("SELECT * FROM sensors WHERE id = ?", id);
        if (!sensor || !sensor.station_id) {
            return res.status(404).json({ error: 'Sensor not found or not assigned to a station.' });
        }
        queueCommand(sensor.station_id, 'FORCE_READ_SENSOR', { sensor_id: id });
        res.status(202).send('Read command queued');
    } catch (error) {
        console.error(`Error queueing read command for sensor ${id}:`, error);
        res.status(500).json({ error: "Failed to queue read command." });
    }
});

apiRouter.post('/sensors/:id/read-failure', agentAuth, async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        await db.run("UPDATE sensors SET health_status = ? WHERE id = ?", 'Okuma Hatası', id);
        res.status(200).send('OK');
    } catch (error) {
        console.error(`Error reporting read failure for sensor ${id}:`, error);
        res.status(500).json({ error: "Failed to report read failure." });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.post('/sensors/:id/manual-reading', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { id: sensor_id } = req.params;
        const { value } = req.body; // Expecting a raw number

        if (sensor_id === undefined || typeof value !== 'number') {
            return res.status(400).json({ error: 'Bad Request: A numeric value is required.' });
        }

        const sensor = await db.get("SELECT type FROM sensors WHERE id = ?", sensor_id);
        if (!sensor) {
            return res.status(404).json({ error: 'Sensor not found.' });
        }
        
        let valueObject: any;
        if (sensor.type === 'Kar Yüksekliği') {
            valueObject = { snow_depth_cm: value };
        } else if (sensor.type === 'Mesafe') {
            valueObject = { distance_cm: value };
        } else {
             const lastReading = await db.get("SELECT value FROM sensors WHERE id = ?", sensor_id);
             if (lastReading && lastReading.value) {
                const lastValue = safeJSONParse(lastReading.value, {});
                const key = Object.keys(lastValue)[0] || 'value';
                valueObject = { [key]: value };
             } else {
                valueObject = { value };
             }
        }
        
        // This helper no longer exists, but we can keep it here as no-op. The rounding is now done on the agent.
        const roundNumericValues = (v: any) => v; 
        const finalValue = roundNumericValues(valueObject);
        const timestamp = new Date().toISOString();
        const valueStr = JSON.stringify(finalValue);

        await db.run("INSERT INTO readings (sensor_id, value, timestamp) VALUES (?, ?, ?)", sensor_id, valueStr, timestamp);
        await db.run("UPDATE sensors SET value = ?, last_update = ? WHERE id = ?", valueStr, timestamp, sensor_id);
        
        console.log(`[MANUAL READING] Sensor ${sensor_id} updated to ${valueStr}`);
        res.status(201).json({ message: 'OK', value: finalValue });
    } catch (error: any) {
        console.error(`Error submitting manual reading for sensor ${req.params.id}:`, error.message);
        res.status(500).json({ error: 'Failed to submit manual reading.' });
    }
});

// CAMERAS
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/cameras', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const unassigned = req.query.unassigned === 'true';
        const query = unassigned
            ? "SELECT * FROM cameras WHERE station_id IS NULL OR station_id = ''"
            : "SELECT * FROM cameras";
        const cameras = await db.all(query);
         // Map snake_case from DB to camelCase for frontend
        res.json(cameras.map(c => ({
            id: c.id,
            name: c.name,
            stationId: c.station_id,
            status: c.status,
            streamUrl: c.stream_url,
            rtspUrl: c.rtsp_url,
            cameraType: c.camera_type,
            viewDirection: c.view_direction,
            fps: c.fps,
            photos: safeJSONParse(c.photos, [])
        })));
    } catch (error) {
        console.error("Error fetching cameras:", error);
        res.status(500).json({ error: "Failed to fetch cameras." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/cameras', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { name, stationId, status, viewDirection, rtspUrl, cameraType } = req.body;
        const id = `C${Date.now()}`;
        await db.run(
            "INSERT INTO cameras (id, name, station_id, status, view_direction, rtsp_url, camera_type, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            id, name, stationId, status, viewDirection, rtspUrl, cameraType, '[]'
        );
        if (stationId) queueCommand(stationId, 'REFRESH_CONFIG');
        res.status(201).json({ id });
    } catch (error) {
        console.error("Error creating camera:", error);
        res.status(500).json({ error: "Failed to create camera." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.put('/cameras/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        const oldCamera = await db.get("SELECT station_id FROM cameras WHERE id = ?", id);
        const fields = req.body;
        const updates: string[] = [];
        const params: any[] = [];
        
        if (fields.name !== undefined) { updates.push('name = ?'); params.push(fields.name); }
        if (fields.stationId !== undefined) { updates.push('station_id = ?'); params.push(fields.stationId); }
        if (fields.status !== undefined) { updates.push('status = ?'); params.push(fields.status); }
        if (fields.viewDirection !== undefined) { updates.push('view_direction = ?'); params.push(fields.viewDirection); }
        if (fields.rtspUrl !== undefined) { updates.push('rtsp_url = ?'); params.push(fields.rtspUrl); }
        if (fields.cameraType !== undefined) { updates.push('camera_type = ?'); params.push(fields.cameraType); }

        if (updates.length === 0) {
            return res.status(200).json({ id, message: 'No fields to update.' });
        }

        const sql = `UPDATE cameras SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);
        
        await db.run(sql, ...params);
        // Tell old and new stations to refresh their config
        if (oldCamera?.station_id) queueCommand(oldCamera.station_id, 'REFRESH_CONFIG');
        if (fields.stationId && fields.stationId !== oldCamera?.station_id) {
            queueCommand(fields.stationId, 'REFRESH_CONFIG');
        }
        res.status(200).json({ id });
    } catch (error) {
        console.error(`Error updating camera ${id}:`, error);
        res.status(500).json({ error: "Failed to update camera." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.delete('/cameras/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const camera = await db.get("SELECT station_id FROM cameras WHERE id = ?", req.params.id);
        await db.run("DELETE FROM cameras WHERE id = ?", req.params.id);
        if (camera?.station_id) queueCommand(camera.station_id, 'REFRESH_CONFIG');
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting camera ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete camera." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/cameras/:id/capture', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        const camera = await db.get("SELECT station_id FROM cameras WHERE id = ?", id);
        if (!camera || !camera.station_id) {
            return res.status(404).json({ error: 'Camera not found or not assigned to a station.' });
        }
        queueCommand(camera.station_id, 'CAPTURE_IMAGE', { camera_id: id });
        res.status(202).send('Capture command queued');
    } catch (error) {
        console.error(`Error queueing capture command for camera ${id}:`, error);
        res.status(500).json({ error: "Failed to queue capture command." });
    }
});

// READINGS
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/readings', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const readings = await db.all(`
            SELECT r.id, r.sensor_id as sensorId, s.name as sensorName, s.type as sensorType, s.unit, s.interface, st.id as stationId, st.name as stationName, r.value, r.timestamp 
            FROM readings r
            JOIN sensors s ON r.sensor_id = s.id
            JOIN stations st ON s.station_id = st.id
            ORDER BY r.timestamp DESC
            LIMIT 100
        `);
        res.json(readings.map(r => ({ ...r, value: safeJSONParse(r.value, null) })));
    } catch (error) {
        console.error("Error fetching readings:", error);
        res.status(500).json({ error: "Failed to fetch readings." });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.get('/readings/history', async (req: ExpressRequest, res: ExpressResponse) => {
    const { stationIds: stationIdsQuery, sensorTypes: sensorTypesQuery, start: startDate, end: endDate } = req.query;

    if (typeof stationIdsQuery !== 'string' || typeof sensorTypesQuery !== 'string' || !stationIdsQuery || !sensorTypesQuery) {
        return res.json([]);
    }

    try {
        const stationIdList = stationIdsQuery.split(',');
        const sensorTypeList = sensorTypesQuery.split(',');
        const placeholders = (arr: string[]) => arr.map(() => '?').join(',');

        // 1. Get all relevant sensors
        const sensors = await db.all<SensorForProcessing[]>(`
            SELECT id, type, name, station_id, interface, unit
            FROM sensors 
            WHERE station_id IN (${placeholders(stationIdList)}) AND type IN (${placeholders(sensorTypeList)})
        `, [...stationIdList, ...sensorTypeList]);
        
        if (sensors.length === 0) return res.json([]);

        const sensorMap = new Map<string, SensorForProcessing>(sensors.map(s => [s.id, s]));
        const sensorIdList = sensors.map(s => s.id);

        // 2. Build date filter
        let dateFilterClause = '';
        const dateParams: string[] = [];
        if (startDate && typeof startDate === 'string') {
            dateFilterClause += ' AND timestamp >= ?';
            dateParams.push(startDate);
        }
        if (endDate && typeof endDate === 'string') {
            dateFilterClause += ' AND timestamp <= ?';
            dateParams.push(endDate);
        }

        // 3. Fetch processed readings
        const processedReadings = await db.all(`
            SELECT id, timestamp, sensor_id, value 
            FROM readings
            WHERE sensor_id IN (${placeholders(sensorIdList)}) ${dateFilterClause}
            ORDER BY timestamp DESC
            LIMIT 1000
        `, [...sensorIdList, ...dateParams]);


        const response = processedReadings.map(r => {
            const sensor = sensorMap.get(r.sensor_id);
            if (!sensor) return null;
            return {
                id: r.id,
                timestamp: r.timestamp,
                sensorId: r.sensor_id,
                value: safeJSONParse(r.value, null),
                sensorName: sensor.name,
                stationId: sensor.station_id,
                sensorType: sensor.type,
                interface: sensor.interface,
                unit: sensor.unit,
            }
        }).filter(Boolean);

        res.json(response);

    } catch (error) {
        console.error("Error fetching and processing reading history:", error);
        res.status(500).json({ error: 'Failed to fetch reading history.' });
    }
});


// FIX: Add explicit types for req and res parameters.
apiRouter.get('/raw-readings/history', async (req: ExpressRequest, res: ExpressResponse) => {
    const { sensorId, start: startDate, end: endDate } = req.query;

    if (!sensorId || typeof sensorId !== 'string') {
        return res.status(400).json({ error: 'sensorId query parameter is required.' });
    }

    try {
        let dateFilterClause = '';
        const params: (string | undefined)[] = [sensorId];

        if (startDate && typeof startDate === 'string') {
            dateFilterClause += ' AND r.timestamp >= ?';
            params.push(startDate);
        }
        if (endDate && typeof endDate === 'string') {
            dateFilterClause += ' AND r.timestamp <= ?';
            params.push(endDate);
        }

        const readings = await db.all(`
            SELECT 
                r.id, 
                r.raw_value,
                r.timestamp,
                s.id as sensorId
            FROM raw_readings r
            JOIN sensors s ON r.sensor_id = s.id
            WHERE s.id = ? ${dateFilterClause}
            ORDER BY r.timestamp DESC
            LIMIT 500
        `, ...params);
        res.json(readings.map(r => ({ ...r, raw_value: safeJSONParse(r.raw_value, null) })));
    } catch (error) {
        console.error("Error fetching raw reading history:", error);
        res.status(500).json({ error: 'Failed to fetch raw reading history.' });
    }
});


// DEFINITIONS & SETTINGS
const isValidDefinitionType = (type: string): boolean => {
    return ['station_types', 'sensor_types', 'camera_types'].includes(type);
};

// FIX: Add explicit types for req and res parameters.
apiRouter.get('/definitions', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const [stationTypes, sensorTypes, cameraTypes] = await Promise.all([
            db.all("SELECT * FROM station_types"),
            db.all("SELECT * FROM sensor_types"),
            db.all("SELECT * FROM camera_types"),
        ]);
        res.json({ stationTypes, sensorTypes, cameraTypes });
    } catch (error) {
        console.error("Error fetching definitions:", error);
        res.status(500).json({ error: "Failed to fetch definitions." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/definitions/:type', async (req: ExpressRequest, res: ExpressResponse) => {
    const { type } = req.params;
    if (!isValidDefinitionType(type)) {
        return res.status(400).json({ error: 'Invalid definition type.' });
    }
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ error: 'Invalid name provided.' });
        }
        const result = await db.run(`INSERT INTO ${type} (name) VALUES (?)`, name);
        res.status(201).json({ id: result.lastID, name });
    } catch (error) {
        console.error(`Error creating definition for ${type}:`, error);
        res.status(500).json({ error: `Failed to create definition for ${type}.` });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.put('/definitions/:type/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { type, id } = req.params;
    if (!isValidDefinitionType(type)) {
        return res.status(400).json({ error: 'Invalid definition type.' });
    }
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ error: 'Invalid name provided.' });
        }
        await db.run(`UPDATE ${type} SET name = ? WHERE id = ?`, name, id);
        res.status(200).json({ id, name });
    } catch (error) {
        console.error(`Error updating definition for ${type} with id ${id}:`, error);
        res.status(500).json({ error: `Failed to update definition.` });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.delete('/definitions/:type/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { type, id } = req.params;
    if (!isValidDefinitionType(type)) {
        return res.status(400).json({ error: 'Invalid definition type.' });
    }
    try {
        await db.run(`DELETE FROM ${type} WHERE id = ?`, id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting definition for ${type} with id ${id}:`, error);
        res.status(500).json({ error: `Failed to delete definition.` });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.get('/alert-rules', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        res.json(await db.all("SELECT * FROM alert_rules"));
    } catch (error) {
        console.error("Error fetching alert rules:", error);
        res.status(500).json({ error: "Failed to fetch alert rules." });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.get('/settings/global_read_frequency', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const setting = await db.get("SELECT value FROM global_settings WHERE key = 'global_read_frequency_minutes'");
        res.json(setting || { value: '0' });
    } catch (error) {
        console.error("Error getting global read frequency:", error);
        res.status(500).json({ error: "Failed to get global read frequency." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.put('/settings/global_read_frequency', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { value } = req.body;
        await db.run("UPDATE global_settings SET value = ? WHERE key = 'global_read_frequency_minutes'", value);
        // Notify all stations about the change
        const stations = await db.all("SELECT id FROM stations");
        for (const station of stations) {
            queueCommand(station.id, 'REFRESH_CONFIG');
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error("Error setting global read frequency:", error);
        res.status(500).json({ error: "Failed to set global read frequency." });
    }
});

// REPORTS
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/reports', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        res.json(await db.all("SELECT * FROM reports"));
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ error: "Failed to fetch reports." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.delete('/reports/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await db.run("DELETE FROM reports WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting report ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete report." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/report-schedules', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const schedules = await db.all("SELECT * FROM report_schedules");
        res.json(schedules.map(s => ({
            ...s, 
            reportConfig: safeJSONParse(s.report_config, {})
        })));
    } catch (error) {
        console.error("Error fetching report schedules:", error);
        res.status(500).json({ error: "Failed to fetch report schedules." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/report-schedules', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { name, frequency, time, recipient, reportConfig, isEnabled } = req.body;
        const id = `SCH_${uuidv4()}`;
        await db.run(
            `INSERT INTO report_schedules (id, name, frequency, time, recipient, report_config, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            id, name, frequency, time, recipient, JSON.stringify(reportConfig), isEnabled
        );
        res.status(201).json({ id });
    } catch (error) {
        console.error("Error creating report schedule:", error);
        res.status(500).json({ error: "Failed to create report schedule." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.put('/report-schedules/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        const fields = req.body;
        const updates: string[] = [];
        const params: any[] = [];

        if (fields.name !== undefined) { updates.push('name = ?'); params.push(fields.name); }
        if (fields.frequency !== undefined) { updates.push('frequency = ?'); params.push(fields.frequency); }
        if (fields.time !== undefined) { updates.push('time = ?'); params.push(fields.time); }
        if (fields.recipient !== undefined) { updates.push('recipient = ?'); params.push(fields.recipient); }
        if (fields.isEnabled !== undefined) { updates.push('is_enabled = ?'); params.push(fields.isEnabled); }
        if (fields.reportConfig !== undefined) {
            updates.push('report_config = ?');
            params.push(JSON.stringify(fields.reportConfig || {}));
        }

        if (updates.length === 0) {
            return res.status(200).json({ id, message: 'No fields to update.' });
        }

        const sql = `UPDATE report_schedules SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);

        await db.run(sql, ...params);
        res.status(200).send('OK');
    } catch (error) {
        console.error(`Error updating report schedule ${id}:`, error);
        res.status(500).json({ error: "Failed to update report schedule." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.delete('/report-schedules/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await db.run("DELETE FROM report_schedules WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting report schedule ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete report schedule." });
    }
});

// NOTIFICATIONS
// FIX: Add explicit types for req and res parameters.
apiRouter.get('/notifications', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        res.json(await db.all("SELECT * FROM notifications ORDER BY timestamp DESC"));
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Failed to fetch notifications." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.post('/notifications/mark-all-read', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await db.run("UPDATE notifications SET is_read = ? WHERE is_read = ?", [true, false]);
        res.status(200).send('OK');
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ error: "Failed to mark all notifications as read." });
    }
});
// FIX: Add explicit types for req and res parameters.
apiRouter.delete('/notifications/clear-all', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await db.run("DELETE FROM notifications");
        res.status(204).send();
    } catch (error) {
        console.error("Error clearing all notifications:", error);
        res.status(500).json({ error: "Failed to clear all notifications." });
    }
});

// ANALYSIS
const GEMINI_SNOW_DEPTH_PROMPT = `Sen meteorolojik veri için görüntü analizi yapan bir uzmansın. Görevin, kar cetveli içeren bu görüntüden santimetre cinsinden kar derinliğini hassas bir şekilde belirlemek.

**GÖREVİN:**
Görüntüdeki kar ölçüm cetvelinden kar derinliğini oku ve sonucu JSON formatında döndür.

**ADIMLAR:**
1.  **Cetveli Bul:** Görüntüdeki üzerinde kırmızı ve beyaz şeritler ile sayısal işaretler olan dikey kar ölçüm cetvelini bul.
2.  **Kar Seviyesini Belirle:** Cetvelin etrafındaki genel kar seviyesini dikkatlice incele. Tekil kar birikintileri veya erimiş alanları değil, cetvelin dibindeki ortalama kar çizgisini temel al.
3.  **Değeri Oku:** Cetvel üzerindeki sayılar santimetreyi gösterir. Belirlediğin kar çizgisine denk gelen sayısal değeri oku. Ara değerleri hassas bir şekilde tahmin et. Örneğin, kar seviyesi "10" işaretinin hemen altındaysa, bu 9 olabilir. "10" işaretinin çok altındaysa, 4 veya 5 gibi bir değer olabilir.
4.  **Doğrula ve Yanıtla:**
    *   Değeri net bir şekilde belirleyebiliyorsan, bu değeri ver.
    *   Görüntü net değilse, cetvel görünmüyorsa, kar seviyesi anlaşılamıyorsa veya derinliği güvenilir bir şekilde belirleyemiyorsan, **-1** değerini döndür.

**ÇIKTI FORMATI:**
Nihai cevabını SADECE aşağıdaki JSON formatında ver, başka hiçbir metin ekleme:
{"snow_depth_cm": SAYI}

**ÖRNEKLER:**
*   **Örnek 1:** Görüntüde kar seviyesi, cetveldeki "10" santimetre işaretinin neredeyse üzerini kapatacak şekilde hemen altındaysa, bu yaklaşık 9 cm'dir. Cevabın şöyle olmalı:
    {"snow_depth_cm": 9}
*   **Örnek 2:** Görüntüde kar seviyesi, cetveldeki "10" santimetre işaretinin oldukça altındaysa, neredeyse sıfır ile 10'un orta noktasının biraz altında ise, bu yaklaşık 4 cm'dir. Cevabın şöyle olmalı:
    {"snow_depth_cm": 4}
*   **Örnek 3:** Eğer kar seviyesi tam olarak "80" işaretinin üzerindeyse, cevabın şöyle olmalı:
    {"snow_depth_cm": 80}`;

// FIX: Add explicit types for req and res parameters.
apiRouter.post('/analysis/snow-depth', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { cameraId, virtualSensorId, analysisType } = req.body;
        const camera = await db.get("SELECT station_id FROM cameras WHERE id = ?", cameraId);

        if (!camera || !camera.station_id) {
            return res.status(404).json({ error: 'Camera not found or not assigned to a station.' });
        }
        
        queueCommand(camera.station_id, 'ANALYZE_SNOW_DEPTH', {
            camera_id: cameraId, 
            virtual_sensor_id: virtualSensorId,
            analysis_type: analysisType, // 'gemini' or 'opencv'
        });

        res.status(202).json({ message: 'Snow depth analysis command queued.' });
    } catch (error) {
        console.error("Error queueing snow depth analysis command:", error);
        res.status(500).json({ error: "Failed to queue snow depth analysis command." });
    }
});

// FIX: Add explicit types for req and res parameters.
apiRouter.post('/analysis/snow-depth-from-image', async (req: ExpressRequest, res: ExpressResponse) => {
    const { imageBase64, virtualSensorId, analysisType } = req.body;

    if (!imageBase64 || !virtualSensorId || !analysisType) {
        return res.status(400).json({ error: 'Missing required fields: imageBase64, virtualSensorId, analysisType' });
    }

    if (analysisType !== 'gemini') {
        return res.status(400).json({ error: 'Only "gemini" analysis type is supported for this endpoint.' });
    }
    
    // FIX: Use process.env.API_KEY as per the coding guidelines.
    if (!process.env.API_KEY) {
        console.error('HATA: Gemini API anahtarı (API_KEY) .env dosyasında ayarlanmamış.');
        return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
        console.log(`[ANALYSIS] Starting ${analysisType} analysis for sensor ${virtualSensorId} from provided image.`);
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg', // Assuming jpeg for now
                data: imageBase64,
            },
        };
        const textPart = {
            text: GEMINI_SNOW_DEPTH_PROMPT,
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        snow_depth_cm: {
                            type: Type.NUMBER,
                            description: "The measured snow depth in centimeters."
                        }
                    },
                    required: ["snow_depth_cm"]
                }
            }
        });
        
        const resultText = response.text;
        if (!resultText) {
            throw new Error('Gemini API returned an empty response.');
        }

        console.log(`[ANALYSIS] Gemini Response: ${resultText}`);
        
        // Clean the response from markdown code blocks
        const cleanedText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        const resultJson = JSON.parse(cleanedText);
        let snowDepth = resultJson.snow_depth_cm;

        if (typeof snowDepth !== 'number') {
            throw new Error('Could not parse a numeric snow depth value from Gemini response.');
        }

        if (snowDepth === -1) {
            console.log(`[ANALYSIS] Gemini could not determine snow depth from the image.`);
            throw new Error('Gemini could not determine snow depth from the image.');
        }

        console.log(`[ANALYSIS] Parsed snow depth: ${snowDepth} cm`);
        
        // This helper no longer exists, but we can keep it here as no-op. The rounding is now done on the agent.
        const roundNumericValues = (v: any) => v; 
        snowDepth = roundNumericValues(snowDepth);

        // Update the sensor reading
        const timestamp = new Date().toISOString();
        const value = { snow_depth_cm: snowDepth };
        const valueStr = JSON.stringify(value);

        await db.run("INSERT INTO readings (sensor_id, value, timestamp) VALUES (?, ?, ?)", virtualSensorId, valueStr, timestamp);
        await db.run("UPDATE sensors SET value = ?, last_update = ? WHERE id = ?", valueStr, timestamp, virtualSensorId);

        res.status(200).json({ message: 'Analysis successful and reading updated.', value });

    } catch (error) {
        console.error(`[ANALYSIS] Error during image analysis:`, error);
        res.status(500).json({ error: 'Failed to analyze image.' });
    }
});


// --- NODEMAILER TRANSPORTER & SCHEDULED REPORTS ---

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: (process.env.EMAIL_PORT === '465'), // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify(function(error, success) {
    if (error) {
        console.error("❌ E-posta gönderici yapılandırma hatası:", error.message);
        console.warn("   -> .env dosyanızda EMAIL_HOST, EMAIL_PORT, EMAIL_USER, ve EMAIL_PASS değişkenlerini kontrol edin.");
    } else {
        console.log("✅ E-posta gönderici (Nodemailer) başarıyla yapılandırıldı ve hazır.");
    }
});


async function sendEmail(recipient: string, subject: string, body: string, attachment?: { filename: string, content: Buffer, contentType: string }) {
    console.log(`[E-POSTA GÖNDERİLİYOR] -> Alıcı: ${recipient}, Konu: ${subject}`);
    
    const mailOptions: nodemailer.SendMailOptions = {
        from: `"ORION Gözlem Platformu" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: subject,
        html: `<p>${body}</p>`,
    };

    if (attachment) {
        mailOptions.attachments = [
            {
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType,
            },
        ];
    }

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ [E-POSTA BAŞARILI] -> Alıcı: ${recipient}`);
    } catch (error) {
        console.error(`❌ [E-POSTA HATASI] -> Alıcı: ${recipient}, Hata:`, error);
    }
}

// FIX: Add explicit type for reading parameter and fix property access.
const formatReadingValueForReport = (reading: ReadingForReport): string => {
    const value = safeJSONParse(reading.value, null);
    // FIX: Use `sensorType` and `interface` from the `reading` object directly.
    const { sensorType, interface: sensorInterface } = reading;

    if (value === null || value === undefined) return 'N/A';
    if (typeof value !== 'object') return String(value);

    if (sensorInterface === 'openweather') {
        if (sensorType === 'Sıcaklık' && typeof (value as any).temperature === 'number') {
            return String((value as any).temperature.toFixed(2));
        }
        if (sensorType === 'Nem' && typeof (value as any).humidity === 'number') {
            return String((value as any).humidity.toFixed(2));
        }
        // Fallback for other openweather types
        return 'N/A';
    }
    
    // Fallback for other object types
    const numericValue = Object.values(value).find(v => typeof v === 'number');
    if (typeof numericValue === 'number') {
        return String(numericValue.toFixed(2));
    }

    return JSON.stringify(value); // Last resort
};

async function checkAndSendScheduledReports() {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentTime = now.toTimeString().substring(0, 5); // HH:MM

        const dueSchedules = await db.all<ReportSchedule[]>(
            "SELECT * FROM report_schedules WHERE is_enabled = 1 AND time = ? AND (last_run IS NULL OR last_run < ?)",
            currentTime,
            today
        );
        
        for (const schedule of dueSchedules) {
            const scheduleFromDb = schedule as any;
            const scheduleConfig = safeJSONParse(scheduleFromDb.report_config, null);

            if (!scheduleConfig || !scheduleConfig.selectedStations || !scheduleConfig.selectedSensorTypes) {
                console.error(`[Zamanlayıcı Hatası] Rapor planı (${schedule.id} - ${schedule.name}) için yapılandırma eksik veya bozuk, atlanıyor.`);
                continue; 
            }

            // FIX: Add explicit type for db.all result
            let readings = await db.all<ReadingForReport[]>(`
                SELECT r.timestamp, st.name as stationName, s.name as sensorName, s.type as sensorType, r.value, s.unit, s.interface FROM readings r
                JOIN sensors s ON r.sensor_id = s.id
                JOIN stations st ON s.station_id = st.id
                WHERE s.station_id IN (${scheduleConfig.selectedStations.map((s:string) => `'${s}'`).join(',')})
                AND s.type IN (${scheduleConfig.selectedSensorTypes.map((t:string) => `'${t}'`).join(',')})
                ORDER BY r.timestamp DESC
            `);
            
            if (scheduleConfig.dataRules.groupByStation || scheduleConfig.dataRules.groupBySensorType) {
                // FIX: Type a and b as ReadingForReport
                readings.sort((a: ReadingForReport, b: ReadingForReport) => {
                    if (scheduleConfig.dataRules.groupByStation) {
                        const stationCompare = a.stationName.localeCompare(b.stationName, 'tr');
                        if (stationCompare !== 0) return stationCompare;
                    }
                    if (scheduleConfig.dataRules.groupBySensorType) {
                        const typeCompare = a.sensorType.localeCompare(b.sensorType, 'tr');
                        if (typeCompare !== 0) return typeCompare;
                    }
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
            }

            // FIX: Type d as ReadingForReport
            const formattedData = readings.map((d: ReadingForReport) => {
                const date = new Date(d.timestamp);
                return {
                    'Tarih': date.toLocaleDateString('tr-TR'),
                    'Saat': date.toLocaleTimeString('tr-TR'),
                    'İstasyon': d.stationName,
                    'Sensör': d.sensorName,
                    'Sensör Tipi': d.sensorType,
                    'Değer': `${formatReadingValueForReport(d)} ${d.unit || ''}`
                }
            });

            const ws = XLSX.utils.json_to_sheet(formattedData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rapor");
            const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            
            const filename = `${schedule.name.replace(/ /g, '_')}_${today}.xlsx`;
            const emailBody = `Merhaba,<br><br><b>${schedule.name}</b> adlı otomatik raporunuz oluşturulmuş ve eke eklenmiştir.<br><br>Saygılarımızla,<br>ORION Gözlem Platformu`;

            await sendEmail(schedule.recipient, `Otomatik Rapor: ${schedule.name}`, emailBody, {
                filename,
                content: buffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            await db.run("UPDATE report_schedules SET last_run = ? WHERE id = ?", today, schedule.id);
        }
    } catch (error) {
        console.error("[Zamanlayıcı Hatası] Raporlar gönderilemedi:", error);
    }
}

// --- Mount API Router ---
app.use('/api', apiRouter);


// --- SERVE FRONTEND ---
// This robust path serves the frontend from a 'public' directory
// inside the backend's root folder.
const publicPath = path.join(__dirname, '..', 'public');
console.log(`[Server] Serving static files from: ${publicPath}`);

// Check if frontend exists
fs.access(path.join(publicPath, 'index.html')).catch(() => {
    console.warn(`[Server] WARNING: Frontend not found at ${publicPath}.`);
    console.warn(`[Server] Make sure to follow deployment instructions in README.md`);
});

app.use(express.static(publicPath));

// Catch-all to serve index.html for any other request (for client-side routing)
// FIX: Add explicit types for req and res parameters.
app.get('*', (req: ExpressRequest, res: ExpressResponse) => {
    // Exclude API routes from being caught by this
    if (req.path.startsWith('/api/')) {
        return res.status(404).send('API endpoint not found.');
    }
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
        if (err) {
            res.status(500).send("Uygulama yüklenemedi. Dağıtım talimatlarını (README.md) kontrol edin.");
        }
    });
});


// --- SERVER START ---
async function startServer() {
    await openDb();
    await migrate();

    // Start the scheduled report checker (runs every minute)
    setInterval(checkAndSendScheduledReports, 60000);
    console.log('✅ Rapor zamanlayıcısı aktif, her dakika kontrol edilecek.');

    app.listen(port, () => {
        console.log(`✅ Backend server listening on http://localhost:${port}`);
    });
}

startServer();