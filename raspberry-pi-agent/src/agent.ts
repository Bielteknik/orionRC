import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { DeviceConfig, ReadingPayload, SensorConfig, ISensorDriver, AgentState } from './types';

// CommonJS modül sisteminde __dirname global olarak mevcuttur.
// ES modül düzeltmesine gerek yoktur.

// --- Yardımcı Fonksiyonlar ---
const logger = {
    log: (message: string) => console.log(`[${new Date().toISOString()}] [INFO] ${message}`),
    warn: (message: string) => console.warn(`[${new Date().toISOString()}] [WARN] ⚠️  ${message}`),
    error: (message: string, error?: any) => console.error(`[${new Date().toISOString()}] [ERROR] ❌ ${message}`, error || ''),
};

// --- Sürücü Yöneticisi ---
class DriverManager {
    private drivers: Map<string, ISensorDriver> = new Map();

    async getDriver(driverName: string): Promise<ISensorDriver | null> {
        if (this.drivers.has(driverName)) {
            return this.drivers.get(driverName)!;
        }
        try {
            const driverPath = path.join(__dirname, 'drivers', `${driverName}.driver.js`);
            const driverModule = await import(driverPath);
            const driverInstance: ISensorDriver = new driverModule.default();
            this.drivers.set(driverName, driverInstance);
            logger.log(`Sürücü yüklendi ve önbelleğe alındı: ${driverName}`);
            return driverInstance;
        } catch (error) {
            logger.error(`Sürücü '${driverName}' yüklenemedi. Dosya mevcut mu?`, error);
            return null;
        }
    }
}

// --- Ana Orkestra Şefi Sınıfı ---
class OrionAgent {
    private state: AgentState = AgentState.INITIALIZING;
    private baseUrl: string = '';
    private token: string = '';
    private deviceId: string = '';
    private dbPath: string = path.join(__dirname, '..', 'offline_queue.db');
    private db!: Database;
    private deviceConfig: DeviceConfig | null = null;
    private driverManager: DriverManager = new DriverManager();
    private runInterval: number = 10000; // 10 saniye

    constructor(private configPath: string = 'config.json') {
        this.setupGracefulShutdown();
    }

    private setState(newState: AgentState) {
        if (this.state !== newState) {
            this.state = newState;
            logger.log(`Agent durumu değişti: ${this.state}`);
        }
    }

    private async _loadLocalConfig(): Promise<boolean> {
        logger.log(`Yerel konfigürasyon okunuyor: ${this.configPath}`);
        try {
            const configData = await fs.readFile(this.configPath, 'utf-8');
            const config = JSON.parse(configData);
            this.baseUrl = config.server.base_url;
            this.token = config.device.token;
            this.deviceId = config.device.id;
            if (!this.baseUrl || !this.token || !this.deviceId) {
                throw new Error("Yapılandırma dosyasında 'base_url', 'token' veya 'id' eksik.");
            }
            return true;
        } catch (error) {
            logger.error(`Yerel konfigürasyon okunamadı! Lütfen 'config.json' dosyasını kontrol edin.`, error);
            return false;
        }
    }

    private async _initLocalDb(): Promise<boolean> {
        logger.log("Yerel çevrimdışı kuyruk veritabanı kontrol ediliyor...");
        try {
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });
            await this.db.exec('CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');
            logger.log("Veritabanı hazır.");
            return true;
        } catch (error) {
            logger.error(`Yerel veritabanı oluşturulamadı:`, error);
            return false;
        }
    }

    async getServerConfiguration(): Promise<boolean> {
        this.setState(AgentState.CONFIGURING);
        logger.log("Sunucudan cihaz yapılandırması isteniyor...");
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/device/${this.deviceId}/config/`, {
                headers: { 'Authorization': `Token ${this.token}` },
                timeout: 15000
            });
            if (response.status === 200) {
                this.deviceConfig = response.data;
                this.setState(AgentState.ONLINE);
                logger.log("Yapılandırma başarıyla alındı.");
                return true;
            }
            logger.error(`Yapılandırma alınamadı. Sunucu yanıtı: ${response.status}`);
            return false;
        } catch (error) {
            this.setState(AgentState.OFFLINE);
            logger.error(`Sunucuya bağlanılamadı!`, error);
            return false;
        }
    }
    
    private async _readAllPhysicalSensors(): Promise<Map<number, Record<string, any>>> {
        const readings = new Map<number, Record<string, any>>();
        if (!this.deviceConfig) {
            logger.warn("Cihaz yapılandırması olmadığı için sensör okuma atlanıyor.");
            return readings;
        }

        const activeSensors = this.deviceConfig.sensors.filter(
            s => s.is_active && s.interface !== 'virtual'
        );

        for (const sensorConfig of activeSensors) {
            const driverName = sensorConfig.parser_config?.driver;
            if (!driverName) {
                logger.warn(`'${sensorConfig.name}' için 'driver' belirtilmemiş. Atlanıyor.`);
                continue;
            }

            const driver = await this.driverManager.getDriver(driverName);
            if (!driver) {
                logger.error(`'${sensorConfig.name}' için sürücü '${driverName}' yüklenemedi.`);
                continue;
            }

            try {
                const data = await driver.read(sensorConfig.config);
                if (data) {
                    logger.log(`Okunan Veri [${sensorConfig.name}]: ${JSON.stringify(data)}`);
                    readings.set(sensorConfig.id, data);
                } else {
                    logger.warn(`Veri okunamadı [${sensorConfig.name}].`);
                }
            } catch (error) {
                logger.error(`Sürücü '${driverName}' çalışırken hata oluştu:`, error);
            }
        }
        return readings;
    }

    private async _sendDataToServer(payload: ReadingPayload): Promise<boolean> {
         try {
            const response = await axios.post(`${this.baseUrl}/api/v3/readings/submit/`, payload, {
                headers: { 
                    'Authorization': `Token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            if (response.status >= 200 && response.status < 300) {
                this.setState(AgentState.ONLINE);
                return true;
            }
            logger.warn(`Veri gönderilemedi, sunucu yanıtı: ${response.status}`);
            return false;
        } catch (error) {
            this.setState(AgentState.OFFLINE);
            logger.error("Bağlantı Hatası. Veri kuyruğa alınıyor.");
            return false;
        }
    }

    private async _queueDataLocally(payload: ReadingPayload): Promise<void> {
        try {
            await this.db.run("INSERT INTO readings (payload) VALUES (?)", JSON.stringify(payload));
            logger.log(`Veri (Sensör ID: ${payload.sensor}) yerel kuyruğa eklendi.`);
        } catch (error) {
            logger.error(`Veri yerel kuyruğa eklenemedi:`, error);
        }
    }

     private async _processOfflineQueue(): Promise<void> {
        try {
            const items = await this.db.all("SELECT id, payload FROM readings ORDER BY id ASC LIMIT 100");
            if (items.length > 0) {
                 logger.log(`Çevrimdışı kuyrukta ${items.length} kayıt var, gönderiliyor...`);
                 for (const item of items) {
                    const success = await this._sendDataToServer(JSON.parse(item.payload as string));
                    if (success) {
                        logger.log(`Kuyruk (ID: ${item.id}) başarıyla gönderildi.`);
                        await this.db.run("DELETE FROM readings WHERE id = ?", item.id);
                    } else {
                        logger.warn("Sunucuya ulaşılamıyor, kuyruk işlemi durduruldu.");
                        break; 
                    }
                 }
            }
        } catch (error) {
            logger.error(`Kuyruk işlenemedi:`, error);
        }
    }

    async masterReadCycle() {
        logger.log(`--- [${this.state}] Ana okuma döngüsü başladı ---`);
        
        await this._processOfflineQueue();
        
        // Periyodik olarak sunucu yapılandırmasını güncellemeyi dene
        if (this.state === AgentState.OFFLINE) {
            await this.getServerConfiguration();
        }

        logger.log("Fiziksel Sensörler Okunuyor...");
        const newReadings = await this._readAllPhysicalSensors();
        logger.log("Okuma Tamamlandı.");

        if (newReadings.size === 0) {
            logger.log("Gönderilecek yeni veri bulunamadı.");
            return;
        }

        logger.log("Yeni Veriler Sunucuya Gönderiliyor...");
        for (const [sensorId, value] of newReadings.entries()) {
            const payload: ReadingPayload = { sensor: sensorId, value: value };
            const success = await this._sendDataToServer(payload);
             if (!success) {
                await this._queueDataLocally(payload);
            }
        }
        logger.log("Gönderim Tamamlandı.");
    }
    
    private setupGracefulShutdown() {
        process.on('SIGINT', async () => {
            logger.log("\n--- Kapatma sinyali (Ctrl+C) alındı. ---");
            logger.log("Kalan veriler gönderilmeye çalışılıyor...");
            await this._processOfflineQueue();
            logger.log("--- Orion Agent kapatıldı. ---");
            process.exit(0);
        });
    }

    async run(): Promise<void> {
        logger.log("--- Orion Agent (TypeScript) Başlatılıyor ---");
        this.setState(AgentState.INITIALIZING);

        if (!await this._loadLocalConfig() || !await this._initLocalDb()) {
            this.setState(AgentState.ERROR);
            logger.error("Agent, kritik bir başlangıç hatası nedeniyle başlatılamıyor.");
            return;
        }
        
        logger.log(`Sunucu: ${this.baseUrl}`);
        logger.log(`Cihaz ID: ${this.deviceId}`);
        
        await this.getServerConfiguration();

        logger.log(`Zamanlayıcı kuruldu. Ana döngü her ${this.runInterval / 1000} saniyede bir çalışacak.`);
        logger.log("Çıkmak için Ctrl+C'ye basın.");

        this.masterReadCycle();
        setInterval(() => this.masterReadCycle(), this.runInterval);
    }
}

// Agent'ı başlat
const agent = new OrionAgent(path.join(__dirname, '..', 'config.json'));
agent.run().catch(err => logger.error("Beklenmedik bir hata oluştu ve agent durdu.", err));
