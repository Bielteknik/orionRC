
import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import fs from 'fs/promises';
import path from 'path';

/**
 * Arduino Uno ile USB (Serial) üzerinden haberleşen sürücü.
 * 1. Portu açar.
 * 2. 'R' komutunu gönderir.
 * 3. Arduino'dan gelen cevabı (Örn: "T:25.50,H:60.00") bekler.
 * 4. Veriyi ayrıştırır.
 * 5. Belirtilen klasöre (örn: veriler/shtData) o günün tarihiyle JSON olarak kaydeder.
 * 6. Veriyi sunucuya dönmek üzere hazırlar.
 */
export default class ArduinoShtDriver implements ISensorDriver {
    
    public read(config: { port: string; baudrate?: number; data_folder?: string }, verbose: boolean = true): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 9600, data_folder = "/home/pi/veriler/shtData" } = config;

            if (!port) {
                if (verbose) console.error("     -> HATA (Arduino SHT): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }

            if (verbose) console.log(`     -> Arduino SHT okunuyor... Port: ${port}, Komut: 'R'`);
            
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
                           console.error(`     -> HATA (Arduino SHT): Port kapatılamadı: ${err.message}`);
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
                    console.error(`     -> HATA (Arduino SHT): Dosya yazma hatası: ${err.message}`);
                }
            };

            const onData = async (line: string) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                
                if (verbose) console.log(`     -> Arduino Yanıtı: "${trimmedLine}"`);

                // Beklenen format örnekleri: "T:25.50,H:60.00" veya JSON '{"t":25.5, "h":60}'
                // Regex ile T ve H değerlerini arayalım (Büyük/küçük harf duyarsız)
                // T veya Temp, H veya Hum arar. Sayıları yakalar.
                const tempMatch = trimmedLine.match(/(?:t|temp|sicaklik)[^0-9-]*(-?\d+(\.\d+)?)/i);
                const humMatch = trimmedLine.match(/(?:h|hum|nem)[^0-9-]*(\d+(\.\d+)?)/i);

                const temperature = tempMatch ? parseFloat(tempMatch[1]) : null;
                const humidity = humMatch ? parseFloat(humMatch[1]) : null;

                if (temperature !== null || humidity !== null) {
                    const result: any = {};
                    const fileRecord: any = {};

                    if (temperature !== null) {
                        result.temperature = temperature;
                        fileRecord.sicaklik_c = temperature;
                    }
                    if (humidity !== null) {
                        result.humidity = humidity;
                        fileRecord.nem_yuzde = humidity;
                    }

                    // Dosyaya kaydet
                    await saveDataToFile(fileRecord);

                    // Agent'a sonucu dön
                    cleanupAndResolve(result);
                } else {
                    if (verbose) console.warn("     -> UYARI: Yanıt ayrıştırılamadı.");
                }
            };

            const onError = (err: Error | null) => {
                if(err && verbose) {
                    console.error(`     -> HATA (Arduino SHT): Seri port hatası:`, err.message);
                }
                cleanupAndResolve(null);
            };

            timeout = setTimeout(() => {
                if (verbose) console.warn(`     -> UYARI (Arduino SHT): Zaman aşımı. Arduino 'R' komutuna yanıt vermedi.`);
                cleanupAndResolve(null);
            }, 5000); // 5 saniye bekle

            serialPort.on('error', onError);
            parser.on('data', onData);

            serialPort.open((err: Error | null) => {
                if (err) return onError(err);
                
                // Arduino'nun resetlenmesi için kısa bir bekleme (bazı modellerde port açılınca reset atar)
                setTimeout(() => {
                    serialPort.write('R');
                    if (verbose) console.log("     -> 'R' komutu gönderildi.");
                }, 2000); 
            });
        });
    }
}
