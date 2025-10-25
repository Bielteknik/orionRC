# ORION Gözlem Platformu - Backend

Bu, ORION Gözlem Platformu için Node.js, Express ve TypeScript ile oluşturulmuş backend API'sidir.

## Özellikler

-   Uzak IoT agent'larından (Raspberry Pi gibi) sensör verilerini alır.
-   IoT agent'larına hangi sensörleri okuyacaklarını bildiren yapılandırmayı sağlar.
-   IoT agent'ları için basit token tabanlı kimlik doğrulama.
-   Frontend React uygulamasını ve verilerini sunar.
-   İstasyonları, sensörleri, kullanıcıları ve alarm kurallarını yönetir.
-   E-posta yoluyla zamanlanmış raporlar gönderir.

## Kurulum & Yerel Çalıştırma

1.  **Bağımlılıkları Yükle:**
    ```bash
    npm install
    ```

2.  **Ortam Değişkenleri Dosyası Oluştur:**
    Bu dizinde `.env` adında bir dosya oluşturun. Gerekli değerleri doldurun.
    -   `PORT`: Sunucunun çalışacağı port (örn: 8000).
    -   `DEVICE_AUTH_TOKEN`: IoT agent'ınızın kimlik doğrulaması için kullanacağı güçlü, gizli bir token.
    -   `OPENWEATHER_API_KEY`: (Opsiyonel) OpenWeatherMap API anahtarınız.
    -   `EMAIL_HOST`: SMTP sunucu adresiniz (örn: 'smtp.gmail.com').
    -   `EMAIL_PORT`: SMTP portunuz (örn: 587 TLS için, 465 SSL için).
    -   `EMAIL_USER`: E-posta hesabı kullanıcı adınız.
    -   `EMAIL_PASS`: E-posta hesabı şifreniz veya uygulamaya özel şifreniz.
    -   `GEMINI_API_KEY`: (Opsiyonel) Gemini AI özellikleri için Google AI Studio API anahtarınız.

3.  **Geliştirme Modunda Çalıştır:**
    ```bash
    npm run dev
    ```

## Derleme & Dağıtım (Plesk)

Bu kılavuz, Plesk gibi paylaşımlı hosting ortamlarında yaygın izin sorunlarını önleyen sağlam bir dağıtım yöntemi sunar.

1.  **Frontend'i Derle:**
    Projenin **kök dizininde** (`backend` klasörünün dışında), derleme komutunu çalıştırın. Bu, React uygulamanızı optimize edilmiş HTML, CSS ve JS dosyalarına derler.
    ```bash
    npm run build
    ```
    Bu komut, kök dizinde bir `dist` klasörü oluşturacaktır.

2.  **Backend'i Derle:**
    Bu `backend` dizininde, derleme komutunu çalıştırın. Bu, TypeScript sunucu kodunu derler.
    ```bash
    npm run build
    ```
    Bu komut, `backend` dizini içinde bir `dist` klasörü oluşturacaktır.

3.  **Backend'i Yüklemeye Hazırla:**
    -   Bu `backend` klasörü içinde `public` adında yeni bir klasör oluşturun.
    -   **1. Adımda** (frontend derlemesi) oluşturulan `dist` klasörüne gidin.
    -   Frontend `dist` klasörünün **içindeki tüm dosya ve klasörleri** kopyalayın ve yeni oluşturduğunuz `backend/public` klasörünün içine yapıştırın.

4.  **Plesk'e Yükle:**
    -   Tüm `backend` klasörünü (artık `node_modules`, sunucu için `dist` ve frontend dosyalarını içeren `public` klasörlerini barındırır) sunucunuzdaki `/httpdocs` veya belirlediğiniz bir alt dizine yükleyin.

5.  **Plesk'te Node.js'i Yapılandır:**
    -   Alan adınız için Plesk panelindeki **"Node.js"** simgesine gidin.
    -   **Uygulama Kökü:** Dosyaları yüklediğiniz dizini ayarlayın (örn: `/httpdocs/backend`).
    -   **Uygulama Başlangıç Dosyası:** `dist/server.js` olarak ayarlayın.
    -   **Uygulama Modu:** "production" olarak ayarlayın.
    -   **"Node.js'i Etkinleştir"**e tıklayın.

6.  **Bağımlılıkları Yükle & Ortamı Ayarla:**
    -   `node_modules` klasörünü yüklemediyseniz, Plesk arayüzündeki **"NPM install"** düğmesine tıklayın.
    -   "Environment Variables" bölümüne gidin ve yerel `.env` dosyanızdaki değişkenleri (`PORT`, `DEVICE_AUTH_TOKEN`, vb.) ekleyin.

7.  **Uygulamayı Yeniden Başlat:**
    -   **"Restart App"** düğmesine tıklayın.

Uygulamanız artık canlı olmalıdır. Backend, hem API'yi hem de kullanıcı arayüzünü tek bir, kendi kendine yeten bir dizinden sunarak "Not Found" hatalarını önleyecektir.
