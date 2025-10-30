




// Use fully qualified express types to avoid conflict with global DOM types.
// FIX: Use aliased imports for express types to prevent conflicts with global DOM types (e.g., from Jest or other libraries).
// FIX: Added Express type to explicitly type the app constant.
// FIX: Replaced aliased imports with a namespace import to resolve type conflicts more robustly.
import * as express from 'express';
import cors from 'cors';
import { openDb, db, migrate } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { DeviceConfig, SensorConfig, ReportSchedule } from './types.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
// FIX: Explicitly import 'Buffer' to resolve "Cannot find name 'Buffer'" due to missing Node.js types.
import { Buffer } from 'buffer';
import XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FIX: Explicitly type app as Express to fix type conflicts.
const app: express.Express = express();
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

// Serve uploaded photos from both camera captures and analysis
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));


// --- In-memory state for agent and commands ---
let agentStatus = {
    status: 'offline',
    lastUpdate: null as string | null,
};
let commandQueue: { [deviceId: string]: any[] } = {};


// --- AUTH MIDDLEWARE (simple token check) ---
// FIX: Replaced Request, Response, NextFunction with aliased Express types
const agentAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

// --- AGENT-FACING ENDPOINTS ---

// FIX: Replaced Request and Response with aliased Express types
app.get('/api/config/:deviceId', agentAuth, async (req: express.Request, res: express.Response) => {
    try {
        const { deviceId } = req.params;

        const station = await db.get("SELECT lat, lng FROM stations WHERE id = ?", deviceId);
        if (!station) {
            return res.status(404).json({ error: "Station with this device ID not found." });
        }

        const sensorsFromDb = await db.all("SELECT id, name, type, is_active, read_frequency, interface, parser_config, config FROM sensors WHERE station_id = ?", deviceId);
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
        };
        res.json(config);
    } catch (error) {
        console.error("Error fetching config for device:", error);
        res.status(500).json({ error: "Could not fetch configuration." });
    }
});

// FIX: Replaced Request and Response with aliased Express types
app.post('/api/submit-reading', agentAuth, async (req: express.Request, res: express.Response) => {
    try {
        const { sensor: sensor_id, value: rawValue } = req.body;

        // Validate incoming data to prevent database errors from malformed requests.
        if (sensor_id === undefined || rawValue === undefined) {
            console.warn(`Bad request for /submit-reading: 'sensor' or 'value' field is missing.`, req.body);
            return res.status(400).json({ error: 'Bad Request: sensor and value fields are required.' });
        }

        const sensor = await db.get("SELECT reference_value, reference_operation FROM sensors WHERE id = ?", sensor_id);
        if (!sensor) {
            console.warn(`Reading submitted for unknown sensor ID: ${sensor_id}`);
            return res.status(404).json({ error: 'Sensor not found.' });
        }

        let processedValue = rawValue;
        const refVal = sensor.reference_value;
        const refOp = sensor.reference_operation;

        // Apply reference value logic if applicable
        if (refVal !== null && refVal !== 999 && refOp && (refOp === 'add' || refOp === 'subtract')) {
             if (typeof rawValue === 'object' && rawValue !== null) {
                // Find the first numeric value in the object to modify
                const keyToModify = Object.keys(rawValue).find(k => typeof rawValue[k] === 'number');
                if (keyToModify) {
                    const originalNumericValue = rawValue[keyToModify];
                    let calculatedNumericValue;
                    if (refOp === 'subtract') {
                        calculatedNumericValue = refVal - originalNumericValue;
                    } else { // 'add'
                        calculatedNumericValue = refVal + originalNumericValue;
                    }
                    processedValue = { ...rawValue, [keyToModify]: calculatedNumericValue };
                }
            } else if (typeof rawValue === 'number') {
                if (refOp === 'subtract') {
                    processedValue = refVal - rawValue;
                } else { // 'add'
                    processedValue = refVal + rawValue;
                }
            }
        }
        
        const timestamp = new Date().toISOString();
        const valueStr = JSON.stringify(processedValue);

        await db.run("INSERT INTO readings (sensor_id, value, timestamp) VALUES (?, ?, ?)", sensor_id, valueStr, timestamp);
        await db.run("UPDATE sensors SET value = ?, last_update = ? WHERE id = ?", valueStr, timestamp, sensor_id);
        
        res.status(201).send('OK');
    } catch (error) {
        console.error("Error submitting reading:", error);
        res.status(500).json({ error: 'Failed to submit reading.' });
    }
});

// FIX: Replaced Request and Response with aliased Express types
app.get('/api/commands/:deviceId', agentAuth, (req: express.Request, res: express.Response) => {
    const { deviceId } = req.params;
    const pendingCommands = commandQueue[deviceId]?.filter(cmd => cmd.status === 'pending') || [];
    if (pendingCommands.length > 0) {
        res.json(pendingCommands);
    } else {
        res.status(404).send('No pending commands');
    }
});


// FIX: Replaced Request and Response with aliased Express types
app.post('/api/commands/:id/:status', agentAuth, async (req: express.Request, res: express.Response) => {
    const { id, status } = req.params;
    const commandId = parseInt(id, 10);

    let found = false;
    for (const deviceId in commandQueue) {
        const cmdIndex = commandQueue[deviceId].findIndex(cmd => cmd.id === commandId);
        if (cmdIndex > -1) {
            commandQueue[deviceId][cmdIndex].status = status;
            found = true;
            // Optional: Remove completed/failed commands after a while
            setTimeout(() => {
                const updatedIndex = commandQueue[deviceId].findIndex(cmd => cmd.id === commandId);
                if (updatedIndex > -1) {
                    commandQueue[deviceId].splice(updatedIndex, 1);
                }
            }, 60000); // Remove after 1 minute
            break;
        }
    }

    if (found) {
        res.status(200).send('OK');
    } else {
        res.status(404).send('Command not found');
    }
});


// FIX: Replaced Request and Response with aliased Express types
app.post('/api/cameras/:cameraId/upload-photo', agentAuth, async (req: express.Request, res: express.Response) => {
    const { cameraId } = req.params;
    const { image, filename } = req.body; // base64 image and filename

    try {
        const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'captures');
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
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/analysis/upload-photo', agentAuth, async (req: express.Request, res: express.Response) => {
    const { cameraId, image, filename } = req.body;
    try {
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'analysis');
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
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/agent-status', (req: express.Request, res: express.Response) => {
    // Add logic to check if lastUpdate is recent
    if (agentStatus.lastUpdate && (new Date().getTime() - new Date(agentStatus.lastUpdate).getTime()) > 30000) {
        agentStatus.status = 'offline';
    }
    res.json(agentStatus);
});

// STATIONS
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/stations', async (req: express.Request, res: express.Response) => {
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
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/stations', async (req: express.Request, res: express.Response) => {
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
        res.status(201).json({ id });
    } catch (error) {
        console.error("Error creating station:", error);
        res.status(500).json({ error: "Failed to create station." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.put('/api/stations/:id', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const { name, location, locationCoords, status } = req.body;
        await db.run(
            "UPDATE stations SET name = ?, location = ?, lat = ?, lng = ?, status = ? WHERE id = ?",
            name, location, locationCoords.lat, locationCoords.lng, status, id
        );
        res.status(200).json({ id });
    } catch (error) {
        console.error(`Error updating station ${id}:`, error);
        res.status(500).json({ error: "Failed to update station." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.delete('/api/stations/:id', async (req: express.Request, res: express.Response) => {
    try {
        await db.run("DELETE FROM stations WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting station ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete station." });
    }
});


// SENSORS
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/sensors', async (req: express.Request, res: express.Response) => {
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
        })));
    } catch (error) {
        console.error("Error fetching sensors:", error);
        res.status(500).json({ error: "Failed to fetch sensors." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/sensors', async (req: express.Request, res: express.Response) => {
    try {
        const { name, stationId, interfaceType, parserConfig, interfaceConfig, type, unit, readFrequency, isActive, referenceValue, referenceOperation } = req.body;
        const id = `S${Date.now()}`;
        const parserConfigStr = typeof parserConfig === 'string' ? parserConfig : JSON.stringify(parserConfig || {});
        const interfaceConfigStr = typeof interfaceConfig === 'string' ? interfaceConfig : JSON.stringify(interfaceConfig || {});

        await db.run(
            `INSERT INTO sensors (id, name, station_id, type, unit, status, interface, parser_config, config, read_frequency, is_active, last_update, reference_value, reference_operation) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id, name, stationId, type, unit, isActive ? 'Aktif' : 'Pasif', interfaceType, parserConfigStr, interfaceConfigStr, readFrequency, isActive, new Date().toISOString(), referenceValue, referenceOperation
        );
        res.status(201).json({ id });
    } catch (error) {
        console.error("Error creating sensor:", error);
        res.status(500).json({ error: "Failed to create sensor." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.put('/api/sensors/:id', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const { name, stationId, interfaceType, parserConfig, interfaceConfig, type, unit, readFrequency, isActive, referenceValue, referenceOperation } = req.body;
        const parserConfigStr = typeof parserConfig === 'string' ? parserConfig : JSON.stringify(parserConfig || {});
        const interfaceConfigStr = typeof interfaceConfig === 'string' ? interfaceConfig : JSON.stringify(interfaceConfig || {});

        await db.run(
            `UPDATE sensors SET name=?, station_id=?, type=?, unit=?, status=?, interface=?, parser_config=?, config=?, read_frequency=?, is_active=?, reference_value=?, reference_operation=?
             WHERE id = ?`,
            name, stationId, type, unit, isActive ? 'Aktif' : 'Pasif', interfaceType, parserConfigStr, interfaceConfigStr, readFrequency, isActive, referenceValue, referenceOperation, id
        );
        res.status(200).json({ id });
    } catch (error) {
        console.error(`Error updating sensor with ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to update sensor.' });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.delete('/api/sensors/:id', async (req: express.Request, res: express.Response) => {
    try {
        await db.run("DELETE FROM sensors WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting sensor ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete sensor." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/sensors/:id/read', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const sensor = await db.get("SELECT * FROM sensors WHERE id = ?", id);
        if (!sensor || !sensor.station_id) {
            return res.status(404).json({ error: 'Sensor not found or not assigned to a station.' });
        }
        const command = {
            id: Date.now(),
            command_type: 'FORCE_READ_SENSOR',
            payload: { sensor_id: id },
            status: 'pending'
        };
        if (!commandQueue[sensor.station_id]) commandQueue[sensor.station_id] = [];
        commandQueue[sensor.station_id].push(command);
        res.status(202).send('Read command queued');
    } catch (error) {
        console.error(`Error queueing read command for sensor ${id}:`, error);
        res.status(500).json({ error: "Failed to queue read command." });
    }
});

// CAMERAS
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/cameras', async (req: express.Request, res: express.Response) => {
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
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/cameras', async (req: express.Request, res: express.Response) => {
    try {
        const { name, stationId, status, viewDirection, rtspUrl, cameraType } = req.body;
        const id = `C${Date.now()}`;
        await db.run(
            "INSERT INTO cameras (id, name, station_id, status, view_direction, rtsp_url, camera_type, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            id, name, stationId, status, viewDirection, rtspUrl, cameraType, '[]'
        );
        res.status(201).json({ id });
    } catch (error) {
        console.error("Error creating camera:", error);
        res.status(500).json({ error: "Failed to create camera." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.put('/api/cameras/:id', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const { name, stationId, status, viewDirection, rtspUrl, cameraType } = req.body;
        await db.run(
            "UPDATE cameras SET name = ?, station_id = ?, status = ?, view_direction = ?, rtsp_url = ?, camera_type = ? WHERE id = ?",
            name, stationId, status, viewDirection, rtspUrl, cameraType, id
        );
        res.status(200).json({ id });
    } catch (error) {
        console.error(`Error updating camera ${id}:`, error);
        res.status(500).json({ error: "Failed to update camera." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.delete('/api/cameras/:id', async (req: express.Request, res: express.Response) => {
    try {
        await db.run("DELETE FROM cameras WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting camera ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete camera." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/cameras/:id/capture', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const camera = await db.get("SELECT station_id FROM cameras WHERE id = ?", id);
        if (!camera || !camera.station_id) {
            return res.status(404).json({ error: 'Camera not found or not assigned to a station.' });
        }
        const command = {
            id: Date.now(),
            command_type: 'CAPTURE_IMAGE',
            payload: { camera_id: id },
            status: 'pending'
        };
        if (!commandQueue[camera.station_id]) commandQueue[camera.station_id] = [];
        commandQueue[camera.station_id].push(command);
        res.status(202).send('Capture command queued');
    } catch (error) {
        console.error(`Error queueing capture command for camera ${id}:`, error);
        res.status(500).json({ error: "Failed to queue capture command." });
    }
});

// READINGS
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/readings', async (req: express.Request, res: express.Response) => {
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
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/readings/history', async (req: express.Request, res: express.Response) => {
    const { stationIds: stationIdsQuery, sensorTypes: sensorTypesQuery } = req.query;

    if (typeof stationIdsQuery !== 'string' || typeof sensorTypesQuery !== 'string' || stationIdsQuery.length === 0 || sensorTypesQuery.length === 0) {
        return res.json([]);
    }

    try {
        const stationIdList = stationIdsQuery.split(',').map(id => `'${id.trim()}'`).join(',');
        const sensorTypeList = sensorTypesQuery.split(',').map(t => `'${t.trim()}'`).join(',');

        const readings = await db.all(`
            SELECT 
                r.id, 
                r.timestamp, 
                s.id as sensorId,
                s.name as sensorName,
                s.station_id as stationId, 
                s.type as sensorType, 
                s.interface, 
                s.unit, 
                r.value 
            FROM readings r
            JOIN sensors s ON r.sensor_id = s.id
            WHERE s.station_id IN (${stationIdList})
            AND s.type IN (${sensorTypeList})
            ORDER BY r.timestamp DESC
            LIMIT 1000
        `);
        res.json(readings.map(r => ({ ...r, value: safeJSONParse(r.value, null) })));
    } catch (error) {
        console.error("Error fetching reading history:", error);
        res.status(500).json({ error: 'Failed to fetch reading history.' });
    }
});


// DEFINITIONS & SETTINGS
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/definitions', async (req: express.Request, res: express.Response) => {
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
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/definitions/:type', async (req: express.Request, res: express.Response) => {
    const { type } = req.params;
    try {
        const { name } = req.body;
        const result = await db.run(`INSERT INTO ${type} (name) VALUES (?)`, name);
        res.status(201).json({ id: result.lastID, name });
    } catch (error) {
        console.error(`Error creating definition for ${type}:`, error);
        res.status(500).json({ error: `Failed to create definition for ${type}.` });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.put('/api/definitions/:type/:id', async (req: express.Request, res: express.Response) => {
    const { type, id } = req.params;
    try {
        const { name } = req.body;
        await db.run(`UPDATE ${type} SET name = ? WHERE id = ?`, name, id);
        res.status(200).json({ id, name });
    } catch (error) {
        console.error(`Error updating definition for ${type} with id ${id}:`, error);
        res.status(500).json({ error: `Failed to update definition.` });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.delete('/api/definitions/:type/:id', async (req: express.Request, res: express.Response) => {
    const { type, id } = req.params;
    try {
        await db.run(`DELETE FROM ${type} WHERE id = ?`, id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting definition for ${type} with id ${id}:`, error);
        res.status(500).json({ error: `Failed to delete definition.` });
    }
});

// FIX: Replaced Request and Response with aliased Express types
app.get('/api/alert-rules', async (req: express.Request, res: express.Response) => {
    try {
        res.json(await db.all("SELECT * FROM alert_rules"));
    } catch (error) {
        console.error("Error fetching alert rules:", error);
        res.status(500).json({ error: "Failed to fetch alert rules." });
    }
});

// FIX: Replaced Request and Response with aliased Express types
app.get('/api/settings/global_read_frequency', async (req: express.Request, res: express.Response) => {
    try {
        const setting = await db.get("SELECT value FROM global_settings WHERE key = 'global_read_frequency_minutes'");
        res.json(setting || { value: '0' });
    } catch (error) {
        console.error("Error getting global read frequency:", error);
        res.status(500).json({ error: "Failed to get global read frequency." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.put('/api/settings/global_read_frequency', async (req: express.Request, res: express.Response) => {
    try {
        const { value } = req.body;
        await db.run("UPDATE global_settings SET value = ? WHERE key = 'global_read_frequency_minutes'", value);
        res.status(200).send('OK');
    } catch (error) {
        console.error("Error setting global read frequency:", error);
        res.status(500).json({ error: "Failed to set global read frequency." });
    }
});

// REPORTS
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/reports', async (req: express.Request, res: express.Response) => {
    try {
        res.json(await db.all("SELECT * FROM reports"));
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ error: "Failed to fetch reports." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.delete('/api/reports/:id', async (req: express.Request, res: express.Response) => {
    try {
        await db.run("DELETE FROM reports WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting report ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete report." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/report-schedules', async (req: express.Request, res: express.Response) => {
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
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/report-schedules', async (req: express.Request, res: express.Response) => {
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
// FIX: Replaced Request and Response with aliased Express types
app.put('/api/report-schedules/:id', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const { isEnabled } = req.body; // For now, only supports toggling
        await db.run("UPDATE report_schedules SET is_enabled = ? WHERE id = ?", isEnabled, id);
        res.status(200).send('OK');
    } catch (error) {
        console.error(`Error updating report schedule ${id}:`, error);
        res.status(500).json({ error: "Failed to update report schedule." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.delete('/api/report-schedules/:id', async (req: express.Request, res: express.Response) => {
    try {
        await db.run("DELETE FROM report_schedules WHERE id = ?", req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting report schedule ${req.params.id}:`, error);
        res.status(500).json({ error: "Failed to delete report schedule." });
    }
});

// NOTIFICATIONS
// FIX: Replaced Request and Response with aliased Express types
app.get('/api/notifications', async (req: express.Request, res: express.Response) => {
    try {
        res.json(await db.all("SELECT * FROM notifications ORDER BY timestamp DESC"));
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Failed to fetch notifications." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/notifications/mark-all-read', async (req: express.Request, res: express.Response) => {
    try {
        await db.run("UPDATE notifications SET is_read = 0 WHERE is_read = 1");
        res.status(200).send('OK');
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ error: "Failed to mark all notifications as read." });
    }
});
// FIX: Replaced Request and Response with aliased Express types
app.delete('/api/notifications/clear-all', async (req: express.Request, res: express.Response) => {
    try {
        await db.run("DELETE FROM notifications");
        res.status(204).send();
    } catch (error) {
        console.error("Error clearing all notifications:", error);
        res.status(500).json({ error: "Failed to clear all notifications." });
    }
});

// ANALYSIS
// FIX: Replaced Request and Response with aliased Express types
app.post('/api/analysis/snow-depth', async (req: express.Request, res: express.Response) => {
    try {
        const { cameraId, virtualSensorId, analysisType } = req.body;
        const camera = await db.get("SELECT station_id FROM cameras WHERE id = ?", cameraId);

        if (!camera || !camera.station_id) {
            return res.status(404).json({ error: 'Camera not found or not assigned to a station.' });
        }

        const command = {
            id: Date.now(),
            command_type: 'ANALYZE_SNOW_DEPTH',
            payload: { 
                camera_id: cameraId, 
                virtual_sensor_id: virtualSensorId,
                analysis_type: analysisType, // 'gemini' or 'opencv'
            },
            status: 'pending'
        };

        if (!commandQueue[camera.station_id]) {
            commandQueue[camera.station_id] = [];
        }
        commandQueue[camera.station_id].push(command);

        res.status(202).json({ message: 'Snow depth analysis command queued.' });
    } catch (error) {
        console.error("Error queueing snow depth analysis command:", error);
        res.status(500).json({ error: "Failed to queue snow depth analysis command." });
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

const formatReadingValueForReport = (reading: any): string => {
    const value = safeJSONParse(reading.value, null);
    const { type: sensorType, interface: sensorInterface } = reading;

    if (value === null || value === undefined) return 'N/A';
    if (typeof value !== 'object') return String(value);

    if (sensorInterface === 'openweather') {
        if (sensorType === 'Sıcaklık' && value.temperature !== undefined) {
            return String(value.temperature);
        }
        if (sensorType === 'Nem' && value.humidity !== undefined) {
            return String(value.humidity);
        }
    }
    
    const numericValue = Object.values(value).find(v => typeof v === 'number');
    return numericValue !== undefined ? String(numericValue) : JSON.stringify(value);
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

            let readings = await db.all(`
                SELECT r.timestamp, st.name as stationName, s.name as sensorName, s.type as sensorType, r.value, s.unit, s.interface FROM readings r
                JOIN sensors s ON r.sensor_id = s.id
                JOIN stations st ON s.station_id = st.id
                WHERE s.station_id IN (${scheduleConfig.selectedStations.map((s:string) => `'${s}'`).join(',')})
                AND s.type IN (${scheduleConfig.selectedSensorTypes.map((t:string) => `'${t}'`).join(',')})
                ORDER BY r.timestamp DESC
            `);
            
            if (scheduleConfig.dataRules.groupByStation || scheduleConfig.dataRules.groupBySensorType) {
                readings.sort((a: any, b: any) => {
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

            const formattedData = readings.map((d: any) => {
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
// FIX: Replaced Request and Response with aliased Express types
app.get('*', (req: express.Request, res: express.Response) => {
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