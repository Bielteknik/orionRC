import { Station, Sensor, Camera } from '../types';

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
 * Fetches all sensors from the backend.
 */
export const getSensors = (): Promise<Sensor[]> => {
    return fetcher<Sensor[]>('/sensors');
};

/**
 * Fetches all cameras from the backend.
 */
export const getCameras = (): Promise<Camera[]> => {
    return fetcher<Camera[]>('/cameras');
};
