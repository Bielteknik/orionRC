import { ISensorDriver } from "../types.js";
import axios from 'axios';

/**
 * Driver to fetch temperature and humidity data from the OpenWeatherMap API.
 * This acts as a "virtual" sensor.
 */
export default class OpenWeatherDriver implements ISensorDriver {
    /**
     * Reads weather data from OpenWeatherMap.
     * @param config - Must contain { apikey: string, lat: number, lon: number }.
     *                 This config is injected by the backend server.
     * @returns An object with temperature and humidity, or null on failure.
     */
    public async read(config: { apikey: string; lat: number; lon: number; }): Promise<Record<string, any> | null> {
        const { apikey, lat, lon } = config;

        if (!apikey || lat === undefined || lon === undefined) {
            console.error("     -> HATA (OpenWeather): API anahtarı veya koordinatlar eksik. Bu yapılandırma sunucu tarafından sağlanmalıdır.");
            return null;
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apikey}&units=metric`;
        
        console.log(`     -> OpenWeather API'den veri alınıyor...`);

        try {
            const response = await axios.get(url, { timeout: 8000 });
            
            if (response.status === 200 && response.data && response.data.main) {
                const { temp, humidity } = response.data.main;
                
                const result = {
                    temperature: parseFloat(temp.toFixed(2)),
                    humidity: parseFloat(humidity.toFixed(2))
                };
                
                return result;
            } else {
                console.error(`     -> HATA (OpenWeather): API'den geçersiz yanıt alındı. Durum: ${response.status}`);
                return null;
            }

        } catch (error) {
            if (axios.isAxiosError(error)) {
                 console.error(`     -> HATA (OpenWeather): API isteği başarısız oldu: ${error.message}`);
                 if (error.response) {
                     console.error(`     -> Sunucu Yanıtı: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
                 }
            } else {
                 console.error(`     -> HATA (OpenWeather): Beklenmedik bir hata oluştu.`, error);
            }
            return null;
        }
    }
}