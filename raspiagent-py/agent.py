import os
import time
import json
import requests
import importlib.util
import base64
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# .env dosyasını yükle (API anahtarı gibi hassas veriler için)
load_dotenv() 

# --- Renk Tanımları ---
class Color:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

# --- Zamanlayıcılar ---
CONFIG_POLL_INTERVAL = 60  # 1 dakika
SENSOR_READ_INTERVAL = 1      # Her saniye sensörleri kontrol et
COMMAND_POLL_INTERVAL = 5     # 5 saniye

# --- Yapılandırma ---
CONFIG_PATH = Path(__file__).parent / 'config.json'

class Agent:
    def __init__(self, local_config):
        self.state = "BAŞLATILIYOR"
        self.config = None
        self.driver_instances = {}
        self.last_read_times = {}
        self.global_read_frequency_seconds = 0

        self.api_base_url = f"{local_config['server']['base_url']}/api"
        self.device_id = local_config['device']['id']
        self.auth_token = local_config['device']['token']
        self.auth_header = {'Authorization': f'Token {self.auth_token}'}

        print(f"{Color.HEADER}🚀 ORION Agent Başlatılıyor... Cihaz ID: {self.device_id}{Color.ENDC}")
        self._set_state("BAŞLATILIYOR")

    def _set_state(self, new_state):
        if self.state != new_state:
            self.state = new_state
            print(f"{Color.OKBLUE}Durum Değişikliği: {self.state}{Color.ENDC}")

    def start(self):
        try:
            self.fetch_config()
            
            last_config_fetch = time.time()
            last_command_check = time.time()

            while True:
                if time.time() - last_config_fetch >= CONFIG_POLL_INTERVAL:
                    self.fetch_config()
                    last_config_fetch = time.time()

                if time.time() - last_command_check >= COMMAND_POLL_INTERVAL:
                    self.check_for_commands()
                    last_command_check = time.time()

                self.process_sensors()
                time.sleep(SENSOR_READ_INTERVAL)

        except KeyboardInterrupt:
            self.shutdown()
        except Exception as e:
            print(f"{Color.FAIL}Ana döngüde kritik hata: {e}{Color.ENDC}")
            self.shutdown()

    def shutdown(self):
        print(f"\n{Color.WARNING}🚫 Agent durduruluyor... Kaynaklar temizleniyor.{Color.ENDC}")
        print(f"{Color.OKGREEN}✅ Güvenli çıkış tamamlandı.{Color.ENDC}")

    def fetch_config(self):
        print("🔄 Yapılandırma sunucudan alınıyor...")
        self._set_state("YAPILANDIRILIYOR")
        try:
            response = requests.get(f"{self.api_base_url}/config/{self.device_id}", headers=self.auth_header, timeout=10)
            response.raise_for_status()
            self.config = response.json()
            self.global_read_frequency_seconds = self.config.get('global_read_frequency_seconds', 0)
            print(f"{Color.OKGREEN}✅ Yapılandırma alındı: {len(self.config['sensors'])} sensör, {len(self.config['cameras'])} kamera. Global frekans: {self.global_read_frequency_seconds}{Color.ENDC}")
            self._set_state("ÇEVRİMİÇİ")
        except requests.exceptions.RequestException as e:
            self._set_state("ÇEVRİMDIŞI")
            print(f"{Color.FAIL}❌ Yapılandırma alınamadı: {e}{Color.ENDC}")

    def get_effective_frequency(self, sensor_config):
        return self.global_read_frequency_seconds if self.global_read_frequency_seconds > 0 else sensor_config.get('read_frequency', 300)

    def process_sensors(self):
        if self.state != "ÇEVRİMİÇİ" or not self.config:
            return

        now = time.time()
        active_sensors = [s for s in self.config.get('sensors', []) if s.get('is_active') and s.get('interface') != 'virtual']
        
        for sensor_config in active_sensors:
            last_read = self.last_read_times.get(sensor_config['id'], 0)
            read_frequency = self.get_effective_frequency(sensor_config)

            if now - last_read >= read_frequency:
                print(f"[OKUMA BAŞLADI] {sensor_config['name']} (ID: {sensor_config['id']})")
                self.last_read_times[sensor_config['id']] = now

                try:
                    driver = self.load_driver(sensor_config['parser_config']['driver'])
                    if not driver:
                        print(f"  -> {Color.FAIL}HATA: Sürücü yüklenemedi: {sensor_config['parser_config']['driver']}{Color.ENDC}")
                        continue
                    
                    reading = driver.read(sensor_config['config'])
                    if reading is not None:
                        self.send_reading({'sensor': sensor_config['id'], 'value': reading})
                    else:
                        print(f"  -> {Color.WARNING}UYARI: {sensor_config['name']} sensöründen veri okunamadı.{Color.ENDC}")

                except Exception as e:
                    print(f"  -> {Color.FAIL}HATA ({sensor_config['parser_config']['driver']}): Sensör okunurken bir hata oluştu: {e}{Color.ENDC}")
                finally:
                    print(f"[OKUMA BİTTİ] {sensor_config['name']}")

    def load_driver(self, driver_name):
        if driver_name in self.driver_instances:
            return self.driver_instances[driver_name]
        try:
            driver_path = Path(__file__).parent / 'drivers' / f"{driver_name}_driver.py"
            spec = importlib.util.spec_from_file_location(driver_name, driver_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Sürücü dosyasındaki sınıf adının CamelCase (örn: DfrobotUltDriver) olduğunu varsayıyoruz
            class_name = ''.join(word.capitalize() for word in driver_name.split('_')) + 'Driver'
            driver_class = getattr(module, class_name)
            
            instance = driver_class()
            self.driver_instances[driver_name] = instance
            return instance
        except Exception as e:
            print(f"{Color.FAIL}Sürücü {driver_name} yüklenemedi: {e}{Color.ENDC}")
            return None

    def send_reading(self, payload):
        try:
            response = requests.post(f"{self.api_base_url}/submit-reading", json=payload, headers=self.auth_header, timeout=10)
            response.raise_for_status()
            print(f"     -> ✅ Değer sunucuya gönderildi (Sensör ID: {payload['sensor']})")
        except requests.exceptions.RequestException as e:
            print(f"     -> {Color.FAIL}❌ Değer gönderilemedi: {e}{Color.ENDC}")
            self._set_state("ÇEVRİMDIŞI")

    def check_for_commands(self):
        if self.state != "ÇEVRİMİÇİ":
            return
        try:
            response = requests.get(f"{self.api_base_url}/commands/{self.device_id}", headers=self.auth_header, timeout=5)
            if response.status_code == 200:
                commands = response.json()
                if commands:
                    print(f"📩 {len(commands)} yeni komut alındı.")
                    for command in commands:
                        self.execute_command(command)
        except requests.exceptions.RequestException:
            # 404 veya timeout normal, hata basmaya gerek yok
            pass

    def execute_command(self, command):
        print(f"⚡ Komut yürütülüyor: {command['command_type']} (ID: {command['id']})")
        success = False
        try:
            if command['command_type'] == 'CAPTURE_IMAGE':
                success = self.capture_image(command['payload']['camera_id'])
            elif command['command_type'] == 'ANALYZE_SNOW_DEPTH':
                success = self.analyze_snow_depth(command['payload']['camera_id'], command['payload']['virtual_sensor_id'])
            # Diğer komutlar buraya eklenebilir
            self.update_command_status(command['id'], 'completed' if success else 'failed')
        except Exception as e:
            print(f"{Color.FAIL}Komut yürütülürken hata: {e}{Color.ENDC}")
            self.update_command_status(command['id'], 'failed')

    def update_command_status(self, command_id, status):
        try:
            requests.post(f"{self.api_base_url}/commands/{command_id}/{status}", headers=self.auth_header, timeout=5)
        except requests.exceptions.RequestException as e:
            print(f"{Color.FAIL}Komut durumu güncellenemedi: {e}{Color.ENDC}")

    def capture_image(self, camera_id):
        camera_config = next((c for c in self.config.get('cameras', []) if c['id'] == camera_id), None)
        if not camera_config or not camera_config.get('rtsp_url'):
            print(f"{Color.FAIL}Fotoğraf çekilemedi: Kamera (ID: {camera_id}) yapılandırması eksik.{Color.ENDC}")
            return False

        timestamp = time.strftime("%Y-%m-%dT%H-%M-%S", time.gmtime())
        filename = f"{timestamp}_{self.device_id}_{camera_id}.jpg"
        uploads_dir = Path(__file__).parent / 'uploads'
        uploads_dir.mkdir(exist_ok=True)
        filepath = uploads_dir / filename

        print(f"📸 Fotoğraf çekiliyor: {camera_config['name']}...")
        try:
            # Görüntüyü yakala, yeniden boyutlandır ve kalitesini ayarla
            subprocess.run(
                ['ffmpeg', '-i', camera_config['rtsp_url'], '-vframes', '1', '-vf', 'scale=1280:-1', '-q:v', '4', '-y', str(filepath)],
                check=True, capture_output=True, text=True
            )
            print(f"🖼️  Görüntü kaydedildi: {filepath}")

            with open(filepath, 'rb') as f:
                image_b64 = base64.b64encode(f.read()).decode('utf-8')
            
            payload = {'image': image_b64, 'filename': filename}
            requests.post(f"{self.api_base_url}/cameras/{camera_id}/upload-photo", json=payload, headers=self.auth_header)
            print(f"🚀 Fotoğraf sunucuya yüklendi: {filename}")
            
            os.remove(filepath)
            return True
        except (subprocess.CalledProcessError, requests.exceptions.RequestException) as e:
            print(f"{Color.FAIL}HATA: Fotoğraf çekme veya yükleme başarısız. {e}{Color.ENDC}")
            if isinstance(e, subprocess.CalledProcessError):
                print(f"FFMPEG Hata Çıktısı:\n{e.stderr}")
            return False

    def analyze_snow_depth(self, camera_id, virtual_sensor_id):
        # Bu fonksiyon, Gemini API kullanarak görüntü analizi yapar.
        # Python agent için benzer bir mantık uygulanabilir.
        # Şimdilik place holder olarak bırakıldı.
        print(f"{Color.WARNING}UYARI: 'analyze_snow_depth' fonksiyonu Python agent'ında henüz tam olarak implemente edilmedi.{Color.ENDC}")
        return True # Geçici olarak başarılı dönüyor


if __name__ == "__main__":
    try:
        with open(CONFIG_PATH, 'r') as f:
            local_config = json.load(f)
        agent = Agent(local_config)
        agent.start()
    except FileNotFoundError:
        print(f"{Color.FAIL}HATA: 'config.json' dosyası bulunamadı. Lütfen oluşturun.{Color.ENDC}")
    except json.JSONDecodeError:
        print(f"{Color.FAIL}HATA: 'config.json' dosyası geçersiz JSON formatında.{Color.ENDC}")
    except Exception as e:
        print(f"{Color.FAIL}Agent başlatılırken bir hata oluştu: {e}{Color.ENDC}")