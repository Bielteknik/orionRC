import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { MOCK_STATIONS_DATA, MOCK_SENSORS_DATA, MOCK_CAMERAS_DATA } from './mockData';

// Singleton instance for the database to avoid re-initializing on every request
let dbInstance: Database | null = null;

/**
 * Initializes and returns a singleton database instance.
 * It creates an in-memory database and populates it with mock data on the first run.
 */
export async function getDb(): Promise<Database> {
    if (dbInstance) {
        return dbInstance;
    }

    try {
        console.log('[DB] Initializing in-memory SQLite database...');
        const db = await open({
            filename: ':memory:', // Use in-memory storage
            driver: sqlite3.Database
        });

        console.log('[DB] Creating database schema...');
        // Use a single exec call for schema creation for efficiency
        await db.exec(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE stations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                status TEXT NOT NULL,
                activeAlerts INTEGER,
                lastUpdate TEXT NOT NULL
            );

            CREATE TABLE sensors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                stationId TEXT,
                status TEXT,
                value REAL,
                unit TEXT,
                battery INTEGER,
                lastUpdate TEXT,
                FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE SET NULL
            );

            CREATE TABLE cameras (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                stationId TEXT,
                status TEXT,
                streamUrl TEXT,
                rtspUrl TEXT,
                cameraType TEXT,
                viewDirection TEXT,
                fps INTEGER,
                FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE SET NULL
            );
        `);

        console.log('[DB] Populating database with mock data...');
        // Use prepared statements and transactions for bulk inserts for better performance
        await db.run('BEGIN TRANSACTION');
        
        const stationStmt = await db.prepare('INSERT INTO stations (id, name, location, lat, lng, status, activeAlerts, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const station of MOCK_STATIONS_DATA) {
            await stationStmt.run(station.id, station.name, station.location, station.locationCoords.lat, station.locationCoords.lng, station.status, station.activeAlerts, station.lastUpdate);
        }
        await stationStmt.finalize();

        const sensorStmt = await db.prepare('INSERT INTO sensors (id, name, type, stationId, status, value, unit, battery, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const sensor of MOCK_SENSORS_DATA) {
            await sensorStmt.run(sensor.id, sensor.name, sensor.type, sensor.stationId, sensor.status, sensor.value, sensor.unit, sensor.battery, sensor.lastUpdate);
        }
        await sensorStmt.finalize();
        
        const cameraStmt = await db.prepare('INSERT INTO cameras (id, name, stationId, status, streamUrl, rtspUrl, cameraType, viewDirection, fps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const camera of MOCK_CAMERAS_DATA) {
            await cameraStmt.run(camera.id, camera.name, camera.stationId, camera.status, camera.streamUrl, camera.rtspUrl, camera.cameraType, camera.viewDirection, camera.fps);
        }
        await cameraStmt.finalize();

        await db.run('COMMIT');
        
        console.log('[DB] Database initialized successfully.');
        dbInstance = db;
        return db;

    } catch (error) {
        if(dbInstance) await dbInstance.run('ROLLBACK');
        console.error('[DB] Failed to initialize database:', error);
        throw error;
    }
}
