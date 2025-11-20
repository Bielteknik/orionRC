
import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import fs from 'fs/promises';
import path from 'path';

/**
 * Arduino Uno ile USB (Serial) üzerinden haberleşen sürücü (arduSht).
 * 1. Portu açar.
 * 2. 'R' komutunu gönderir.
 * 3. Arduino'dan gelen basit formatlı cevabı (Örn: "23.50,45.20") bekler.
 * 4. Veriyi virgül ile ayırarak işler.
 * 5. Belirtilen klasöre (örn: veriler/shtData) o günün tarihiyle JSON olarak kaydeder.
 * 6. Arduino'ya 'S' komutunu gönderir.
 * 7. Veriyi sunucuya dönmek üzere hazırlar.
 */
export default class ArduShtDriver implements ISensorDriver {
    
    public read(config: { port: string; baudrate?: number; data_folder?: string }, verbose: boolean = true): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            // Varsayılan klasör kullanıcının belirttiği yol olarak ayarlandı
            const { port, baudrate = 9600, data_folder = "/home/bielteknik/orionRC/py/veriler/shtData" } = config;

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
            
            const saveDataToFile = async (data: any) => {
                try {
                    // Klasörün varlığını kontrol et, yoksa oluştur
                    await fs.mkdir(data_folder, { recursive: true });

                    // Dosya adını oluştur (DDMMYYYY.json)
                    const now = new Date();
                    const day = String(now.getDate()).padStart(2, '0');
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const year = now.getFullYear();
                    const filename = `${day}${month}${year}.json`;
                    const filePath = path.join(data_folder, filename);

                    // Veriye zaman damgası ekle
                    const record = {
                        tarih: `${day}.${month}.${year}`,
                        saat: now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                        ...data
                    };

                    // Mevcut dosyayı oku veya yeni liste başlat
                    let fileData = [];
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        fileData = JSON.parse(content);
                        if (!Array.isArray(fileData)) fileData = [];
                    } catch (e) {
                        // Dosya yoksa veya bozuksa boş dizi ile başla
                        fileData = [];
                    }

                    fileData.push(record);

                    // Dosyaya yaz
                    await fs.writeFile(filePath, JSON.stringify(fileData, null, 4), 'utf-8');
                    if (verbose) console.log(`     -> Veri dosyaya kaydedildi: ${filePath}`);

                } catch (err: any) {
                    console.error(`     -> HATA (ArduSht): Dosya yazma hatası: ${err.message}`);
                }
            };

            const onData = async (line: string) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                
                if (verbose) console.log(`     -> Arduino Yanıtı: "${trimmedLine}"`);

                // Beklenen format: "23.50,45.20" (Sıcaklık,Nem)
                const parts = trimmedLine.split(',');

                if (parts.length >= 2) {
                    const temperature = parseFloat(parts[0]);
                    const humidity = parseFloat(parts[1]);

                    if (!isNaN(temperature) && !isNaN(humidity)) {
                        const result: any = {
                            temperature: temperature,
                            humidity: humidity
                        };
                        
                        const fileRecord = {
                            sicaklik_c: temperature,
                            nem_yuzde: humidity
                        };

                        // Dosyaya kaydet
                        await saveDataToFile(fileRecord);

                        // Arduino'ya 'S' (Stop/Success) komutu gönder
                        if (verbose) console.log("     -> Veri alındı, 'S' komutu gönderiliyor...");
                        serialPort.write('S', (err: any) => {
                            if (err && verbose) console.error('     -> HATA: S komutu gönderilemedi:', err);
                            
                            // Komut gönderildikten sonra (başarılı veya başarısız) işlemi bitir
                            cleanupAndResolve(result);
                        });

                    } else {
                         if (verbose) console.warn("     -> UYARI (ArduSht): Gelen veri sayısal değil.");
                    }
                } else {
                    if (verbose) console.warn("     -> UYARI (ArduSht): Beklenen format (Sıcaklık,Nem) sağlanamadı.");
                }
            };

            const onError = (err: Error | null) => {
                if(err && verbose) {
                    console.error(`     -> HATA (ArduSht): Seri port hatası:`, err.message);
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
