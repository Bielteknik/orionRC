// Use explicit express types to resolve type conflicts with global DOM types.
// Fix: Use namespaced express types to avoid conflicts with global DOM types.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenAI, Chat } from "@google/genai";
import { openDb, db, migrate } from './database.js';
import { DeviceConfig, SensorConfig, CameraConfig } from './types.js';
import { fileURLToPath } from 'url';
import { transformFileAsync } from '@babel/core';

dotenv.config();

// --- Path Configuration ---
// Get the directory of the currently executing file (__dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: Calculate absolute paths to the frontend build directory and uploads directory.
// We resolve from the current directory (.../backend-app/dist), go up two levels to the domain root,
// and then into the 'httpdocs' (for frontend) and 'uploads' folders.
const frontendDistPath = path.resolve(__dirname, '..', '..', 'httpdocs');
const uploadsPath = path.resolve(__dirname, '..', '..', 'uploads');
const analysisUploadsPath = path.join(uploadsPath, 'analiz');

const app = express();
const port = process.env.PORT || 8000;
const DEVICE_AUTH_TOKEN = process.env.DEVICE_AUTH_TOKEN || 'EjderMeteo_Rpi_SecretKey_2025!';
const GEMINI_API_KEY = process.env.API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// Sensor Type to Unit Mapping
const SENSOR_UNIT_MAP: { [key: string]: string } = {
    'Sıcaklık': '°C',
    'Nem': '%',
    'Rüzgar Hızı': 'km/h',
    'Basınç': 'hPa',
    'Yağış': 'mm',
    'UV İndeksi': '',
    'Rüzgar Yönü': '°',
    'Mesafe': 'cm',
    'Ağırlık': 'gr',
    'Kar Yüksekliği': 'cm',
};

// Maps sensor types to the specific key to look for in the JSON value object.
const SENSOR_TYPE_TO_VALUE_KEY: { [key: string]: string } = {
    'Sıcaklık': 'temperature',
    'Nem': 'humidity',
    'Mesafe': 'distance_cm',
    'Ağırlık': 'weight_kg',
    'Kar Yüksekliği': 'snow_depth_cm',
};


app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images

// Logging middleware
// Fix: Use namespaced express types to avoid conflicts
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// On-the-fly TSX/TS transpilation middleware.
// This resolves the "Strict MIME type checking" error by compiling frontend source
// files to browser-compatible JavaScript in memory before serving them.
// Fix: Use namespaced express types to avoid conflicts
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestedPath = req.path;
    if (requestedPath.endsWith('.tsx') || requestedPath.endsWith('.ts')) {
        const filePath = path.join(frontendDistPath, requestedPath);
        try {
            await fs.access(filePath); // Check if file exists
            const result = await transformFileAsync(filePath, {
                presets: [
                    '@babel/preset-typescript',
                    ['@babel/preset-react', { runtime: 'automatic' }]
                ],
                filename: filePath,
            });

            if (result?.code) {
                res.set('Content-Type', 'application/javascript; charset=utf-8');
                return res.send(result.code);
            }
        } catch (error) {
            // Fix: Cast error to a generic object with a 'code' property to resolve NodeJS namespace conflict.
            if ((error as { code: string }).code !== 'ENOENT') {
                 console.error(`Babel transpilation error for ${filePath}:`, error);
                 return res.status(500).send(`// Babel Error: ${(error as Error).message}`);
            }
        }
    }
    next();
});

// Fix: Use namespaced express types to avoid conflicts
const authenticateDevice = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Token ${DEVICE_AUTH_TOKEN}`;
    if (!authHeader || authHeader !== expectedToken) {
        console.warn(`Authentication failed from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
};

const apiRouter = express.Router();

// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/', (req: express.Request, res: express.Response) => {
    res.json({ status: 'API is running' });
});

// --- Data Transformation Helpers ---
const dbStationToApi = (station: any): any => {
    if (!station) return null;
    return { ...station, locationCoords: { lat: station.lat, lng: station.lng }, lat: undefined, lng: undefined }
};

const dbSensorToApi = (sensor: any): any => {
    if (!sensor) return null;
    const apiSensor = { ...sensor, stationId: sensor.station_id, config: sensor.config ? JSON.parse(sensor.config) : {}, parser_config: sensor.parser_config ? JSON.parse(sensor.parser_config) : {} };
    delete apiSensor.station_id;
    return apiSensor;
};

const dbCameraToApi = (camera: any): any => {
    if (!camera) return null;
    const apiCamera = { ...camera, stationId: camera.station_id, photos: camera.photos ? JSON.parse(camera.photos) : [] };
    delete apiCamera.station_id;
    return apiCamera;
};

// --- Agent Endpoints ---

// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/config/:deviceId', authenticateDevice, async (req: express.Request, res: express.Response) => {
    const { deviceId } = req.params;
    console.log(`Configuration requested for device: ${deviceId}`);
    try {
        const station = await db.get('SELECT * FROM stations WHERE id = ?', deviceId);
        if (!station) return res.status(404).json({ error: `Station with device ID ${deviceId} not found.` });

        const sensors = await db.all('SELECT * FROM sensors WHERE station_id = ? AND is_active = 1', deviceId);
        const cameras = await db.all('SELECT id, name, rtsp_url FROM cameras WHERE station_id = ?', deviceId);
        
        // Fetch global setting
        const globalFreqSetting = await db.get("SELECT value FROM global_settings WHERE key = 'global_read_frequency_minutes'");
        const globalFreqMinutes = parseInt(globalFreqSetting?.value || '0', 10);
        const global_read_frequency_seconds = globalFreqMinutes > 0 ? globalFreqMinutes * 60 : undefined;

        // Enrich sensor configs on the fly
        const sensorConfigs: SensorConfig[] = sensors.map(s => {
            const parserConfig = JSON.parse(s.parser_config || '{}');
            let finalConfig = JSON.parse(s.config || '{}');

            // If sensor is an OpenWeather sensor, inject API key and coords
            if (parserConfig.driver === 'openweather') {
                if (OPENWEATHER_API_KEY && station.lat && station.lng) {
                     finalConfig = {
                        apikey: OPENWEATHER_API_KEY,
                        lat: station.lat,
                        lon: station.lng
                    };
                } else {
                    console.warn(`OpenWeather sensörü (ID: ${s.id}) için yapılandırma eksik. Sunucuda OPENWEATHER_API_KEY ayarlanmalı ve istasyonun koordinatları olmalı.`);
                }
            }
            
            return { 
                id: s.id, 
                name: s.name, 
                type: s.type,
                read_frequency: s.read_frequency,
                is_active: !!s.is_active, 
                interface: s.interface, 
                parser_config: parserConfig, 
                config: finalConfig 
            } as SensorConfig
        });


        const config: DeviceConfig = {
            sensors: sensorConfigs,
            cameras: cameras.map(c => ({ id: c.id, name: c.name, rtsp_url: c.rtsp_url }) as CameraConfig),
            global_read_frequency_seconds: global_read_frequency_seconds
        };
        res.json(config);
    } catch (e) {
        console.error(`Error fetching config for ${deviceId}:`, e);
        res.status(500).json({ error: 'Could not fetch device configuration.' });
    }
});

// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/submit-reading', authenticateDevice, async (req: express.Request, res: express.Response) => {
    const { sensor: sensorId, value } = req.body;
    console.log('✅ Received sensor reading:', JSON.stringify({ sensorId, value }, null, 2));

    if (!sensorId || value === undefined) return res.status(400).json({ error: 'Missing sensor ID or value.' });

    try {
        const sensor = await db.get('SELECT station_id FROM sensors WHERE id = ?', sensorId);
        if (!sensor) { console.warn(`Received reading for unknown sensor ID: ${sensorId}`); return res.status(404).json({ error: `Sensor with ID ${sensorId} not found.` }); }
        const timestamp = new Date().toISOString();
        await db.run('INSERT INTO readings (sensor_id, value, timestamp) VALUES (?, ?, ?)', sensorId, JSON.stringify(value), timestamp);
        await db.run('UPDATE sensors SET value = ?, last_update = ? WHERE id = ?', JSON.stringify(value), timestamp, sensorId);
        await db.run('UPDATE stations SET last_update = ? WHERE id = ?', timestamp, sensor.station_id);
        res.status(204).send();
    } catch (e) {
        console.error("Error processing incoming reading:", e);
        res.status(500).json({ error: 'Failed to save reading.' });
    }
});

// --- Command Endpoints for Agent ---
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/commands/:deviceId', authenticateDevice, async (req: express.Request, res: express.Response) => {
    const { deviceId } = req.params;
    try {
        const commands = await db.all("SELECT * FROM commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC", deviceId);
        // Set status to processing to prevent re-execution
        if (commands.length > 0) {
            const commandIds = commands.map(c => c.id);
            await db.run(`UPDATE commands SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id IN (${commandIds.map(() => '?').join(',')})`, ...commandIds);
        }
        res.json(commands.map(c => ({...c, payload: JSON.parse(c.payload)})));
    } catch (e) {
        console.error("Error fetching commands:", e);
        res.status(500).json({ error: "Failed to fetch commands." });
    }
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/commands/:commandId/:status', authenticateDevice, async (req: express.Request, res: express.Response) => {
    const { commandId, status } = req.params;
    if (!['complete', 'fail'].includes(status)) return res.status(400).json({ error: "Invalid status" });
    await db.run("UPDATE commands SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status === 'complete' ? 'completed' : 'failed', commandId);
    res.status(204).send();
});


// --- Frontend Endpoints ---

// STATIONS
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/stations', async (req: express.Request, res: express.Response) => { 
    // Fix: Explicitly alias columns to match frontend camelCase property names
    const rows = await db.all(`
        SELECT 
            s.id, s.name, s.location, s.lat, s.lng, s.status, 
            s.active_alerts AS activeAlerts, 
            s.last_update AS lastUpdate, 
            s.system_health AS systemHealth, 
            s.avg_battery AS avgBattery, 
            s.data_flow AS dataFlow, 
            s.active_sensor_count AS activeSensorCount, 
            s.online_camera_count AS onlineCameraCount,
            (SELECT COUNT(*) FROM sensors WHERE station_id = s.id) as sensorCount,
            (SELECT COUNT(*) FROM cameras WHERE station_id = s.id) as cameraCount
        FROM stations s
    `); 
    res.json(rows.map(dbStationToApi)); 
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/stations', async (req: express.Request, res: express.Response) => {
    const { id, name, location, locationCoords, selectedSensorIds, selectedCameraIds } = req.body;
    if (!id || !id.trim()) return res.status(400).json({ error: 'Device ID is required and cannot be empty.' });
    const existingStation = await db.get('SELECT id FROM stations WHERE id = ?', id);
    if (existingStation) return res.status(409).json({ error: `Station with device ID ${id} already exists.` });
    await db.run('INSERT INTO stations (id, name, location, lat, lng, status, last_update) VALUES (?, ?, ?, ?, ?, ?, ?)', id, name, location, locationCoords.lat, locationCoords.lng, 'active', new Date().toISOString());
    if (selectedSensorIds?.length > 0) await db.run(`UPDATE sensors SET station_id = ? WHERE id IN (${selectedSensorIds.map(() => '?').join(',')})`, id, ...selectedSensorIds);
    if (selectedCameraIds?.length > 0) await db.run(`UPDATE cameras SET station_id = ? WHERE id IN (${selectedCameraIds.map(() => '?').join(',')})`, id, ...selectedCameraIds);
    const newStation = await db.get('SELECT * FROM stations WHERE id = ?', id);
    if (!newStation) return res.status(404).json({ error: 'Could not find station after creation.' });
    res.status(201).json(dbStationToApi(newStation));
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.put('/stations/:id', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { name, location, locationCoords, status } = req.body;
    await db.run('UPDATE stations SET name = ?, location = ?, lat = ?, lng = ?, status = ? WHERE id = ?', name, location, locationCoords.lat, locationCoords.lng, status, id);
    const updatedStation = await db.get('SELECT * FROM stations WHERE id = ?', id);
    if (!updatedStation) return res.status(404).json({ error: 'Station not found.' });
    res.json(dbStationToApi(updatedStation));
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.delete('/stations/:id', async (req: express.Request, res: express.Response) => { await db.run('DELETE FROM stations WHERE id = ?', req.params.id); res.status(204).send(); });

// SENSORS
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/sensors', async (req: express.Request, res: express.Response) => {
    const rows = await db.all(req.query.unassigned === 'true' ? 'SELECT * FROM sensors WHERE station_id IS NULL' : 'SELECT * FROM sensors');
    res.json(rows.map(s => {
        const apiSensor = dbSensorToApi(s);
        try {
            const latestValue = s.value ? JSON.parse(s.value) : {};
            let finalValue: any = 0;

            const valueKey = SENSOR_TYPE_TO_VALUE_KEY[s.type];
            
            if (valueKey && typeof latestValue[valueKey] === 'number') {
                finalValue = latestValue[valueKey];
            } else {
                // Fallback: find the first numeric value
                const numericValue = Object.values(latestValue).find(v => typeof v === 'number');
                finalValue = typeof numericValue === 'number' ? numericValue : 0;
            }
            apiSensor.value = finalValue;
        } catch {
            apiSensor.value = 0;
        }
        return apiSensor;
    }));
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/sensors', async (req: express.Request, res: express.Response) => {
    const { name, stationId, type, isActive, interfaceType, interfaceConfig, parserConfig, readFrequency } = req.body;
    const newId = `S${Date.now()}`;
    const unit = SENSOR_UNIT_MAP[type] || '';
    await db.run('INSERT INTO sensors (id, name, station_id, type, status, is_active, battery, last_update, value, interface, config, parser_config, read_frequency, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', newId, name, stationId, type, isActive ? 'Aktif' : 'Pasif', isActive, 100, new Date().toISOString(), '{}', interfaceType, interfaceConfig, parserConfig, readFrequency, unit);
    const newSensor = await db.get('SELECT * FROM sensors WHERE id = ?', newId);
    if (!newSensor) return res.status(404).json({ error: 'Could not find sensor after creation.' });
    res.status(201).json(dbSensorToApi(newSensor));
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.put('/sensors/:id', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { name, stationId, type, isActive, interfaceType, interfaceConfig, parserConfig, readFrequency } = req.body;
    const unit = SENSOR_UNIT_MAP[type] || '';
     await db.run('UPDATE sensors SET name = ?, station_id = ?, type = ?, status = ?, is_active = ?, last_update = ?, interface = ?, config = ?, parser_config = ?, read_frequency = ?, unit = ? WHERE id = ?', name, stationId, type, isActive ? 'Aktif' : 'Pasif', isActive, new Date().toISOString(), interfaceType, interfaceConfig, parserConfig, readFrequency, unit, id);
    const updatedSensor = await db.get('SELECT * FROM sensors WHERE id = ?', id);
    if (!updatedSensor) return res.status(404).json({ error: 'Sensor not found.' });
    res.json(dbSensorToApi(updatedSensor));
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.delete('/sensors/:id', async (req: express.Request, res: express.Response) => { await db.run('DELETE FROM sensors WHERE id = ?', req.params.id); res.status(204).send(); });
// New endpoint to trigger a sensor read
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/sensors/:id/read', async (req: express.Request, res: express.Response) => {
    const { id: sensorId } = req.params;
    try {
        const sensor = await db.get('SELECT station_id FROM sensors WHERE id = ?', sensorId);
        if (!sensor || !sensor.station_id) {
            return res.status(404).json({ error: "Sensor not found or not assigned to a station." });
        }

        await db.run("INSERT INTO commands (device_id, command_type, payload) VALUES (?, ?, ?)",
            sensor.station_id,
            'FORCE_READ_SENSOR',
            JSON.stringify({ sensor_id: sensorId })
        );
        console.log(`📠 Force read command queued for sensor ${sensorId} on device ${sensor.station_id}`);
        res.status(202).json({ message: 'Force read command accepted.' });
    } catch (e) {
        console.error("Error creating force read command:", e);
        res.status(500).json({ error: "Failed to queue force read command." });
    }
});


// CAMERAS
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/cameras', async (req: express.Request, res: express.Response) => { const rows = await db.all(req.query.unassigned === 'true' ? 'SELECT * FROM cameras WHERE station_id IS NULL' : 'SELECT * FROM cameras'); res.json(rows.map(dbCameraToApi)); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/cameras', async (req: express.Request, res: express.Response) => {
    const { name, stationId, status, viewDirection, rtspUrl, cameraType } = req.body;
    const newId = `cam${Date.now()}`;
    await db.run('INSERT INTO cameras (id, name, station_id, status, view_direction, rtsp_url, camera_type, fps, stream_url, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', newId, name, stationId, status, viewDirection, rtspUrl, cameraType, 30, 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', '[]');
    const newCamera = await db.get('SELECT * FROM cameras WHERE id = ?', newId);
    if (!newCamera) return res.status(404).json({ error: 'Could not find camera after creation.' });
    res.status(201).json(dbCameraToApi(newCamera));
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.delete('/cameras/:id', async (req: express.Request, res: express.Response) => { await db.run('DELETE FROM cameras WHERE id = ?', req.params.id); res.status(204).send(); });

// New endpoint to trigger capture
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/cameras/:id/capture', async (req: express.Request, res: express.Response) => {
    const { id: cameraId } = req.params;
    try {
        const camera = await db.get('SELECT station_id FROM cameras WHERE id = ?', cameraId);
        if (!camera || !camera.station_id) return res.status(404).json({ error: "Camera not found or not assigned to a station." });
        
        await db.run("INSERT INTO commands (device_id, command_type, payload) VALUES (?, ?, ?)", camera.station_id, 'CAPTURE_IMAGE', JSON.stringify({ camera_id: cameraId }));
        console.log(`📸 Capture command queued for camera ${cameraId} on device ${camera.station_id}`);
        res.status(202).json({ message: 'Capture command accepted.' });
    } catch (e) {
        console.error("Error creating capture command:", e);
        res.status(500).json({ error: "Failed to queue capture command." });
    }
});
// New endpoint to receive uploaded photo
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/cameras/:id/upload-photo', authenticateDevice, async (req: express.Request, res: express.Response) => {
    const { id: cameraId } = req.params;
    const { image, filename } = req.body; // base64 encoded image
    if (!image || !filename) return res.status(400).json({ error: "Image data and filename are required." });

    try {
        await fs.mkdir(uploadsPath, { recursive: true });
        const imagePath = path.join(uploadsPath, filename);
        await fs.writeFile(imagePath, image, 'base64');
        console.log(`🖼️  Image saved: ${imagePath}`);

        const camera = await db.get('SELECT photos FROM cameras WHERE id = ?', cameraId);
        if (!camera) return res.status(404).json({ error: "Camera not found." });
        
        const photos = JSON.parse(camera.photos || '[]');
        photos.unshift(`/uploads/${filename}`); // Add to the beginning of the list

        await db.run('UPDATE cameras SET photos = ? WHERE id = ?', JSON.stringify(photos), cameraId);
        res.status(201).json({ message: "Photo uploaded successfully." });

    } catch (e) {
        console.error("Error uploading photo:", e);
        res.status(500).json({ error: "Failed to upload photo." });
    }
});

// New endpoint for snow depth analysis
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/analysis/snow-depth', async (req: express.Request, res: express.Response) => {
    const { cameraId, virtualSensorId } = req.body;
    if (!cameraId || !virtualSensorId) {
        return res.status(400).json({ error: "cameraId and virtualSensorId are required." });
    }
    try {
        const camera = await db.get('SELECT station_id FROM cameras WHERE id = ?', cameraId);
        if (!camera || !camera.station_id) return res.status(404).json({ error: "Camera not found or not assigned to a station." });

        await db.run("INSERT INTO commands (device_id, command_type, payload) VALUES (?, ?, ?)", 
            camera.station_id, 
            'ANALYZE_SNOW_DEPTH', 
            JSON.stringify({ camera_id: cameraId, virtual_sensor_id: virtualSensorId })
        );
        console.log(`❄️ Snow depth analysis command queued for camera ${cameraId} on device ${camera.station_id}`);
        res.status(202).json({ message: 'Snow depth analysis command accepted.' });

    } catch (e) {
        console.error("Error creating snow depth analysis command:", e);
        res.status(500).json({ error: "Failed to queue analysis command." });
    }
});

// New endpoint to receive analysis photo
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/analysis/upload-photo', authenticateDevice, async (req: express.Request, res: express.Response) => {
    const { cameraId, image, filename } = req.body; // base64 encoded image
    if (!cameraId || !image || !filename) {
        return res.status(400).json({ error: "cameraId, image data and filename are required." });
    }

    try {
        await fs.mkdir(analysisUploadsPath, { recursive: true });
        const imagePath = path.join(analysisUploadsPath, filename);
        await fs.writeFile(imagePath, image, 'base64');
        console.log(`🖼️ [ANALYSIS] Image saved: ${imagePath}`);

        const camera = await db.get('SELECT photos FROM cameras WHERE id = ?', cameraId);
        if (!camera) {
            console.warn(`Analysis image uploaded for a non-existent camera ID: ${cameraId}`);
            return res.status(201).json({ message: "Photo uploaded but camera not found in DB." });
        }
        
        const photos = JSON.parse(camera.photos || '[]');
        const photoUrl = `/uploads/analiz/${filename}`;
        photos.unshift(photoUrl);

        await db.run('UPDATE cameras SET photos = ? WHERE id = ?', JSON.stringify(photos), cameraId);
        res.status(201).json({ message: "Analysis photo uploaded and linked successfully." });

    } catch (e) {
        console.error("Error uploading analysis photo:", e);
        res.status(500).json({ error: "Failed to upload analysis photo." });
    }
});


// READINGS (for reports)
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/readings', async (req: express.Request, res: express.Response) => { const rows = await db.all(`SELECT r.id, r.sensor_id, r.value, r.timestamp, s.name as sensor_name, s.type as sensor_type, s.unit, st.id as station_id, st.name as station_name FROM readings r JOIN sensors s ON r.sensor_id = s.id JOIN stations st ON s.station_id = st.id ORDER BY r.timestamp DESC LIMIT 2000`); const formatted = rows.map(r => { try { const readingValue = r.value ? JSON.parse(r.value) : {}; let finalValue: any = 0; const valueKey = SENSOR_TYPE_TO_VALUE_KEY[r.sensor_type]; if (valueKey && typeof readingValue[valueKey] === 'number') { finalValue = readingValue[valueKey]; } else { const numericValue = Object.values(readingValue).find(v => typeof v === 'number'); finalValue = typeof numericValue === 'number' ? numericValue : 0; } return { id: r.id, sensorId: r.sensor_id, stationId: r.station_id, sensorName: r.sensor_name, stationName: r.station_name, sensorType: r.sensor_type, value: finalValue, unit: r.unit, timestamp: new Date(r.timestamp).toISOString(), }; } catch { return null; } }).filter(Boolean); res.json(formatted); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/readings/history', async (req: express.Request, res: express.Response) => {
    const { stationIds, sensorTypes, start, end } = req.query;
    if (!stationIds || !sensorTypes) return res.status(400).json({ error: 'stationIds and sensorTypes are required.' });
    
    const stationIdList = (stationIds as string).split(',');
    const sensorTypeList = (sensorTypes as string).split(',');
    
    const queryParams: (string|number)[] = [...stationIdList, ...sensorTypeList];
    let query = `SELECT r.value, r.timestamp, s.station_id, st.name as station_name, s.type as sensor_type 
                 FROM readings r 
                 JOIN sensors s ON r.sensor_id = s.id 
                 JOIN stations st ON s.station_id = st.id 
                 WHERE s.station_id IN (${stationIdList.map(() => '?').join(',')}) 
                 AND s.type IN (${sensorTypeList.map(() => '?').join(',')})`;

    if (start) {
        query += ` AND r.timestamp >= ?`;
        queryParams.push(start as string);
    }
    if (end) {
        // Fix: Ensure the end date includes the entire day
        const endDate = new Date(end as string);
        endDate.setUTCHours(23, 59, 59, 999);
        query += ` AND r.timestamp <= ?`;
        queryParams.push(endDate.toISOString());
    }
    query += ` ORDER BY r.timestamp ASC`;

    const rows = await db.all(query, ...queryParams);
    
    const formatted = rows.map(r => {
        try {
            const readingValue = JSON.parse(r.value);
            let finalValue: number | null = null;

            // Try to find value using the specific key for the sensor type
            const valueKey = SENSOR_TYPE_TO_VALUE_KEY[r.sensor_type];
            if (valueKey && typeof readingValue[valueKey] === 'number') {
                finalValue = readingValue[valueKey];
            } else {
                // Fallback: find the first numeric value in the object
                const numericValue = Object.values(readingValue).find(v => typeof v === 'number');
                if (typeof numericValue === 'number') {
                    finalValue = numericValue;
                }
            }

            if (finalValue === null) return null;

            return {
                timestamp: r.timestamp,
                stationId: r.station_id,
                stationName: r.station_name,
                sensorType: r.sensor_type,
                value: finalValue
            };
        } catch {
            return null;
        }
    }).filter(Boolean);
    
    res.json(formatted);
});

// DEFINITIONS
const allowedDefTypes = ['station_types', 'sensor_types', 'camera_types'];
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/definitions', async(req: express.Request, res: express.Response) => { const [stationTypes, sensorTypes, cameraTypes] = await Promise.all([ db.all('SELECT * FROM station_types'), db.all('SELECT * FROM sensor_types'), db.all('SELECT * FROM camera_types'), ]); res.json({ stationTypes, sensorTypes, cameraTypes }); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/definitions/:type', async (req: express.Request, res: express.Response) => { const { type } = req.params; const { name } = req.body; if (!allowedDefTypes.includes(type)) return res.status(400).json({ error: 'Invalid definition type.' }); if (!name) return res.status(400).json({ error: 'Name is required.' }); const result = await db.run(`INSERT INTO ${type} (name) VALUES (?)`, name); res.status(201).json({ id: result.lastID, name }); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.put('/definitions/:type/:id', async (req: express.Request, res: express.Response) => { const { type, id } = req.params; const { name } = req.body; if (!allowedDefTypes.includes(type)) return res.status(400).json({ error: 'Invalid definition type.' }); if (!name) return res.status(400).json({ error: 'Name is required.' }); await db.run(`UPDATE ${type} SET name = ? WHERE id = ?`, name, id); res.json({ id: parseInt(id), name }); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.delete('/definitions/:type/:id', async (req: express.Request, res: express.Response) => { const { type, id } = req.params; if (!allowedDefTypes.includes(type)) return res.status(400).json({ error: 'Invalid definition type.' }); await db.run(`DELETE FROM ${type} WHERE id = ?`, id); res.status(204).send(); });

// Global Settings
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/settings/global_read_frequency', async (req: express.Request, res: express.Response) => {
    const setting = await db.get("SELECT value FROM global_settings WHERE key = 'global_read_frequency_minutes'");
    res.json({ value: setting?.value || '0' });
});
// Fix: Use namespaced express types to avoid conflicts
apiRouter.put('/settings/global_read_frequency', async (req: express.Request, res: express.Response) => {
    const { value } = req.body;
    if (typeof value !== 'string' || isNaN(parseInt(value, 10))) {
        return res.status(400).json({ error: "Invalid value provided." });
    }
    await db.run("UPDATE global_settings SET value = ? WHERE key = 'global_read_frequency_minutes'", value);
    res.status(204).send();
});

// REPORTS, NOTIFICATIONS etc.
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/alert-rules', async (req: express.Request, res: express.Response) => res.json(await db.all('SELECT * FROM alert_rules')));
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/reports', async (req: express.Request, res: express.Response) => res.json(await db.all('SELECT * FROM reports ORDER BY created_at DESC')));
// Fix: Use namespaced express types to avoid conflicts
apiRouter.delete('/reports/:id', async (req: express.Request, res: express.Response) => { await db.run('DELETE FROM reports WHERE id = ?', req.params.id); res.status(204).send(); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/report-schedules', async (req: express.Request, res: express.Response) => res.json(await db.all('SELECT * FROM report_schedules')));
// Fix: Use namespaced express types to avoid conflicts
apiRouter.delete('/report-schedules/:id', async (req: express.Request, res: express.Response) => { await db.run('DELETE FROM report_schedules WHERE id = ?', req.params.id); res.status(204).send(); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.get('/notifications', async (req: express.Request, res: express.Response) => res.json(await db.all('SELECT * FROM notifications ORDER BY timestamp DESC')));
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/notifications/mark-all-read', async(req: express.Request, res: express.Response) => { await db.run('UPDATE notifications SET is_read = 1'); res.status(204).send(); });
// Fix: Use namespaced express types to avoid conflicts
apiRouter.delete('/notifications/clear-all', async(req: express.Request, res: express.Response) => { await db.run('DELETE FROM notifications'); res.status(204).send(); });

// --- Gemini Chat Proxy ---
let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;
if (GEMINI_API_KEY) { ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); const SYSTEM_INSTRUCTION = "Sen ORION platformu için geliştirilmiş, dünya standartlarında bir meteoroloji asistanısın. Kullanıcı sorularını açık ve öz bir şekilde yanıtla. Hava olaylarını açıklayabilir, sensör okumalarını yorumlayabilir ve trendlere göre tahminlerde bulunabilirsin. Cevaplarını her zaman Türkçe ver."; chat = ai.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction: SYSTEM_INSTRUCTION }, }); } else { console.warn('⚠️ GEMINI_API_KEY not set. Gemini Assistant will be disabled.'); }
// Fix: Use namespaced express types to avoid conflicts
apiRouter.post('/gemini-chat-stream', async (req: express.Request, res: express.Response) => { if (!chat) return res.status(503).json({ error: 'Gemini assistant is not configured on the server.' }); const { message } = req.body; if (!message) return res.status(400).json({ error: 'Message is required.' }); try { const stream = await chat.sendMessageStream({ message }); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Transfer-Encoding', 'chunked'); for await (const chunk of stream) { res.write(chunk.text); } res.end(); } catch (error) { console.error('Error streaming from Gemini:', error); res.status(500).json({ error: 'Failed to get response from assistant.' }); } });

// --- Middleware & Serving Order ---

// 1. All API routes are handled by the apiRouter under the /api prefix.
app.use('/api', apiRouter);

// 2. Serve static files from the /uploads directory.
app.use('/uploads', express.static(uploadsPath));

// 3. Serve all static assets (JS, CSS, images) from the frontend build directory.
//    express.static will automatically handle serving index.html for requests to '/'.
app.use(express.static(frontendDistPath));

// 4. Handle the favicon.ico request specifically to prevent it from falling through
//    to the SPA handler and causing a 500 error if the file doesn't exist.
// Fix: Use namespaced express types to avoid conflicts
app.get('/favicon.ico', (req: express.Request, res: express.Response) => res.status(204).send());

// 5. SPA Fallback: For any other GET request that hasn't been handled yet,
//    serve the main index.html file. This allows the client-side router (React Router) to take over.
//    This MUST be the last GET route handler.
// Fix: Use namespaced express types to avoid conflicts
app.get('*', (req: express.Request, res: express.Response) => {
    const indexPath = path.resolve(frontendDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error(`CRITICAL ERROR: Failed to send index.html. Path: ${indexPath}`, err);
            res.status(500).send(
                `<h1>Application Not Found</h1>` +
                `<p>The server could not find the main application file. Please ensure the frontend has been built correctly.</p>` +
                `<p><em>Checked path: ${indexPath}</em></p>`
            );
        }
    });
});

// --- Start Server ---
const startServer = async () => {
    // Ensure uploads directory exists
    await fs.mkdir(uploadsPath, { recursive: true });
    await fs.mkdir(analysisUploadsPath, { recursive: true });
    
    // Check if frontend has been built
    try {
        await fs.access(path.join(frontendDistPath, 'index.html'));
        console.log(`[SERVER_INIT] Frontend found at: ${frontendDistPath}`);
    } catch (e) {
        console.warn('--- UYARI ---');
        console.warn('Frontend build dosyaları bulunamadı. Lütfen ana dizinde `npm run build` komutunu çalıştırın veya Vite dev sunucusunu kullanın.');
        console.warn('Beklenen Dizin:', frontendDistPath);
        console.warn('-------------');
    }

    await openDb();
    await migrate();
    app.listen(port, () => {
        console.log(`🚀 Server is running at http://localhost:${port}`);
        if (!process.env.DEVICE_AUTH_TOKEN || process.env.DEVICE_AUTH_TOKEN === 'REPLACE_WITH_YOUR_SECURE_TOKEN') {
            console.warn(`⚠️  SECURITY WARNING: Using default DEVICE_AUTH_TOKEN.`);
        }
        if (!OPENWEATHER_API_KEY) {
            console.warn('⚠️  UYARI: OPENWEATHER_API_KEY ayarlanmamış. OpenWeather sanal sensörü çalışmayacaktır.');
        }
    });
};

startServer().catch(console.error);