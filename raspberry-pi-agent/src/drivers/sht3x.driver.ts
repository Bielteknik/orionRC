import { ISensorDriver } from "../types";
import { openSync, I2CBus } from 'i2c-bus';

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

        if (isNaN(address)) {
            console.error("     -> HATA (SHT3x): Geçersiz I2C adresi belirtilmiş.");
            return null;
        }

        let i2cBus: I2CBus | null = null;
        try {
            console.log(`     -> SHT3x sensörü okunuyor... Adres: 0x${address.toString(16)}, Bus: ${busNumber}`);
            
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

            if (tempCRC !== readBuffer[2] || humCRC !== readBuffer[5]) {
                 console.error("     -> HATA (SHT3x): CRC kontrolü başarısız! Veri bozuk olabilir.");
                 return null;
            }

            // Ham veriyi sıcaklık ve neme dönüştür (datasheet formülleri)
            const rawTemp = readBuffer.readUInt16BE(0);
            const rawHumidity = readBuffer.readUInt16BE(3);

            const temperature = -45 + 175 * (rawTemp / 65535);
            const humidity = 100 * (rawHumidity / 65535);

            return {
                temperature: parseFloat(temperature.toFixed(2)),
                humidity: parseFloat(humidity.toFixed(2))
            };

        } catch (error) {
            console.error(`     -> HATA (SHT3x): I2C bus üzerinden okuma yapılamadı.`, error);
            return null;
        } finally {
            // I2C bus'ı her zaman kapat
            if (i2cBus) {
                i2cBus.closeSync();
            }
        }
    }
}