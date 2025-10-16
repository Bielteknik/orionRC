// This file defines the shape of the configuration object
// that the backend sends to the IoT agent.

// A single sensor's configuration
export interface SensorConfig {
    id: number; // Unique ID for this sensor in the database
    name: string; // Human-readable name, e.g., "Sıcaklık Sensörü 1"
    is_active: boolean;
    interface: 'i2c' | 'serial' | 'virtual'; // The hardware interface type
    
    // Defines which driver to use on the agent
    parser_config: {
        driver: string; // e.g., "sht3x"
    };

    // Driver-specific settings, like I2C address or serial port path
    config: {
        address?: string; // e.g., "0x44" for I2C
        bus?: number;     // e.g., 1 for I2C bus 1
        port?: string;    // e.g., "/dev/ttyUSB0" for serial
        baudrate?: number;
    };
}

export interface CameraConfig {
    id: string;
    name: string;
    rtsp_url: string;
}

// The complete configuration for a single IoT device (Raspberry Pi)
export interface DeviceConfig {
    sensors: SensorConfig[];
    cameras: CameraConfig[];
}

// Data structure for a station, sent to the frontend
export interface Station {
  id: string;
  name: string;
  location: string;
  locationCoords: { lat: number; lng: number };
  status: 'active' | 'inactive' | 'maintenance';
  sensorCount: number;
  cameraCount: number;
  activeAlerts: number;
  lastUpdate: string;
  systemHealth?: number;
  avgBattery?: number;
  dataFlow?: number;
  activeSensorCount?: number;
  onlineCameraCount?: number;
}

export enum SensorStatus {
    Active = 'Aktif',
    Inactive = 'Pasif',
    Error = 'Hatalı',
    Maintenance = 'Bakımda'
}

export interface Sensor {
  id: string;
  name: string;
  type: string;
  stationId: string;
  status: SensorStatus;
  value: number;
  unit: string;
  battery: number;
  lastUpdate: string;
}

export enum CameraStatus {
    Online = 'Çevrimiçi',
    Offline = 'Çevrimdışı',
    Recording = 'Kaydediyor',
}
export interface Camera {
  id: string;
  name: string;
  stationId: string;
  status: CameraStatus;
  streamUrl: string;
  rtspUrl: string;
  cameraType: string;
  viewDirection: string;
  fps: number;
  photos: string[];
}