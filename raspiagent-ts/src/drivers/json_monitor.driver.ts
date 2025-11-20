
import { ISensorDriver } from "../types.js";
import fs from 'fs/promises';
import path from 'path';

/**
 * Yerel bir klasördeki günlük JSON dosyalarını izleyen sürücü.
 * Dosya formatı: DDMMYYYY.json (Örn: 19112025.json)
 * İçerik formatı: Array (Son eleman en güncel veridir)
 */
export default class JsonMonitorDriver implements ISensorDriver {
    
    public async read(config: { folder_path: string }, verbose: boolean = true): Promise<Record<string, any> | null> {
        const { folder_path } = config;

        if (!folder_path) {
            if (verbose) console.error("     -> HATA (JSON Monitor): 'folder_path' yapılandırmada belirtilmemiş.");
            return null;
        }

        // Bugünün tarihini DDMMYYYY formatında oluştur
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Aylar 0-11 arasıdır
        const year = now.getFullYear();
        const filename = `${day}${month}${year}.json`;
        
        const filePath = path.join(folder_path, filename);

        try {
            // Dosyanın varlığını kontrol et
            try {
                await fs.access(filePath);
            } catch {
                if (verbose) console.warn(`     -> UYARI (JSON Monitor): Bugünün dosyası henüz oluşmamış veya bulunamadı: ${filePath}`);
                return null;
            }

            // Dosyayı oku
            const fileContent = await fs.readFile(filePath, 'utf-8');
            
            if (!fileContent.trim()) {
                return null; // Dosya boş
            }

            let jsonData;
            try {
                jsonData = JSON.parse(fileContent);
            } catch (e) {
                if (verbose) console.error(`     -> HATA (JSON Monitor): JSON ayrıştırılamadı. Dosya bozuk olabilir.`);
                return null;
            }

            if (!Array.isArray(jsonData) || jsonData.length === 0) {
                if (verbose) console.warn(`     -> UYARI (JSON Monitor): JSON formatı beklenen dizi formatında değil veya boş.`);
                return null;
            }

            // Dizideki son elemanı (en güncel veriyi) al
            const latestEntry = jsonData[jsonData.length - 1];

            if (verbose) console.log(`     -> JSON Dosyasından Okunan:`, latestEntry);

            // Veri formatını sistem standartlarına dönüştür (Mapping)
            // Sizin formatınız: { "tarih": "...", "saat": "...", "sicaklik_c": 4.7, "hadise": "...", "nem_yuzde": 24 }
            const mappedData: any = {
                // Orijinal verileri koru
                ...latestEntry,
            };

            // Sistemdeki widget'ların (grafiklerin) tanıması için standart anahtarları ekle
            if (typeof latestEntry.sicaklik_c === 'number') {
                mappedData.temperature = latestEntry.sicaklik_c;
            }
            if (typeof latestEntry.nem_yuzde === 'number') {
                mappedData.humidity = latestEntry.nem_yuzde;
            }
            
            // Tarih ve saati birleştirip timestamp olarak ekleyebiliriz ama server zaten geliş zamanını kaydediyor.
            
            return mappedData;

        } catch (error: any) {
            if (verbose) console.error(`     -> HATA (JSON Monitor): Dosya okuma hatası: ${error.message}`);
            return null;
        }
    }
}
