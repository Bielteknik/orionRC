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
    -   `server.base_url`: ORION backend sunucunuzun tam API URL'si (örn: `https://sistem.alanadiniz.com/api`).
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
            Agent'ı arkaplanda sürekli çalıştırmak ve cihaz yeniden başladığında otomatik olarak başlamasını sağlamak için `pm2` kullanılması şiddetle tavsiye edilir. Proje, `ecosystem.config.cjs` adlı bir `pm2` yapılandırma dosyası içerir.

            **1. PM2 Kurulumu:**
            ```bash
            sudo npm install pm2 -g
            ```

            **2. Agent'ı PM2 ile Başlatma:**
            Bu dizindeyken aşağıdaki komutu çalıştırın:
            ```bash
            pm2 start ecosystem.config.cjs
            ```
            Bu komut, `ecosystem.config.cjs` dosyasındaki yapılandırmayı kullanarak agent'ı `orion-agent` adıyla başlatır. Agent'ın durumunu `pm2 list` komutuyla kontrol edebilirsiniz.

            **3. Açılışta Otomatik Başlatmayı Yapılandırma (ÇOK ÖNEMLİ):**
            Agent'ın Raspberry Pi her yeniden başladığında otomatik olarak çalışması için `pm2`'nin başlangıç betiğini oluşturması gerekir.

            **a. Başlangıç Betiğini Oluşturun:**
            ```bash
            pm2 startup
            ```
            Bu komut, size `sudo` ile başlayan başka bir komut çıktısı verecektir. **Bu ikinci komutu kopyalayıp terminalde çalıştırın.** Bu komut, `pm2`'nin sistem başlangıcında çalışması için bir `systemd` servisi oluşturur.

            Örnek çıktı şöyle görünebilir (kullanıcı adınıza ve sisteminize göre değişir):
            `sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi`

            **b. Mevcut İşlem Listesini Kaydedin:**
            Başlangıç servisini kurduktan sonra, `pm2`'ye şu anki çalışan uygulamaları (yani `orion-agent`) hatırlamasını söyleyin:
            ```bash
            pm2 save
            ```
            Bu komut, mevcut işlem listesini bir dosyaya kaydeder. Cihaz yeniden başladığında, `pm2` bu dosyayı okuyarak `orion-agent`'ı otomatik olarak yeniden başlatır.

## Sorun Giderme (Troubleshooting)

#### Agent Bağlantı Kuramıyor (`EAI_AGAIN` hatası)

Loglarda `getaddrinfo EAI_AGAIN` gibi hatalar görüyorsanız, bu durum agent'ın sunucu adlarını (örn: `api.openweathermap.org` veya kendi backend sunucunuz) IP adreslerine çözümleyemediği anlamına gelir. Bu genellikle Raspberry Pi'nin ağ veya DNS ayarlarında bir sorun olduğunu gösterir.

1.  **İnternet Bağlantısını Kontrol Edin:**
    ```bash
    ping 8.8.8.8
    ```
    Eğer "Destination Host Unreachable" veya paket kaybı gibi bir sonuç alıyorsanız, Pi'nin internete erişimi yoktur. Wi-Fi veya Ethernet bağlantınızı kontrol edin.

2.  **DNS Çözümlemesini Kontrol Edin:**
    ```bash
    ping google.com
    ```
    Eğer `ping 8.8.8.8` çalışıyor ancak bu komut "Name or service not known" hatası veriyorsa, DNS sunucunuzda bir sorun var demektir.

3.  **DNS Ayarlarını Kontrol Edin:**
    `cat /etc/resolv.conf` komutuyla DNS sunucularınızı görüntüleyin. Genellikle `nameserver 8.8.8.8` (Google DNS) gibi bir satır bulunmalıdır. Eğer bu dosya boşsa veya yanlış bir IP adresi içeriyorsa, DNS ayarlarınızı düzeltmeniz gerekir. Cihazınızı yeniden başlatmak veya ağ bağlantısını yenilemek genellikle bu dosyayı düzeltir. Kalıcı bir çözüm için ağ yapılandırmanızı (genellikle `/etc/dhcpcd.conf` üzerinden) düzenleyebilirsiniz.

#### PM2 Yeniden Başlatmada Otomatik Başlamıyor

Bu sorunun en yaygın nedeni, `pm2 startup` komutunun oluşturduğu `systemd` servisinin doğru yapılandırılmamış olmasıdır. Lütfen yukarıdaki "Açılışta Otomatik Başlatmayı Yapılandırma" bölümündeki adımları, özellikle de **adım 3a ve 3b**'yi dikkatlice takip ettiğinizden emin olun. `pm2 save` komutunu çalıştırmayı unutmayın.

Eğer sorun devam ederse, `pm2` servisini manuel olarak yeniden kurmayı deneyin:
1.  **Mevcut başlangıç yapılandırmasını kaldırın:**
    ```bash
    pm2 unstartup
    ```
2.  **Yeniden oluşturun, ancak bu sefer belirli bir kullanıcı ile:** `<username>` yerine kendi kullanıcı adınızı yazın (genellikle `pi`).
    ```bash
    pm2 startup systemd -u <username> --hp /home/<username>
    ```
3.  Yine, bu komutun çıktısı olan `sudo env...` ile başlayan komutu kopyalayıp çalıştırın.
4.  İşlem listesini tekrar kaydedin:
    ```bash
    pm2 save
    ```
5.  Emin olmak için `sudo systemctl status pm2-<username>` komutuyla servisin durumunu kontrol edebilirsiniz. `enabled` olarak görünmelidir.

## Agent Loglarını (Günlüklerini) İzleme

Agent `pm2` ile çalıştırıldığında, çıktısı doğrudan terminalde görünmez. Canlı logları görmek veya geçmiş logları incelemek için aşağıdaki komutu kullanın:

```bash
pm2 logs orion-agent
```

Bu komut, sensör okumaları, hatalar ve durum değişiklikleri dahil olmak üzere agent'ın tüm konsol çıktılarını gösterecektir. `Ctrl+C` ile log izlemeden çıkabilirsiniz.

**Not:** Web arayüzünden uzaktan yeniden başlatma ve durdurma özelliklerinin çalışabilmesi için agent'ın `ecosystem.config.cjs` dosyası kullanılarak `pm2` ile başlatılması **gereklidir**. Bu, işlem adının (`orion-agent`) doğru şekilde ayarlanmasını sağlar.