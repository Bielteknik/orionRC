import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;
const DB_FILE = path.join(__dirname, '..', 'orion.db');

export async function initializeDatabase(): Promise<Database> {
    try {
        console.log(`[Database] Kalıcı veritabanı başlatılıyor: ${DB_FILE}`);
        
        const newDb = await open({
            filename: DB_FILE,
            driver: sqlite3.Database,
        });

        console.log('[Database] Veritabanı şeması oluşturuluyor...');
        await newDb.exec(`
            CREATE TABLE IF NOT EXISTS stations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                status TEXT NOT NULL,
                lastUpdate TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sensors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                stationId TEXT,
                status TEXT NOT NULL,
                value REAL,
                unit TEXT,
                battery INTEGER,
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
        `);
        console.log('[Database] Şema hazır.');

        db = newDb;
        return db;

    } catch (error) {
        console.error('[Database] Veritabanı açılamadı veya şema oluşturulamadı:', error);
        throw error; // Sunucunun başlamasını engellemek için hatayı tekrar fırlat
    }
}

export function getDb(): Database {
    if (!db) {
        throw new Error('Veritabanı başlatılmadı. Önce initializeDatabase fonksiyonunu çağırın.');
    }
    return db;
}