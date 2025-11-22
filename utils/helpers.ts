
export const getNumericValue = (value: any, sensorType?: string, sensorInterface?: string): number | null => {
    if (value === null || value === undefined) return null;
    
    // 1. Eğer değer doğrudan bir sayıysa döndür
    if (typeof value === 'number') {
        return isFinite(value) ? value : null;
    }

    // 2. Eğer değer string ise ve sayıya benziyorsa parse et
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
    }

    // 3. Eğer değer bir nesne (JSON) ise, sensör tipine göre doğru anahtarı ara
    if (typeof value === 'object') {
        
        // --- SICAKLIK SENSÖRÜ ---
        if (sensorType === 'Sıcaklık') {
            // Öncelik sırasına göre anahtarlar
            if (isValidNumber(value.temperature)) return value.temperature; // Standart & Arduino
            if (isValidNumber(value.temp)) return value.temp;
            if (isValidNumber(value.sicaklik_c)) return value.sicaklik_c; // Python Script
            if (isValidNumber(value.value)) return value.value; // Genel fallback
        }

        // --- NEM SENSÖRÜ ---
        if (sensorType === 'Nem') {
            if (isValidNumber(value.humidity)) return value.humidity; // Standart & Arduino
            if (isValidNumber(value.hum)) return value.hum;
            if (isValidNumber(value.nem_yuzde)) return value.nem_yuzde; // Python Script
            if (isValidNumber(value.value)) return value.value;
        }

        // --- MESAFE SENSÖRÜ ---
        if (sensorType === 'Mesafe') {
            if (isValidNumber(value.distance_cm)) return value.distance_cm; // Lidar
            if (isValidNumber(value.dist)) return value.dist;
            if (isValidNumber(value.value)) return value.value;
        }

        // --- KAR YÜKSEKLİĞİ SENSÖRÜ ---
        if (sensorType === 'Kar Yüksekliği') {
            if (isValidNumber(value.snow_depth_cm)) return value.snow_depth_cm; // AI & Lidar (Özel mod)
            if (isValidNumber(value.depth)) return value.depth;
            if (isValidNumber(value.value)) return value.value;
        }

        // --- AĞIRLIK SENSÖRÜ ---
        if (sensorType === 'Ağırlık') {
            if (isValidNumber(value.weight_kg)) return value.weight_kg; // HX711
            if (isValidNumber(value.weight)) return value.weight;
            if (isValidNumber(value.value)) return value.value;
        }
        
        // --- RÜZGAR HIZI ---
        if (sensorType === 'Rüzgar Hızı') {
             if (isValidNumber(value.speed)) return value.speed;
             if (isValidNumber(value.wind_speed)) return value.wind_speed;
             if (isValidNumber(value.value)) return value.value;
        }

        // --- RÜZGAR YÖNÜ ---
        if (sensorType === 'Rüzgar Yönü') {
             if (isValidNumber(value.direction)) return value.direction;
             if (isValidNumber(value.deg)) return value.deg;
             if (isValidNumber(value.value)) return value.value;
        }
        
        // --- BASINÇ ---
        if (sensorType === 'Basınç') {
             if (isValidNumber(value.pressure)) return value.pressure;
             if (isValidNumber(value.pres)) return value.pres;
             if (isValidNumber(value.value)) return value.value;
        }

        // Fallback: Eğer hiçbir özel tip eşleşmezse veya anahtarlar bulunamazsa
        // 'value' anahtarına veya ilk bulunan sayısal değere bak.
        if (isValidNumber(value.value)) return value.value;

        const numericValues = Object.values(value).filter(v => isValidNumber(v)) as number[];
        if (numericValues.length > 0) {
            // Son çare: Bulunan ilk sayıyı döndür.
            // Not: Bu risklidir ama hiç veri göstermemekten iyidir.
            return numericValues[0];
        }
        
        return null;
    }

    return null;
};

// Yardımcı: Bir değerin geçerli bir sayı olup olmadığını kontrol eder
const isValidNumber = (val: any): boolean => {
    return typeof val === 'number' && isFinite(val);
};

export const formatTimeAgo = (isoString: string | undefined | null): string => {
    if (!isoString) return 'veri yok';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) { // Check for invalid date
        return 'geçersiz';
    }

    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 10) return "şimdi";
    if (seconds < 60) return `${seconds} sn önce`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} dk önce`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;

    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
};


export const toDateTimeLocal = (date: Date) => {
  const tzoffset = date.getTimezoneOffset() * 60000;
  const localISOTime = new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
  return localISOTime;
};
