# ORION Gözlem Platformu - TypeScript Agent

Bu, bir Raspberry Pi üzerinde çalışmak üzere tasarlanmış **TypeScript/Node.js** tabanlı agent yazılımıdır. ORION backend'ine bağlanır, yapılandırmasını alır, bağlı donanım sensörlerinden verileri okur ve sunucudan gönderilen komutları yürütür.

## Raspberry Pi Kurulumu

Agent'ı çalıştırmadan önce, Raspberry Pi'nizin donanım iletişimi için doğru şekilde yapılandırıldığından emin olun.

1.  **Arayüzleri Etkinleştirme:**
    Terminalde `sudo raspi-config` komutunu çalıştırın.
    -   `3 Interface Options` menüsüne gidin.
    -   `I1 I2C`'yi etkinleştirin.
    -   `I3 Serial Port`'u seçin. "Would you like a login shell to be accessible over serial?" sorusuna **Hayır (No)**, "Would you like the serial port hardware to be enabled?" sorusuna **Evet (Yes)** yanıtını verin.
    -   `Finish` seçeneği ile çıkın ve istendiğinde yeniden başlatın.

2.  **Kullanıcı İzinleri:**
    Agent'ın `sudo` olmadan donanım portlarına erişmesine izin vermek için, kullanıcınızın doğru gruplara üye olması gerekir. `<username>` yerine kendi kullanıcı adınızı yazın (örn: `pi`).
    ```bash
    sudo usermod -a -G dialout,i2c <username>
    ```
    **Önemli:** Bu grup değişikliklerinin etkili olması için Raspberry Pi'nizi **yeniden başlatmanız** (veya oturumu kapatıp yeniden açmanız) gerekir.

3.  **I2C Cihazlarını Kontrol Etme:**
    I2C sensörlerinizi (SHT3x gibi) bağladıktan sonra, Raspberry Pi'nin onları algıladığını şu komutla doğrulayabilirsiniz:
    ```bash
    i2cdetect -y 1
    ```
    Çıktı tablosunda onaltılık bir sayı (örn: `44`) görmelisiniz. Görmüyorsanız, kablo bağlantılarınızı kontrol edin.

## Agent Kurulumu ve Çalıştırma

1.  **Node.js Kurulumu:**
    Node.js v18 veya daha yeni bir sürümün kullanılması önerilir.
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

2.  **Bağımlılıkları Yükleme:**
    Raspberry Pi'nizde bu dizine (`raspiagent-ts`) gidin ve şunu çalıştırın:
    ```bash
    npm install
    ```

3.  **Ortam Değişkenleri Dosyası Oluştur (Opsiyonel):**
    Eğer Yapay Zeka destekli kar yüksekliği analizi gibi özellikleri kullanacaksanız, bu dizinde `.env` adında bir dosya oluşturun ve içine API anahtarınızı ekleyin:
    ```
    API_KEY=YAPAY_ZEKA_API_ANAHTARINIZ
    ```
    Bu anahtarı Google AI Studio'dan alabilirsiniz. Bu değişkenin ayarlanmaması durumunda, yapay zeka özellikleri çalışmayacaktır.

4.  **Agent'ı Yapılandırma:**
    Bu dizindeki `config.json` dosyasını düzenleyin.
    -   `server.base_url`: ORION backend sunucunuzun tam URL'si (örn: `https://sistem.alanadiniz.com`).
    -   `device.id`: Bu Raspberry Pi için benzersiz kimlik. Bu, ORION web arayüzünde istasyonu oluştururken belirlediğiniz "Cihaz ID" ile **aynı olmalıdır**.
    -   `device.token`: Kimlik doğrulama token'ı. Bu, backend'in `.env` dosyasındaki `DEVICE_AUTH_TOKEN` ile **aynı olmalıdır**.

5.  **Derleme ve Çalıştırma:**
    -   Önce, TypeScript kodunu derleyin:
        ```bash
        npm run build
        ```
    -   Ardından, derlenmiş agent'ı çalıştırın:
        -   **Geliştirme/Test için:**
            ```bash
            npm start
            ```
        -   **Sürekli Çalıştırma için (PM2 ile):**
            Agent'ı arkaplanda sürekli çalıştırmak için `pm2` gibi bir araç kullanmanız önerilir. Proje, `ecosystem.config.cjs` adlı bir `pm2` yapılandırma dosyası içerir.
            ```bash
            sudo npm install pm2 -g
            pm2 start ecosystem.config.cjs
            pm2 startup # Cihaz açıldığında agent'ın otomatik başlaması için
            pm2 save
            ```
    -   **Not:** Web arayüzünden uzaktan yeniden başlatma ve durdurma özelliklerinin çalışabilmesi için agent'ın `ecosystem.config.cjs` dosyası kullanılarak `pm2` ile başlatılması **gereklidir**. Bu, işlem adının (`orion-agent`) doğru şekilde ayarlanmasını sağlar.
