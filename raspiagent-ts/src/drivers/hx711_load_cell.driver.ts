import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

/**
 * HX711 tabanlı bir ağırlık sensöründen seri port üzerinden veri okumak için sürücü.
 * Bu sürücü, Arduino gibi bir mikrodenetleyiciden gelen metin tabanlı veriyi işler.
 * Artık hem '= 15.234' formatını hem de sadece '15.234' formatını destekler.
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
                autoOpen: false, // Hata yönetimi için manuel açılacak
            });

            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            let readAttempts = 0;
            const maxAttempts = 10; // Geçerli veri için en fazla kaç satır deneneceği
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
                readAttempts++;
                const trimmedLine = line.trim();
                console.log(`     -> Ham Veri [HX711]: "${trimmedLine}"`);

                let weight: number;

                if (trimmedLine.startsWith('=')) {
                    // Case 1: Handle lines with prefix, e.g., "= 15.234"
                    const valueStr = trimmedLine.substring(1).trim();
                    weight = parseFloat(valueStr);
                } else {
                    // Case 2: Handle lines that are just a number, with possible junk at the end
                    weight = parseFloat(trimmedLine);
                }

                if (!isNaN(weight)) {
                    console.log(`     -> Ayrıştırılan Veri [HX711]: ${weight} kg`);
                    cleanupAndResolve({ weight_kg: weight });
                    return; // Success, stop listening
                }

                if (readAttempts >= maxAttempts) {
                    console.warn(`     -> UYARI (HX711): ${maxAttempts} denemede geçerli sayısal veri bulunamadı.`);
                    cleanupAndResolve(null);
                }
            };

            const onError = (err: Error | null) => {
                if(err) {
                    console.error(`     -> HATA (HX711): Seri port hatası (${port}):`, err.message);
                }
                cleanupAndResolve(null);
            };

            // 7 saniye sonra işlem zaman aşımına uğrayacak
            timeout = setTimeout(() => {
                console.warn(`     -> UYARI (HX711): Veri okuma ${port} portunda zaman aşımına uğradı. Geçerli bir sayısal değer alınamadı.`);
                cleanupAndResolve(null);
            }, 7000);

            // Olay dinleyicilerini ata
            serialPort.on('error', onError);
            parser.on('data', onData);

            // Portu aç
            serialPort.open((err: Error | null) => {
                if (err) {
                    return onError(err);
                }
                console.log(`     -> Port açıldı: ${port}. Stabilizasyon için bekleniyor ve veri okunuyor...`);
            });
        });
    }
}