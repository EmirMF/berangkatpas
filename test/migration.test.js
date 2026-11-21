import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { openDb } from '../src/db.js';

test('existing user buffer is backfilled into calibration profile once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'berangkatpas-migration-'));
  const path = join(dir, 'legacy.db');
  try {
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,
      buffer_minutes REAL NOT NULL DEFAULT 10,created_at TEXT NOT NULL);
      INSERT INTO users VALUES('u1','old@example.com','hash',17.5,'2026-11-01T00:00:00Z');`);
    old.close();
    const upgraded = openDb(path);
    assert.equal(upgraded.prepare('SELECT buffer_minutes FROM calibration_profiles WHERE user_id=?').get('u1').buffer_minutes, 17.5);
    upgraded.prepare('UPDATE calibration_profiles SET buffer_minutes=19 WHERE user_id=?').run('u1');
    upgraded.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)')
      .run('u2', 'new@example.com', 'hash', '2026-11-21T00:00:00Z');
    upgraded.close();
    const reopened = openDb(path);
    assert.equal(reopened.prepare('SELECT buffer_minutes FROM calibration_profiles WHERE user_id=?').get('u1').buffer_minutes, 19);
    assert.equal(reopened.prepare('SELECT 1 FROM calibration_profiles WHERE user_id=?').get('u2'), undefined);
    reopened.close();
  } finally {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temp cleanup path');
    rmSync(dir, { recursive: true, force: true });
  }
});
test('version 1 records survive frontend-ready schema migration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'berangkatpas-v1-'));
  const path = join(dir, 'v1.db');
  try {
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,buffer_minutes REAL NOT NULL DEFAULT 10,created_at TEXT NOT NULL);
      CREATE TABLE schedules(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,origin_lat REAL NOT NULL,origin_lng REAL NOT NULL,destination_lat REAL NOT NULL,destination_lng REAL NOT NULL,arrival_time TEXT NOT NULL,travel_date TEXT,weekdays TEXT,mode TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE recommendations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,schedule_id TEXT NOT NULL,occurrence_date TEXT NOT NULL,arrival_at TEXT NOT NULL,depart_at TEXT NOT NULL,route_minutes INTEGER NOT NULL,weather_minutes INTEGER NOT NULL,buffer_minutes REAL NOT NULL,source_info TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE feedback(recommendation_id TEXT PRIMARY KEY,arrived_at TEXT NOT NULL,delta_minutes REAL NOT NULL,buffer_after REAL NOT NULL,created_at TEXT NOT NULL);
      INSERT INTO users VALUES('u1','old@example.com','hash',12,'2026-11-01T00:00:00Z');
      INSERT INTO schedules VALUES('s1','u1',-6.9,107.6,-6.8,107.7,'08:00','2026-11-25',NULL,'car',1,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z');
      INSERT INTO recommendations VALUES('r1','u1','s1','2026-11-25','2026-11-25T08:00:00+07:00','2026-11-25T07:30:00+07:00',20,0,10,'{}','2026-11-01T00:00:00Z');
      INSERT INTO feedback VALUES('r1','2026-11-25T08:05:00+07:00',5,11.25,'2026-11-25T08:05:00Z');
      PRAGMA user_version=1;
    `);
    old.close();
    const upgraded = openDb(path);
    assert.equal(upgraded.prepare('PRAGMA user_version').get().user_version, 3);
    assert.equal(upgraded.prepare('SELECT id,title,origin_label FROM schedules WHERE id=?').get('s1').id, 's1');
    assert.equal(upgraded.prepare('SELECT preparation_minutes FROM schedules WHERE id=?').get('s1').preparation_minutes, 0);
    assert.equal(upgraded.prepare('SELECT id,revision,result_json FROM recommendations WHERE id=?').get('r1').id, 'r1');
    assert.equal(upgraded.prepare('SELECT buffer_after FROM feedback WHERE recommendation_id=?').get('r1').buffer_after, 11.25);
    upgraded.close();
  } finally {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temp cleanup path');
    rmSync(dir, { recursive: true, force: true });
  }
});
