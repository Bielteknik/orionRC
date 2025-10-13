import axios from 'axios';
import { Station } from '../types';

// IMPORTANT: Replace this with your actual backend URL.
// For local development, you might use 'http://localhost:8000'.
// For production, it will be 'https://meteoroloji.ejderapi.com.tr'.
const API_BASE_URL = 'https://meteoroloji.ejderapi.com.tr/api/v3';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

/**
 * Fetches all stations from the backend.
 * @returns A promise that resolves to an array of Station objects.
 */
export const getStations = async (): Promise<Station[]> => {
    try {
        const response = await apiClient.get('/stations');
        return response.data;
    } catch (error) {
        console.error("Error fetching stations:", error);
        // In a real-world app, you might want to handle this error more gracefully,
        // e.g., by showing a toast notification to the user.
        throw new Error('İstasyon verileri alınamadı.');
    }
};

// You can add other API functions here as you build out the application.
// For example:
// export const getSensors = async () => { ... };
// export const getStationById = async (id: string) => { ... };
