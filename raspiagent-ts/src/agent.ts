import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
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
import { openDb, addReading, getUnsentReadings, markReadingsAsSent, ReadingFromDb } from './database.js';

dotenv.config();

const execAsync = promisify(exec);

// --- Path Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// --- Timers ---
const CONFIG_POLL_INTERVAL = 60000; // 1 minute (used as default cycle time)
const COMMAND_POLL_INTERVAL = 5000; // 5 seconds
const SYNC_INTERVAL = 30000; // 30 seconds for syncing offline data

// Local config file structure
interface LocalConfig {
    server: { base_url: string };
    device: { id: string; token: string };
}

// Helper to round numeric values in an object/primitive recursively to 2 decimal places
const roundNumericValues = (value: any): any => {
    if (typeof value === 'number') {
        return parseFloat(value.toFixed(2));
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const newObj: { [key: string]: any } = {};
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                newObj[key] = roundNumericValues(value[key]);
            }
        }
        return newObj;
    }
    return value;
};


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

class Agent {
    private state: AgentState = AgentState.INITIALIZING;
    private config: DeviceConfig | null = null;
    private driverInstances: Map<string, ISensorDriver> = new Map();
    private globalReadFrequencySeconds?: number;

    // Properties from local config
    private apiBaseUrl: string = '';
    private deviceId: string = '';
    private authToken: string = '';
    private geminiApiKey?: string;
    
    private running: boolean = false;
    private timers: ReturnType<typeof setTimeout>[] = [];

    constructor(localConfig: LocalConfig) {
        this.apiBaseUrl = localConfig.server.base_url;
        this.deviceId = localConfig.device.id;
        this.authToken = localConfig.device.token;

        console.log(`🚀 ORION Agent Başlatılıyor... Cihaz ID: ${this.deviceId}`);
        this.setState(AgentState.INITIALIZING);
    }
    
    private handleApiError(error: any, context: string) {
        if (axios.isAxiosError(error)) {
            // A 204 for commands is expected and means we are connected.
            if (context.includes('komutları kontrol etme') && error.response?.status === 204) {
                 if (this.state !== AgentState.ONLINE) this.setState(AgentState.ONLINE);
                return;
            }

            console.error(`❌ Hata (${context}): ${error.message}`);

            if (error.response) {
                console.error(`   -> Sunucu Yanıtı (${error.response.status}): ${JSON.stringify(error.response.data)}`);
            } else if (error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                console.error(`   -> Sunucuya ulaşılamıyor. Ağ bağlantısı veya sunucu adresi (${this.apiBaseUrl}) kontrol edilmeli.`);
            } else {
                 console.error(`   -> Ağ hatası veya sunucuya ulaşılamıyor.`);
            }
            this.setState(AgentState.OFFLINE);
        } else {
            console.error(`❌ Beklenmedik hata (${context}):`, error);
            this.setState(AgentState.ERROR);
        }
    }


    private setState(newState: AgentState) {
        if (this.state !== newState) {
            this.state = newState;
            console.log(`Durum Değişikliği: ${this.state}`);
        }
    }

    public async start() {
        this.running = true;
        await openDb();
        await this.fetchConfig();
        this.sensorReadLoop();
        this.commandLoop();
        this.syncLoop();
    }
    
    public shutdown() {
        console.log("\n🚫 Agent durduruluyor... Kaynaklar temizleniyor.");
        this.running = false;
        this.timers.forEach(clearTimeout);
        console.log("✅ Zamanlayıcılar durduruldu.");
        console.log("✅ Güvenli çıkış tamamlandı.");
    }

    private async sensorReadLoop() {
        if (!this.running) return;
        
        if (this.state === AgentState.ONLINE && this.config) {
            await this.readAllActiveSensors();
        }

        const delay = (this.globalReadFrequencySeconds && this.globalReadFrequencySeconds > 0)
            ? this.globalReadFrequencySeconds * 1000
            : CONFIG_POLL_INTERVAL;
        
        if (this.state === AgentState.ONLINE) {
             console.log(`Döngü tamamlandı. Sonraki okuma ${delay / 1000} saniye sonra.`);
        }

        if (this.running) {
            const timer = setTimeout(() => this.sensorReadLoop(), delay);
            this.timers.push(timer);
        }
    }
    
    private async syncLoop() {
        if (!this.running) return;

        if (this.state === AgentState.ONLINE) {
            await this.syncUnsentReadings();
        }

        if (this.running) {
            const timer = setTimeout(() => this.syncLoop(), SYNC_INTERVAL);
            this.timers.push(timer);
        }
    }

    private async commandLoop() {
        if (!this.running) return;
        
        // Always check for commands, even when offline, to allow for recovery commands.
        await this.checkForCommands();

        if (this.running) {
            const timer = setTimeout(() => this.commandLoop(), COMMAND_POLL_INTERVAL);
            this.timers.push(timer);
        }
    }

    public async fetchConfig() {
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
            this.handleApiError(error, 'yapılandırma alma');
        }
    }

    private async readAllActiveSensors() {
        if (!this.config) return;

        const activeSensors = this.config.sensors.filter(s => s.is_active && s.interface !== 'virtual' && s.type !== 'Kar Yüksekliği');

        if (activeSensors.length === 0) {
            console.log('[OKUMA] Okunacak aktif fiziksel sensör bulunmuyor.');
            return;
        }
        
        console.log(`[OKUMA BAŞLADI] ${activeSensors.length} aktif sensör okunacak...`);

        for (const sensorConfig of activeSensors) {
            await this.processAndStoreReading(sensorConfig);
        }
        console.log(`[OKUMA BİTTİ] Sensör okuma döngüsü tamamlandı.`);
    }

    private async processAndStoreReading(sensorConfig: SensorConfig, rawValueOverride?: any) {
        console.log(`  -> ${sensorConfig.name} (ID: ${sensorConfig.id}) işleniyor...`);

        try {
            const rawValue = rawValueOverride ?? await this.readSingleSensor(sensorConfig);

            if (rawValue === null) {
                console.warn(`     -> UYARI: ${sensorConfig.name} sensöründen veri alınamadı (sürücü null döndü).`);
                return;
            }

            // Processing logic (calibration, rounding) moved from backend
            let processedValue = rawValue;
            const refVal = sensorConfig.reference_value;
            const refOp = sensorConfig.reference_operation;

            if (refVal !== null && refVal !== 999 && refOp && (refOp === 'add' || refOp === 'subtract')) {
                if (typeof rawValue === 'object' && rawValue !== null) {
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

            processedValue = roundNumericValues(processedValue);

            const readingId = await addReading(sensorConfig.id, rawValue, processedValue);
            console.log(`     -> Veri yerel veritabanına kaydedildi (ID: ${readingId}).`);

            // Immediately try to send to server
            if (this.state === AgentState.ONLINE) {
                const readingFromDb: ReadingFromDb = {
                    id: readingId,
                    sensor_id: sensorConfig.id,
                    processed_value: JSON.stringify(processedValue),
                    // These fields are not used for sending but satisfy the type
                    raw_value: '', 
                    timestamp: '',
                    is_sent: 0
                };
                await this.sendReadingToServer(readingFromDb);
            }

        } catch (error) {
            console.error(`     -> HATA: ${sensorConfig.name} sensörü işlenirken bir hata oluştu:`, (error as Error).message);
        }
    }
    
    private async readSingleSensor(sensorConfig: SensorConfig): Promise<any | null> {
        const driverName = sensorConfig.parser_config?.driver;
        if (!driverName || typeof driverName !== 'string') {
            console.error(`     -> HATA: ${sensorConfig.name} (ID: ${sensorConfig.id}) için 'driver' tanımlanmamış.`);
            return null;
        }

        try {
            const driver = await this.loadDriver(driverName);
            if (!driver) return null;

            return await driver.read(sensorConfig.config);
        } catch (error) {
            console.error(`     -> HATA: Sürücü (${driverName}) yürütülürken hata:`, (error as Error).message);
            return null;
        }
    }


    private async loadDriver(driverName: string): Promise<ISensorDriver | null> {
        if (this.driverInstances.has(driverName)) {
            return this.driverInstances.get(driverName)!;
        }
        try {
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

    private async sendReadingToServer(reading: ReadingFromDb) {
        const payload = {
            sensor: reading.sensor_id,
            value: JSON.parse(reading.processed_value),
        };

        try {
            await axios.post(`${this.apiBaseUrl}/submit-reading`, payload, {
                headers: { 'Authorization': `Token ${this.authToken}` },
            });
            await markReadingsAsSent([reading.id]);
            console.log(`     -> ✅ Veri sunucuya gönderildi (Yerel ID: ${reading.id}, Sensör ID: ${payload.sensor})`);
        } catch (error) {
            // Don't use the global handler here as failure is expected when offline.
            // The sync loop will handle retries.
            if (axios.isAxiosError(error)) {
                console.warn(`     -> ⚠️  Veri gönderilemedi, daha sonra tekrar denenecek (Sensör ID: ${payload.sensor}): ${error.code}`);
            } else {
                 console.warn(`     -> ⚠️  Veri gönderilemedi, beklenmedik hata (Sensör ID: ${payload.sensor}):`, error);
            }
             this.setState(AgentState.OFFLINE);
        }
    }

    private async syncUnsentReadings() {
        console.log('[SYNC] Gönderilmemiş veriler kontrol ediliyor...');
        const unsent = await getUnsentReadings(50); // Send in batches of 50
        if (unsent.length > 0) {
            console.log(`[SYNC] ${unsent.length} adet gönderilmemiş veri bulundu. Sunucuya gönderiliyor...`);
            for (const reading of unsent) {
                if (!this.running || this.state !== AgentState.ONLINE) {
                    console.log('[SYNC] Agent çevrimdışı, senkronizasyon durduruldu.');
                    break;
                }
                await this.sendReadingToServer(reading);
            }
            console.log('[SYNC] Senkronizasyon döngüsü tamamlandı.');
        } else {
            console.log('[SYNC] Gönderilecek yeni veri yok.');
        }
    }

    private async checkForCommands() {
        try {
            const response = await axios.get<AgentCommand[]>(`${this.apiBaseUrl}/commands/${this.deviceId}`, {
                headers: { 'Authorization': `Token ${this.authToken}` },
            });

            // Status 204 means no commands, which is a success case.
            if (response.status === 204) {
                 if (this.state !== AgentState.ONLINE) this.setState(AgentState.ONLINE);
                return;
            }

            const commands = response.data;
            if (commands && commands.length > 0) {
                if (this.state !== AgentState.ONLINE) this.setState(AgentState.ONLINE);
                console.log(`📩 ${commands.length} yeni komut alındı.`);
                for (const command of commands) {
                    await this.executeCommand(command);
                }
            }
        } catch (error) {
            this.handleApiError(error, 'komutları kontrol etme');
        }
    }

    private async executeCommand(command: AgentCommand) {
        console.log(`⚡ Komut yürütülüyor: ${command.command_type} (ID: ${command.id})`);
        let success = false;
        try {
            switch (command.command_type) {
                case 'REFRESH_CONFIG':
                    await this.fetchConfig();
                    success = this.state === AgentState.ONLINE;
                    break;
                case 'STOP_AGENT':
                    console.log("Durdurma komutu alındı. PM2 aracılığıyla agent durduruluyor...");
                    await this.updateCommandStatus(command.id, 'complete');
                    exec('pm2 stop orion-agent', (err) => { if (err) console.error("PM2 stop hatası:", err); });
                    // No success=true here, because the process will be stopped.
                    return; // Exit early
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
                case 'RESTART_AGENT':
                    console.log("Yeniden başlatma komutu alındı. PM2 aracılığıyla agent yeniden başlatılıyor...");
                    await this.updateCommandStatus(command.id, 'complete');
                    exec('pm2 restart orion-agent', (error, stdout, stderr) => {
                        if (error) {
                            console.error(`PM2 restart hatası: ${error.message}. Agent'ın 'orion-agent' adıyla çalıştığından emin olun.`);
                            return;
                        }
                    });
                    return; 
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
        // This is now less critical as commands are dequeued on GET,
        // but we can leave it for logging/future tracking purposes.
        // The endpoint is now a no-op on the server.
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
            this.handleApiError(error, `fotoğraf çekme veya yükleme (Kamera: ${cameraId})`);
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
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            const ffmpegCommand = `ffmpeg -i "${cameraConfig.rtsp_url}" -vframes 1 -vf "scale=1280:-1" -q:v 4 -y "${filepath}"`;
            await execAsync(ffmpegCommand);
            console.log(`   -> Analiz için optimize edilmiş görüntü kaydedildi: ${filepath}`);

            const imageBuffer = await fs.readFile(filepath);
            const base64Image = imageBuffer.toString('base64');
            
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
            
            // Here, we create a 'raw' value that is the same as the processed one for consistency.
            const value = { snow_depth_cm: snowDepth };
            await this.processAndStoreReading({ id: virtualSensorId } as SensorConfig, value);

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
            this.handleApiError(error, `kar derinliği analizi (Kamera: ${cameraId})`);
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
        // This function remains largely the same, but will now use processAndStoreReading
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
        const scriptPath = path.join(__dirname, 'scripts', 'snow_depth_opencv.py');

        try {
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            const ffmpegCommand = `ffmpeg -i "${cameraConfig.rtsp_url}" -vframes 1 -y "${filepath}"`;
            await execAsync(ffmpegCommand);
            console.log(`   -> Analiz için görüntü kaydedildi: ${filepath}`);

            console.log(`   -> OpenCV script'i çalıştırılıyor: ${scriptPath}`);
            const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${filepath}"`);
            
            if (stderr) {
                console.error(`   -> HATA: OpenCV script hatası: ${stderr}`);
            }
            
            console.log(`   -> OpenCV Yanıtı: ${stdout}`);

            const resultJson = JSON.parse(stdout.trim());
            if (resultJson.error) {
                throw new Error(resultJson.error);
            }

            const snowDepth = resultJson.snow_depth_cm;
             if (typeof snowDepth !== 'number') {
                throw new Error('OpenCV script\'inden sayısal bir kar yüksekliği değeri alınamadı.');
            }

            console.log(`   -> Analiz Sonucu: ${snowDepth} cm`);
            
            const value = { snow_depth_cm: snowDepth };
            await this.processAndStoreReading({ id: virtualSensorId } as SensorConfig, value);

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
    
        console.log(`[MANUEL OKUMA BAŞLADI] ${sensorConfig.name}`);
        await this.processAndStoreReading(sensorConfig);
        console.log(`[MANUEL OKUMA BİTTİ] ${sensorConfig.name}`);
        return true; // Assume success, as errors are handled internally
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
        
        // FIX: Cast `process` to `any` to access Node.js specific `on` method.
        (process as any).on('SIGINT', () => {
            agent.shutdown();
            // FIX: Cast `process` to `any` to access Node.js specific `exit` method.
            (process as any).exit(0);
        });
        
        // FIX: Cast `process` to `any` to access Node.js specific `on` method.
        (process as any).on('SIGTERM', () => {
            agent.shutdown();
             // FIX: Cast `process` to `any` to access Node.js specific `exit` method.
             (process as any).exit(0);
        });

        await agent.start();

    } catch (error) {
        console.error("Agent başlatılamadı. config.json dosyası okunamadı veya geçersiz.", error);
        // FIX: Cast `process` to `any` to access Node.js specific `exit` method.
        (process as any).exit(1);
    }
}

main().catch(error => {
    console.error("Agent çalışırken kritik bir hata oluştu:", error);
    // FIX: Cast `process` to `any` to access Node.js specific `exit` method.
    (process as any).exit(1);
});
