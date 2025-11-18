
import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

/**
 * HX711 tabanlı bir ağırlık sensöründen seri port üzerinden veri okumak için sürücü.
 * Bu sürücü, Arduino gibi bir mikrodenetleyiciden gelen metin tabanlı veriyi işler.
 * Artık çeşitli formatlardaki sayıları bulmak için daha sağlam bir ayrıştırma yöntemi kullanır.
 */
export default class Hx711Driver implements ISensorDriver {
    /**
     * Sensörden tek bir geçerli ağırlık okuması yapar.
     * @param config - { port: string; baudrate?: number } şeklinde seri port ayarlarını içerir.
     * @param verbose - Loglamanın aktif olup olmadığını kontrol eder.
     * @returns Ağırlık verisini içeren bir nesne (örn: { weight_kg: 15.23 }) veya hata/zaman aşımı durumunda null döner.
     */
    public read(config: { port: string; baudrate?: number }, verbose: boolean = true): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 115200 } = config;

            if (!port) {
                if (verbose) console.error("     -> HATA (HX711): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }

            if (verbose) console.log(`     -> HX711 okunuyor... Port: ${port}, Baud: ${baudrate}`);
            
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
                           console.error(`     -> HATA (HX711): Port kapatılamadı (${port}): ${err.message}`);
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
                
                if (verbose) console.log(`     -> Ham Veri [HX711]: "${trimmedLine}"`);

                // This regex handles positive/negative integers and floats.
                const match = trimmedLine.match(/-?\d*\.?\d+/);

                if (match && match[0]) {
                    const weight = parseFloat(match[0]);
                    if (!isNaN(weight) && isFinite(weight)) {
                        // Treat small negative values from sensor drift as zero.
                        const finalWeight = weight < 0 ? 0 : weight;
                        if (verbose) console.log(`     -> Ayrıştırılan Veri [HX711]: ${finalWeight.toFixed(2)} kg`);
                        cleanupAndResolve({ weight_kg: finalWeight });
                        return;
                    }
                }
            };

            const onError = (err: Error | null) => {
                if(err && verbose) {
                    console.error(`     -> HATA (HX711): Seri port hatası (${port}):`, err.message);
                }
                cleanupAndResolve(null);
            };

            timeout = setTimeout(() => {
                if (verbose) console.warn(`     -> UYARI (HX711): Veri okuma ${port} portunda zaman aşımına uğradı. Arduino'dan geçerli formatta veri gelmiyor olabilir.`);
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
