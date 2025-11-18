import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

/**
 * Driver to read from a generic UART weight sensor that outputs lines of text.
 * It now uses a regular expression to robustly parse numbers from various formats.
 */
export default class Hx711UartDriver implements ISensorDriver {
    /**
     * Reads a single valid weight reading from the sensor.
     * @param config - Contains serial port settings: { port: string; baudrate?: number }.
     * @param verbose - Controls whether to log output.
     * @returns An object containing the weight data (e.g., { weight_kg: 15.23 }) or null on error/timeout.
     */
    public read(config: { port: string; baudrate?: number }, verbose: boolean = true): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 115200 } = config;

            if (!port) {
                if (verbose) console.error("     -> HATA (HX711 UART): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }

            if (verbose) console.log(`     -> HX711 UART okunuyor... Port: ${port}, Baud: ${baudrate}`);
            
            const serialPort: any = new SerialPort({
                path: port,
                baudRate: baudrate,
                autoOpen: false,
            });

            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

            let timeout: ReturnType<typeof setTimeout> | null = null;

            const cleanupAndResolve = (value: Record<string, any> | null) => {
                if (timeout) clearTimeout(timeout);
                
                parser.removeAllListeners('data');
                serialPort.removeAllListeners('error');
                serialPort.removeAllListeners('open');
                
                if (serialPort.isOpen) {
                    serialPort.close((err: Error | null) => {
                        if (err && verbose) {
                           console.error(`     -> HATA (HX711 UART): Port kapatılamadı (${port}): ${err.message}`);
                        }
                    });
                }
                resolve(value);
            };
            
            const onData = (line: string) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) {
                    return;
                }

                if (verbose) console.log(`     -> Ham Veri [HX711 UART]: "${trimmedLine}"`);

                if (trimmedLine.includes('-')) {
                    if (verbose) console.log(`     -> Ayrıştırılan Veri [HX711 UART]: 0.00 kg ("-" karakteri algılandı)`);
                    cleanupAndResolve({ weight_kg: 0.0 });
                    return;
                }

                const match = trimmedLine.match(/\d*\.?\d+/);

                if (match && match[0]) {
                    const weight = parseFloat(match[0]);
                    if (!isNaN(weight) && isFinite(weight)) {
                        if (verbose) console.log(`     -> Ayrıştırılan Veri [HX711 UART]: ${weight} kg`);
                        cleanupAndResolve({ weight_kg: weight });
                        return;
                    }
                }
            };

            const onError = (err: Error | null) => {
                if(err && verbose) {
                    console.error(`     -> HATA (HX711 UART): Seri port hatası (${port}):`, err.message);
                }
                cleanupAndResolve(null);
            };

            timeout = setTimeout(() => {
                if (verbose) console.warn(`     -> UYARI (HX711 UART): Veri okuma ${port} portunda zaman aşımına uğradı. Arduino'dan geçerli formatta veri gelmiyor olabilir.`);
                cleanupAndResolve(null);
            }, 15000);

            serialPort.on('error', onError);
            parser.on('data', onData);

            serialPort.open((err: Error | null) => {
                if (err) {
                    return onError(err);
                }
                if (verbose) console.log(`     -> Port açıldı: ${port}. Veri bekleniyor...`);
            });
        });
    }
}