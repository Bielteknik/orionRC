import { ISensorDriver } from "../types.js";
// Use the promisified version of i2c-bus for better async handling
import i2c, { PromisifiedBus } from 'i2c-bus';
import { Buffer } from 'buffer';

// SHT3x sensor I2C commands
const CMD_SOFT_RESET = [0x30, 0xA2];
const CMD_MEASURE_HPM = [0x2C, 0x06]; // Single Measurement, High Repeatability

// Delays for sensor communication
const RESET_DELAY = 10; // ms to wait after soft reset
const MEASUREMENT_DELAY = 500; // ms to wait after measurement command, increased to 500ms to prevent CRC errors based on successful test script.

// CRC-8 (Cyclic Redundancy Check) calculation function
// Crucial for verifying data integrity from the SHT3x datasheet.
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
            let i2cBus: PromisifiedBus | null = null;
            try {
                console.log(`     -> SHT3x okunuyor... Adres: 0x${address.toString(16)}, Bus: ${busNumber} (Deneme ${attempt}/${maxRetries})`);
                
                // Open I2C bus asynchronously
                i2cBus = await i2c.openPromisified(busNumber);

                // 1. Send Soft Reset to ensure sensor is in a known state
                const resetBuffer = Buffer.from(CMD_SOFT_RESET);
                await i2cBus.i2cWrite(address, resetBuffer.length, resetBuffer);
                await new Promise(resolve => setTimeout(resolve, RESET_DELAY));

                // 2. Send measurement command
                const writeBuffer = Buffer.from(CMD_MEASURE_HPM);
                await i2cBus.i2cWrite(address, writeBuffer.length, writeBuffer);

                // Wait for the sensor to perform the measurement
                await new Promise(resolve => setTimeout(resolve, MEASUREMENT_DELAY));

                // 3. Read 6 bytes of data: [Temp MSB, Temp LSB, Temp CRC, Hum MSB, Hum LSB, Hum CRC]
                const readBuffer = Buffer.alloc(6);
                await i2cBus.i2cRead(address, readBuffer.length, readBuffer);

                // Verify data integrity with CRC checks
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
                     await new Promise(resolve => setTimeout(resolve, 100)); // Short delay before retrying
                     continue; // Proceed to the next attempt
                }

                // Convert raw data to temperature and humidity (formulas from datasheet)
                const rawTemp = readBuffer.readUInt16BE(0);
                const rawHumidity = readBuffer.readUInt16BE(3);

                const temperature = -45 + 175 * (rawTemp / 65535);
                const humidity = 100 * (rawHumidity / 65535);

                // Success, return data and exit the loop
                return {
                    temperature: parseFloat(temperature.toFixed(2)),
                    humidity: parseFloat(humidity.toFixed(2))
                };

            } catch (error) {
                 if (attempt === maxRetries) {
                    console.error(`     -> HATA (SHT3x): I2C bus üzerinden okuma yapılamadı.`, error);
                    return null;
                }
                 await new Promise(resolve => setTimeout(resolve, 100)); // Wait before retrying on error
            } finally {
                // Always close the I2C bus
                if (i2cBus) {
                    await i2cBus.close();
                }
            }
        }
        // Return null if all retries fail
        return null;
    }
}