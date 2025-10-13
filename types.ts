export enum Page {
  Dashboard = 'Dashboard',
  Stations = 'Stations',
  Sensors = 'Sensors',
  Cameras = 'Cameras',
  Definitions = 'Definitions',
  Reports = 'Reports',
  Notifications = 'Notifications',
}

export enum Trend {
  Up = 'up',
  Down = 'down',
  Stable = 'stable',
}

export type Severity = 'Kritik' | 'Uyarı' | 'Bilgi';
export type AlertCondition = 'Büyüktür' | 'Küçüktür';

export interface AlertRule {
  id: string;
  name: string;
  sensorType: string;
  stationIds: string[]; // Empty array means all stations
  condition: AlertCondition;
  threshold: number;
  severity: Severity;
  isEnabled: boolean;
}

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
  // Detail page specific fields
  systemHealth: number;
  avgBattery: number;
  dataFlow: number;
  activeSensorCount: number;
  onlineCameraCount: number;
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

export interface SensorDataPoint {
  time: string;
  value: number;
}

export interface ReportConfig {
  reportName: string;
  reportType: 'Günlük' | 'Haftalık' | 'Aylık';
  fileFormat: 'PDF' | 'CSV';
  dateRangePreset: 'last24h' | 'last7d' | 'last30d' | 'custom';
  customDateRange: { start: string; end: string };
  selectedStations: string[];
  selectedSensorTypes: string[];
  dataRules: {
    includeMinMaxAvg: boolean;
    includeAlerts: boolean;
    includeUptime: boolean;
  };
}

export interface Report {
  id: string;
  title: string;
  createdAt: string;
  type: 'daily' | 'weekly' | 'monthly';
  config?: ReportConfig;
}

export interface ReportSchedule {
    id: string;
    name: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipient: string;
    reportConfig: ReportConfig;
    isEnabled: boolean;
    lastRun?: string;
}

export type WidgetType = 'dataCard' | 'sensorChart' | 'windRose';

export interface WidgetConfig {
    id: string;
    type: WidgetType;
    // For dataCard: { title: string, sensorType: string }
    // For sensorChart: { sensorType: string }
    // For windRose: {}
    config: any; 
    gridArea: string; // e.g. '1 / 1 / 2 / 2' for row-start/col-start/row-end/col-end
}