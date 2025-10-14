import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;
const DB_FILE = path.join(__dirname, '..', 'orion.db');

export async function initializeDatabase(): Promise<Database> {
    try {
        console.log(`[Database] Initializing persistent database at: ${DB_FILE}`);
        
        const newDb = await open({
            filename: DB_FILE,
            driver: sqlite3.Database,
        });

        console.log('[Database] Running migrations to create schema...');
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
                FOREIGN KEY(stationId) REFERENCES stations(id)
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
                FOREIGN KEY(stationId) REFERENCES stations(id)
            );
        `);
        console.log('[Database] Schema is up to date.');

        db = newDb;
        return db;

    } catch (error) {
        console.error('[Database] FAILED to open or migrate database:', error);
        throw error; // Propagate the error to stop the server from starting
    }
}

export function getDb(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return db;
}
