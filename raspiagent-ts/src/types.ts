// Sunucudan gelen cihaz yapılandırması
export interface DeviceConfig {
    sensors: SensorConfig[];
    cameras: CameraConfig[];
    global_read_frequency_seconds?: number;
    gemini_api_key?: string;
}

// Tek bir sensörün yapılandırması
export interface SensorConfig {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    read_frequency: number;
    interface: 'i2c' | 'serial' | 'virtual' | 'openweather' | 'http' | 'uart';
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
    command_type: 'CAPTURE_IMAGE' | 'ANALYZE_SNOW_DEPTH' | 'FORCE_READ_SENSOR' | string;
    payload: {
        camera_id?: string;
        virtual_sensor_id?: string;
        sensor_id?: string;
        analysis_type?: 'gemini' | 'opencv';
    };
}

// Sensör sürücülerinin uygulayacağı arayüz
export interface ISensorDriver {
    read(config: any): Promise<Record<string, any> | null>;
}

// Sunucuya gönderilecek okuma verisi
export interface ReadingPayload {
    sensor: string;
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