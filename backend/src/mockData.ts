// This file contains mock data to be served by the backend API
// until a database is connected.
import { Station, Sensor, SensorStatus, Camera, CameraStatus } from './types';

const pastDate = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

export const MOCK_STATIONS_DATA: Station[] = [];

export const MOCK_SENSORS_DATA: Sensor[] = [];

export const MOCK_CAMERAS_DATA: Camera[] = [];