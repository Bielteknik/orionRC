
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
 * - AKILLI OKUMA: Eğer son kayıtta değer boşsa (""), geriye doğru gidip en son geçerli değeri bulur.
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

            // --- AKILLI ARAMA ---
            // Diziyi sondan başa doğru tarayarak en son geçerli sıcaklık ve nem değerlerini bulalım.
            let lastValidTemp: number | null = null;
            let lastValidHum: number | null = null;

            for (let i = jsonData.length - 1; i >= 0; i--) {
                const entryRoot = jsonData[i];
                const entry = entryRoot.anlik_durum || entryRoot;

                // Sıcaklık henüz bulunmadıysa ve bu kayıtta varsa al
                if (lastValidTemp === null && entry.sicaklik !== undefined) {
                    const temp = parseTurkishFloat(entry.sicaklik);
                    if (temp !== null) lastValidTemp = temp;
                }

                // Nem henüz bulunmadıysa ve bu kayıtta varsa al
                if (lastValidHum === null) {
                    const rawHum = entry.nem !== undefined ? entry.nem : entry.nem_yuzde;
                    if (rawHum !== undefined) {
                        const hum = parseTurkishFloat(rawHum);
                        if (hum !== null) lastValidHum = hum;
                    }
                }

                // İkisini de bulduysak döngüden çık
                if (lastValidTemp !== null && lastValidHum !== null) break;
            }

            const result: any = {};
            if (lastValidTemp !== null) result.temperature = lastValidTemp;
            if (lastValidHum !== null) result.humidity = lastValidHum;
            
            if (Object.keys(result).length === 0) {
                 if (verbose) console.warn(`     -> UYARI (JSON Monitor): Dosyada geçerli sayısal veri bulunamadı.`);
                 return null;
            }

            if (verbose) console.log(`     -> İşlenmiş Veri (Akıllı Arama):`, result);
            
            return result;

        } catch (error: any) {
            if (verbose) console.error(`     -> HATA (JSON Monitor): Dosya okuma hatası: ${error.message}`);
            return null;
        }
    }
}
