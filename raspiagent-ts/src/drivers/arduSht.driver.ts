
import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

/**
 * Arduino Uno ile USB (Serial) üzerinden haberleşen sürücü (arduSht).
 * 
 * GÜNCELLEME:
 * - 'temperature = X, humidity = Y' formatını okur.
 * - 'S' komutu gönderme işlemi kaldırıldı.
 */
export default class ArduShtDriver implements ISensorDriver {
    
    public read(config: { port: string; baudrate?: number }, verbose: boolean = true): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 9600 } = config;

            if (!port) {
                if (verbose) console.error("     -> HATA (ArduSht): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }

            if (verbose) console.log(`     -> ArduSht okunuyor... Port: ${port}, Komut: 'R'`);
            
            const serialPort: any = new SerialPort({
                path: port,
                baudRate: baudrate,
                autoOpen: false,
            });

            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
            let timeout: ReturnType<typeof setTimeout> | null = null;

            const cleanupAndResolve = (value: Record<string, any> | null) => {
                if (timeout) clearTimeout(timeout);
                
                // Remove listeners
                parser.removeAllListeners('data');
                serialPort.removeAllListeners('error');
                serialPort.removeAllListeners('open');
                
                if (serialPort.isOpen) {
                    serialPort.close((err: Error | null) => {
                        if (err && verbose) {
                           console.error(`     -> HATA (ArduSht): Port kapatılamadı: ${err.message}`);
                        }
                    });
                }
                resolve(value);
            };
            
            const onData = (line: string) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                
                // Yeni Regex: "temperature = 19.74, humidity = 21.03" formatını yakalar.
                // Büyük/küçük harf duyarsızdır.
                const dataRegex = /temperature\s*=\s*(-?\d+(?:\.\d+)?).*humidity\s*=\s*(-?\d+(?:\.\d+)?)/i;
                const match = trimmedLine.match(dataRegex);

                if (match) {
                    const temperature = parseFloat(match[1]);
                    const humidity = parseFloat(match[2]);

                    if (verbose) console.log(`     -> Arduino Verisi Yakalandı: Sıcaklık=${temperature}, Nem=${humidity}`);

                    const result: any = {
                        temperature: temperature,
                        humidity: humidity
                    };
                    
                    // Artık 'S' komutu göndermiyoruz, veriyi aldık ve işlemi bitiriyoruz.
                    cleanupAndResolve(result);

                } else {
                    // Veri formatına uymayan satırlar (Debug mesajları vb.)
                    if (verbose) console.log(`     -> (Arduino Info): "${trimmedLine}"`);
                }
            };

            const onError = (err: Error | null) => {
                if (err) {
                    if (verbose) {
                        console.error(`     -> HATA (ArduSht): Seri port hatası: ${err.message}`);
                        if (err.message.includes('busy') || err.message.includes('Device or resource busy') || (err as any).code === 'EBUSY') {
                            console.error(`     -> ⚠️ İPUCU: Port (${port}) şu anda meşgul. Arduino IDE Serial Monitor veya başka bir uygulama açık olabilir. Lütfen kapatın.`);
                        }
                    }
                }
                cleanupAndResolve(null);
            };

            // Zaman aşımı 15 saniye
            timeout = setTimeout(() => {
                if (verbose) console.warn(`     -> UYARI (ArduSht): Zaman aşımı (15sn). Beklenen formatta veri gelmedi.`);
                cleanupAndResolve(null);
            }, 15000);

            serialPort.on('error', onError);
            parser.on('data', onData);

            serialPort.open((err: Error | null) => {
                if (err) return onError(err);
                
                // Arduino'nun resetlenmesi için bekleme süresi (2.5 saniye)
                setTimeout(() => {
                    serialPort.write('R');
                    if (verbose) console.log("     -> 'R' komutu gönderildi.");
                }, 2500); 
            });
        });
    }
}
