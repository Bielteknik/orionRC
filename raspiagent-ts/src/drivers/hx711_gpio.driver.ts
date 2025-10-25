import { ISensorDriver } from "../types.js";

/**
 * Stub driver for HX711 via GPIO.
 * This TypeScript agent does not currently support direct GPIO communication for the HX711.
 * Please use a microcontroller (like Arduino) to read the sensor and send data via a serial port,
 * then use the 'hx711_load_cell' driver.
 */
export default class Hx711GpioDriver implements ISensorDriver {
    public read(config: any): Promise<Record<string, any> | null> {
        console.error("     -> HATA (HX711 GPIO): Bu agent, HX711'in doğrudan GPIO ile okunmasını desteklememektedir.");
        console.warn("     -> ÖNERİ: Lütfen sensörü bir Arduino'ya bağlayın ve seri port üzerinden veri gönderin.");
        console.warn("     -> ÖNERİ: Web arayüzünde bu sensörün yapılandırmasını 'hx711_load_cell' sürücüsünü kullanacak şekilde güncelleyin.");
        return Promise.resolve(null); // Return null to indicate failure without crashing.
    }
}
