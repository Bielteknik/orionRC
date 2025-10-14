import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;
const DB_FILE = path.join(__dirname, '..', 'orion.db');

export async function initializeDatabase(): Promise<Database> {
    if (db) return db;

    try {
        console.log(`[Database] Veritabanı başlatılıyor: ${DB_FILE}`);
        
        const newDb = await open({
            filename: DB_FILE,
            driver: sqlite3.Database,
        });

        console.log('[Database] Şema kontrol ediliyor/oluşturuluyor...');
        await newDb.exec(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS stations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                location TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'maintenance')),
                lastUpdate TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sensors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                stationId TEXT,
                status TEXT NOT NULL,
                value REAL DEFAULT 0,
                unit TEXT,
                battery INTEGER DEFAULT 100,
                lastUpdate TEXT NOT NULL,
                FOREIGN KEY(stationId) REFERENCES stations(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS cameras (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                stationId TEXT,
                status TEXT NOT NULL,
                streamUrl TEXT,
                rtspUrl TEXT,
                cameraType TEXT,
                viewDirection TEXT,
                fps INTEGER,
                FOREIGN KEY(stationId) REFERENCES stations(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                ruleId TEXT,
                message TEXT NOT NULL,
                stationName TEXT NOT NULL,
                sensorName TEXT NOT NULL,
                triggeredValue TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                severity TEXT NOT NULL,
                isRead INTEGER NOT NULL DEFAULT 0
            );
        `);
        console.log('[Database] Şema hazır.');

        db = newDb;
        return db;

    } catch (error) {
        console.error('[Database] Veritabanı başlatılamadı:', error);
        throw error;
    }
}

export function getDb(): Database {
    if (!db) {
        throw new Error('Veritabanı başlatılmadı. Önce initializeDatabase fonksiyonunu çağırın.');
    }
    return db;
}

export async function seedDatabase(db: Database): Promise<void> {
    const { count } = await db.get('SELECT COUNT(*) as count FROM stations');
    if (count > 0) {
        console.log('[Database] Veritabanı zaten veri içeriyor, seeding atlanıyor.');
        return;
    }

    console.log('[Database] Veritabanı boş, başlangıç verileri ekleniyor...');
    try {
        await db.exec('BEGIN TRANSACTION');
        
        const now = new Date().toISOString();

        // Stations
        await db.run(`INSERT INTO stations (id, name, location, lat, lng, status, lastUpdate) VALUES
            ('STATION001', 'Merkez İstasyon', 'Erzurum, Merkez', 39.9086, 41.2655, 'active', '${now}'),
            ('STATION002', 'Palandöken Kayak Merkezi', 'Palandöken, Erzurum', 39.8732, 41.2917, 'active', '${now}'),
            ('STATION003', 'Atatürk Üniversitesi Kampüs', 'Yakutiye, Erzurum', 39.9100, 41.2900, 'maintenance', '${now}'),
            ('STATION004', 'Tortum Şelalesi Gözlem', 'Tortum, Erzurum', 40.2975, 41.6703, 'inactive', '${now}');
        `);

        // Sensors
        await db.run(`INSERT INTO sensors (id, name, type, stationId, status, value, unit, battery, lastUpdate) VALUES
            ('SENS01_1', 'Sıcaklık Sensörü A', 'Sıcaklık', 'STATION001', 'Aktif', 12.5, '°C', 98, '${now}'),
            ('SENS01_2', 'Nem Sensörü A', 'Nem', 'STATION001', 'Aktif', 45.2, '%', 95, '${now}'),
            ('SENS01_3', 'Rüzgar Hızı Sensörü', 'Rüzgar Hızı', 'STATION001', 'Aktif', 15.3, 'km/h', 88, '${now}'),
            ('SENS01_4', 'Basınç Sensörü', 'Basınç', 'STATION001', 'Aktif', 1012.5, 'hPa', 99, '${now}'),
            ('SENS01_5', 'Rüzgar Yönü Sensörü', 'Rüzgar Yönü', 'STATION001', 'Aktif', 270, '°', 91, '${now}'),
            ('SENS02_1', 'Kar Kalınlığı Sensörü', 'Sıcaklık', 'STATION002', 'Aktif', -2.1, '°C', 76, '${now}'),
            ('SENS02_2', 'UV İndeksi Sensörü', 'UV İndeksi', 'STATION002', 'Aktif', 4, '', 81, '${now}'),
            ('SENS02_3', 'Rüzgar Hızı (Zirve)', 'Rüzgar Hızı', 'STATION002', 'Aktif', 45.8, 'km/h', 85, '${now}'),
            ('SENS02_4', 'Nem (Zirve)', 'Nem', 'STATION002', 'Hatalı', 88.1, '%', 15, '${now}'),
            ('SENS03_1', 'Kampüs Sıcaklık', 'Sıcaklık', 'STATION003', 'Bakımda', 14.8, '°C', 100, '${now}'),
            ('SENS03_2', 'Kampüs Nem', 'Nem', 'STATION003', 'Bakımda', 52.0, '%', 100, '${now}'),
            ('SENS04_1', 'Şelale Nem Sensörü', 'Nem', 'STATION004', 'Pasif', 78.5, '%', 0, '${now}');
        `);
        
        // Cameras
        await db.run(`INSERT INTO cameras (id, name, stationId, status, streamUrl, rtspUrl, cameraType, viewDirection, fps) VALUES
            ('CAM001', 'Merkez Gözlem Kamerası', 'STATION001', 'Çevrimiçi', 'https://storage.googleapis.com/web-dev-assets/video-and-source-tags/chrome.mp4', 'rtsp://...', 'PTZ Kamera', 'Kuzeydoğu', 25),
            ('CAM002', 'Palandöken Zirve', 'STATION002', 'Kaydediyor', 'https://storage.googleapis.com/web-dev-assets/video-and-source-tags/chrome.mp4', 'rtsp://...', 'Sabit Dome Kamera', 'Güney', 30),
            ('CAM003', 'Kampüs Ana Giriş', 'STATION003', 'Çevrimdışı', '', 'rtsp://...', 'Geniş Açılı Kamera', 'Batı', 30),
            ('CAM004', 'Palandöken Kafe Önü', 'STATION002', 'Çevrimiçi', 'https://storage.googleapis.com/web-dev-assets/video-and-source-tags/chrome.mp4', 'rtsp://...', 'Sabit Dome Kamera', 'Doğu', 25);
        `);
        
        // Notifications
        await db.run(`INSERT INTO notifications (id, ruleId, message, stationName, sensorName, triggeredValue, timestamp, severity, isRead) VALUES
            ('NOTIF001', 'RULE01', 'Kritik sıcaklık uyarısı!', 'Merkez İstasyon', 'Sıcaklık Sensörü A', '35.2°C', '${new Date(Date.now() - 3600000).toLocaleString('tr-TR')}', 'Kritik', 0),
            ('NOTIF002', 'RULE02', 'Nem seviyesi çok düşük.', 'Palandöken Kayak Merkezi', 'Nem (Zirve)', '15.0%', '${new Date(Date.now() - 7200000).toLocaleString('tr-TR')}', 'Uyarı', 0),
            ('NOTIF003', 'RULE03', 'Rüzgar hızı tehlikeli seviyede.', 'Palandöken Kayak Merkezi', 'Rüzgar Hızı (Zirve)', '88.5 km/h', '${new Date(Date.now() - 86400000).toLocaleString('tr-TR')}', 'Kritik', 1),
            ('NOTIF004', 'RULE04', 'Kampüs sensörü bakıma alındı.', 'Atatürk Üniversitesi Kampüs', 'Kampüs Sıcaklık', 'Bakımda', '${new Date(Date.now() - 172800000).toLocaleString('tr-TR')}', 'Bilgi', 1);
        `);

        await db.exec('COMMIT');
        console.log('[Database] Başlangıç verileri başarıyla eklendi.');
    } catch (e) {
        await db.exec('ROLLBACK');
        console.error('[Database] Başlangıç verileri eklenirken hata oluştu, geri alınıyor:', e);
        throw e;
    }
}
