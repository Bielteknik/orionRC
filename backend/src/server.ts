
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { transformFileAsync } from '@babel/core';
import { GoogleGenAI, Chat } from "@google/genai";
import { openDb, db, migrate } from './database';
import { DeviceConfig, SensorConfig, CameraConfig } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;
const DEVICE_AUTH_TOKEN = process.env.DEVICE_AUTH_TOKEN || 'EjderMeteo_Rpi_SecretKey_2025!';
const GEMINI_API_KEY = process.env.API_KEY;

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
    'Ağırlık': 'gr'
};

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images

// FIX: Added explicit types from express import to resolve handler type errors.
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// FIX: Added explicit types from express import to resolve handler type errors.
const authenticateDevice = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Token ${DEVICE_AUTH_TOKEN}`;
    if (!authHeader || authHeader !== expectedToken) {
        console.warn(`Authentication failed from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
};

const apiRouter = express.Router();
app.use('/api', apiRouter);

// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/', (req: Request, res: Response) => {
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

// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/config/:deviceId', authenticateDevice, async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    console.log(`Configuration requested for device: ${deviceId}`);
    try {
        const station = await db.get('SELECT * FROM stations WHERE id = ?', deviceId);
        if (!station) return res.status(404).json({ error: `Station with device ID ${deviceId} not found.` });

        const sensors = await db.all('SELECT * FROM sensors WHERE station_id = ? AND is_active = 1', deviceId);
        const cameras = await db.all('SELECT id, name, rtsp_url FROM cameras WHERE station_id = ?', deviceId);
        
        const config: DeviceConfig = {
            sensors: sensors.map(s => ({ id: s.id, name: s.name, is_active: !!s.is_active, interface: s.interface, parser_config: JSON.parse(s.parser_config), config: JSON.parse(s.config) }) as SensorConfig),
            cameras: cameras.map(c => ({ id: c.id, name: c.name, rtsp_url: c.rtsp_url }) as CameraConfig)
        };
        res.json(config);
    } catch (e) {
        console.error(`Error fetching config for ${deviceId}:`, e);
        res.status(500).json({ error: 'Could not fetch device configuration.' });
    }
});


// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/submit-reading', authenticateDevice, async (req: Request, res: Response) => {
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
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/commands/:deviceId', authenticateDevice, async (req: Request, res: Response) => {
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
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/commands/:commandId/:status', authenticateDevice, async (req: Request, res: Response) => {
    const { commandId, status } = req.params;
    if (!['complete', 'fail'].includes(status)) return res.status(400).json({ error: "Invalid status" });
    await db.run("UPDATE commands SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status === 'complete' ? 'completed' : 'failed', commandId);
    res.status(204).send();
});


// --- Frontend Endpoints ---

// STATIONS
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/stations', async (req: Request, res: Response) => { const rows = await db.all('SELECT * FROM stations'); res.json(rows.map(dbStationToApi)); });
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/stations', async (req: Request, res: Response) => {
    const { id, name, location, locationCoords, selectedSensorIds, selectedCameraIds } = req.body;
    if (!id || !id.trim()) return res.status(400).json({ error: 'Device ID is required and cannot be empty.' });
    const existingStation = await db.get('SELECT id FROM stations WHERE id = ?', id);
    if (existingStation) return res.status(409).json({ error: `Station with device ID ${id} already exists.` });
    await db.run('INSERT INTO stations (id, name, location, lat, lng, status, sensor_count, camera_count, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, name, location, locationCoords.lat, locationCoords.lng, 'active', selectedSensorIds.length, selectedCameraIds.length, new Date().toISOString());
    if (selectedSensorIds?.length > 0) await db.run(`UPDATE sensors SET station_id = ? WHERE id IN (${selectedSensorIds.map(() => '?').join(',')})`, id, ...selectedSensorIds);
    if (selectedCameraIds?.length > 0) await db.run(`UPDATE cameras SET station_id = ? WHERE id IN (${selectedCameraIds.map(() => '?').join(',')})`, id, ...selectedCameraIds);
    const newStation = await db.get('SELECT * FROM stations WHERE id = ?', id);
    if (!newStation) return res.status(404).json({ error: 'Could not find station after creation.' });
    res.status(201).json(dbStationToApi(newStation));
});
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.put('/stations/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, location, locationCoords, status } = req.body;
    await db.run('UPDATE stations SET name = ?, location = ?, lat = ?, lng = ?, status = ? WHERE id = ?', name, location, locationCoords.lat, locationCoords.lng, status, id);
    const updatedStation = await db.get('SELECT * FROM stations WHERE id = ?', id);
    if (!updatedStation) return res.status(404).json({ error: 'Station not found.' });
    res.json(dbStationToApi(updatedStation));
});
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.delete('/stations/:id', async (req: Request, res: Response) => { await db.run('DELETE FROM stations WHERE id = ?', req.params.id); res.status(204).send(); });

// SENSORS
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/sensors', async (req: Request, res: Response) => {
    const rows = await db.all(req.query.unassigned === 'true' ? 'SELECT * FROM sensors WHERE station_id IS NULL' : 'SELECT * FROM sensors');
    res.json(rows.map(s => { const apiSensor = dbSensorToApi(s); try { const latestValue = s.value ? JSON.parse(s.value) : {}; const numericValue = Object.values(latestValue).find(v => typeof v === 'number'); apiSensor.value = typeof numericValue === 'number' ? numericValue : 0; } catch { apiSensor.value = 0; } return apiSensor; }));
});
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/sensors', async (req: Request, res: Response) => {
    const { name, stationId, type, isActive, interfaceType, interfaceConfig, parserConfig, readFrequency } = req.body;
    const newId = `S${Date.now()}`;
    const unit = SENSOR_UNIT_MAP[type] || '';
    await db.run('INSERT INTO sensors (id, name, station_id, type, status, is_active, battery, last_update, value, interface, config, parser_config, read_frequency, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', newId, name, stationId, type, isActive ? 'Aktif' : 'Pasif', isActive, 100, new Date().toISOString(), '{}', interfaceType, interfaceConfig, parserConfig, readFrequency, unit);
    const newSensor = await db.get('SELECT * FROM sensors WHERE id = ?', newId);
    if (!newSensor) return res.status(404).json({ error: 'Could not find sensor after creation.' });
    res.status(201).json(dbSensorToApi(newSensor));
});
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.put('/sensors/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, stationId, type, isActive, interfaceType, interfaceConfig, parserConfig, readFrequency } = req.body;
    const unit = SENSOR_UNIT_MAP[type] || '';
     await db.run('UPDATE sensors SET name = ?, station_id = ?, type = ?, status = ?, is_active = ?, last_update = ?, interface = ?, config = ?, parser_config = ?, read_frequency = ?, unit = ? WHERE id = ?', name, stationId, type, isActive ? 'Aktif' : 'Pasif', isActive, new Date().toISOString(), interfaceType, interfaceConfig, parserConfig, readFrequency, unit, id);
    const updatedSensor = await db.get('SELECT * FROM sensors WHERE id = ?', id);
    if (!updatedSensor) return res.status(404).json({ error: 'Sensor not found.' });
    res.json(dbSensorToApi(updatedSensor));
});
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.delete('/sensors/:id', async (req: Request, res: Response) => { await db.run('DELETE FROM sensors WHERE id = ?', req.params.id); res.status(204).send(); });

// CAMERAS
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/cameras', async (req: Request, res: Response) => { const rows = await db.all(req.query.unassigned === 'true' ? 'SELECT * FROM cameras WHERE station_id IS NULL' : 'SELECT * FROM cameras'); res.json(rows.map(dbCameraToApi)); });
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/cameras', async (req: Request, res: Response) => {
    const { name, stationId, status, viewDirection, rtspUrl, cameraType } = req.body;
    const newId = `cam${Date.now()}`;
    await db.run('INSERT INTO cameras (id, name, station_id, status, view_direction, rtsp_url, camera_type, fps, stream_url, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', newId, name, stationId, status, viewDirection, rtspUrl, cameraType, 30, 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', '[]');
    const newCamera = await db.get('SELECT * FROM cameras WHERE id = ?', newId);
    if (!newCamera) return res.status(404).json({ error: 'Could not find camera after creation.' });
    res.status(201).json(dbCameraToApi(newCamera));
});
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.delete('/cameras/:id', async (req: Request, res: Response) => { await db.run('DELETE FROM cameras WHERE id = ?', req.params.id); res.status(204).send(); });

// New endpoint to trigger capture
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/cameras/:id/capture', async (req: Request, res: Response) => {
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
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/cameras/:id/upload-photo', authenticateDevice, async (req: Request, res: Response) => {
    const { id: cameraId } = req.params;
    const { image, filename } = req.body; // base64 encoded image
    if (!image || !filename) return res.status(400).json({ error: "Image data and filename are required." });

    try {
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        const imagePath = path.join(uploadsDir, filename);
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


// READINGS (for reports)
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/readings', async (req: Request, res: Response) => { const rows = await db.all(`SELECT r.id, r.sensor_id, r.value, r.timestamp, s.name as sensor_name, s.type as sensor_type, s.unit, st.id as station_id, st.name as station_name FROM readings r JOIN sensors s ON r.sensor_id = s.id JOIN stations st ON s.station_id = st.id ORDER BY r.timestamp DESC LIMIT 2000`); const formatted = rows.map(r => { try { const readingValue = r.value ? JSON.parse(r.value) : {}; const numericValue = Object.values(readingValue).find(v => typeof v === 'number'); return { id: r.id, sensorId: r.sensor_id, stationId: r.station_id, sensorName: r.sensor_name, stationName: r.station_name, sensorType: r.sensor_type, value: typeof numericValue === 'number' ? numericValue : 0, unit: r.unit, timestamp: new Date(r.timestamp).toISOString(), }; } catch { return null; } }).filter(Boolean); res.json(formatted); });
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/readings/history', async (req: Request, res: Response) => {
    const { stationIds, sensorTypes, start, end } = req.query;
    if (!stationIds || !sensorTypes) return res.status(400).json({ error: 'stationIds and sensorTypes are required.' });
    const stationIdList = (stationIds as string).split(',');
    const sensorTypeList = (sensorTypes as string).split(',');
    const rows = await db.all(`SELECT r.value, r.timestamp, s.station_id, st.name as station_name, s.type as sensor_type FROM readings r JOIN sensors s ON r.sensor_id = s.id JOIN stations st ON s.station_id = st.id WHERE s.station_id IN (${stationIdList.map(() => '?').join(',')}) AND s.type IN (${sensorTypeList.map(() => '?').join(',')}) ${start ? `AND r.timestamp >= ?` : ''} ${end ? `AND r.timestamp <= ?` : ''} ORDER BY r.timestamp ASC`, ...stationIdList, ...sensorTypeList, ...(start ? [start as string] : []), ...(end ? [end as string] : []));
    const formatted = rows.map(r => { try { const readingValue = JSON.parse(r.value); const key = Object.keys(readingValue)[0]; return { timestamp: r.timestamp, stationId: r.station_id, stationName: r.station_name, sensorType: r.sensor_type, value: readingValue[key] }; } catch { return null; } }).filter(Boolean);
    res.json(formatted);
});

// DEFINITIONS
const allowedDefTypes = ['station_types', 'sensor_types', 'camera_types'];
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/definitions', async(req: Request, res: Response) => { const [stationTypes, sensorTypes, cameraTypes] = await Promise.all([ db.all('SELECT * FROM station_types'), db.all('SELECT * FROM sensor_types'), db.all('SELECT * FROM camera_types'), ]); res.json({ stationTypes, sensorTypes, cameraTypes }); });
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/definitions/:type', async (req: Request, res: Response) => { const { type } = req.params; const { name } = req.body; if (!allowedDefTypes.includes(type)) return res.status(400).json({ error: 'Invalid definition type.' }); if (!name) return res.status(400).json({ error: 'Name is required.' }); const result = await db.run(`INSERT INTO ${type} (name) VALUES (?)`, name); res.status(201).json({ id: result.lastID, name }); });
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.put('/definitions/:type/:id', async (req: Request, res: Response) => { const { type, id } = req.params; const { name } = req.body; if (!allowedDefTypes.includes(type)) return res.status(400).json({ error: 'Invalid definition type.' }); if (!name) return res.status(400).json({ error: 'Name is required.' }); await db.run(`UPDATE ${type} SET name = ? WHERE id = ?`, name, id); res.json({ id: parseInt(id), name }); });
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.delete('/definitions/:type/:id', async (req: Request, res: Response) => { const { type, id } = req.params; if (!allowedDefTypes.includes(type)) return res.status(400).json({ error: 'Invalid definition type.' }); await db.run(`DELETE FROM ${type} WHERE id = ?`, id); res.status(204).send(); });

// REPORTS, NOTIFICATIONS etc.
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/alert-rules', async (req: Request, res: Response) => res.json(await db.all('SELECT * FROM alert_rules')));
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/reports', async (req: Request, res: Response) => res.json(await db.all('SELECT * FROM reports ORDER BY created_at DESC')));
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/report-schedules', async (req: Request, res: Response) => res.json(await db.all('SELECT * FROM report_schedules')));
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.get('/notifications', async (req: Request, res: Response) => res.json(await db.all('SELECT * FROM notifications ORDER BY timestamp DESC')));
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/notifications/mark-all-read', async(req: Request, res: Response) => { await db.run('UPDATE notifications SET is_read = 1'); res.status(204).send(); });
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.delete('/notifications/clear-all', async(req: Request, res: Response) => { await db.run('DELETE FROM notifications'); res.status(204).send(); });

// --- Gemini Chat Proxy ---
let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;
if (GEMINI_API_KEY) { ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); const SYSTEM_INSTRUCTION = "Sen ORION platformu için geliştirilmiş, dünya standartlarında bir meteoroloji asistanısın. Kullanıcı sorularını açık ve öz bir şekilde yanıtla. Hava olaylarını açıklayabilir, sensör okumalarını yorumlayabilir ve trendlere göre tahminlerde bulunabilirsin. Cevaplarını her zaman Türkçe ver."; chat = ai.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction: SYSTEM_INSTRUCTION }, }); } else { console.warn('⚠️ GEMINI_API_KEY not set. Gemini Assistant will be disabled.'); }
// FIX: Added explicit types from express import to resolve handler type errors.
apiRouter.post('/gemini-chat-stream', async (req: Request, res: Response) => { if (!chat) return res.status(503).json({ error: 'Gemini assistant is not configured on the server.' }); const { message } = req.body; if (!message) return res.status(400).json({ error: 'Message is required.' }); try { const stream = await chat.sendMessageStream({ message }); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Transfer-Encoding', 'chunked'); for await (const chunk of stream) { res.write(chunk.text); } res.end(); } catch (error) { console.error('Error streaming from Gemini:', error); res.status(500).json({ error: 'Failed to get response from assistant.' }); } });

// --- Frontend Serving ---
const httpdocsPath = path.join(__dirname, '..', '..', 'httpdocs');
const uploadsPath = path.join(__dirname, '..', '..', 'uploads');

app.use('/uploads', express.static(uploadsPath));

// FIX: Added explicit types from express import to resolve handler type errors.
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const filePath = path.join(httpdocsPath, req.path);
  const possiblePaths = [ filePath, `${filePath}.ts`, `${filePath}.tsx` ];
  let actualPath: string | null = null;

  for (const p of possiblePaths) { try { await fs.access(p, fs.constants.F_OK); actualPath = p; break; } catch (e) { /* continue */ } }

  if (actualPath && (actualPath.endsWith('.tsx') || actualPath.endsWith('.ts'))) {
    try {
      const result = await transformFileAsync(actualPath, { presets: ['@babel/preset-react', ['@babel/preset-typescript', { allowDeclareFields: true, allExtensions: true, isTSX: true }]], filename: actualPath, sourceMaps: 'inline' });
      if (result?.code) { res.setHeader('Content-Type', 'application/javascript; charset=utf-8'); res.send(result.code); } else { res.sendStatus(500); }
    } catch (err: any) {
      console.error(`Babel transformation error for ${req.path}:\n`, err);
      res.status(500).send(`<pre>Error transforming ${req.path}:\n${err.message}</pre>`);
    }
  } else { next(); }
});

app.use(express.static(httpdocsPath));
// FIX: Added explicit types from express import to resolve handler type errors.
app.get('*', (req: Request, res: Response) => { res.sendFile(path.join(httpdocsPath, 'index.html')); });

// --- Start Server ---
const startServer = async () => {
    await fs.mkdir(uploadsPath, { recursive: true }); // Ensure uploads directory exists
    await openDb();
    await migrate();
    app.listen(port, () => {
        console.log(`🚀 Server is running at http://localhost:${port}`);
        if (!process.env.DEVICE_AUTH_TOKEN || process.env.DEVICE_AUTH_TOKEN === 'REPLACE_WITH_YOUR_SECURE_TOKEN') {
            console.warn(`⚠️  SECURITY WARNING: Using default DEVICE_AUTH_TOKEN.`);
        }
    });
};

startServer().catch(console.error);
