// Sunucudan gelen cihaz yapılandırması
export interface DeviceConfig {
    sensors: SensorConfig[];
    cameras: CameraConfig[];
}

// Tek bir sensörün yapılandırması
export interface SensorConfig {
    id: number;
    name: string;
    is_active: boolean;
    interface: 'i2c' | 'serial' | 'virtual' | 'openweather' | 'http';
    parser_config: {
        driver: string;
    };
    config: any; // Porta özel ayarlar (port, baudrate, address vb.)
}

// Tek bir kameranın yapılandırması
export interface CameraConfig {
    id: string;
    name: string;
    rtsp_url: string;
}

// Sunucudan gelen komut
export interface AgentCommand {
    id: number;
    command_type: 'CAPTURE_IMAGE' | string;
    payload: {
        camera_id: string;
        // Diğer payload verileri
    };
}

// Sensör sürücülerinin uygulayacağı arayüz
export interface ISensorDriver {
    read(config: any): Promise<Record<string, any> | null>;
}

// Sunucuya gönderilecek okuma verisi
export interface ReadingPayload {
    sensor: number;
    value: Record<string, any>;
}

// Agent'ın genel durumunu belirtmek için
export enum AgentState {
    INITIALIZING = "BAŞLATILIYOR",
    CONFIGURING = "YAPILANDIRILIYOR",
    OFFLINE = "ÇEVRİMDIŞI",
    ONLINE = "ÇEVRİMİÇİ",
    ERROR = "HATALI"
}