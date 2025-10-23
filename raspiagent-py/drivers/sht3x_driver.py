from sensirion_i2c_driver import LinuxI2cTransceiver, I2cConnection, CrcCalculator
from sensirion_driver_adapters.i2c_adapter.i2c_channel import I2cChannel
from sensirion_i2c_sht3x.device import Sht3xDevice

class Sht3xDriver:
    """
    Sensirion SHT3x (SHT30, SHT31, SHT35) sıcaklık ve nem sensörü için I2C sürücüsü.
    Bu sürücü, tek seferlik ölçüm (single shot) modunu kullanır.
    """
    def read(self, config):
        address_str = config.get('address', '0x44')
        bus_number = config.get('bus', 1)
        bus_path = f'/dev/i2c-{bus_number}'
        
        try:
            address = int(address_str, 16)
        except (ValueError, TypeError):
            print(f"     -> HATA (SHT3x): Geçersiz I2C adresi formatı: '{address_str}'. '0x44' gibi olmalı.")
            return None

        print(f"     -> SHT3x okunuyor... Adres: {address_str}, Port: {bus_path}")
        
        try:
            with LinuxI2cTransceiver(bus_path) as i2c_transceiver:
                channel = I2cChannel(
                    I2cConnection(i2c_transceiver),
                    # Kütüphane 'slave_address' bekliyor, 'i2c_address' değil.
                    slave_address=address,
                    crc=CrcCalculator(8, 0x31, 0xFF, 0x00)
                )
                sensor = Sht3xDevice(channel)
                
                # Tek seferlik ölçüm yap ve sonucu bekle (blocking)
                temp_signal, hum_signal = sensor.single_shot_measurement()
                
                # Sinyal nesnelerinden .value ile asıl değeri al
                temp_c = temp_signal.value
                hum_rh = hum_signal.value
                
                result = {
                    'temperature': round(temp_c, 2),
                    'humidity': round(hum_rh, 2)
                }
                
                return result

        except Exception as e:
            print(f"     -> HATA (SHT3x): Sensör okunurken bir hata oluştu: {e}")
            print(f"     -> ÖNERİ: 'i2cdetect -y {bus_number}' komutu ile cihazın {address_str} adresinde göründüğünü doğrulayın.")
            return None