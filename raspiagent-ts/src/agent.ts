import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
// FIX: Import Type for responseSchema
import { GoogleGenAI, Type } from "@google/genai";
import {
    DeviceConfig,
    SensorConfig,
    ISensorDriver,
    ReadingPayload,
    AgentCommand,
    AgentState,
} from './types.js';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

// --- Path Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// --- Timers ---
const CONFIG_POLL_INTERVAL = 60000; // 1 minute
const SENSOR_READ_INTERVAL = 1000;  // Check every second if a sensor needs to be read
const COMMAND_POLL_INTERVAL = 5000; // 5 seconds

// Local config file structure
interface LocalConfig {
    server: { base_url: string };
    device: { id: string; token: string };
}

const GEMINI_SNOW_DEPTH_PROMPT = `Sen meteorolojik veri için görüntü analizi yapan bir uzmansın. Görevin, kar cetveli içeren bu görüntüden santimetre cinsinden kar derinliğini belirlemek.

Bu adımları dikkatlice izle:
1.  **Cetveli Bul:** Görüntüdeki kar ölçüm cetvelini bul. Genellikle üzerinde sayısal işaretler olan dikey bir nesnedir.
2.  **Kar Seviyesini Belirle:** Karla kaplı zemin ile cetvelin görünen kısmı arasındaki ortalama sınırı, yani kar çizgisini belirle. Tekil kar birikintileri veya erimiş alanları değil, genel kar seviyesini dikkate al.
3.  **Değeri Oku:** Cetvel üzerinde, belirlediğin bu ortalama kar çizgisine denk gelen en yakın sayısal değeri oku.
4.  **Doğrula ve Yanıtla:** Değeri net bir şekilde belirleyebiliyorsan, bu değeri ver. Görüntü net değilse, cetvel görünmüyorsa, kar seviyesi anlaşılamıyorsa veya derinliği güvenilir bir şekilde belirleyemiyorsan, -1 değerini döndür.

Nihai cevabını SADECE şu JSON formatında ver:
{"snow_depth_cm": SAYI}

Örnek: Eğer kar seviyesi ortalama 80cm çizgisindeyse, cevabın şöyle olmalı:
{"snow_depth_cm": 80}`;

class Agent {
    private state: AgentState = AgentState.INITIALIZING;
    private config: DeviceConfig | null = null;
    private driverInstances: Map<string, ISensorDriver> = new Map();
    private lastReadTimes: Map<string, number> = new Map();
    private globalReadFrequencySeconds?: number;

    // Properties from local config
    private apiBaseUrl: string = '';
    private deviceId: string = '';
    private authToken: string = '';
    private geminiApiKey?: string;
    
    private running: boolean = false;
    // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> to avoid dependency on Node.js-specific types which are not correctly resolved.
    private timers: ReturnType<typeof setTimeout>[] = [];

    constructor(localConfig: LocalConfig) {
        this.apiBaseUrl = localConfig.server.base_url;
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
        this.running = true;
        // Initial fetch, then start loops
        await this.fetchConfig();
        
        this.configLoop();
        this.sensorLoop();
        this.commandLoop();
    }
    
    public shutdown() {
        console.log("\n🚫 Agent durduruluyor... Kaynaklar temizleniyor.");
        this.running = false;
        this.timers.forEach(clearTimeout);
        console.log("✅ Zamanlayıcılar durduruldu.");
        // In the future, any open connections or hardware resources can be closed here.
        console.log("✅ Güvenli çıkış tamamlandı.");
    }

    private async configLoop() {
        if (!this.running) return;
        try {
            await this.fetchConfig();
        } catch (e) {
            console.error("Yapılandırma döngüsünde hata:", e);
        } finally {
            if (this.running) {
                const timer = setTimeout(() => this.configLoop(), CONFIG_POLL_INTERVAL);
                this.timers.push(timer);
            }
        }
    }

    private async sensorLoop() {
        if (!this.running) return;
        try {
            await this.processSensors();
        } catch (e) {
            console.error("Sensör döngüsünde hata:", e);
        } finally {
            if (this.running) {
                const timer = setTimeout(() => this.sensorLoop(), SENSOR_READ_INTERVAL);
                this.timers.push(timer);
            }
        }
    }

    private async commandLoop() {
        if (!this.running) return;
        try {
            await this.checkForCommands();
        } catch (e) {
            console.error("Komut döngüsünde hata:", e);
        } finally {
            if (this.running) {
                const timer = setTimeout(() => this.commandLoop(), COMMAND_POLL_INTERVAL);
                this.timers.push(timer);
            }
        }
    }

    private async fetchConfig() {
        console.log("🔄 Yapılandırma sunucudan alınıyor...");
        this.setState(AgentState.CONFIGURING);
        try {
            const response = await axios.get<DeviceConfig>(`${this.apiBaseUrl}/config/${this.deviceId}`, {
                headers: { 'Authorization': `Token ${this.authToken}` },
            });
            this.config = response.data;
            this.globalReadFrequencySeconds = this.config.global_read_frequency_seconds;
            this.geminiApiKey = this.config.gemini_api_key;
            console.log(`✅ Yapılandırma alındı: ${this.config.sensors.length} sensör, ${this.config.cameras.length} kamera. Global frekans: ${this.globalReadFrequencySeconds || 'devre dışı'}`);
            if(this.geminiApiKey) {
                console.log("   -> Gemini API anahtarı başarıyla alındı.");
            } else {
                console.warn("   -> UYARI: Sunucudan Gemini API anahtarı alınamadı. Görüntü analizi özellikleri çalışmayabilir.");
            }
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

    private getEffectiveFrequency(sensorConfig: SensorConfig): number {
        return (this.globalReadFrequencySeconds && this.globalReadFrequencySeconds > 0)
            ? this.globalReadFrequencySeconds
            : sensorConfig.read_frequency || 300;
    }

    private async processSensors() {
        if (this.state !== AgentState.ONLINE || !this.config) {
            return;
        }

        const now = Date.now();
        const activeSensors = this.config.sensors.filter(s => s.is_active && s.interface !== 'virtual' && s.type !== 'Kar Yüksekliği');

        // Sequentially iterate through each sensor. This is the main loop.
        for (const sensorConfig of activeSensors) {
            const lastRead = this.lastReadTimes.get(sensorConfig.id) || 0;
            const readFrequency = this.getEffectiveFrequency(sensorConfig);

            if (now - lastRead >= readFrequency * 1000) {
                console.log(`[OKUMA BAŞLADI] ${sensorConfig.name} (ID: ${sensorConfig.id})`);
                this.lastReadTimes.set(sensorConfig.id, now);

                const driverName = sensorConfig.parser_config?.driver;
                if (!driverName || typeof driverName !== 'string') {
                    console.error(`  -> HATA: ${sensorConfig.name} (ID: ${sensorConfig.id}) için 'driver' tanımlanmamış. Lütfen web arayüzünden sensörün 'Ayrıştırıcı Yapılandırması' alanını kontrol edin.`);
                    console.log(`[OKUMA BİTTİ] ${sensorConfig.name} - Hatalı Yapılandırma`);
                    continue; // Skip this misconfigured sensor
                }

                try {
                    const driver = await this.loadDriver(driverName);
                    if (!driver) {
                        // loadDriver already logs the detailed error
                        console.log(`[OKUMA BİTTİ] ${sensorConfig.name} - Sürücü Yüklenemedi`);
                        continue;
                    }
                    
                    const reading = await driver.read(sensorConfig.config);
                    
                    if (reading !== null) {
                        let valueToSend = reading;

                        if (typeof reading === 'object' && Object.keys(reading).length > 1) {
                            const sensorType = sensorConfig.type.toLowerCase();
                            let keyToExtract: string | undefined;
                    
                            if (sensorType.includes('sıcaklık') || sensorType.includes('temp')) {
                                keyToExtract = Object.keys(reading).find(k => k.toLowerCase().includes('temp'));
                            } else if (sensorType.includes('nem') || sensorType.includes('hum')) {
                                keyToExtract = Object.keys(reading).find(k => k.toLowerCase().includes('hum'));
                            }
                            
                            if (keyToExtract && reading[keyToExtract] !== undefined) {
                                console.log(`     -> Çoklu değerden ayıklanan: { ${keyToExtract}: ${reading[keyToExtract]} }`);
                                valueToSend = { [keyToExtract]: reading[keyToExtract] };
                            } else {
                                console.warn(`     -> UYARI: ${sensorConfig.name} (${sensorConfig.type}) için çoklu değerli yanıttan ilgili anahtar bulunamadı. Tam nesne gönderiliyor.`);
                            }
                        }
                        
                        await this.sendReading({ sensor: sensorConfig.id, value: valueToSend });
                    } else {
                        console.warn(`  -> UYARI: ${sensorConfig.name} sensöründen veri okunamadı (sürücü null döndü).`);
                    }

                } catch (error) {
                    console.error(`  -> HATA: ${sensorConfig.name} sensörü işlenirken bir hata oluştu. Detaylar sürücü loglarında olabilir.`);
                }
                console.log(`[OKUMA BİTTİ] ${sensorConfig.name}`);
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
                if (error.response) {
                    console.error(`     -> Sunucu Yanıtı (${error.response.status}): ${JSON.stringify(error.response.data)}`);
                }
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
                    if (!command.payload?.camera_id) {
                        console.error("Capture image command is missing 'camera_id' in payload.");
                        break;
                    }
                    success = await this.captureImage(command.payload.camera_id);
                    break;
                case 'ANALYZE_SNOW_DEPTH':
                     if (!command.payload?.camera_id || !command.payload?.virtual_sensor_id || !command.payload.analysis_type) {
                        console.error("Analyze snow depth command is missing 'camera_id', 'virtual_sensor_id' or 'analysis_type'.");
                        break;
                    }
                    if(command.payload.analysis_type === 'gemini') {
                        success = await this.analyzeSnowDepthWithGemini(command.payload.camera_id, command.payload.virtual_sensor_id);
                    } else if (command.payload.analysis_type === 'opencv') {
                        success = await this.analyzeSnowDepthWithOpenCV(command.payload.camera_id, command.payload.virtual_sensor_id);
                    } else {
                        console.error(`Bilinmeyen analiz tipi: ${command.payload.analysis_type}`);
                    }
                    break;
                case 'FORCE_READ_SENSOR':
                    if (!command.payload?.sensor_id) {
                        console.error("Force read command is missing 'sensor_id'.");
                        break;
                    }
                    success = await this.forceReadSensor(command.payload.sensor_id);
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

    private async captureImage(cameraId: string): Promise<boolean> {
        const cameraConfig = this.config?.cameras.find(c => c.id === cameraId);

        if (!cameraConfig || !cameraConfig.rtsp_url) {
            console.error(`Fotoğraf çekilemedi: Kamera (ID: ${cameraId}) yapılandırmada bulunamadı veya RTSP URL'si eksik.`);
            return false;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}_${this.deviceId}_${cameraId}.jpg`;
        const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
        const filepath = path.join(UPLOADS_DIR, filename);

        console.log(`📸 Fotoğraf çekiliyor ve optimize ediliyor: ${cameraConfig.name}...`);

        try {
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            
            const ffmpegCommand = `ffmpeg -i "${cameraConfig.rtsp_url}" -vframes 1 -vf "scale=1280:-1" -q:v 4 -y "${filepath}"`;
            
            const { stdout, stderr } = await execAsync(ffmpegCommand);
            if (stderr && !stderr.includes('frame=')) {
                console.log(`FFMPEG Info: ${stderr}`);
            }
            console.log(`🖼️  Optimize edilmiş görüntü kaydedildi: ${filepath}`);

            const imageBuffer = await fs.readFile(filepath);
            const base64Image = imageBuffer.toString('base64');
            
            await axios.post(`${this.apiBaseUrl}/cameras/${cameraId}/upload-photo`, {
                image: base64Image,
                filename: filename
            }, {
                headers: { 'Authorization': `Token ${this.authToken}` },
            });

            console.log(`🚀 Fotoğraf sunucuya yüklendi: ${filename}`);
            
            await fs.unlink(filepath);
            
            return true;

        } catch (error) {
            console.error(`HATA: Fotoğraf çekme veya yükleme başarısız oldu (Kamera: ${cameraId})`, error);
            return false;
        }
    }

    private async analyzeSnowDepthWithGemini(cameraId: string, virtualSensorId: string): Promise<boolean> {
        const cameraConfig = this.config?.cameras.find(c => c.id === cameraId);
        if (!cameraConfig || !cameraConfig.rtsp_url) {
            console.error(`Analiz için kamera bulunamadı veya RTSP URL'si eksik: ${cameraId}`);
            return false;
        }
        
        if (!this.geminiApiKey) {
            console.error('HATA: Gemini API anahtarı sunucudan alınamadı. Analiz yapılamıyor.');
            return false;
        }

        console.log(`❄️  Kar derinliği analizi başlatılıyor (Gemini)... Kamera: ${cameraId}`);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ANALYSIS_GEMINI_${timestamp}_${cameraId}.jpg`;
        const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
        const filepath = path.join(UPLOADS_DIR, filename);

        try {
            // 1. Capture and optimize image
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            const ffmpegCommand = `ffmpeg -i "${cameraConfig.rtsp_url}" -vframes 1 -vf "scale=1280:-1" -q:v 4 -y "${filepath}"`;
            await execAsync(ffmpegCommand);
            console.log(`   -> Analiz için optimize edilmiş görüntü kaydedildi: ${filepath}`);

            // 2. Read image to base64
            const imageBuffer = await fs.readFile(filepath);
            const base64Image = imageBuffer.toString('base64');
            
            // 3. Call Gemini API
            console.log('   -> Gemini API ile analiz ediliyor...');
            const ai = new GoogleGenAI({ apiKey: this.geminiApiKey });
            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image,
                },
            };
            const textPart = {
                text: GEMINI_SNOW_DEPTH_PROMPT,
            };

            // FIX: Use responseSchema for reliable JSON output
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
                console.error('   -> HATA: Gemini API boş yanıt döndü.');
                return false;
            }

            console.log(`   -> Gemini Yanıtı: ${resultText}`);

            // 4. Parse response and send reading
            const resultJson = JSON.parse(resultText.replace(/```json/g, '').replace(/```/g, ''));
            const snowDepth = resultJson.snow_depth_cm;

            if (typeof snowDepth !== 'number') {
                console.error('   -> HATA: Gemini yanıtından sayısal bir kar yüksekliği değeri alınamadı.');
                return false;
            }

            if (snowDepth === -1) {
                console.log(`   -> BİLGİ: Gemini görüntüden kar derinliğini belirleyemedi.`);
                return false; // Command failed
            }
            
            console.log(`   -> Analiz Sonucu: ${snowDepth} cm`);
            
            await this.sendReading({
                sensor: virtualSensorId,
                value: { snow_depth_cm: snowDepth }
            });

            // 5. Upload analyzed image to server for verification
            await axios.post(`${this.apiBaseUrl}/analysis/upload-photo`, {
                cameraId: cameraId,
                image: base64Image,
                filename: filename
            }, {
                headers: { 'Authorization': `Token ${this.authToken}` },
            });
            console.log(`   -> Analiz görüntüsü sunucuya yüklendi: ${filename}`);

            return true;

        } catch (error) {
            console.error(`HATA: Kar derinliği analizi başarısız oldu (Kamera: ${cameraId})`, error);
            return false;
        } finally {
            try {
                await fs.unlink(filepath);
            } catch (unlinkError: any) {
                if (unlinkError.code !== 'ENOENT') {
                    console.warn(`Geçici analiz dosyası silinemedi: ${filepath}`, unlinkError);
                }
            }
        }
    }

    private async analyzeSnowDepthWithOpenCV(cameraId: string, virtualSensorId: string): Promise<boolean> {
        const cameraConfig = this.config?.cameras.find(c => c.id === cameraId);
        if (!cameraConfig || !cameraConfig.rtsp_url) {
            console.error(`OpenCV analizi için kamera bulunamadı veya RTSP URL'si eksik: ${cameraId}`);
            return false;
        }

        console.log(`❄️  Kar derinliği analizi başlatılıyor (OpenCV)... Kamera: ${cameraId}`);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ANALYSIS_OCV_${timestamp}_${cameraId}.jpg`;
        const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
        const filepath = path.join(UPLOADS_DIR, filename);
        // Corrected path to point to the script's location relative to the source, not the compiled output
        const scriptPath = path.join(__dirname, 'scripts', 'snow_depth_opencv.py');

        try {
            // 1. Capture image
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            const ffmpegCommand = `ffmpeg -i "${cameraConfig.rtsp_url}" -vframes 1 -y "${filepath}"`;
            await execAsync(ffmpegCommand);
            console.log(`   -> Analiz için görüntü kaydedildi: ${filepath}`);

            // 2. Execute Python script
            console.log(`   -> OpenCV script'i çalıştırılıyor: ${scriptPath}`);
            const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${filepath}"`);
            
            if (stderr) {
                console.error(`   -> HATA: OpenCV script hatası: ${stderr}`);
                // Continue, as stdout might still have a partial result or error message
            }
            
            console.log(`   -> OpenCV Yanıtı: ${stdout}`);

            // 3. Parse result and send
            const resultJson = JSON.parse(stdout.trim());
            if (resultJson.error) {
                throw new Error(resultJson.error);
            }

            const snowDepth = resultJson.snow_depth_cm;
             if (typeof snowDepth !== 'number') {
                throw new Error('OpenCV script\'inden sayısal bir kar yüksekliği değeri alınamadı.');
            }

            console.log(`   -> Analiz Sonucu: ${snowDepth} cm`);

            await this.sendReading({
                sensor: virtualSensorId,
                value: { snow_depth_cm: snowDepth }
            });

            return true;

        } catch (error) {
            console.error(`HATA: Kar derinliği (OpenCV) analizi başarısız oldu:`, error);
            return false;
        } finally {
             try {
                await fs.unlink(filepath);
            } catch (unlinkError: any) {
                if (unlinkError.code !== 'ENOENT') {
                    console.warn(`Geçici analiz dosyası silinemedi: ${filepath}`, unlinkError);
                }
            }
        }
    }


    private async forceReadSensor(sensorId: string): Promise<boolean> {
        const sensorConfig = this.config?.sensors.find(s => s.id === sensorId);
        if (!sensorConfig) {
            console.error(`Manuel okuma başarısız: Sensör ID ${sensorId} mevcut cihaz yapılandırmasında bulunamadı.`);
            return false;
        }

        if (sensorConfig.interface === 'virtual') {
            console.warn(`Manuel okuma atlandı: ${sensorConfig.name} bir sanal sensördür ve bu yöntemle tetiklenemez.`);
            return true; // Return true as it's not a failure, just not applicable.
        }
    
        console.log(`[MANUEL OKUMA BAŞLADI] ${sensorConfig.name}`);
    
        try {
            const driver = await this.loadDriver(sensorConfig.parser_config.driver);
            if (!driver) {
                console.error(`     -> HATA: Sürücü bulunamadı: ${sensorConfig.parser_config.driver}`);
                return false;
            }
            const reading = await driver.read(sensorConfig.config);
            if (reading) {
                await this.sendReading({ sensor: sensorConfig.id, value: reading });
                console.log(`[MANUEL OKUMA BİTTİ] ${sensorConfig.name}`);
                return true; // Success
            } else {
                console.warn(`     -> UYARI: ${sensorConfig.name} sensöründen manuel okuma ile veri alınamadı.`);
                console.log(`[MANUEL OKUMA BİTTİ] ${sensorConfig.name}`);
                return false;
            }
        } catch (error) {
            console.error(`     -> HATA: ${sensorConfig.name} sensörü manuel okunurken hata oluştu:`, error);
            console.log(`[MANUEL OKUMA BİTTİ] ${sensorConfig.name}`);
            return false;
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
        
        // Handle graceful shutdown on Ctrl+C
        (process as any).on('SIGINT', () => {
            agent.shutdown();
            (process as any).exit(0);
        });

        agent.start().catch(error => {
            console.error("Agent çalışırken kritik bir hata oluştu:", error);
            (process as any).exit(1);
        });

    } catch (error) {
        console.error("Agent başlatılamadı. config.json dosyası okunamadı veya geçersiz.", error);
        (process as any).exit(1);
    }
}

main();