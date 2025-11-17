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
import { openDb, addReading, getUnsentReadings, markReadingsAsSent, ReadingFromDb, closeDb } from './database.js';
// FIX: Import process to resolve type errors for process.on and process.exit
import process from 'process';

dotenv.config();

const execAsync = promisify(exec);

// --- Path Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const CONFIG_CACHE_PATH = path.join(__dirname, '..', 'config.cache.json'); // Cache for offline startup

// --- Timers ---
const CONFIG_FETCH_INTERVAL = 60000; // 1 minute (for checking config updates)
const MAIN_LOOP_DEFAULT_INTERVAL = 600000; // 10 minutes (default sensor read cycle)
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
    private timers: (ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>)[] = [];
    private mainLoopInterval: ReturnType<typeof setInterval> | null = null;

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
                 if (this.state !== AgentState.ONLINE) {
                    console.log('✅ Sunucu ile bağlantı doğrulandı (komut yok).');
                    this.setState(AgentState.ONLINE);
                 }
                return;
            }

            console.error(`❌ Hata (${context}): ${error.code || error.message}`);
            if (error.response) {
                console.error(`   -> Sunucu Yanıtı: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                console.error(`   -> Sunucuya ulaşılamadı. Ağ bağlantınızı ve sunucu adresini kontrol edin: ${this.apiBaseUrl}`);
                if (error.code === 'EAI_AGAIN') {
                    console.error('   -> DNS çözümleme hatası (EAI_AGAIN): Cihazın internete bağlı olduğundan ve DNS ayarlarının doğru olduğundan emin olun.');
                }
                if (this.state !== AgentState.OFFLINE) {
                    this.setState(AgentState.OFFLINE);
                    console.log('... Veriler yerel olarak kaydedilecek ve bağlantı kurulduğunda gönderilecek.');
                }
            }
        } else {
            console.error(`❌ Beklenmedik Hata (${context}):`, error);
        }
    }

    private setState(newState: AgentState) {
        if (this.state !== newState) {
            console.log(`Durum Değişikliği: ${this.state} -> ${newState}`);
            this.state = newState;
        }
    }

    public async start() {
        if (this.running) {
            console.warn('Agent zaten çalışıyor.');
            return;
        }
        this.running = true;
        await openDb();
        await this.fetchConfig(true); // Initial fetch attempt
        
        // Start other periodic tasks
        this.timers.push(setInterval(() => this.fetchConfig(), CONFIG_FETCH_INTERVAL));
        this.timers.push(setInterval(() => this.pollForCommands(), COMMAND_POLL_INTERVAL));
        this.timers.push(setInterval(() => this.syncOfflineData(), SYNC_INTERVAL));
    }

    public async stop() {
        if (!this.running) return;
        this.running = false;
        console.log('🛑 ORION Agent durduruluyor...');
        if (this.mainLoopInterval) clearInterval(this.mainLoopInterval);
        this.timers.forEach(timer => clearInterval(timer));
        this.timers = [];
        for (const [sensorId, driver] of this.driverInstances.entries()) {
            if (typeof (driver as any).close === 'function') {
                try {
                    await (driver as any).close();
                    console.log(`   -> Sürücü kapatıldı: ${sensorId}`);
                } catch (e) {
                    console.error(`   -> Sürücü kapatılırken hata: ${sensorId}`, e);
                }
            }
        }
        await closeDb();
        console.log("👋 Agent başarıyla durduruldu.");
    }

    private async saveConfigToFile(config: DeviceConfig) {
        try {
            await fs.writeFile(CONFIG_CACHE_PATH, JSON.stringify(config, null, 2));
            console.log('📝 Yapılandırma yerel önbelleğe kaydedildi.');
        } catch (error) {
            console.error('❌ HATA: Yapılandırma önbelleğe kaydedilemedi.', error);
        }
    }

    private async loadConfigFromFile(): Promise<DeviceConfig | null> {
        try {
            const configContent = await fs.readFile(CONFIG_CACHE_PATH, 'utf-8');
            console.log('✅ Yerel önbellekten yapılandırma yüklendi.');
            return JSON.parse(configContent);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log('... Yerel yapılandırma önbelleği bulunamadı.');
            } else {
                console.error('❌ HATA: Önbellek yapılandırması okunamadı.', error);
            }
            return null;
        }
    }

    private async fetchConfig(isInitial: boolean = false) {
        if (isInitial) {
            console.log('🔄️ Sunucudan yapılandırma alınıyor...');
            this.setState(AgentState.CONFIGURING);
        } else {
            console.log('🔄️ Sunucudan yapılandırma güncellemeleri kontrol ediliyor...');
        }

        try {
            const response = await axios.get(`${this.apiBaseUrl}/config/${this.deviceId}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            this.config = response.data;
            this.geminiApiKey = this.config?.gemini_api_key;
            
            // Explicitly parse the frequency value to handle potential type mismatches from JSON.
            const freqFromConfig = this.config?.global_read_frequency_seconds;
            this.globalReadFrequencySeconds = freqFromConfig !== undefined && freqFromConfig !== null 
                ? parseInt(String(freqFromConfig), 10) 
                : undefined;

            console.log('✅ Sunucudan yapılandırma başarıyla alındı.');
            await this.saveConfigToFile(this.config!);
            
            if (this.state !== AgentState.ONLINE) {
                this.setState(AgentState.ONLINE);
            }
            
            await this.initializeDrivers();
            this.startMainLoop();

        } catch (error) {
            this.handleApiError(error, isInitial ? 'yapılandırma alınırken' : 'yapılandırma güncellenirken');
            
            if (isInitial && !this.config) { // Only try cache if we don't have a config yet
                console.log('... Sunucuya ulaşılamadı, yerel önbellek deneniyor.');
                const cachedConfig = await this.loadConfigFromFile();
                if (cachedConfig) {
                    this.config = cachedConfig;
                    this.geminiApiKey = this.config?.gemini_api_key;
                    
                    const freqFromConfig = this.config?.global_read_frequency_seconds;
                    this.globalReadFrequencySeconds = freqFromConfig !== undefined && freqFromConfig !== null 
                        ? parseInt(String(freqFromConfig), 10) 
                        : undefined;

                    this.setState(AgentState.OFFLINE);
                    await this.initializeDrivers();
                    this.startMainLoop();
                } else {
                    console.error('❌ KRİTİK HATA: Sunucuya ulaşılamıyor ve yerel yapılandırma önbelleği yok. Agent sensörleri okuyamıyor. Bağlantı kurulduğunda tekrar denenecek.');
                    this.setState(AgentState.ERROR);
                }
            }
        }
    }
    
    private async initializeDrivers() {
        if (!this.config?.sensors) return;

        for (const sensor of this.config.sensors) {
            const driverName = sensor.parser_config?.driver;
            if (!driverName) {
                console.warn(`Uyarı: ${sensor.name} için 'driver' belirtilmemiş. Atlanıyor.`);
                continue;
            }

            if (!this.driverInstances.has(sensor.id)) {
                try {
                    const driverModule = await import(`./drivers/${driverName}.driver.js`);
                    this.driverInstances.set(sensor.id, new driverModule.default());
                    console.log(`   -> Sürücü yüklendi: ${driverName} (${sensor.name})`);
                } catch (error) {
                    console.error(`HATA: Sürücü yüklenemedi: ${driverName}. Dosyanın varlığını ve doğruluğunu kontrol edin.`, error);
                }
            }
        }
    }

    private startMainLoop() {
        // If a loop is already running, clear it before starting a new one
        // This ensures the read frequency is updated if the config changes
        if (this.mainLoopInterval) {
            clearInterval(this.mainLoopInterval);
        }

        const cycleTime = this.globalReadFrequencySeconds && this.globalReadFrequencySeconds > 0 
            ? this.globalReadFrequencySeconds * 1000 
            : MAIN_LOOP_DEFAULT_INTERVAL;
        
        // Run once immediately, then start the interval
        this.mainLoop(); 
        this.mainLoopInterval = setInterval(() => this.mainLoop(), cycleTime);
        console.log(`✅ Ana döngü ${cycleTime / 1000} saniyede bir çalışacak şekilde ayarlandı.`);
    }

    private async mainLoop() {
        if (!this.running) return;

        if (!this.config) {
             console.warn(`Yapılandırma yüklenemediği için okuma döngüsü atlanıyor. Yapılandırma periyodik olarak kontrol edilecek.`);
             return;
        }
        
        console.log('--- Döngü Başlangıcı ---');
        
        const readPromises = this.config.sensors
            .filter(s => s.is_active)
            .map(sensor => this.readAndProcessSensor(sensor));

        const results = await Promise.all(readPromises);
        const validResults = results.filter((r): r is ReadingPayload => r !== null);

        if (validResults.length > 0) {
             await this.sendReadings(validResults);
        }

        console.log(`--- Döngü Sonu ---`);
    }
    
    private async readAndProcessSensor(sensor: SensorConfig): Promise<ReadingPayload | null> {
        const driver = this.driverInstances.get(sensor.id);
        if (!driver) return null;
        
        console.log(`   Okunuyor: ${sensor.name} (${sensor.type})`);
        
        let rawValue = await driver.read(sensor.config);

        if (rawValue === null) {
            console.log(`     -> OKUMA BAŞARISIZ: ${sensor.name} sensöründen veri alınamadı.`);
            return null;
        }
        
        // --- Değer İşleme (Kalibrasyon ve Yuvarlama) ---
        let processedValue: Record<string, any> | number | null = rawValue;
        const refVal = sensor.reference_value;
        const refOp = sensor.reference_operation;

        // Kar Yüksekliği (Mesafe sensöründen) özel işlemi
        // Bu işlem, sensörün bir nesneye olan mesafesini ölçtüğünü ve karın bu mesafeyi azalttığını varsayar.
        // Örn: Sensör yerden 300cm yüksekte. Kar yokken 300cm ölçer. 20cm kar varken 280cm ölçer.
        // Kar Yüksekliği = Referans Yükseklik (300) - Okunan Mesafe (280) = 20cm.
        if (sensor.type === 'Kar Yüksekliği' && (rawValue as any).distance_cm !== undefined) {
            const originalNumericValue = (rawValue as any).distance_cm;
            if (typeof refVal === 'number' && refOp === 'subtract') {
                let calculatedNumericValue = refVal - originalNumericValue;
                processedValue = {
                    snow_depth_cm: calculatedNumericValue > 0 ? calculatedNumericValue : 0
                };
            } else {
                // Eğer referans değeri/işlemi yoksa, ham mesafeyi kar yüksekliği olarak kullan (bu genellikle istenmez ama bir geri dönüş yoludur)
                processedValue = { snow_depth_cm: originalNumericValue };
            }
        } 
        // Genel kalibrasyon işlemleri
        else if (typeof processedValue === 'object' && processedValue !== null && typeof refVal === 'number' && refOp && refOp !== 'none') {
            const keys = Object.keys(processedValue);
            if (keys.length === 1 && typeof (processedValue as any)[keys[0]] === 'number') {
                const key = keys[0];
                const originalValue = (processedValue as any)[key];
                let calibratedValue = originalValue;

                if (refOp === 'subtract') {
                    calibratedValue = refVal - originalValue;
                } else if (refOp === 'add') {
                    calibratedValue = refVal + originalValue;
                }
                
                processedValue = { [key]: calibratedValue };
            }
        }
        
        const finalValue = roundNumericValues(processedValue);
        
        // Veriyi yerel DB'ye kaydet
        await addReading(sensor.id, rawValue, finalValue);

        return { sensor: sensor.id, value: finalValue };
    }


    private async sendReadings(readings: ReadingPayload[]) {
        if (this.state === AgentState.OFFLINE) {
            console.log(`🔌 Çevrimdışı mod: ${readings.length} okuma yerel olarak kaydedildi.`);
            return;
        }

        console.log(`📤 Sunucuya ${readings.length} adet okuma gönderiliyor...`);
        try {
            // NOTE: The backend expects one reading per request.
            for (const reading of readings) {
                await axios.post(`${this.apiBaseUrl}/submit-reading`, reading, {
                     headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                console.log(`   -> Başarılı: ${reading.sensor}`);
            }
        } catch (error) {
            this.handleApiError(error, 'okuma gönderilirken');
        }
    }

    private async syncOfflineData() {
        if (this.state === AgentState.OFFLINE || !this.running) {
            return;
        }
        
        const unsentReadings = await getUnsentReadings(50);
        if (unsentReadings.length === 0) {
            return;
        }

        console.log(`🔄️ ${unsentReadings.length} adet çevrimdışı okuma senkronize ediliyor...`);
        const sentIds: number[] = [];

        for (const reading of unsentReadings) {
             try {
                const payload: ReadingPayload = {
                    sensor: reading.sensor_id,
                    value: JSON.parse(reading.processed_value)
                };
                 await axios.post(`${this.apiBaseUrl}/submit-reading`, payload, {
                     headers: { 'Authorization': `Bearer ${this.authToken}` },
                     timeout: 10000
                });
                sentIds.push(reading.id);
            } catch (error) {
                this.handleApiError(error, 'çevrimdışı veri senkronize edilirken');
                // Stop syncing on first error to prevent data loss and wait for next interval
                break; 
            }
        }
        
        if (sentIds.length > 0) {
            await markReadingsAsSent(sentIds);
            console.log(`   -> ${sentIds.length} okuma başarıyla senkronize edildi.`);
        }
    }


    private async pollForCommands() {
        if (!this.running || this.state === AgentState.OFFLINE) return;
        try {
            const response = await axios.get(`${this.apiBaseUrl}/commands/${this.deviceId}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            if (response.status === 200 && Array.isArray(response.data)) {
                 if (response.data.length > 0) console.log(`🔽 ${response.data.length} adet yeni komut alındı.`);
                for (const command of response.data) {
                    await this.executeCommand(command);
                }
            }
        } catch (error) {
            this.handleApiError(error, 'sunucudan komutları kontrol etme');
        }
    }

    private async executeCommand(command: AgentCommand) {
        console.log(`   -> Komut yürütülüyor: ${command.command_type}`);
        try {
            switch (command.command_type) {
                case 'REFRESH_CONFIG':
                    await this.fetchConfig();
                    break;
                case 'RESTART_AGENT':
                    console.log('Agent yeniden başlatılıyor...');
                    // Use pm2 to restart the process. Assumes it's running with name 'orion-agent'.
                    await execAsync('pm2 restart orion-agent');
                    break;
                case 'STOP_AGENT':
                     console.log('Agent durduruluyor...');
                     await execAsync('pm2 stop orion-agent');
                    break;
                case 'FORCE_READ_SENSOR':
                    if (command.payload?.sensor_id) {
                         const sensorToRead = this.config?.sensors.find(s => s.id === command.payload.sensor_id);
                         if (sensorToRead) {
                             const result = await this.readAndProcessSensor(sensorToRead);
                             if (result) await this.sendReadings([result]);
                         }
                    }
                    break;
                case 'CAPTURE_IMAGE':
                     if (command.payload?.camera_id) {
                        await this.captureAndUploadImage(command.payload.camera_id, `${this.apiBaseUrl}/cameras/${command.payload.camera_id}/upload-photo`);
                     }
                    break;
                case 'ANALYZE_SNOW_DEPTH':
                    if (command.payload?.camera_id && command.payload?.virtual_sensor_id && command.payload?.analysis_type) {
                       await this.analyzeSnowDepth(
                           command.payload.camera_id, 
                           command.payload.virtual_sensor_id, 
                           command.payload.analysis_type
                        );
                    }
                    break;
            }
            // Notify server of command completion (optional, but good practice)
            // await axios.post(`${this.apiBaseUrl}/commands/${command.id}/completed`, {}, { ... });

        } catch (error) {
            console.error(`HATA: Komut yürütülürken (${command.command_type}):`, error);
        }
    }

    private async captureAndUploadImage(cameraId: string, uploadUrl: string) {
        const cameraConfig = this.config?.cameras.find(c => c.id === cameraId);
        if (!cameraConfig || !cameraConfig.rtsp_url) {
            console.error(`HATA: ${cameraId} için kamera yapılandırması veya RTSP URL'si bulunamadı.`);
            return;
        }

        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `${this.deviceId}_${cameraId}_${timestamp}.jpg`;
        const outputPath = `/tmp/${filename}`;
        
        console.log(`   -> Fotoğraf çekiliyor: ${cameraConfig.name}`);
        
        try {
            // Use ffmpeg to capture a single frame from the RTSP stream.
            // -rtsp_transport tcp: Forces TCP transport, more reliable over lossy networks.
            // -y: Overwrite output file if it exists.
            // -i: Input source (RTSP URL).
            // -vframes 1: Capture a single video frame.
            // -q:v 2: Set image quality (2 is high).
            const { stdout, stderr } = await execAsync(`ffmpeg -rtsp_transport tcp -y -i "${cameraConfig.rtsp_url}" -vframes 1 -q:v 2 ${outputPath}`);
            
            console.log(`   -> Fotoğraf kaydedildi: ${outputPath}`);

            // Read the captured image file
            const imageBuffer = await fs.readFile(outputPath);
            const imageBase64 = imageBuffer.toString('base64');
            
            console.log(`   -> Fotoğraf sunucuya yükleniyor...`);
            
            // Upload the image to the server
            await axios.post(uploadUrl, {
                image: imageBase64,
                filename: filename
            }, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            console.log(`   -> Yükleme başarılı: ${filename}`);
            
            // Clean up the temporary file
            await fs.unlink(outputPath);

        } catch (error: any) {
            console.error(`HATA: Fotoğraf çekme veya yükleme başarısız oldu (${cameraConfig.name}):`, error.stderr || error.message);
        }
    }
    
    private async analyzeSnowDepth(cameraId: string, virtualSensorId: string, analysisType: 'gemini' | 'opencv') {
        if (analysisType === 'gemini') {
            await this.analyzeWithGemini(cameraId, virtualSensorId);
        } else if (analysisType === 'opencv') {
            await this.analyzeWithOpenCV(cameraId, virtualSensorId);
        }
    }

    private async analyzeWithGemini(cameraId: string, virtualSensorId: string) {
        if (!this.geminiApiKey) {
            console.error('HATA: Gemini analizi için API anahtarı yapılandırılmamış.');
            return;
        }
        
        const cameraConfig = this.config?.cameras.find(c => c.id === cameraId);
        if (!cameraConfig || !cameraConfig.rtsp_url) {
            console.error(`HATA (Gemini): ${cameraId} için kamera yapılandırması bulunamadı.`);
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `${this.deviceId}_${cameraId}_gemini-analysis_${timestamp}.jpg`;
        const outputPath = `/tmp/${filename}`;
        
        console.log(`   -> Gemini Analizi için fotoğraf çekiliyor: ${cameraConfig.name}`);

        try {
            await execAsync(`ffmpeg -rtsp_transport tcp -y -i "${cameraConfig.rtsp_url}" -vframes 1 -q:v 2 ${outputPath}`);
            const imageBuffer = await fs.readFile(outputPath);
            const imageBase64 = imageBuffer.toString('base64');
            
            const ai = new GoogleGenAI({ apiKey: this.geminiApiKey });

            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } };
            const textPart = { text: GEMINI_SNOW_DEPTH_PROMPT };
            
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
                throw new Error('Gemini API boş yanıt döndürdü.');
            }

            console.log(`[ANALYSIS] Gemini Yanıtı: ${resultText}`);
            
            const cleanedText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const resultJson = JSON.parse(cleanedText);
            const snowDepth = resultJson.snow_depth_cm;

            if (typeof snowDepth !== 'number' || snowDepth < 0) {
                 console.warn(`     -> UYARI (Gemini): Geçersiz kar derinliği değeri (${snowDepth}). Okuma atlanıyor.`);
                 return;
            }

            const payload: ReadingPayload = {
                sensor: virtualSensorId,
                value: roundNumericValues({ snow_depth_cm: snowDepth })
            };

            await this.sendReadings([payload]);
            await fs.unlink(outputPath); // Clean up temp file
            
            // Also upload the analysis image for verification
            const uploadUrl = `${this.apiBaseUrl}/analysis/upload-photo`;
            await axios.post(uploadUrl, {
                cameraId: cameraId,
                image: imageBase64,
                filename: filename
            }, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });


        } catch (error) {
            console.error(`HATA (Gemini): Analiz başarısız oldu.`, error);
             try { await fs.unlink(outputPath); } catch {}
        }
    }
    
    private async analyzeWithOpenCV(cameraId: string, virtualSensorId: string) {
        console.log(`   -> OpenCV analizi başlatılıyor... (Bu özellik şu anda bir yer tutucudur)`);
        // In a real implementation, you would call a Python script via child_process
        // that uses OpenCV to analyze an image and print the result to stdout.
        // For now, we'll simulate a result.
        const mockSnowDepth = parseFloat((Math.random() * 150).toFixed(2));
        
         const payload: ReadingPayload = {
            sensor: virtualSensorId,
            value: { snow_depth_cm: mockSnowDepth }
        };
        await this.sendReadings([payload]);
    }

}

// --- Agent Başlatma ---
async function main() {
    try {
        const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
        const localConfig: LocalConfig = JSON.parse(configContent);
        
        const agent = new Agent(localConfig);
        await agent.start();

        // Handle graceful shutdown for pm2 and Ctrl+C
        const shutdown = async (signal: string) => {
            console.log(`${signal} sinyali alındı. Agent temiz bir şekilde kapatılıyor...`);
            await agent.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        console.error("FATAL: Agent başlatılamadı.", error);
        process.exit(1);
    }
}

main();