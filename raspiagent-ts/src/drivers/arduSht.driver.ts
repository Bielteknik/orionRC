
import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

/**
 * Arduino Uno ile USB (Serial) üzerinden haberleşen sürücü (arduSht).
 * Dosya kayıt özelliği kaldırılmıştır. Sadece anlık veri okur ve sisteme iletir.
 * 
 * 1. Portu açar.
 * 2. 'R' komutunu gönderir.
 * 3. Arduino'dan gelen satırları dinler.
 * 4. Debug mesajlarını eler, sadece "Sayı,Sayı" formatını (Örn: 6.91,26.15) yakalar.
 * 5. Veriyi ayrıştırır (temperature, humidity).
 * 6. Arduino'ya 'S' komutunu gönderir.
 * 7. Veriyi sisteme döner.
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
                
                // Regex: Başlangıçta opsiyonel eksi, sayılar, opsiyonel ondalık, virgül, ikinci sayı
                // Örn: "6.91,26.15"
                const dataRegex = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;
                const match = trimmedLine.match(dataRegex);

                if (match) {
                    const temperature = parseFloat(match[1]);
                    const humidity = parseFloat(match[2]);

                    if (verbose) console.log(`     -> Arduino Verisi Yakalandı: Sıcaklık=${temperature}, Nem=${humidity}`);

                    const result: any = {
                        temperature: temperature,
                        humidity: humidity
                    };
                    
                    // Arduino'ya 'S' (Stop/Success) komutu gönder
                    if (verbose) console.log("     -> Veri işlendi, 'S' komutu gönderiliyor...");
                    
                    serialPort.write('S', (err: any) => {
                        if (err && verbose) console.error('     -> HATA: S komutu gönderilemedi:', err);
                        
                        // 'S' gönderildikten sonra (biraz bekleyip) bağlantıyı kapatıp veriyi dönüyoruz
                        setTimeout(() => cleanupAndResolve(result), 100);
                    });

                } else {
                    // Veri formatına uymayan satırlar (Debug mesajları vb.)
                    if (verbose) console.log(`     -> (Arduino Info): "${trimmedLine}"`);
                }
            };

            const onError = (err: Error | null) => {
                if (err) {
                    if (verbose) {
                        console.error(`     -> HATA (ArduSht): Seri port hatası: ${err.message}`);
                        // Meşgul hatası için özel ipucu
                        if (err.message.includes('busy') || err.message.includes('Device or resource busy') || (err as any).code === 'EBUSY') {
                            console.error(`     -> ⚠️ İPUCU: Port (${port}) şu anda meşgul. Arduino IDE Serial Monitor veya başka bir uygulama açık olabilir. Lütfen kapatın.`);
                        }
                    }
                }
                cleanupAndResolve(null);
            };

            timeout = setTimeout(() => {
                if (verbose) console.warn(`     -> UYARI (ArduSht): Zaman aşımı. Arduino 'R' komutuna yanıt vermedi.`);
                cleanupAndResolve(null);
            }, 5000); // 5 saniye bekle

            serialPort.on('error', onError);
            parser.on('data', onData);

            serialPort.open((err: Error | null) => {
                if (err) return onError(err);
                
                // Arduino'nun resetlenmesi için kısa bir bekleme
                setTimeout(() => {
                    serialPort.write('R');
                    if (verbose) console.log("     -> 'R' komutu gönderildi.");
                }, 2000); 
            });
        });
    }
}
