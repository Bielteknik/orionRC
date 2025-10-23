import serial
import time
from .base_driver import BaseDriver

class Hx711LoadCellDriver(BaseDriver):
    """
    Seri port üzerinden HX711 yük hücresi (load cell) verilerini okumak için sürücü.
    Bu sürücü, Arduino gibi bir mikrodenetleyiciden gelen metin tabanlı veriyi
    işlemek üzere tasarlanmıştır. Beklenen format: '= 12.34' gibi bir satır.
    """

    def read(self, config: dict) -> dict | None:
        """
        Seri porttan ağırlık verisini okur.

        Args:
            config (dict): { "port": "/dev/ttyUSB0", "baudrate": 9600 } gibi
                           seri port ayarlarını içeren bir sözlük.

        Returns:
            dict | None: Ağırlık verisini içeren bir sözlük (örn: {'weight_kg': 15.23})
                         veya zaman aşımı/hata durumunda None.
        """
        port = config.get("port")
        baudrate = config.get("baudrate", 9600)
        timeout_seconds = 7  # Veri okuma için maksimum bekleme süresi

        if not port:
            print("     -> HATA (HX711): Yapılandırmada 'port' belirtilmemiş.")
            return None

        print(f"     -> HX711 okunuyor... Port: {port}, Baud: {baudrate}")

        try:
            with serial.Serial(port, baudrate, timeout=1) as ser:
                start_time = time.time()
                # Portun açılması ve Arduino'nun stabil hale gelmesi için kısa bir bekleme
                time.sleep(2)
                ser.flushInput() # Giriş tamponunu temizle

                while time.time() - start_time < timeout_seconds:
                    if ser.in_waiting > 0:
                        line = ser.readline().decode('utf-8').strip()
                        print(f'     -> Ham Veri [HX711]: "{line}"')

                        if line.startswith('='):
                            try:
                                # '=' karakterinden ve olası boşluklardan sonraki sayıyı al
                                weight_str = line.split('=')[1].strip()
                                weight = float(weight_str)
                                print(f"     -> Ayrıştırılan Veri [HX711]: {weight} kg")
                                return {"weight_kg": weight}
                            except (ValueError, IndexError) as e:
                                print(f"     -> UYARI (HX711): Veri ayrıştırılamadı. Satır: '{line}', Hata: {e}")
                                # Hatalı satırı atla ve bir sonraki satırı bekle
                                continue
                
                # While döngüsü zaman aşımı ile biterse
                print(f"     -> UYARI (HX711): {timeout_seconds} saniye içinde geçerli veri ('= 12.34' formatında) alınamadı.")
                return None

        except serial.SerialException as e:
            print(f"     -> HATA (HX711): Seri port hatası ({port}): {e}")
            if "Permission denied" in str(e):
                print("     -> ÖNERİ: Port erişim izni reddedildi. Agent'ı çalıştıran kullanıcının 'dialout' grubuna ekli olduğundan emin olun.")
                print("     -> Komut: 'sudo usermod -a -G dialout $USER' ve ardından sistemi yeniden başlatın.")
            return None
        except Exception as e:
            print(f"     -> HATA (HX711): Beklenmedik bir hata oluştu: {e}")
            return None