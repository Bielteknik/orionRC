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
     * @returns Ağırlık verisini içeren bir nesne (örn: { weight_kg: 15.23 }) veya hata/zaman aşımı durumunda null döner.
     */
    public read(config: { port: string; baudrate?: number }): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 9600 } = config;

            if (!port) {
                console.error("     -> HATA (HX711): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }

            console.log(`     -> HX711 okunuyor... Port: ${port}, Baud: ${baudrate}`);
            
            const serialPort: any = new SerialPort({
                path: port,
                baudRate: baudrate,
                autoOpen: false,
            });

            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

            let timeout: ReturnType<typeof setTimeout> | null = null;

            // Portu ve dinleyicileri temizleyip Promise'i sonlandıran fonksiyon
            const cleanupAndResolve = (value: Record<string, any> | null) => {
                if (timeout) clearTimeout(timeout);
                
                parser.removeAllListeners('data');
                serialPort.removeAllListeners('error');
                serialPort.removeAllListeners('open');
                
                if (serialPort.isOpen) {
                    serialPort.close((err: Error | null) => {
                        if (err) {
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
                
                console.log(`     -> Ham Veri [HX711]: "${trimmedLine}"`);

                // Per user requirement, if the line contains a '-', it's an invalid/tare reading, so treat as 0.
                if (trimmedLine.includes('-')) {
                    console.log(`     -> Ayrıştırılan Veri [HX711]: 0.00 kg ("-" karakteri algılandı)`);
                    cleanupAndResolve({ weight_kg: 0.0 });
                    return;
                }

                // Use a regular expression to find the first floating point number in the string.
                // This correctly handles various text formats.
                const match = trimmedLine.match(/\d+(\.\d+)?/);

                if (match && match[0]) {
                    const weight = parseFloat(match[0]);
                    if (!isNaN(weight) && isFinite(weight)) {
                        console.log(`     -> Ayrıştırılan Veri [HX711]: ${weight} kg`);
                        cleanupAndResolve({ weight_kg: weight });
                        return; // Found a valid number, stop processing
                    }
                }
                
                // If no number is found, wait for the next line or timeout.
            };

            const onError = (err: Error | null) => {
                if(err) {
                    console.error(`     -> HATA (HX711): Seri port hatası (${port}):`, err.message);
                }
                cleanupAndResolve(null);
            };

            // Timeout'u 15 saniyeye çıkararak Arduino'nun reset sonrası başlaması için daha fazla zaman tanıyoruz.
            timeout = setTimeout(() => {
                console.warn(`     -> UYARI (HX711): Veri okuma ${port} portunda zaman aşımına uğradı. Arduino'dan geçerli formatta veri gelmiyor olabilir.`);
                cleanupAndResolve(null);
            }, 15000);

            // Olay dinleyicilerini ata
            serialPort.on('error', onError);
            parser.on('data', onData);

            // Portu aç
            serialPort.open((err: Error | null) => {
                if (err) {
                    return onError(err);
                }
                console.log(`     -> Port açıldı: ${port}. Veri bekleniyor...`);
            });
        });
    }
}