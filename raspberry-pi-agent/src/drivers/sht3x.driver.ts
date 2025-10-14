import { ISensorDriver } from "../types";
import { openSync, I2CBus } from 'i2c-bus';
// Fix: Import Buffer to resolve 'Cannot find name' error.
import { Buffer } from 'buffer';

// SHT3x sensörü için I2C komutları
const CMD_MEASURE_HPM = [0x2C, 0x06]; // Yüksek Tekrarlanabilirlikte Tek Ölçüm

// Sensörden veri okumadan önce beklenecek süre (ms)
const MEASUREMENT_DELAY = 20;

// CRC-8 (Cyclic Redundancy Check) hesaplama fonksiyonu
// SHT3x datasheet'inden alınmıştır. Veri bütünlüğünü doğrulamak için kritiktir.
const calculateCRC = (data: Buffer): number => {
    let crc = 0xFF;
    for (let i = 0; i < 2; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 0x80) {
                crc = (crc << 1) ^ 0x31;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc & 0xFF;
};

export default class Sht3xDriver implements ISensorDriver {
    async read(config: { address: string; bus?: number }): Promise<Record<string, any> | null> {
        const address = parseInt(config.address, 16);
        const busNumber = config.bus || 1;
        const maxRetries = 3;

        if (isNaN(address)) {
            console.error("     -> HATA (SHT3x): Geçersiz I2C adresi belirtilmiş.");
            return null;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let i2cBus: I2CBus | null = null;
            try {
                console.log(`     -> SHT3x okunuyor... Adres: 0x${address.toString(16)}, Bus: ${busNumber} (Deneme ${attempt}/${maxRetries})`);
                
                // I2C bus'ı aç
                i2cBus = openSync(busNumber);

                // Ölçüm komutunu gönder
                const writeBuffer = Buffer.from(CMD_MEASURE_HPM);
                i2cBus.i2cWriteSync(address, writeBuffer.length, writeBuffer);

                // Sensörün ölçüm yapması için bekle
                await new Promise(resolve => setTimeout(resolve, MEASUREMENT_DELAY));

                // 6 byte veri oku: [Sıcaklık MSB, Sıcaklık LSB, Sıcaklık CRC, Nem MSB, Nem LSB, Nem CRC]
                const readBuffer = Buffer.alloc(6);
                i2cBus.i2cReadSync(address, readBuffer.length, readBuffer);

                // Veri bütünlüğünü CRC ile kontrol et
                const tempCRC = calculateCRC(readBuffer.slice(0, 2));
                const humCRC = calculateCRC(readBuffer.slice(3, 5));
                const receivedTempCRC = readBuffer[2];
                const receivedHumCRC = readBuffer[5];

                if (tempCRC !== receivedTempCRC || humCRC !== receivedHumCRC) {
                     console.warn(`     -> UYARI (SHT3x): CRC kontrolü başarısız!`);
                     console.warn(`     -> Ham Veri Buffer: <${readBuffer.toString('hex')}>`);
                     console.warn(`     -> Sıcaklık: Hesaplanan CRC=0x${tempCRC.toString(16)}, Alınan CRC=0x${receivedTempCRC.toString(16)}`);
                     console.warn(`     -> Nem:      Hesaplanan CRC=0x${humCRC.toString(16)}, Alınan CRC=0x${receivedHumCRC.toString(16)}`);
                     
                     if (attempt === maxRetries) {
                         console.error("     -> HATA (SHT3x): Maksimum deneme sayısına ulaşıldı, okuma başarısız.");
                         return null;
                     }
                     await new Promise(resolve => setTimeout(resolve, 100)); // Tekrar denemeden önce kısa bir süre bekle
                     continue; // Sonraki denemeye geç
                }

                // Ham veriyi sıcaklık ve neme dönüştür (datasheet formülleri)
                const rawTemp = readBuffer.readUInt16BE(0);
                const rawHumidity = readBuffer.readUInt16BE(3);

                const temperature = -45 + 175 * (rawTemp / 65535);
                const humidity = 100 * (rawHumidity / 65535);

                // Başarılı, veriyi döndür ve döngüden çık
                return {
                    temperature: parseFloat(temperature.toFixed(2)),
                    humidity: parseFloat(humidity.toFixed(2))
                };

            } catch (error) {
                 if (attempt === maxRetries) {
                    console.error(`     -> HATA (SHT3x): I2C bus üzerinden okuma yapılamadı.`, error);
                    return null;
                }
                 await new Promise(resolve => setTimeout(resolve, 100)); // Hata durumunda da tekrar denemeden önce bekle
            } finally {
                // I2C bus'ı her zaman kapat
                if (i2cBus) {
                    i2cBus.closeSync();
                }
            }
        }
        // Tüm denemeler başarısız olursa null döndür
        return null;
    }
}