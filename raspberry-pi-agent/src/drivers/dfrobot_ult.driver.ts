import { ISensorDriver } from "../types";
import { SerialPort } from 'serialport';

/**
 * DFRobot TF-Luna Lidar sensöründen seri port üzerinden veri okumak için sürücü.
 * Bu sürücü, sensör tarafından gönderilen 4 byte'lık binary bir veri paketini işler.
 * Paket formatı: [0xFF (Başlangıç), Mesafe Yüksek Byte, Mesafe Düşük Byte, Checksum]
 */
export default class DFRobotUltDriver implements ISensorDriver {
    /**
     * Sensörden tek bir geçerli mesafe okuması yapar.
     * @param config - { port: string; baudrate?: number } şeklinde seri port ayarlarını içerir.
     * @returns Mesafe verisini içeren bir nesne (örn: { distance_cm: 123.4 }) veya hata/zaman aşımı durumunda null döner.
     */
    public read(config: { port: string; baudrate?: number }): Promise<Record<string, any> | null> {
        return new Promise((resolve) => {
            const { port, baudrate = 9600 } = config;

            if (!port) {
                console.error("     -> HATA (Lidar): Yapılandırmada 'port' belirtilmemiş.");
                return resolve(null);
            }

            console.log(`     -> DFRobot Lidar okunuyor... Port: ${port}, Baud: ${baudrate}`);
            
            const serialPort = new SerialPort({
                path: port,
                baudRate: baudrate,
                autoOpen: false,
            });

            let timeout: NodeJS.Timeout | null = null;
            let internalBuffer = Buffer.alloc(0);

            const cleanupAndResolve = (value: Record<string, any> | null) => {
                if (timeout) clearTimeout(timeout);
                
                serialPort.removeAllListeners('data');
                serialPort.removeAllListeners('error');
                serialPort.removeAllListeners('open');
                
                if (serialPort.isOpen) {
                    serialPort.close(err => {
                        if (err) {
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
                        // Başlangıç byte'ı bulunamadı, buffer'da sadece son 3 byte'ı tut (paket bölünmüş olabilir)
                        internalBuffer = internalBuffer.slice(internalBuffer.length - 3);
                        return;
                    }
                    
                    if (internalBuffer.length < startIndex + 4) {
                        // Başlangıç byte'ı var ama paket tamamlanmamış, beklemeye devam et
                        internalBuffer = internalBuffer.slice(startIndex);
                        return;
                    }

                    const packet = internalBuffer.slice(startIndex, startIndex + 4);
                    const checksum = (packet[0] + packet[1] + packet[2]) & 0xFF;

                    if (checksum === packet[3]) {
                        // Geçerli paket bulundu!
                        const distance_mm = packet.readUInt16BE(1); // Yüksek ve düşük byte'ları birleştir
                        const result = { distance_cm: parseFloat((distance_mm / 10).toFixed(1)) };
                        
                        console.log(`     -> Ayrıştırılan Veri [Lidar]: ${result.distance_cm} cm`);
                        cleanupAndResolve(result);
                        return;
                    } else {
                        // Checksum hatalı, bu geçersiz bir başlangıç byte'ı. Atla ve aramaya devam et.
                        internalBuffer = internalBuffer.slice(startIndex + 1);
                    }
                }
            };

            const onError = (err: Error | null) => {
                if(err) {
                    console.error(`     -> HATA (Lidar): Seri port hatası (${port}):`, err.message);
                }
                cleanupAndResolve(null);
            };

            // 3 saniye sonra işlem zaman aşımına uğrayacak
            timeout = setTimeout(() => {
                console.warn(`     -> UYARI (Lidar): Veri okuma ${port} portunda zaman aşımına uğradı. Geçerli paket bulunamadı.`);
                cleanupAndResolve(null);
            }, 3000);

            serialPort.on('error', onError);
            serialPort.on('data', onData);

            serialPort.open(err => {
                if (err) {
                    return onError(err);
                }
                console.log(`     -> Port açıldı: ${port}. Veri okunuyor...`);
                serialPort.flush(); // Eski verileri temizle
            });
        });
    }
}
