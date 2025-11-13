import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let db: Database;

export interface ReadingFromDb {
    id: number;
    sensor_id: string;
    raw_value: string;
    processed_value: string;
    timestamp: string;
    is_sent: number;
}

export async function openDb() {
    try {
        db = await open({
            filename: path.join(__dirname, '..', 'agent-db.sqlite'),
            driver: sqlite3.Database
        });
        console.log('📦 Yerel veritabanı bağlantısı açıldı.');
        await migrate();
    } catch (error) {
        console.error("❌ Yerel veritabanı açılamadı:", error);
        throw error;
    }
}

async function migrate() {
    console.log('📦 Veritabanı şeması kontrol ediliyor...');
    const schema = `
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT NOT NULL,
            raw_value TEXT NOT NULL,
            processed_value TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            is_sent INTEGER DEFAULT 0
        );
    `;
    await db.exec(schema);
    console.log('✅ Veritabanı hazır.');
}

export async function addReading(sensorId: string, rawValue: any, processedValue: any): Promise<number> {
    const timestamp = new Date().toISOString();
    const rawValueStr = JSON.stringify(rawValue);
    const processedValueStr = JSON.stringify(processedValue);
    
    const result = await db.run(
        'INSERT INTO readings (sensor_id, raw_value, processed_value, timestamp, is_sent) VALUES (?, ?, ?, ?, ?)',
        sensorId,
        rawValueStr,
        processedValueStr,
        timestamp,
        0
    );
    return result.lastID!;
}

export async function getUnsentReadings(limit: number = 50): Promise<ReadingFromDb[]> {
    return await db.all<ReadingFromDb[]>('SELECT * FROM readings WHERE is_sent = 0 ORDER BY timestamp ASC LIMIT ?', limit);
}

export async function markReadingsAsSent(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.run(`UPDATE readings SET is_sent = 1 WHERE id IN (${placeholders})`, ...ids);
}
