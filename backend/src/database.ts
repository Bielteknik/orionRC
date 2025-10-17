import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

export let db: Database;

export async function openDb() {
    db = await open({
        filename: path.join(__dirname, '..', 'db.sqlite'),
        driver: sqlite3.Database
    });
    console.log('Database connection opened.');
    await db.run('PRAGMA foreign_keys = ON;');
    return db;
}

export async function migrate() {
    console.log('Running database migrations...');
    const schema = `
        CREATE TABLE IF NOT EXISTS stations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            location TEXT,
            lat REAL,
            lng REAL,
            status TEXT,
            sensor_count INTEGER DEFAULT 0,
            camera_count INTEGER DEFAULT 0,
            active_alerts INTEGER DEFAULT 0,
            last_update TEXT,
            system_health INTEGER DEFAULT 100,
            avg_battery INTEGER DEFAULT 100,
            data_flow INTEGER DEFAULT 100,
            active_sensor_count INTEGER DEFAULT 0,
            online_camera_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sensors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            station_id TEXT,
            status TEXT,
            value TEXT, -- Storing as JSON string
            unit TEXT,
            battery INTEGER,
            last_update TEXT,
            is_active BOOLEAN DEFAULT 1,
            interface TEXT,
            parser_config TEXT,
            config TEXT,
            read_frequency INTEGER DEFAULT 60,
            FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS cameras (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            station_id TEXT,
            status TEXT,
            stream_url TEXT,
            rtsp_url TEXT,
            camera_type TEXT,
            view_direction TEXT,
            fps INTEGER,
            photos TEXT, -- Storing as JSON string array
            FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE SET NULL
        );
        
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT NOT NULL,
            value TEXT NOT NULL, -- JSON string
            timestamp TEXT NOT NULL,
            FOREIGN KEY(sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS alert_rules (
            id TEXT PRIMARY KEY,
            name TEXT,
            sensor_type TEXT,
            station_ids TEXT, -- JSON array
            condition TEXT,
            threshold REAL,
            severity TEXT,
            is_enabled BOOLEAN
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            rule_id TEXT,
            message TEXT,
            station_name TEXT,
            sensor_name TEXT,
            triggered_value TEXT,
            timestamp TEXT,
            severity TEXT,
            is_read BOOLEAN
        );

        CREATE TABLE IF NOT EXISTS commands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            command_type TEXT NOT NULL,
            payload TEXT, -- JSON payload
            status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS station_types ( id INTEGER PRIMARY KEY, name TEXT UNIQUE );
        CREATE TABLE IF NOT EXISTS sensor_types ( id INTEGER PRIMARY KEY, name TEXT UNIQUE );
        CREATE TABLE IF NOT EXISTS camera_types ( id INTEGER PRIMARY KEY, name TEXT UNIQUE );
        CREATE TABLE IF NOT EXISTS reports ( id TEXT PRIMARY KEY, title TEXT, created_at TEXT, type TEXT, config TEXT );
        CREATE TABLE IF NOT EXISTS report_schedules ( id TEXT PRIMARY KEY, name TEXT, frequency TEXT, time TEXT, recipient TEXT, report_config TEXT, is_enabled BOOLEAN, last_run TEXT );
    `;

    await db.exec(schema);

    // Seed default sensor types if the table is empty.
    const countResult = await db.get("SELECT COUNT(*) as count FROM sensor_types");
    if (countResult.count === 0) {
        console.log('Seeding default sensor types...');
        const defaultSensorTypes = ['Sıcaklık', 'Nem', 'Rüzgar Hızı', 'Basınç', 'Yağış', 'UV İndeksi', 'Rüzgar Yönü', 'Mesafe', 'Ağırlık'];
        const existingTypes = await db.all("SELECT name FROM sensor_types");
        const existingTypeNames = new Set(existingTypes.map(t => t.name));
        const typesToAdd = defaultSensorTypes.filter(t => !existingTypeNames.has(t));
        
        if (typesToAdd.length > 0) {
            const stmt = await db.prepare("INSERT INTO sensor_types (name) VALUES (?)");
            for (const type of typesToAdd) {
                await stmt.run(type);
            }
            await stmt.finalize();
        }
    }


    console.log('Migrations complete. Database is ready.');
}
