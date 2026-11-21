import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      buffer_minutes REAL NOT NULL DEFAULT 10, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      origin_lat REAL NOT NULL, origin_lng REAL NOT NULL,
      destination_lat REAL NOT NULL, destination_lng REAL NOT NULL,
      arrival_time TEXT NOT NULL, travel_date TEXT, weekdays TEXT,
      mode TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);
    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      schedule_id TEXT NOT NULL REFERENCES schedules(id), occurrence_date TEXT NOT NULL,
      arrival_at TEXT NOT NULL, depart_at TEXT NOT NULL,
      route_minutes INTEGER NOT NULL, weather_minutes INTEGER NOT NULL,
      buffer_minutes REAL NOT NULL, source_info TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(user_id, created_at);
    CREATE TABLE IF NOT EXISTS feedback (
      recommendation_id TEXT PRIMARY KEY REFERENCES recommendations(id),
      arrived_at TEXT NOT NULL, delta_minutes REAL NOT NULL,
      buffer_after REAL NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calibration_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id), buffer_minutes REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY, group_name TEXT NOT NULL UNIQUE,
      key_hash TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS provider_cache (
      cache_key TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL,
      revoked_at INTEGER, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user ON refresh_sessions(user_id);
  `);
  // Migrate once. New users receive their profile lazily from the History
  // context using the configured default, independent of the legacy column.
  if (db.prepare('PRAGMA user_version').get().user_version < 1) {
    db.exec(`BEGIN IMMEDIATE;
      INSERT OR IGNORE INTO calibration_profiles(user_id,buffer_minutes,updated_at)
        SELECT id,buffer_minutes,created_at FROM users;
      PRAGMA user_version=1;
      COMMIT;`);
  }
  if (db.prepare('PRAGMA user_version').get().user_version < 2) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE schedules ADD COLUMN title TEXT;
      ALTER TABLE schedules ADD COLUMN origin_label TEXT;
      ALTER TABLE schedules ADD COLUMN destination_label TEXT;
      ALTER TABLE recommendations ADD COLUMN revision TEXT;
      ALTER TABLE recommendations ADD COLUMN result_json TEXT;
      CREATE INDEX IF NOT EXISTS idx_recommendations_occurrence
        ON recommendations(user_id,schedule_id,occurrence_date,created_at);
      PRAGMA user_version=2;
      COMMIT;`);
  }
  if (db.prepare('PRAGMA user_version').get().user_version < 3) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE schedules ADD COLUMN preparation_minutes INTEGER NOT NULL DEFAULT 0;
      PRAGMA user_version=3;
      COMMIT;`);
  }
  return db;
}
