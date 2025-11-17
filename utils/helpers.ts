

export const getNumericValue = (value: any, sensorType?: string, sensorInterface?: string): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;

    if (typeof value === 'object') {
        // Handle values based on sensor type first, this is more robust
        if (sensorType === 'Sıcaklık' && typeof value.temperature === 'number') {
            return value.temperature;
        }
        if (sensorType === 'Nem' && typeof value.humidity === 'number') {
            return value.humidity;
        }
        if (sensorType === 'Kar Yüksekliği' && typeof value.snow_depth_cm === 'number') {
            return value.snow_depth_cm;
        }
        if (sensorType === 'Mesafe' && typeof value.distance_cm === 'number') {
            return value.distance_cm;
        }
        if (sensorType === 'Ağırlık' && typeof value.weight_kg === 'number') {
            return value.weight_kg;
        }

        // Fallback: If no specific key matches, try to find the first numeric value.
        // This helps with simple objects like { "value": 123 }
        const numeric = Object.values(value).find(v => typeof v === 'number');
        if (typeof numeric === 'number') {
            return numeric;
        }
        
        return null;
    }

    // Final fallback for stringified numbers or other primitives
    const parsed = parseFloat(String(value));
    return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
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