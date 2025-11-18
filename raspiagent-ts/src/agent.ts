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
const AVERAGING_DURATION_MS = 60000; // 1 minute for averaging
const AVERAGING_READ_INTERVAL_MS = 2000; // Read every 2 seconds during averaging

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
    private globalReadFrequencySeconds: number = 0;

    // Properties from local config
    private apiBaseUrl: string = '';
    private deviceId: string = '';
    private authToken: string = '';
    private geminiApiKey?: string;
    
    private running: boolean = false;
    private timers: (ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>)[] = [];
    private mainLoopTimeout: ReturnType<typeof setTimeout> | null = null;
    private sensorLoopTimers: Map<string, ReturnType<typeof setInterval>> = new Map();


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
        await this.fetchConfig(true); 

        // Start other periodic tasks
        this.timers.push(setInterval(() => this.fetchConfig(), CONFIG_FETCH_INTERVAL));
        this.timers.push(setInterval(() => this.pollForCommands(), COMMAND_POLL_INTERVAL));
        this.timers.push(setInterval(() => this.syncOfflineData(), SYNC_INTERVAL));
    }

    public async stop() {
        if (!this.running) return;
        this.running = false;
        console.log('🛑 ORION Agent durduruluyor...');
        
        if (this.mainLoopTimeout) clearTimeout(this.mainLoopTimeout);
        this.sensorLoopTimers.forEach(timer => clearInterval(timer));
        this.sensorLoopTimers.clear();

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
        }

        try {
            const response = await axios.get(`${this.apiBaseUrl}/config/${this.deviceId}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            const newConfigString = JSON.stringify(response.data);
            const oldConfigString = JSON.stringify(this.config);

            if (newConfigString === oldConfigString && !isInitial) {
                 if (this.state !== AgentState.ONLINE) {
                    this.setState(AgentState.ONLINE);
                    console.log('✅ Sunucu ile bağlantı kuruldu, yapılandırma değişmedi.');
                 }
                return;
            }

            this.config = response.data;
            this.geminiApiKey = this.config?.gemini_api_key;
            
            this.globalReadFrequencySeconds = this.config?.global_read_frequency_seconds ?? 0;

            if (isInitial) {
                 console.log('✅ Sunucudan yapılandırma başarıyla alındı.');
            } else {
                 console.log('✨ Yapılandırma güncellendi, sürücüler ve döngü yeniden başlatılıyor.');
            }
            
            await this.saveConfigToFile(this.config!);
            
            if (this.state !== AgentState.ONLINE) {
                this.setState(AgentState.ONLINE);
            }
            
            await this.initializeDrivers();
            this.restartMainLoop();

        } catch (error) {
            this.handleApiError(error, isInitial ? 'yapılandırma alınırken' : 'yapılandırma güncellenirken');
            
            if (isInitial && !this.config) {
                console.log('... Sunucuya ulaşılamadı, yerel önbellek deneniyor.');
                const cachedConfig = await this.loadConfigFromFile();
                if (cachedConfig) {
                    this.config = cachedConfig;
                    this.geminiApiKey = this.config?.gemini_api_key;
                    
                    this.globalReadFrequencySeconds = this.config?.global_read_frequency_seconds ?? 0;

                    this.setState(AgentState.OFFLINE);
                    await this.initializeDrivers();
                    this.restartMainLoop();
                } else {
                    console.error('❌ KRİTİK HATA: Sunucuya ulaşılamıyor ve yerel yapılandırma önbelleği yok. Agent sensörleri okuyamıyor. Bağlantı kurulduğunda tekrar denenecek.');
                    this.setState(AgentState.ERROR);
                }
            }
        }
    }
    
    private async initializeDrivers() {
        if (!this.config?.sensors) return;

        // Unload drivers for sensors that are no longer in the config
        const newSensorIds = new Set(this.config.sensors.map(s => s.id));
        for (const sensorId of this.driverInstances.keys()) {
            if (!newSensorIds.has(sensorId)) {
                this.driverInstances.delete(sensorId);
                console.log(`   -> Sürücü kaldırıldı: ${sensorId}`);
            }
        }
        
        // Load new drivers
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
    
    private restartMainLoop() {
        // Clear all previous loop timers
        if (this.mainLoopTimeout) clearTimeout(this.mainLoopTimeout);
        this.sensorLoopTimers.forEach(timer => clearInterval(timer));
        this.sensorLoopTimers.clear();
        
        if (this.globalReadFrequencySeconds > 0) {
            console.log(`⚙️ Global frekans modu aktif. Döngü ${this.globalReadFrequencySeconds / 60} dakikada bir çalışacak.`);
            this.sequentialLoopCycle(); // Start the first cycle immediately
        } else {
            console.log(`⚙️ Bireysel sensör frekans modu aktif.`);
            this.individualSensorLoops();
        }
    }
    
    private individualSensorLoops() {
        if (!this.config?.sensors) return;
        
        this.config.sensors.forEach(sensor => {
            if (sensor.is_active && sensor.read_frequency > 0) {
                console.log(`   -> ${sensor.name} için ${sensor.read_frequency} saniyede bir okuma planlandı.`);
                const timer = setInterval(async () => {
                    if (!this.running) {
                        clearInterval(timer);
                        return;
                    }
                    const reading = await this.performSingleReading(sensor);
                    if (reading) {
                        await addReading(sensor.id, reading.rawValue, reading.processedValue);
                    }
                }, sensor.read_frequency * 1000);
                this.sensorLoopTimers.set(sensor.id, timer);
            }
        });
    }
    
    private sequentialLoopCycle = async () => {
        if (!this.running) return;
        if (!this.config) {
            console.warn('Yapılandırma yok, sıralı döngü atlanıyor.');
            this.scheduleNextSequentialLoop(); // Retry after interval
            return;
        }

        console.log('--- Sıralı Okuma Döngüsü Başladı ---');
        this.setState(AgentState.READING);
        
        const sortedSensors = this.config.sensors
            .filter(s => s.is_active && (s.read_order ?? 0) > 0)
            .sort((a, b) => (a.read_order ?? 0) - (b.read_order ?? 0));

        if (sortedSensors.length === 0) {
            console.log('... Sıralı okuma için yapılandırılmış aktif sensör bulunamadı.');
        } else {
            for (const sensor of sortedSensors) {
                const avgReadingPayload = await this.readAndAverageSensor(sensor, AVERAGING_DURATION_MS);
                if (avgReadingPayload) {
                    await addReading(sensor.id, avgReadingPayload.rawValue, avgReadingPayload.value);
                }
                 // If agent is stopped during a long loop, exit early.
                if (!this.running) break;
            }
        }

        console.log('--- Sıralı Okuma Döngüsü Tamamlandı ---');
        this.setState(AgentState.IDLE);
        this.scheduleNextSequentialLoop();
    }

    private scheduleNextSequentialLoop() {
        const cycleTime = this.globalReadFrequencySeconds > 0 
            ? this.globalReadFrequencySeconds * 1000 
            : MAIN_LOOP_DEFAULT_INTERVAL;

        console.log(`... Sonraki sıralı okuma döngüsü ${cycleTime / 1000 / 60} dakika sonra planlandı.`);
        this.mainLoopTimeout = setTimeout(this.sequentialLoopCycle, cycleTime);
    }
    
    private async readAndAverageSensor(sensor: SensorConfig, durationMs: number): Promise<ReadingPayload | null> {
        console.log(`   Ortalama alınıyor: ${sensor.name} (${durationMs / 1000} saniye)`);
        
        const collectedRawValues: any[] = [];
        const collectedProcessedValues: any[] = [];
        const endTime = Date.now() + durationMs;

        while (Date.now() < endTime) {
            if (!this.running) break;
            const reading = await this.performSingleReading(sensor);
            if (reading && reading.rawValue !== null && reading.processedValue !== null) {
                collectedRawValues.push(reading.rawValue);
                collectedProcessedValues.push(reading.processedValue);
            }
            await new Promise(r => setTimeout(r, AVERAGING_READ_INTERVAL_MS)); // Wait between reads
        }
        
        if (collectedRawValues.length === 0) {
             console.log(`     -> Ortalama alınamadı, ${sensor.name} için geçerli okuma yok.`);
             return null;
        }

        const avgRaw = this.averageSensorValues(collectedRawValues);
        const avgProcessed = this.averageSensorValues(collectedProcessedValues);
        
        console.log(`     -> Ortalama Sonuç:`, avgProcessed);

        return { sensor: sensor.id, rawValue: avgRaw, value: avgProcessed };
    }
    
    private averageSensorValues(values: any[]): any {
        if (!values || values.length === 0) return null;

        const sums: { [key: string]: number } = {};
        const counts: { [key: string]: number } = {};

        for (const value of values) {
            if (typeof value === 'object' && value !== null) {
                for (const key in value) {
                    if (typeof value[key] === 'number' && isFinite(value[key])) {
                        sums[key] = (sums[key] || 0) + value[key];
                        counts[key] = (counts[key] || 0) + 1;
                    }
                }
            } else if (typeof value === 'number' && isFinite(value)) {
                sums['value'] = (sums['value'] || 0) + value;
                counts['value'] = (counts['value'] || 0) + 1;
            }
        }

        const averages: { [key: string]: number } = {};
        let hasKeys = false;
        for (const key in sums) {
            hasKeys = true;
            if (counts[key] > 0) {
                averages[key] = sums[key] / counts[key];
            }
        }
        
        if (!hasKeys) return null; // No numeric values found to average

        // If the original value was just a number, return just a number
        if (Object.keys(averages).length === 1 && averages.hasOwnProperty('value')) {
            return averages.value;
        }

        return averages;
    }
    
    private processRawValue(rawValue: any, sensor: SensorConfig): any {
        if (rawValue === null || rawValue === undefined) return null;

        let processedValue = { ...rawValue }; // Work on a copy

        const refVal = sensor.reference_value;
        const refOp = sensor.reference_operation;

        if (sensor.type === 'Kar Yüksekliği' && typeof rawValue.distance_cm === 'number') {
            if (typeof refVal === 'number' && refOp === 'subtract') {
                let calculated = refVal - rawValue.distance_cm;
                processedValue = { snow_depth_cm: calculated > 0 ? calculated : 0 };
            } else {
                processedValue = { snow_depth_cm: rawValue.distance_cm };
            }
        } else if (typeof rawValue === 'object' && typeof refVal === 'number' && refOp && refOp !== 'none') {
            const keys = Object.keys(rawValue);
            if (keys.length === 1 && typeof rawValue[keys[0]] === 'number') {
                const key = keys[0];
                const originalValue = rawValue[key];
                let calibratedValue = originalValue;
                if (refOp === 'subtract') calibratedValue = refVal - originalValue;
                else if (refOp === 'add') calibratedValue = refVal + originalValue;
                processedValue = { [key]: calibratedValue };
            }
        }
        return processedValue;
    }
    
    private async performSingleReading(sensor: SensorConfig): Promise<{ rawValue: any, processedValue: any } | null> {
        const driver = this.driverInstances.get(sensor.id);
        if (!driver) return null;

        console.log(`   Okunuyor: ${sensor.name} (${sensor.type})`);
        
        let rawValue = await driver.read(sensor.config);

        if (rawValue === null) {
            console.log(`     -> OKUMA BAŞARISIZ: ${sensor.name} sensöründen veri alınamadı.`);
            return null;
        }
        
        const processedValue = this.processRawValue(rawValue, sensor);
        const finalProcessedValue = roundNumericValues(processedValue);

        return { rawValue, processedValue: finalProcessedValue };
    }

    private async sendReadings(readings: ReadingPayload[]) {
        if (this.state === AgentState.OFFLINE) {
            console.log(`🔌 Çevrimdışı mod: ${readings.length} okuma yerel olarak kaydedildi.`);
            // Data is already saved by readAndProcessSensor, so nothing more to do here.
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
                    rawValue: JSON.parse(reading.raw_value),
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
                             const reading = await this.performSingleReading(sensorToRead);
                             if(reading) {
                                 await addReading(sensorToRead.id, reading.rawValue, reading.processedValue);
                             }
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
                value: roundNumericValues({ snow_depth_cm: snowDepth }),
                rawValue: { note: "Gemini analysis result", raw_response: resultJson }
            };

            await addReading(virtualSensorId, payload.rawValue, payload.value);
            
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
            value: { snow_depth_cm: mockSnowDepth },
            rawValue: { note: "OpenCV mock result", depth: mockSnowDepth }
        };
        await addReading(virtualSensorId, payload.rawValue, payload.value);
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