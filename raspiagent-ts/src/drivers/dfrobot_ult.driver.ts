import { ISensorDriver } from "../types.js";
import { SerialPort } from 'serialport';
import { Buffer } from 'buffer';

/**
 * DFRobot TF-Luna Lidar sensöründen seri port üzerinden veri okumak için sürücü.
 * Bu sürücü, sensör tarafından gönderilen 4 byte'lık binary bir veri paketini işler.
 * Paket formatı: [0xFF (Başlangıç), Mesafe Yüksek Byte, Mesafe Düşük Byte, Checksum]
 */
export default class DFRobotUltDriver implements ISensorDriver {
    /**
     * Sensörden tek bir geçerli mesafe okuması yapar.
     * @param config - { port: string; baudrate?: number } şeklinde seri port ayarlarını içerir.
     * @param verbose - Loglamanın aktif olup olmadığını kontrol eder.
     * @returns Mesafe verisini içeren bir nesne (örn: { distance_cm: 123.4 }) veya hata/zaman aşımı durumunda null döner.
     */
    public read(config: { port: string; baudrate?: number }, verbose: boolean = true): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 9600 } = config;

            if (!port) {
                if (verbose) console.error("     -> HATA (Lidar): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }
            
            if (port === '/dev/tty0' && verbose) {
                console.warn(`     -> UYARI (Lidar): '/dev/tty0' portu genellikle sistem konsoludur. Lidar sensörünüzün farklı bir porta (örn: /dev/ttyS0, /dev/ttyAMA0 veya /dev/ttyUSB0) bağlı olması muhtemeldir. Lütfen yapılandırmayı kontrol edin.`);
            }

            if (verbose) console.log(`     -> DFRobot Lidar okunuyor... Port: ${port}, Baud: ${baudrate}`);
            
            const serialPort: any = new SerialPort({
                path: port,
                baudRate: baudrate,
                autoOpen: false,
            });

            let timeout: ReturnType<typeof setTimeout> | null = null;
            let internalBuffer = Buffer.alloc(0);

            const cleanupAndResolve = (value: Record<string, any> | null) => {
                if (timeout) clearTimeout(timeout);
                
                serialPort.removeAllListeners('data');
                serialPort.removeAllListeners('error');
                serialPort.removeAllListeners('open');
                
                if (serialPort.isOpen) {
                    serialPort.close((err: Error | null) => {
                        if (err && verbose) {
                           console.error(`     -> HATA (Lidar): Port kapatılamadı (${port}): ${err.message}`);
                        }
                    });
                }
                resolve(value);
            };
            
            const onData = (chunk: Buffer) => {
                internalBuffer = Buffer.concat([internalBuffer, chunk]);

                while (internalBuffer.length >= 4) {
                    const startIndex = internalBuffer.indexOf(0xFF);
                    
                    if (startIndex === -1) {
                        internalBuffer = internalBuffer.slice(internalBuffer.length - 3);
                        return;
                    }
                    
                    if (internalBuffer.length < startIndex + 4) {
                        internalBuffer = internalBuffer.slice(startIndex);
                        return;
                    }

                    const packet = internalBuffer.slice(startIndex, startIndex + 4);
                    const checksum = (packet[0] + packet[1] + packet[2]) & 0xFF;

                    if (checksum === packet[3]) {
                        const distance_mm = packet.readUInt16BE(1);
                        const result = { distance_cm: parseFloat((distance_mm / 10).toFixed(1)) };
                        
                        if (verbose) console.log(`     -> Ayrıştırılan Veri [Lidar]: ${result.distance_cm} cm`);
                        cleanupAndResolve(result);
                        return;
                    } else {
                        internalBuffer = internalBuffer.slice(startIndex + 1);
                    }
                }
            };

            const onError = (err: Error | null) => {
                if (err) {
                    if (verbose) {
                        console.error(`     -> HATA (Lidar): Seri port hatası (${port}): ${err.message}`);
                        if (err.message.includes('Permission denied')) {
                            console.error(`     -> ÖNERİ: Port erişim izni reddedildi. Agent'ı çalıştıran kullanıcının 'dialout' grubuna ekli olduğundan emin olun.`);
                            console.error(`     -> Komut: 'sudo usermod -a -G dialout $USER' ve ardından sistemi yeniden başlatın.`);
                        }
                    }
                }
                cleanupAndResolve(null);
            };

            timeout = setTimeout(() => {
                if (verbose) console.warn(`     -> UYARI (Lidar): Veri okuma ${port} portunda zaman aşımına uğradı. Geçerli paket bulunamadı.`);
                cleanupAndResolve(null);
            }, 3000);

            serialPort.on('error', onError);
            serialPort.on('data', onData);

            serialPort.open((err: Error | null) => {
                if (err) {
                    return onError(err);
                }
                if (verbose) console.log(`     -> Port açıldı: ${port}. Veri okunuyor...`);
                serialPort.flush();
            });
        });
    }
}