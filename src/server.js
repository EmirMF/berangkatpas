import { config } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';

const cfg = config();
const db = openDb(cfg.dbPath);
const server = createApp({ db, cfg }).listen(cfg.port, '0.0.0.0', () => console.log(`BerangkatPas listening on ${cfg.port}`));
function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
