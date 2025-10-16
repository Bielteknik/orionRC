import axios from 'axios';
import { Station, Sensor, Camera, AlertRule, Report, ReportSchedule, Notification } from '../types.ts';

const API_BASE_URL = '/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Generic error handler
const handleError = (error: any, context: string): Promise<never> => {
    console.error(`Error ${context}:`, error);
    const message = error.response?.data?.error || `Veri alınamadı: ${context}`;
    throw new Error(message);
};

// Stations
export const getStations = (): Promise<Station[]> => apiClient.get('/stations').then(res => res.data).catch(e => handleError(e, 'fetching stations'));
export const addStation = (data: any): Promise<Station> => apiClient.post('/stations', data).then(res => res.data).catch(e => handleError(e, 'adding station'));
export const updateStation = (id: string, data: any): Promise<Station> => apiClient.put(`/stations/${id}`, data).then(res => res.data).catch(e => handleError(e, 'updating station'));
export const deleteStation = (id: string): Promise<void> => apiClient.delete(`/stations/${id}`).then(res => res.data).catch(e => handleError(e, 'deleting station'));

// Sensors
export const getSensors = (): Promise<Sensor[]> => apiClient.get('/sensors').then(res => res.data).catch(e => handleError(e, 'fetching sensors'));
export const getUnassignedSensors = (): Promise<Sensor[]> => apiClient.get('/sensors?unassigned=true').then(res => res.data).catch(e => handleError(e, 'fetching unassigned sensors'));
export const addSensor = (data: any): Promise<Sensor> => apiClient.post('/sensors', data).then(res => res.data).catch(e => handleError(e, 'adding sensor'));
export const updateSensor = (id: string, data: any): Promise<Sensor> => apiClient.put(`/sensors/${id}`, data).then(res => res.data).catch(e => handleError(e, 'updating sensor'));
export const deleteSensor = (id: string): Promise<void> => apiClient.delete(`/sensors/${id}`).then(res => res.data).catch(e => handleError(e, 'deleting sensor'));

// Cameras
export const getCameras = (): Promise<Camera[]> => apiClient.get('/cameras').then(res => res.data).catch(e => handleError(e, 'fetching cameras'));
export const getUnassignedCameras = (): Promise<Camera[]> => apiClient.get('/cameras?unassigned=true').then(res => res.data).catch(e => handleError(e, 'fetching unassigned cameras'));
export const addCamera = (data: any): Promise<Camera> => apiClient.post('/cameras', data).then(res => res.data).catch(e => handleError(e, 'adding camera'));
export const deleteCamera = (id: string): Promise<void> => apiClient.delete(`/cameras/${id}`).then(res => res.data).catch(e => handleError(e, 'deleting camera'));
export const captureCameraImage = (id: string): Promise<void> => apiClient.post(`/cameras/${id}/capture`).then(res => res.data).catch(e => handleError(e, 'capturing camera image'));


// Readings
export const getReadings = (): Promise<any[]> => apiClient.get('/readings').then(res => res.data).catch(e => handleError(e, 'fetching readings'));
export const getReadingsHistory = (params: { stationIds: string[], sensorTypes: string[], start?: string, end?: string }): Promise<any[]> => {
    return apiClient.get('/readings/history', {
        params: {
            stationIds: params.stationIds.join(','),
            sensorTypes: params.sensorTypes.join(','),
            start: params.start,
            end: params.end,
        }
    }).then(res => res.data).catch(e => handleError(e, 'fetching readings history'));
}

// Definitions
export const getDefinitions = (): Promise<{ stationTypes: any[], sensorTypes: any[], cameraTypes: any[] }> => apiClient.get('/definitions').then(res => res.data).catch(e => handleError(e, 'fetching definitions'));
export const addDefinition = (type: string, data: { name: string }): Promise<any> => apiClient.post(`/definitions/${type}`, data).then(res => res.data).catch(e => handleError(e, `adding ${type}`));
export const updateDefinition = (type: string, id: number, data: { name: string }): Promise<any> => apiClient.put(`/definitions/${type}/${id}`, data).then(res => res.data).catch(e => handleError(e, `updating ${type}`));
export const deleteDefinition = (type: string, id: number): Promise<void> => apiClient.delete(`/definitions/${type}/${id}`).then(res => res.data).catch(e => handleError(e, `deleting ${type}`));
export const getAlertRules = (): Promise<AlertRule[]> => apiClient.get('/alert-rules').then(res => res.data).catch(e => handleError(e, 'fetching alert rules'));

// Reports
export const getReports = (): Promise<Report[]> => apiClient.get('/reports').then(res => res.data).catch(e => handleError(e, 'fetching reports'));
export const getReportSchedules = (): Promise<ReportSchedule[]> => apiClient.get('/report-schedules').then(res => res.data).catch(e => handleError(e, 'fetching report schedules'));

// Notifications
export const getNotifications = (): Promise<Notification[]> => apiClient.get('/notifications').then(res => res.data).catch(e => handleError(e, 'fetching notifications'));
export const markAllNotificationsAsRead = (): Promise<void> => apiClient.post('/notifications/mark-all-read').then(res => res.data).catch(e => handleError(e, 'marking all notifications as read'));
export const clearAllNotifications = (): Promise<void> => apiClient.delete('/notifications/clear-all').then(res => res.data).catch(e => handleError(e, 'clearing all notifications'));