import requests

class OpenweatherDriver:
    """
    OpenWeatherMap API'sinden sıcaklık ve nem verisi çeken sanal sürücü.
    """
    def read(self, config):
        api_key = config.get('apikey')
        lat = config.get('lat')
        lon = config.get('lon')

        if not all([api_key, lat, lon]):
            print("     -> HATA (OpenWeather): API anahtarı veya koordinatlar eksik.")
            return None

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        print("     -> OpenWeather API'den veri alınıyor...")

        try:
            response = requests.get(url, timeout=8)
            response.raise_for_status()
            data = response.json()
            
            if 'main' in data:
                temp = round(data['main']['temp'], 2)
                humidity = round(data['main']['humidity'], 2)
                result = {'temperature': temp, 'humidity': humidity}
                return result
            else:
                print("     -> HATA (OpenWeather): API'den geçersiz yanıt alındı.")
                return None
        except requests.exceptions.RequestException as e:
            print(f"     -> HATA (OpenWeather): API isteği başarısız: {e}")
            return None