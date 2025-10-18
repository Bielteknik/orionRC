import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    DeviceConfig,
    SensorConfig,
    ISensorDriver,
    ReadingPayload,
    AgentCommand,
    AgentState,
} from './types.js';

// --- Configuration ---
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';
const DEVICE_ID = process.env.DEVICE_ID || 'ejder3200-01'; // Default for local dev
const AUTH_TOKEN = process.env.DEVICE_AUTH_TOKEN || 'EjderMeteo_Rpi_SecretKey_2025!';
const CONFIG_POLL_INTERVAL = 60000; // 1 minute
const SENSOR_READ_INTERVAL = 10000; // 10 seconds (for quick demo, real world would be >60s)
const COMMAND_POLL_INTERVAL = 5000;  // 5 seconds

// Fix: Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Agent {
    private state: AgentState = AgentState.INITIALIZING;
    private config: DeviceConfig | null = null;
    private driverInstances: Map<string, ISensorDriver> = new Map();

    constructor() {
        console.log(`🚀 ORION Agent Başlatılıyor... Cihaz ID: ${DEVICE_ID}`);
        this.setState(AgentState.INITIALIZING);
    }

    private setState(newState: AgentState) {
        if (this.state !== newState) {
            this.state = newState;
            console.log(`Durum Değişikliği: ${this.state}`);
        }
    }

    public async start() {
        await this.fetchConfig();
        
        setInterval(() => this.fetchConfig(), CONFIG_POLL_INTERVAL);
        setInterval(() => this.processSensors(), SENSOR_READ_INTERVAL);
        setInterval(() => this.checkForCommands(), COMMAND_POLL_INTERVAL);
    }

    private async fetchConfig() {
        console.log("🔄 Yapılandırma sunucudan alınıyor...");
        this.setState(AgentState.CONFIGURING);
        try {
            const response = await axios.get<DeviceConfig>(`${API_BASE_URL}/config/${DEVICE_ID}`, {
                headers: { 'Authorization': `Token ${AUTH_TOKEN}` },
            });
            this.config = response.data;
            console.log(`✅ Yapılandırma alındı: ${this.config.sensors.length} sensör, ${this.config.cameras.length} kamera.`);
            this.setState(AgentState.ONLINE);
        } catch (error) {
            this.setState(AgentState.OFFLINE);
            if (axios.isAxiosError(error)) {
                console.error(`❌ Yapılandırma alınamadı: ${error.message} (Durum: ${error.response?.status})`);
            } else {
                console.error('❌ Yapılandırma alınırken beklenmedik bir hata oluştu:', error);
            }
        }
    }

    private async processSensors() {
        if (this.state !== AgentState.ONLINE || !this.config) {
            return;
        }

        console.log("🌡️ Sensörler okunuyor...");
        for (const sensorConfig of this.config.sensors) {
            if (!sensorConfig.is_active) continue;

            console.log(`   - ${sensorConfig.name} (ID: ${sensorConfig.id})`);
            try {
                const driver = await this.loadDriver(sensorConfig.parser_config.driver);
                if (!driver) {
                    console.error(`     -> HATA: Sürücü bulunamadı: ${sensorConfig.parser_config.driver}`);
                    continue;
                }
                const reading = await driver.read(sensorConfig.config);
                if (reading) {
                    console.log(`     -> Okunan Değer:`, reading);
                    await this.sendReading({ sensor: sensorConfig.id, value: reading });
                } else {
                    console.warn(`     -> UYARI: ${sensorConfig.name} sensöründen veri okunamadı (null döndü).`);
                }
            } catch (error) {
                console.error(`     -> HATA: ${sensorConfig.name} sensörü okunurken hata oluştu:`, error);
            }
        }
    }

    private async loadDriver(driverName: string): Promise<ISensorDriver | null> {
        if (this.driverInstances.has(driverName)) {
            return this.driverInstances.get(driverName)!;
        }
        try {
            // Drivers are compiled to .js files in the dist directory
            const driverPath = `./drivers/${driverName}.driver.js`;
            const driverModule = await import(driverPath);
            const driverInstance: ISensorDriver = new driverModule.default();
            this.driverInstances.set(driverName, driverInstance);
            return driverInstance;
        } catch (error) {
            console.error(`Sürücü yüklenemedi: ${driverName}`, error);
            return null;
        }
    }

    private async sendReading(payload: ReadingPayload) {
        try {
            await axios.post(`${API_BASE_URL}/submit-reading`, payload, {
                headers: { 'Authorization': `Token ${AUTH_TOKEN}` },
            });
            console.log(`     -> ✅ Değer sunucuya gönderildi (Sensör ID: ${payload.sensor})`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`     -> ❌ Değer gönderilemedi: ${error.message}`);
            } else {
                console.error('     -> ❌ Değer gönderilirken beklenmedik hata:', error);
            }
        }
    }

    private async checkForCommands() {
        if (this.state !== AgentState.ONLINE) return;
        
        try {
            const response = await axios.get<AgentCommand[]>(`${API_BASE_URL}/commands/${DEVICE_ID}`, {
                headers: { 'Authorization': `Token ${AUTH_TOKEN}` },
            });
            const commands = response.data;
            if (commands.length > 0) {
                console.log(`📩 ${commands.length} yeni komut alındı.`);
                for (const command of commands) {
                    await this.executeCommand(command);
                }
            }
        } catch (error) {
            // It's normal to get 404 or empty responses, so we don't log errors unless it's a server failure.
            if (axios.isAxiosError(error) && error.response?.status !== 404) {
                 console.error(`Komutlar kontrol edilirken hata: ${error.message}`);
            }
        }
    }

    private async executeCommand(command: AgentCommand) {
        console.log(`⚡ Komut yürütülüyor: ${command.command_type} (ID: ${command.id})`);
        let success = false;
        try {
            switch (command.command_type) {
                case 'CAPTURE_IMAGE':
                    success = await this.captureImage(command);
                    break;
                case 'ANALYZE_SNOW_DEPTH':
                    success = await this.analyzeSnowDepth(command);
                    break;
                default:
                    console.warn(`Bilinmeyen komut tipi: ${command.command_type}`);
                    break;
            }
            await this.updateCommandStatus(command.id, success ? 'complete' : 'fail');
        } catch (error) {
            console.error(`Komut yürütülürken hata oluştu (ID: ${command.id}):`, error);
            await this.updateCommandStatus(command.id, 'fail');
        }
    }
    
    private async updateCommandStatus(commandId: number, status: 'complete' | 'fail') {
        try {
            await axios.post(`${API_BASE_URL}/commands/${commandId}/${status}`, {}, {
                 headers: { 'Authorization': `Token ${AUTH_TOKEN}` },
            });
            console.log(`✅ Komut durumu güncellendi: ID ${commandId} -> ${status}`);
        } catch (error) {
             console.error(`❌ Komut durumu güncellenemedi (ID: ${commandId}):`, error);
        }
    }

    private async captureImage(command: AgentCommand): Promise<boolean> {
        const { camera_id } = command.payload;
        const cameraConfig = this.config?.cameras.find(c => c.id === camera_id);

        if (!cameraConfig) {
            console.error(`Fotoğraf çekilemedi: Kamera ID'si ${camera_id} yapılandırmada bulunamadı.`);
            return false;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}_${DEVICE_ID}_${camera_id}.jpg`;
        const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
        const filepath = path.join(UPLOADS_DIR, filename);

        console.log(`📸 Fotoğraf çekiliyor: ${cameraConfig.name}...`);

        try {
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            
            // This is a mock capture. In a real scenario, you'd use a library
            // like `node-webcam` or execute a command-line tool like `fswebcam` or `ffmpeg`.
            // For example: `ffmpeg -i ${cameraConfig.rtsp_url} -vframes 1 ${filepath}`
            
            // Mock implementation: create a dummy file.
            await fs.writeFile(filepath, "dummy image data");
            console.log(`🖼️  Mock görüntü kaydedildi: ${filepath}`);

            // Read the file and send it as base64
            const imageBuffer = await fs.readFile(filepath);
            const base64Image = imageBuffer.toString('base64');
            
            await axios.post(`${API_BASE_URL}/cameras/${camera_id}/upload-photo`, {
                image: base64Image,
                filename: filename
            }, {
                headers: { 'Authorization': `Token ${AUTH_TOKEN}` },
            });

            console.log(`🚀 Fotoğraf sunucuya yüklendi: ${filename}`);
            
            // Clean up local file after upload
            await fs.unlink(filepath);
            
            return true;

        } catch (error) {
            console.error(`HATA: Fotoğraf çekme veya yükleme başarısız oldu (Kamera: ${camera_id})`, error);
            return false;
        }
    }

    private async analyzeSnowDepth(command: AgentCommand): Promise<boolean> {
        const { camera_id, virtual_sensor_id } = command.payload;
        if (!virtual_sensor_id) {
            console.error('Kar derinliği analizi için virtual_sensor_id gerekli.');
            return false;
        }

        console.log(`❄️  Kar derinliği analizi başlatılıyor... Kamera: ${camera_id}`);
        // Here you would run your Python script for image analysis.
        // We'll mock the result.
        
        try {
            // 1. Capture an image (reuse capture logic, maybe without uploading)
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ANALYSIS_${timestamp}_${camera_id}.jpg`;
            // In a real scenario, you'd capture a real image here.
            
            // 2. Mock analysis result
            const mockSnowDepth = parseFloat((Math.random() * 50 + 5).toFixed(1)); // Random depth between 5 and 55 cm
            console.log(`   -> Mock Analiz Sonucu: ${mockSnowDepth} cm`);
            
            // 3. Send the result as if it's a sensor reading
            await this.sendReading({
                sensor: virtual_sensor_id,
                value: { snow_depth_cm: mockSnowDepth }
            });

            // 4. (Optional) Upload the analyzed image for verification
            // This part is simplified. In reality, you'd save an actual image.
            const dummyImage = "dummy analysis image data";
             await axios.post(`${API_BASE_URL}/analysis/upload-photo`, {
                cameraId: camera_id,
                image: Buffer.from(dummyImage).toString('base64'),
                filename: filename
            }, {
                headers: { 'Authorization': `Token ${AUTH_TOKEN}` },
            });
            console.log(`   -> Analiz görüntüsü sunucuya yüklendi: ${filename}`);
            
            return true;
        } catch (error) {
            console.error(`HATA: Kar derinliği analizi başarısız oldu (Kamera: ${camera_id})`, error);
            return false;
        }
    }

}


// --- Agent Başlatma ---
const agent = new Agent();
agent.start().catch(error => {
    console.error("Agent başlatılırken kritik bir hata oluştu:", error);
    process.exit(1);
});
