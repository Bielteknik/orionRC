import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

/**
 * Driver to read from a generic UART weight sensor that outputs lines of text containing a weight value.
 * This driver reads lines from the serial port and parses the first floating-point number it finds.
 */
export default class Hx711UartDriver implements ISensorDriver {
    /**
     * Reads a single valid weight reading from the sensor.
     * @param config - Contains serial port settings: { port: string; baudrate?: number }.
     * @returns An object containing the weight data (e.g., { weight_kg: 15.23 }) or null on error/timeout.
     */
    public read(config: { port: string; baudrate?: number }): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 9600 } = config;

            if (!port) {
                console.error("     -> HATA (HX711 UART): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }

            console.log(`     -> HX711 UART okunuyor... Port: ${port}, Baud: ${baudrate}`);
            
            const serialPort: any = new SerialPort({
                path: port,
                baudRate: baudrate,
                autoOpen: false,
            });

            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            let timeout: ReturnType<typeof setTimeout> | null = null;

            const cleanupAndResolve = (value: Record<string, any> | null) => {
                if (timeout) clearTimeout(timeout);
                
                parser.removeAllListeners('data');
                serialPort.removeAllListeners('error');
                serialPort.removeAllListeners('open');
                
                if (serialPort.isOpen) {
                    serialPort.close((err: Error | null) => {
                        if (err) {
                           console.error(`     -> HATA (HX711 UART): Port kapatılamadı (${port}): ${err.message}`);
                        }
                    });
                }
                resolve(value);
            };
            
            const onData = (line: string) => {
                const trimmedLine = line.trim();
                console.log(`     -> Ham Veri [HX711 UART]: "${trimmedLine}"`);

                const match = trimmedLine.match(/([0-9]*\.?[0-9]+)/);
                
                if (match && match[0]) {
                    const weight = parseFloat(match[0]);
                    if (!isNaN(weight)) {
                        console.log(`     -> Ayrıştırılan Veri [HX711 UART]: ${weight} kg`);
                        cleanupAndResolve({ weight_kg: weight });
                        return; // Success, stop listening
                    }
                }
            };

            const onError = (err: Error | null) => {
                if(err) {
                    console.error(`     -> HATA (HX711 UART): Seri port hatası (${port}):`, err.message);
                }
                cleanupAndResolve(null);
            };

            // Timeout after 7 seconds
            timeout = setTimeout(() => {
                console.warn(`     -> UYARI (HX711 UART): Veri okuma ${port} portunda zaman aşımına uğradı. Sayısal bir değer içeren satır bulunamadı.`);
                cleanupAndResolve(null);
            }, 7000);

            serialPort.on('error', onError);
            parser.on('data', onData);

            serialPort.open((err: Error | null) => {
                if (err) {
                    return onError(err);
                }
                console.log(`     -> Port açıldı: ${port}. Veri okunuyor...`);
            });
        });
    }
}
