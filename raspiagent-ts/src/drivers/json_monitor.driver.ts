import { ISensorDriver } from "../types.js";
import fs from 'fs/promises';
import path from 'path';

/**
 * Yerel bir klasördeki günlük JSON dosyalarını izleyen sürücü.
 * Dosya formatı: DDMMYYYY.json (Örn: 22112025.json)
 * İçerik formatı: Array (Son eleman en güncel veridir)
 * 
 * GÜNCELLEME:
 * - Veri yapısı: [ { "anlik_durum": { ... } }, ... ]
 * - Sayı formatı: "11,6" (Virgüllü string) -> 11.6 (Number) dönüşümü yapıldı.
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
        const month = String(now.getMonth() + 1).padStart(2, '0'); 
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

            const fileContent = await fs.readFile(filePath, 'utf-8');
            
            if (!fileContent.trim()) {
                return null; 
            }

            let jsonData;
            try {
                jsonData = JSON.parse(fileContent);
            } catch (e) {
                if (verbose) console.error(`     -> HATA (JSON Monitor): JSON ayrıştırılamadı.`);
                return null;
            }

            if (!Array.isArray(jsonData) || jsonData.length === 0) {
                if (verbose) console.warn(`     -> UYARI (JSON Monitor): JSON formatı beklenen dizi formatında değil veya boş.`);
                return null;
            }

            // Dizideki son elemanı al
            const latestEntryRoot = jsonData[jsonData.length - 1];
            
            // "anlik_durum" alt nesnesini kontrol et
            const data = latestEntryRoot.anlik_durum || latestEntryRoot;

            if (verbose) console.log(`     -> JSON Dosyasından Okunan (Ham):`, data);

            // Helper to parse Turkish float string "11,6" -> 11.6
            const parseTurkishFloat = (val: any): number | null => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    if (!val.trim()) return null; // Boş string ise null dön
                    const normalized = val.replace(',', '.');
                    const num = parseFloat(normalized);
                    return isNaN(num) ? null : num;
                }
                return null;
            };

            const mappedData: any = { ...data };

            // Sistem standartlarına dönüştür
            if (data.sicaklik !== undefined) {
                const temp = parseTurkishFloat(data.sicaklik);
                if (temp !== null) mappedData.temperature = temp;
            }
            
            // Nem verisi bazen "nem", bazen "nem_yuzde" olabilir, her ikisini de kontrol et
            const rawHum = data.nem !== undefined ? data.nem : data.nem_yuzde;
            if (rawHum !== undefined) {
                const hum = parseTurkishFloat(rawHum);
                if (hum !== null) mappedData.humidity = hum;
            }
            
            if (verbose) console.log(`     -> İşlenmiş Veri:`, mappedData);
            
            return mappedData;

        } catch (error: any) {
            if (verbose) console.error(`     -> HATA (JSON Monitor): Dosya okuma hatası: ${error.message}`);
            return null;
        }
    }
}