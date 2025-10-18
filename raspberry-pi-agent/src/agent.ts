import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import {
    DeviceConfig,
    SensorConfig,
    ISensorDriver,
    ReadingPayload,
    AgentCommand,
    AgentState,
} from './types.js';

// --- Path Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// --- Timers ---
const CONFIG_POLL_INTERVAL = 60000; // 1 minute
const SENSOR_READ_INTERVAL = 10000; // 10 seconds (for quick demo, real world would be >60s)
const COMMAND_POLL_INTERVAL = 5000;  // 5 seconds

// Local config file structure
interface LocalConfig {
    server: { base_url: string };
    device: { id: string; token: string };
}

class Agent {
    private state: AgentState = AgentState.INITIALIZING;
    private config: DeviceConfig | null = null;
    private driverInstances: Map<string, ISensorDriver> = new Map();

    // Properties from local config
    private apiBaseUrl: string = '';
    private deviceId: string = '';
    private authToken: string = '';

    constructor(localConfig: LocalConfig) {
        this.apiBaseUrl = `${localConfig.server.base_url}/api`;
        this.deviceId = localConfig.device.id;
        this.authToken = localConfig.device.token;

        console.log(`🚀 ORION Agent Başlatılıyor... Cihaz ID: ${this.deviceId}`);
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
            const response = await axios.get<DeviceConfig>(`${this.apiBaseUrl}/config/${this.deviceId}`, {
                headers: { 'Authorization': `Token ${this.authToken}` },
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

            // Skip virtual sensors or specific AI-driven sensor types in the main reading loop.
            // These are triggered by commands, not polling.
            if (sensorConfig.interface === 'virtual' || sensorConfig.type === 'Kar Yüksekliği') {
                continue;
            }

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
            await axios.post(`${this.apiBaseUrl}/submit-reading`, payload, {
                headers: { 'Authorization': `Token ${this.authToken}` },
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
            const response = await axios.get<AgentCommand[]>(`${this.apiBaseUrl}/commands/${this.deviceId}`, {
                headers: { 'Authorization': `Token ${this.authToken}` },
            });
            const commands = response.data;
            if (commands.length > 0) {
                console.log(`📩 ${commands.length} yeni komut alındı.`);
                for (const command of commands) {
                    await this.executeCommand(command);
                }
            }
        } catch (error) {
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
            await axios.post(`${this.apiBaseUrl}/commands/${commandId}/${status}`, {}, {
                 headers: { 'Authorization': `Token ${this.authToken}` },
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
        const filename = `${timestamp}_${this.deviceId}_${camera_id}.jpg`;
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
            
            await axios.post(`${this.apiBaseUrl}/cameras/${camera_id}/upload-photo`, {
                image: base64Image,
                filename: filename
            }, {
                headers: { 'Authorization': `Token ${this.authToken}` },
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
        const cameraConfig = this.config?.cameras.find(c => c.id === camera_id);
        if (!cameraConfig) {
            console.error(`Analiz için kamera bulunamadı: ${camera_id}`);
            return false;
        }
        
        if (!process.env.API_KEY) {
            console.error('HATA: Gemini API anahtarı (API_KEY) ortam değişkenlerinde ayarlanmamış. Analiz yapılamıyor.');
            return false;
        }

        console.log(`❄️  Kar derinliği analizi başlatılıyor... Kamera: ${camera_id}`);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ANALYSIS_${timestamp}_${camera_id}.jpg`;
        const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
        const filepath = path.join(UPLOADS_DIR, filename);

        try {
            // 1. Capture image
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            // MOCK: In a real scenario, use ffmpeg or similar
            await fs.writeFile(filepath, "dummy image data for analysis");
            console.log(`   -> Analiz için mock görüntü kaydedildi: ${filepath}`);

            // 2. Read image to base64
            const imageBuffer = await fs.readFile(filepath);
            const base64Image = imageBuffer.toString('base64');
            
            // 3. Call Gemini API
            console.log('   -> Gemini API ile analiz ediliyor...');
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image,
                },
            };
            const textPart = {
                text: "Bu görüntüdeki kar ölçüm cetveline göre karla kaplı en yüksek sayısal değer nedir? Cevabını sadece `{\"snow_depth_cm\": SAYI}` formatında bir JSON olarak ver.",
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, textPart] },
            });
            
            if (!response.text) {
                console.error('   -> HATA: Gemini API boş yanıt döndü.');
                return false;
            }

            const resultText = response.text.trim();
            console.log(`   -> Gemini Yanıtı: ${resultText}`);

            // 4. Parse response and send reading
            const resultJson = JSON.parse(resultText.replace(/```json/g, '').replace(/```/g, ''));
            const snowDepth = resultJson.snow_depth_cm;

            if (typeof snowDepth !== 'number') {
                console.error('   -> HATA: Gemini yanıtından sayısal bir kar yüksekliği değeri alınamadı.');
                return false;
            }
            
            console.log(`   -> Analiz Sonucu: ${snowDepth} cm`);
            
            await this.sendReading({
                sensor: virtual_sensor_id,
                value: { snow_depth_cm: snowDepth }
            });

            // 5. Upload analyzed image to server for verification
            await axios.post(`${this.apiBaseUrl}/analysis/upload-photo`, {
                cameraId: camera_id,
                image: base64Image,
                filename: filename
            }, {
                headers: { 'Authorization': `Token ${this.authToken}` },
            });
            console.log(`   -> Analiz görüntüsü sunucuya yüklendi: ${filename}`);

            return true;

        } catch (error) {
            console.error(`HATA: Kar derinliği analizi başarısız oldu (Kamera: ${camera_id})`, error);
            return false;
        } finally {
            // Clean up temp file
            try {
                await fs.unlink(filepath);
            } catch (unlinkError: any) {
                // Ignore error if file doesn't exist, but log others
                if (unlinkError.code !== 'ENOENT') {
                    console.warn(`Geçici analiz dosyası silinemedi: ${filepath}`, unlinkError);
                }
            }
        }
    }
}


// --- Agent Startup ---
async function main() {
    try {
        console.log(`Yerel yapılandırma okunuyor: ${CONFIG_PATH}`);
        const configFile = await fs.readFile(CONFIG_PATH, 'utf-8');
        const localConfig: LocalConfig = JSON.parse(configFile);

        if (!localConfig.server?.base_url || !localConfig.device?.id || !localConfig.device?.token) {
            throw new Error("config.json dosyasında 'server.base_url', 'device.id', ve 'device.token' alanları zorunludur.");
        }

        const agent = new Agent(localConfig);
        agent.start().catch(error => {
            console.error("Agent çalışırken kritik bir hata oluştu:", error);
            process.exit(1);
        });

    } catch (error) {
        console.error("Agent başlatılamadı. config.json dosyası okunamadı veya geçersiz.", error);
        process.exit(1);
    }
}

main();