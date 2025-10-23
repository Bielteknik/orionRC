import serial
import time

class DfrobotUltDriver:
    """
    DFRobot TF-Luna Lidar sensöründen seri port üzerinden veri okumak için sürücü.
    Paket formatı: [0xFF (Başlangıç), Mesafe Yüksek Byte, Mesafe Düşük Byte, Checksum]
    """
    def read(self, config):
        port = config.get('port')
        baudrate = config.get('baudrate', 9600)

        if not port:
            print("     -> HATA (Lidar): Yapılandırmada 'port' belirtilmemiş.")
            return None

        print(f"     -> DFRobot Lidar okunuyor... Port: {port}, Baud: {baudrate}")
        
        try:
            with serial.Serial(port, baudrate, timeout=2) as ser:
                start_time = time.time()
                buffer = bytearray()
                
                while time.time() - start_time < 3: # 3 saniye timeout
                    buffer += ser.read(ser.in_waiting or 1)
                    
                    while len(buffer) >= 4:
                        if buffer[0] == 0xFF:
                            checksum = sum(buffer[0:3]) & 0xFF
                            if checksum == buffer[3]:
                                distance_mm = (buffer[1] << 8) | buffer[2]
                                distance_cm = round(distance_mm / 10.0, 1)
                                print(f"     -> Ayrıştırılan Veri [Lidar]: {distance_cm} cm")
                                return {'distance_cm': distance_cm}
                            else:
                                # Checksum hatalı, ilk byte'ı atla ve devam et
                                buffer.pop(0)
                        else:
                            # Başlangıç byte'ı değil, atla
                            buffer.pop(0)
                
                print(f"     -> UYARI (Lidar): Zaman aşımı. {port} portundan geçerli paket alınamadı.")
                return None
                
        except serial.SerialException as e:
            print(f"     -> HATA (Lidar): Seri port hatası ({port}): {e}")
            if "Permission denied" in str(e):
                print("     -> ÖNERİ: Kullanıcının 'dialout' grubuna ekli olduğundan emin olun ('sudo usermod -a -G dialout $USER') ve yeniden başlatın.")
            return None
        except Exception as e:
            print(f"     -> HATA (Lidar): Beklenmedik hata: {e}")
            return None