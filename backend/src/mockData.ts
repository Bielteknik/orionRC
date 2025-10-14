import { Station, Sensor, Camera, SensorStatus, CameraStatus } from './types';

// Omit calculated fields for DB seeding
type DbStation = Omit<Station, 'locationCoords' | 'sensorCount' | 'cameraCount' | 'activeAlerts' | 'lastUpdate' | 'systemHealth' | 'avgBattery' | 'dataFlow' | 'activeSensorCount' | 'onlineCameraCount'> & { lat: number, lng: number };
type DbSensor = Omit<Sensor, 'value' | 'lastUpdate'>;
type DbCamera = Omit<Camera, 'photos'>;

export const MOCK_STATIONS: DbStation[] = [];

export const MOCK_SENSORS: DbSensor[] = [];

export const MOCK_CAMERAS: DbCamera[] = [];
