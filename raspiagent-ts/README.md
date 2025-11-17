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

### Agent Bağlantı Kuramıyor (`EAI_AGAIN` hatası)

Loglarda `getaddrinfo EAI_AGAIN` gibi hatalar görüyorsanız, bu durum agent'ın sunucu adlarını (örn: `api.openweathermap.org` veya kendi backend sunucunuz) IP adreslerine çözümleyemediği anlamına gelir. Bu genellikle Raspberry Pi'nin ağ veya DNS ayarlarında bir sorun olduğunu gösterir.

**Teşhis:**
1.  `ping 8.8.8.8` komutuyla internet bağlantınızı test edin. Başarılıysa, temel bağlantı vardır.
2.  `ping google.com` komutunu çalıştırın. Hata alıyorsanız sorun DNS'dedir.
3.  `cat /etc/resolv.conf` komutuyla mevcut DNS sunucunuzu kontrol edin.

Eğer `/etc/resolv.conf` dosyasının en üstünde `# Generated by NetworkManager` yazıyorsa, aşağıdaki **NetworkManager Yöntemi**'ni kullanın. Aksi takdirde **dhcpcd Yöntemi**'ni kullanın.

---

#### Çözüm 1: NetworkManager Yöntemi (Önerilen)

Bu yöntem, `NetworkManager` servisini kullanan modern Raspberry Pi OS sürümleri (özellikle masaüstü ortamı olanlar) için geçerlidir.

**Adım 1: Aktif Bağlantı Adını Bulun**
Terminalde şu komutu çalıştırın ve `NAME` sütunundaki bağlantı adını not alın (örn: "Wired connection 1").
```bash
nmcli connection show --active
```

**Adım 2: DNS Ayarlarını Kalıcı Olarak Değiştirin**
Aşağıdaki iki komutu çalıştırın. `"BAĞLANTI_ADI"` yazan yeri bir önceki adımda bulduğunuz isimle değiştirmeyi unutmayın.
```bash
sudo nmcli connection modify "BAĞLANTI_ADI" ipv4.dns "8.8.8.8 1.1.1.1"
sudo nmcli connection modify "BAĞLANTI_ADI" ipv4.ignore-auto-dns yes
```
*İlk komut, DNS sunucusu olarak Google (`8.8.8.8`) ve Cloudflare'i (`1.1.1.1`) ayarlar.*
*İkinci komut, modem/router'ınızdan gelen otomatik DNS ayarlarını yok saymasını sağlar.*

**Adım 3: Ayarları Uygulayın**
Ağ servisini yeniden başlatarak ayarları hemen aktif edin:
```bash
sudo systemctl restart NetworkManager
```

**Adım 4: Doğrulayın**
`cat /etc/resolv.conf` komutunu tekrar çalıştırdığınızda çıktının artık `nameserver 8.8.8.8` şeklinde başladığını görmelisiniz. `ping google.com` komutu da artık çalışmalıdır.

---

#### Çözüm 2: dhcpcd Yöntemi (NetworkManager Kullanılmıyorsa)

**a. Yapılandırma Dosyasını Açın:**
```bash
sudo nano /etc/dhcpcd.conf
```

**b. DNS Satırını Ekleyin:**
Dosyanın en sonuna gidin ve aşağıdaki satırı ekleyin:
```
static domain_name_servers=8.8.8.8 1.1.1.1
```

**c. Kaydedip Çıkın ve Yeniden Başlatın:**
-   `Ctrl + O`, `Enter` ile kaydedin.
-   `Ctrl + X` ile çıkın.
-   `sudo reboot` ile cihazı yeniden başlatın.

---

### PM2 Yeniden Başlatmada Otomatik Başlamıyor (Özellikle NVM Kullanıcıları İçin)

Eğer `pm2 start` ile agent düzgün çalışıyor ancak `sudo reboot` sonrası başlamıyorsa, sorun neredeyse her zaman `systemd` servisinin `node` uygulamasını nerede bulacağını bilmemesidir. Bu durum, özellikle Node.js'i **NVM (Node Version Manager)** ile kurduysanız yaygındır. `systemd` servisleri, sizin normal kullanıcı oturumunuzdaki `PATH` ortam değişkenine sahip değildir.

Gönderdiğiniz çıktılar NVM kullandığınızı gösteriyor. İşte bu sorunu çözmek için doğru ve kesin adımlar:

**Adım 1: Mevcut PM2 Servisini Temizleyin**
Önce, `pm2`'nin daha önce oluşturmuş olabileceği hatalı başlangıç servislerini kaldıralım.
```bash
pm2 unstartup
```
Bu komut size `sudo` ile başlayan bir komut verecektir. **Bu komutu kopyalayıp çalıştırarak** mevcut servisi sistemden kaldırın.

**Adım 2: Agent'ın Çalıştığından Emin Olun**
`pm2`'nin hangi uygulamaları kaydetmesi gerektiğini bilmesi için agent'ı başlatın:
```bash
pm2 start ecosystem.config.cjs
```
`pm2 list` komutuyla `orion-agent`'ın `online` olduğundan emin olun.

**Adım 3: Yeni Başlangıç Servisini Oluşturun**
Şimdi, `pm2`'nin başlangıç betiğini yeniden oluşturmasını isteyin. `pm2`, `nvm` kullandığınızı algılayacak ve `systemd` servisi için doğru `PATH` değişkenini içeren bir komut üretecektir.
```bash
pm2 startup
```
Bu komut, bir önceki adıma benzer şekilde, `sudo env PATH=$PATH...` ile başlayan uzun bir komut üretecektir. **Bu komut, `systemd`'ye NVM'nin Node.js yolunu öğretir. Bu komutu kopyalayıp terminalde çalıştırın.**

**Adım 4: Mevcut İşlem Listesini Kaydedin**
`systemd` servisi artık doğru yapılandırıldığına göre, `pm2`'ye yeniden başlatmasını istediğiniz uygulamaların listesini kaydedin:
```bash
pm2 save
```
Bu komut, `orion-agent`'ı `pm2`'nin "yeniden başlatma listesine" ekler.

**Adım 5: Doğrulayın**
Her şeyin yolunda olduğundan emin olmak için cihazınızı yeniden başlatın:
```bash
sudo reboot
```
Cihaz açıldıktan sonra birkaç dakika bekleyin ve ardından `pm2 status` komutunu çalıştırın. `orion-agent`'ın `online` durumunda olduğunu görmelisiniz.


## Agent Loglarını (Günlüklerini) İzleme

Agent `pm2` ile çalıştırıldığında, çıktısı doğrudan terminalde görünmez. Canlı logları görmek veya geçmiş logları incelemek için aşağıdaki komutu kullanın:

```bash
pm2 logs orion-agent
```

Bu komut, sensör okumaları, hatalar ve durum değişiklikleri dahil olmak üzere agent'ın tüm konsol çıktılarını gösterecektir. `Ctrl+C` ile log izlemeden çıkabilirsiniz.

**Not:** Web arayüzünden uzaktan yeniden başlatma ve durdurma özelliklerinin çalışabilmesi için agent'ın `ecosystem.config.cjs` dosyası kullanılarak `pm2` ile başlatılması **gereklidir**. Bu, işlem adının (`orion-agent`) doğru şekilde ayarlanmasını sağlar.