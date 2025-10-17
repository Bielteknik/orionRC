


import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { DeviceConfig, ReadingPayload, AgentState, AgentCommand, ISensorDriver, SensorConfig, CameraConfig } from './types.js';

const execAsync = promisify(exec);

// Fix: Define __dirname for ES modules to resolve path errors.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
================================================================================
YAPAY ZEKA DESTEKLİ SANAL SENSÖRLER (GÖRÜNTÜ İŞLEME)
================================================================================
Bu agent, Python ile yazılmış harici yapay zeka script'lerini çalıştırarak 
"sanal sensörler" oluşturma yeteneğine sahiptir. Bu, kameralardan alınan
görüntülerin analiz edilerek meteorolojik veya çevresel veriler üretilmesini sağlar.

Örnek Kullanım Alanları:
- Gökyüzü görüntüsünden bulutluluk oranı tespiti.
- Zemin görüntüsünden kar veya ıslaklık tespiti.
- Hava kalitesi için görüş mesafesi tahmini.

GEREKSİNİMLER:
1. Raspberry Pi üzerinde Python 3 kurulu olmalıdır.
2. Gerekli Python kütüphaneleri (örn: Pillow, OpenCV, NumPy) pip ile kurulmalıdır.
   Örnek: `pip install Pillow numpy`
3. Analiz script'leri `raspberry-pi-agent/dist/scripts/` klasöründe bulunmalıdır.
   Projenizde `raspberry-pi-agent/src/scripts/` klasörü oluşturup script'lerinizi
   buraya ekleyebilirsiniz. TypeScript derlendiğinde bu klasör `dist`'e kopyalanacaktır.
   (Not: Bu özellik için `tsconfig.json` ve `package.json`'da ek ayarlar gerekebilir.)

PYTHON SCRIPT'İNİN UYMASI GEREKEN KURALLAR:
- Komut satırından tek bir argüman almalıdır: analiz edilecek resmin tam yolu.
- Analiz sonucunu JSON formatında standart çıktıya (stdout) yazdırmalıdır.
- Başarılı olursa `exit(0)`, hata olursa `exit(1)` ile sonlanmalıdır.
- Hata durumunda, hatayı açıklayan bir JSON'u standart hataya (stderr) yazabilir.

Örnek `image_analyzer.py` (src/scripts/ içine yerleştirin):
--------------------------------------------------------------------------------
import sys
import json
from PIL import Image

def analyze_image(image_path):
    try:
        with Image.open(image_path) as img:
            grayscale_img = img.convert('L')
            pixels = list(grayscale_img.getdata())
            avg_brightness = sum(pixels) / len(pixels)
            normalized_brightness = round(avg_brightness / 255.0, 2)
            
            result = {
                "brightness": normalized_brightness,
                "sky_condition": "cloudy" if normalized_brightness < 0.5 else "clear"
            }
            print(json.dumps(result))
            sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)
    analyze_image(sys.argv[1])
--------------------------------------------------------------------------------

WEB ARAYÜZÜNDEN SANAL SENSÖR TANIMLAMA:
- Sensörler sayfasına gidin ve "Yeni Ekle" deyin.
- Arayüz Tipi: "Yapay Zeka (Görüntü İşleme)" seçin.
- Arayüz Yapılandırması (JSON):
  {
    "source_camera_id": "analiz_yapilacak_kameranin_id_si",
    "script": "image_analyzer.py" 
  }
- Ayrıştırıcı Yapılandırması (JSON):
  {
    "driver": "image_analyzer"
  }
- Diğer sensör bilgilerini doldurup kaydedin.

Agent, bir sonraki okuma döngüsünde bu sanal sensörü otomatik olarak işlemeye başlayacaktır.
*/

const logger = {
    log: (message: string) => console.log(`[${new Date().toISOString()}] [INFO] ${message}`),
    warn: (message: string) => console.warn(`[${new Date().toISOString()}] [WARN] ⚠️  ${message}`),
    error: (message: string, ...optionalParams: any[]) => console.error(`[${new Date().toISOString()}] [ERROR] ❌ ${message}`, ...optionalParams),
};

class DriverManager {
    private drivers: Map<string, ISensorDriver> = new Map();

    async getDriver(driverName: string): Promise<ISensorDriver | null> {
        if (this.drivers.has(driverName)) {
            return this.drivers.get(driverName)!;
        }
        try {
            const filename = driverName.endsWith('.driver') 
                ? `${driverName}.js` 
                : `${driverName}.driver.js`;
            const driverPath = path.join(__dirname, 'drivers', filename);

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
            if (!this.baseUrl || !this.token || !this.deviceId) throw new Error("Yapılandırma dosyasında 'base_url', 'token' veya 'id' eksik.");
            return true;
        } catch (error) {
            logger.error(`Yerel konfigürasyon okunamadı! Lütfen 'config.json' dosyasını kontrol edin.`, error);
            return false;
        }
    }

    private async _initLocalDb(): Promise<boolean> {
        logger.log("Yerel çevrimdışı kuyruk veritabanı kontrol ediliyor...");
        try {
            this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });
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
            const response = await axios.get(`${this.baseUrl}/api/config/${this.deviceId}`, {
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
        if (!this.deviceConfig?.sensors) {
            logger.warn("Cihaz yapılandırmasında sensör bulunmadığı için sensör okuma atlanıyor.");
            return readings;
        }

        const activeSensors = this.deviceConfig.sensors.filter((s: SensorConfig) => s.is_active && s.interface !== 'virtual');
        for (const sensorConfig of activeSensors) {
            const driverName = sensorConfig.parser_config?.driver;
            if (!driverName) {
                logger.warn(`'${sensorConfig.name}' için 'driver' belirtilmemiş. Atlanıyor.`);
                continue;
            }
            
            logger.log(`'${sensorConfig.name}' okunuyor (Sürücü: ${driverName})...`);
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
                } else logger.warn(`Veri okunamadı [${sensorConfig.name}].`);
            } catch (error) {
                logger.error(`Sürücü '${driverName}' çalışırken hata oluştu:`, error);
            }
        }
        return readings;
    }

    private async _readVirtualImageSensors(): Promise<Map<number, Record<string, any>>> {
        const readings = new Map<number, Record<string, any>>();
        if (!this.deviceConfig?.sensors) {
            return readings;
        }

        const virtualSensors = this.deviceConfig.sensors.filter((s: SensorConfig) => s.is_active && s.interface === 'virtual' && s.parser_config?.driver === 'image_analyzer');

        for (const sensorConfig of virtualSensors) {
            const sourceCameraId = sensorConfig.config?.source_camera_id;
            const script = sensorConfig.config?.script;

            if (!sourceCameraId || !script) {
                logger.warn(`Sanal sensör '${sensorConfig.name}' için 'source_camera_id' veya 'script' yapılandırması eksik. Atlanıyor.`);
                continue;
            }

            const cameraConfig = this.deviceConfig.cameras.find((c: CameraConfig) => c.id === sourceCameraId);
            if (!cameraConfig) {
                logger.warn(`'${sensorConfig.name}' için kaynak kamera ID '${sourceCameraId}' bulunamadı. Atlanıyor.`);
                continue;
            }

            logger.log(`Sanal sensör '${sensorConfig.name}' işleniyor... (Kaynak: ${cameraConfig.name})`);
            
            const tempFilePath = path.join('/tmp', `orion_agent_capture_${Date.now()}.png`);
            const ffmpegCommand = `ffmpeg -rtsp_transport tcp -i "${cameraConfig.rtsp_url}" -vframes 1 -y "${tempFilePath}"`;
            // NOTE: Assumes that python scripts are placed in a 'scripts' directory next to the 'drivers' directory.
            const scriptPath = path.join(__dirname, 'scripts', script);
            const pythonCommand = `python3 "${scriptPath}" "${tempFilePath}"`;

            try {
                // 1. Capture image
                logger.log(`     -> Görüntü yakalanıyor: ${cameraConfig.rtsp_url}`);
                await execAsync(ffmpegCommand);

                // 2. Run python script
                logger.log(`     -> Python script çalıştırılıyor: ${pythonCommand}`);
                const { stdout, stderr } = await execAsync(pythonCommand);
                if (stderr) {
                    logger.warn(`     -> Python script'i stderr'e yazdı: ${stderr}`);
                }

                // 3. Parse result and add to readings
                const data = JSON.parse(stdout);
                logger.log(`     -> Analiz sonucu [${sensorConfig.name}]: ${JSON.stringify(data)}`);
                readings.set(sensorConfig.id, data);

            } catch (error) {
                logger.error(`Sanal sensör '${sensorConfig.name}' işlenirken hata oluştu:`, error);
            } finally {
                // 4. Clean up temp file
                try {
                    await fs.unlink(tempFilePath);
                } catch (unlinkError) {
                    // Fix: Cannot find namespace 'NodeJS'. Cast to any to access code property.
                    if ((unlinkError as any).code !== 'ENOENT') {
                        logger.warn(`Geçici resim dosyası silinemedi: ${tempFilePath}: ${String(unlinkError)}`);
                    }
                }
            }
        }
        return readings;
    }


    private async _sendDataToServer(payload: ReadingPayload): Promise<boolean> {
         try {
            const response = await axios.post(`${this.baseUrl}/api/submit-reading`, payload, {
                headers: { 'Authorization': `Token ${this.token}`, 'Content-Type': 'application/json' },
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
            logger.error(`Bağlantı Hatası. Veri kuyruğa alınıyor: ${String(error)}`);
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

    private async _handleCaptureImageCommand(command: AgentCommand): Promise<void> {
        const { camera_id } = command.payload;
        const cameraConfig = this.deviceConfig?.cameras.find((c: CameraConfig) => c.id === camera_id);
        if (!cameraConfig) {
            logger.error(`Fotoğraf çekme komutu başarısız: Kamera ID '${camera_id}' yapılandırmada bulunamadı.`);
            return;
        }
        const { rtsp_url, name: cameraName } = cameraConfig;
        
        const now = new Date();
        const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `${timestamp}_${cameraName.replace(/\s+/g, '_')}.png`;
        const tempFilePath = path.join('/tmp', filename);

        const ffmpegCommand = `ffmpeg -rtsp_transport tcp -i "${rtsp_url}" -vframes 1 -y "${tempFilePath}"`;
        
        logger.log(`ffmpeg komutu çalıştırılıyor: ${ffmpegCommand}`);
        try {
            await execAsync(ffmpegCommand);
            logger.log(`Görüntü başarıyla yakalandı: ${tempFilePath}`);

            const imageBuffer = await fs.readFile(tempFilePath);
            const base64Image = imageBuffer.toString('base64');
            
            logger.log(`Görüntü sunucuya yükleniyor...`);
            await axios.post(`${this.baseUrl}/api/cameras/${camera_id}/upload-photo`, 
                { image: base64Image, filename },
                { headers: { 'Authorization': `Token ${this.token}`, 'Content-Type': 'application/json' } }
            );
            logger.log(`Görüntü başarıyla yüklendi.`);
            await fs.unlink(tempFilePath); // Clean up temp file

            // Mark command as complete
            await axios.post(`${this.baseUrl}/api/commands/${command.id}/complete`, {}, { headers: { 'Authorization': `Token ${this.token}` } });

        } catch (error) {
            logger.error(`Fotoğraf çekme/yükleme hatası: ${String(error)}`);
            // Mark command as failed
             await axios.post(`${this.baseUrl}/api/commands/${command.id}/fail`, {}, { headers: { 'Authorization': `Token ${this.token}` } });
        }
    }

    private async _processCommands(): Promise<void> {
        if (this.state === AgentState.OFFLINE) return;
        try {
            const response = await axios.get(`${this.baseUrl}/api/commands/${this.deviceId}`, {
                headers: { 'Authorization': `Token ${this.token}` },
            });
            const commands: AgentCommand[] = response.data;
            if (commands.length > 0) {
                logger.log(`${commands.length} adet yeni komut bulundu.`);
                for (const command of commands) {
                    logger.log(`Komut işleniyor: ID=${command.id}, Tip=${command.command_type}`);
                    switch (command.command_type) {
                        case 'CAPTURE_IMAGE':
                            await this._handleCaptureImageCommand(command);
                            break;
                        default:
                            logger.warn(`Bilinmeyen komut tipi: ${command.command_type}`);
                    }
                }
            }
        } catch (error) {
            logger.error('Sunucudan komutlar alınamadı:', error);
        }
    }

    async masterReadCycle() {
        logger.log(`--- [${this.state}] Ana okuma döngüsü başladı ---`);
        
        await this._processOfflineQueue();
        
        if (this.state === AgentState.OFFLINE) {
            await this.getServerConfiguration();
        }

        await this._processCommands();

        logger.log("Fiziksel Sensörler Okunuyor...");
        const physicalReadings = await this._readAllPhysicalSensors();

        logger.log("Sanal Sensörler Okunuyor...");
        const virtualReadings = await this._readVirtualImageSensors();
        
        logger.log("Okuma Tamamlandı.");
        const newReadings = new Map([...physicalReadings, ...virtualReadings]);

        if (newReadings.size === 0) {
            logger.log("Gönderilecek yeni sensör verisi bulunamadı.");
            return;
        }

        logger.log("Yeni Sensör Verileri Sunucuya Gönderiliyor...");
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
        (process as any).on('SIGINT', async () => {
            logger.log("\n--- Kapatma sinyali (Ctrl+C) alındı. ---");
            logger.log("Kalan veriler gönderilmeye çalışılıyor...");
            await this._processOfflineQueue();
            logger.log("--- ORION Agent kapatıldı. ---");
            (process as any).exit(0);
        });
    }

    async run(): Promise<void> {
        logger.log("--- ORION Agent (TypeScript) Başlatılıyor ---");
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

const agent = new OrionAgent(path.join(__dirname, '..', 'config.json'));
agent.run().catch(err => logger.error("Beklenmedik bir hata oluştu ve agent durdu.", err));