import { Station, Sensor, Camera, Notification } from '../types';

// Use a relative path for API calls, assuming the backend is served on the same host
// or a proxy is set up in development.
const API_BASE_URL = '/api';

/**
 * A generic fetcher function to handle API requests and errors.
 * @param url The API endpoint to fetch.
 * @param options Optional fetch options.
 * @returns A promise that resolves to the JSON response.
 */
async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorInfo = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorInfo.message || `HTTP error! status: ${response.status}`);
        }
        // Handle 204 No Content for DELETE requests
        if (response.status === 204) {
            return null as T;
        }
        return response.json();
    } catch (error) {
        console.error(`API service error fetching ${endpoint}:`, error);
        // Re-throw the error to be handled by the calling component
        throw error;
    }
}

/**
 * Fetches all stations from the backend.
 */
export const getStations = (): Promise<Station[]> => {
    return fetcher<Station[]>('/stations');
};

/**
 * Deletes a station by its ID.
 */
export const deleteStation = (id: string): Promise<void> => {
    return fetcher<void>(`/stations/${id}`, { method: 'DELETE' });
};


/**
 * Fetches all sensors from the backend.
 */
export const getSensors = (): Promise<Sensor[]> => {
    return fetcher<Sensor[]>('/sensors');
};

/**
 * Deletes a sensor by its ID.
 */
export const deleteSensor = (id: string): Promise<void> => {
    return fetcher<void>(`/sensors/${id}`, { method: 'DELETE' });
};

/**
 * Fetches all cameras from the backend.
 */
export const getCameras = (): Promise<Camera[]> => {
    return fetcher<Camera[]>('/cameras');
};

/**
 * Deletes a camera by its ID.
 */
export const deleteCamera = (id: string): Promise<void> => {
    return fetcher<void>(`/cameras/${id}`, { method: 'DELETE' });
};


/**
 * Fetches all notifications from the backend.
 */
export const getNotifications = (): Promise<Notification[]> => {
    return fetcher<Notification[]>('/notifications');
};