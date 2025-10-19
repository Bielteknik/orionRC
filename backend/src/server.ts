// Fix: Changed aliased imports for Request and Response to direct imports to resolve type conflicts.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { openDb, db, migrate } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { DeviceConfig, SensorConfig } from './types.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8000;

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
const agentAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    // This token MUST match the one in the agent's config.json
    if (token && token === "EjderMeteo_Rpi_SecretKey_2025!") { 
        agentStatus.status = 'online';
        agentStatus.lastUpdate = new Date().toISOString();
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
};

// --- AGENT-FACING ENDPOINTS ---

app.get('/api/config/:deviceId', agentAuth, async (req: Request, res: Response) => {
    try {
        const { deviceId } = req.params;
        const sensors = await db.all("SELECT id, name, type, is_active, read_frequency, interface, parser_config, config FROM sensors WHERE station_id = ?", deviceId);
        const cameras = await db.all("SELECT id, name, rtsp_url FROM cameras WHERE station_id = ?", deviceId);
        const globalFreq = await db.get("SELECT value FROM global_settings WHERE key = 'global_read_frequency_minutes'");
        
        const config: DeviceConfig = {
            sensors: sensors.map(s => ({
                ...s,
                is_active: !!s.is_active,
                parser_config: JSON.parse(s.parser_config || '{}'),
                config: JSON.parse(s.config || '{}'),
            })),
            cameras: cameras,
            global_read_frequency_seconds: (parseInt(globalFreq?.value, 10) || 0) * 60,
        };
        res.json(config);
    } catch (error) {
        console.error("Error fetching config for device:", error);
        res.status(500).json({ error: "Could not fetch configuration." });
    }
});

app.post('/api/submit-reading', agentAuth, async (req: Request, res: Response) => {
    try {
        const { sensor: sensor_id, value } = req.body;
        const timestamp = new Date().toISOString();
        const valueStr = JSON.stringify(value);

        await db.run("INSERT INTO readings (sensor_id, value, timestamp) VALUES (?, ?, ?)", sensor_id, valueStr, timestamp);
        await db.run("UPDATE sensors SET value = ?, last_update = ? WHERE id = ?", valueStr, timestamp, sensor_id);
        
        res.status(201).send('OK');
    } catch (error) {
        console.error("Error submitting reading:", error);
        res.status(500).json({ error: 'Failed to submit reading.' });
    }
});

app.get('/api/commands/:deviceId', agentAuth, (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const pendingCommands = commandQueue[deviceId]?.filter(cmd => cmd.status === 'pending') || [];
    if (pendingCommands.length > 0) {
        res.json(pendingCommands);
    } else {
        res.status(404).send('No pending commands');
    }
});


app.post('/api/commands/:id/:status', agentAuth, async (req: Request, res: Response) => {
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


app.post('/api/cameras/:cameraId/upload-photo', agentAuth, async (req: Request, res: Response) => {
    const { cameraId } = req.params;
    const { image, filename } = req.body; // base64 image and filename

    try {
        const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'captures');
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        const imagePath = path.join(UPLOADS_DIR, filename);
        
        await fs.writeFile(imagePath, Buffer.from(image, 'base64'));

        const camera = await db.get("SELECT photos FROM cameras WHERE id = ?", cameraId);
        if (!camera) return res.status(404).json({ error: 'Camera not found' });
        
        const photos = JSON.parse(camera.photos || '[]');
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
app.post('/api/analysis/upload-photo', agentAuth, async (req: Request, res: Response) => {
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
app.get('/api/agent-status', (req: Request, res: Response) => {
    // Add logic to check if lastUpdate is recent
    if (agentStatus.lastUpdate && (new Date().getTime() - new Date(agentStatus.lastUpdate).getTime()) > 30000) {
        agentStatus.status = 'offline';
    }
    res.json(agentStatus);
});

// STATIONS
app.get('/api/stations', async (req: Request, res: Response) => {
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
});
app.post('/api/stations', async (req: Request, res: Response) => {
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
});
app.put('/api/stations/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, location, locationCoords, status } = req.body;
    await db.run(
        "UPDATE stations SET name = ?, location = ?, lat = ?, lng = ?, status = ? WHERE id = ?",
        name, location, locationCoords.lat, locationCoords.lng, status, id
    );
    res.status(200).json({ id });
});
app.delete('/api/stations/:id', async (req: Request, res: Response) => {
    await db.run("DELETE FROM stations WHERE id = ?", req.params.id);
    res.status(204).send();
});


// SENSORS
app.get('/api/sensors', async (req: Request, res: Response) => {
    const unassigned = req.query.unassigned === 'true';
    const query = unassigned
        ? "SELECT * FROM sensors WHERE station_id IS NULL OR station_id = ''"
        : "SELECT * FROM sensors";
    const sensors = await db.all(query);
    // Map snake_case from DB to camelCase for frontend
    res.json(sensors.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        stationId: s.station_id,
        status: s.status,
        value: JSON.parse(s.value || 'null'),
        unit: s.unit,
        battery: s.battery,
        lastUpdate: s.last_update,
        interface: s.interface,
        config: JSON.parse(s.config || '{}'),
        parser_config: JSON.parse(s.parser_config || '{}'),
        read_frequency: s.read_frequency,
    })));
});
app.post('/api/sensors', async (req: Request, res: Response) => {
    const { name, stationId, interfaceType, parserConfig, interfaceConfig, type, readFrequency, isActive } = req.body;
    const id = `S${Date.now()}`;
    await db.run(
        `INSERT INTO sensors (id, name, station_id, type, status, interface, parser_config, config, read_frequency, is_active, last_update) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, name, stationId, type, isActive ? 'Aktif' : 'Pasif', interfaceType, parserConfig, interfaceConfig, readFrequency, isActive, new Date().toISOString()
    );
    res.status(201).json({ id });
});
app.put('/api/sensors/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, stationId, interfaceType, parserConfig, interfaceConfig, type, readFrequency, isActive } = req.body;
    await db.run(
        `UPDATE sensors SET name=?, station_id=?, type=?, status=?, interface=?, parser_config=?, config=?, read_frequency=?, is_active=?
         WHERE id = ?`,
        name, stationId, type, isActive ? 'Aktif' : 'Pasif', interfaceType, parserConfig, interfaceConfig, readFrequency, isActive, id
    );
    res.status(200).json({ id });
});
app.delete('/api/sensors/:id', async (req: Request, res: Response) => {
    await db.run("DELETE FROM sensors WHERE id = ?", req.params.id);
    res.status(204).send();
});
app.post('/api/sensors/:id/read', async (req: Request, res: Response) => {
    const { id } = req.params;
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
});

// CAMERAS
app.get('/api/cameras', async (req: Request, res: Response) => {
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
        photos: JSON.parse(c.photos || '[]')
    })));
});
app.post('/api/cameras', async (req: Request, res: Response) => {
    const { name, stationId, status, viewDirection, rtspUrl, cameraType } = req.body;
    const id = `C${Date.now()}`;
    await db.run(
        "INSERT INTO cameras (id, name, station_id, status, view_direction, rtsp_url, camera_type, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        id, name, stationId, status, viewDirection, rtspUrl, cameraType, '[]'
    );
    res.status(201).json({ id });
});
app.put('/api/cameras/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, stationId, status, viewDirection, rtspUrl, cameraType } = req.body;
    await db.run(
        "UPDATE cameras SET name = ?, station_id = ?, status = ?, view_direction = ?, rtsp_url = ?, camera_type = ? WHERE id = ?",
        name, stationId, status, viewDirection, rtspUrl, cameraType, id
    );
    res.status(200).json({ id });
});
app.delete('/api/cameras/:id', async (req: Request, res: Response) => {
    await db.run("DELETE FROM cameras WHERE id = ?", req.params.id);
    res.status(204).send();
});
app.post('/api/cameras/:id/capture', async (req: Request, res: Response) => {
    const { id } = req.params;
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
});

// READINGS
app.get('/api/readings', async (req: Request, res: Response) => {
    const readings = await db.all(`
        SELECT r.id, r.sensor_id as sensorId, s.name as sensorName, s.type as sensorType, s.unit, s.interface, st.id as stationId, st.name as stationName, r.value, r.timestamp 
        FROM readings r
        JOIN sensors s ON r.sensor_id = s.id
        JOIN stations st ON s.station_id = st.id
        ORDER BY r.timestamp DESC
        LIMIT 100
    `);
    res.json(readings.map(r => ({ ...r, value: JSON.parse(r.value || 'null') })));
});
app.get('/api/readings/history', async (req: Request, res: Response) => {
    const { stationIds: stationIdsQuery, sensorTypes: sensorTypesQuery } = req.query;

    if (typeof stationIdsQuery !== 'string' || typeof sensorTypesQuery !== 'string' || stationIdsQuery.length === 0 || sensorTypesQuery.length === 0) {
        return res.json([]);
    }

    try {
        const stationIdList = stationIdsQuery.split(',').map(id => `'${id.trim()}'`).join(',');
        const sensorTypeList = sensorTypesQuery.split(',').map(t => `'${t.trim()}'`).join(',');

        const readings = await db.all(`
            SELECT r.timestamp, s.type as sensorType, r.value FROM readings r
            JOIN sensors s ON r.sensor_id = s.id
            WHERE s.station_id IN (${stationIdList})
            AND s.type IN (${sensorTypeList})
            ORDER BY r.timestamp DESC
            LIMIT 1000
        `);
        res.json(readings.map(r => ({ ...r, value: JSON.parse(r.value || 'null') })));
    } catch (error) {
        console.error("Error fetching reading history:", error);
        res.status(500).json({ error: 'Failed to fetch reading history.' });
    }
});


// DEFINITIONS & SETTINGS
app.get('/api/definitions', async (req: Request, res: Response) => {
    const [stationTypes, sensorTypes, cameraTypes] = await Promise.all([
        db.all("SELECT * FROM station_types"),
        db.all("SELECT * FROM sensor_types"),
        db.all("SELECT * FROM camera_types"),
    ]);
    res.json({ stationTypes, sensorTypes, cameraTypes });
});
app.post('/api/definitions/:type', async (req: Request, res: Response) => {
    const { type } = req.params;
    const { name } = req.body;
    const result = await db.run(`INSERT INTO ${type} (name) VALUES (?)`, name);
    res.status(201).json({ id: result.lastID, name });
});
app.put('/api/definitions/:type/:id', async (req: Request, res: Response) => {
    const { type, id } = req.params;
    const { name } = req.body;
    await db.run(`UPDATE ${type} SET name = ? WHERE id = ?`, name, id);
    res.status(200).json({ id, name });
});
app.delete('/api/definitions/:type/:id', async (req: Request, res: Response) => {
    const { type, id } = req.params;
    await db.run(`DELETE FROM ${type} WHERE id = ?`, id);
    res.status(204).send();
});

app.get('/api/alert-rules', async (req: Request, res: Response) => res.json(await db.all("SELECT * FROM alert_rules")));

app.get('/api/settings/global_read_frequency', async (req: Request, res: Response) => {
    const setting = await db.get("SELECT value FROM global_settings WHERE key = 'global_read_frequency_minutes'");
    res.json(setting || { value: '0' });
});
app.put('/api/settings/global_read_frequency', async (req: Request, res: Response) => {
    const { value } = req.body;
    await db.run("UPDATE global_settings SET value = ? WHERE key = 'global_read_frequency_minutes'", value);
    res.status(200).send('OK');
});

// REPORTS
app.get('/api/reports', async (req: Request, res: Response) => res.json(await db.all("SELECT * FROM reports")));
app.delete('/api/reports/:id', async (req: Request, res: Response) => {
    await db.run("DELETE FROM reports WHERE id = ?", req.params.id);
    res.status(204).send();
});
app.get('/api/report-schedules', async (req: Request, res: Response) => res.json(await db.all("SELECT * FROM report_schedules")));
app.delete('/api/report-schedules/:id', async (req: Request, res: Response) => {
    await db.run("DELETE FROM report_schedules WHERE id = ?", req.params.id);
    res.status(204).send();
});

// NOTIFICATIONS
app.get('/api/notifications', async (req: Request, res: Response) => res.json(await db.all("SELECT * FROM notifications ORDER BY timestamp DESC")));
app.post('/api/notifications/mark-all-read', async (req: Request, res: Response) => {
    await db.run("UPDATE notifications SET is_read = 1 WHERE is_read = 0");
    res.status(200).send('OK');
});
app.delete('/api/notifications/clear-all', async (req: Request, res: Response) => {
    await db.run("DELETE FROM notifications");
    res.status(204).send();
});

// ANALYSIS
app.post('/api/analysis/snow-depth', async (req: Request, res: Response) => {
    const { cameraId, virtualSensorId } = req.body;
    const camera = await db.get("SELECT station_id FROM cameras WHERE id = ?", cameraId);

    if (!camera || !camera.station_id) {
        return res.status(404).json({ error: 'Camera not found or not assigned to a station.' });
    }

    const command = {
        id: Date.now(),
        command_type: 'ANALYZE_SNOW_DEPTH',
        payload: { camera_id: cameraId, virtual_sensor_id: virtualSensorId },
        status: 'pending'
    };

    if (!commandQueue[camera.station_id]) {
        commandQueue[camera.station_id] = [];
    }
    commandQueue[camera.station_id].push(command);

    res.status(202).json({ message: 'Snow depth analysis command queued.' });
});

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
app.get('*', (req: Request, res: Response) => {
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

    app.listen(port, () => {
        console.log(`✅ Backend server listening on http://localhost:${port}`);
    });
}

startServer();