// backend/src/types.ts

// A single sensor's configuration for the agent
export interface SensorConfig {
    id: number;
    name: string;
    is_active: boolean;
    interface: 'i2c' | 'serial' | 'virtual';
    parser_config: {
        driver: string;
    };
    config: any;
}

// The complete configuration for a single IoT device
export interface DeviceConfig {
    sensors: SensorConfig[];
}

// Data payload sent from the agent to the server
export interface ReadingPayload {
    sensor: number;
    value: Record<string, any>;
}

// --- Common types for Frontend and Backend ---

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

export type Severity = 'Kritik' | 'Uyarı' | 'Bilgi';

export interface Notification {
    id: string;
    ruleId: string;
    message: string;
    stationName: string;
    sensorName: string;
    triggeredValue: string;
    timestamp: string;
    severity: Severity;
    isRead: boolean;
}
