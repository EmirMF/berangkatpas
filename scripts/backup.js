import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = process.env.DB_PATH || './data/berangkatpas.db';
const target = resolve(process.argv[2] || `./data/berangkatpas-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(source);
try {
  db.prepare('VACUUM INTO ?').run(target);
  console.log(target);
} finally { db.close(); }
