import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

/**
 * Driver to read from a generic UART weight sensor that outputs lines of text.
 * It now supports both "Agirlik: = 0.19B0" and simple "0.19" formats.
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
                // Gelen satır boşsa dikkate alma
                if (!trimmedLine) {
                    return;
                }

                console.log(`     -> Ham Veri [HX711 UART]: "${trimmedLine}"`);

                let weight: number;

                const prefix = "Agirlik: =";
                const prefixIndex = trimmedLine.indexOf(prefix);
                
                if (prefixIndex !== -1) {
                    // Case 1: Handle lines with the prefix, e.g., "Agirlik: = 0.19B0"
                    const valueStr = trimmedLine.substring(prefixIndex + prefix.length).trim();
                    weight = parseFloat(valueStr); // parseFloat handles trailing non-numeric characters
                } else {
                    // Case 2: Handle lines that are just a number, possibly with junk
                    weight = parseFloat(trimmedLine);
                }

                if (!isNaN(weight) && isFinite(weight)) {
                    console.log(`     -> Ayrıştırılan Veri [HX711 UART]: ${weight} kg`);
                    cleanupAndResolve({ weight_kg: weight });
                }
            };

            const onError = (err: Error | null) => {
                if(err) {
                    console.error(`     -> HATA (HX711 UART): Seri port hatası (${port}):`, err.message);
                }
                cleanupAndResolve(null);
            };

            // Timeout'u 15 saniyeye çıkararak Arduino'nun reset sonrası başlaması için daha fazla zaman tanıyoruz.
            timeout = setTimeout(() => {
                console.warn(`     -> UYARI (HX711 UART): Veri okuma ${port} portunda zaman aşımına uğradı. Arduino'dan geçerli formatta veri gelmiyor olabilir.`);
                cleanupAndResolve(null);
            }, 15000);

            serialPort.on('error', onError);
            parser.on('data', onData);

            serialPort.open((err: Error | null) => {
                if (err) {
                    return onError(err);
                }
                console.log(`     -> Port açıldı: ${port}. Veri bekleniyor...`);
            });
        });
    }
}
