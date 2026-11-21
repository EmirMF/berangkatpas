import { config } from '../src/config.js';
import { openDb } from '../src/db.js';
import { issuePartnerKey } from '../src/contexts/identity/index.js';

const group = process.argv[2];
if (!group || !/^[a-z0-9-]{3,32}$/.test(group)) {
  console.error('Usage: npm run key:issue -- <group-slug>'); process.exit(1);
}
const db = openDb(config().dbPath);
try {
  const key = issuePartnerKey(db, group);
  console.log(`Group: ${group}\nX-API-Key: ${key}\nStore this key securely; it is shown only once.`);
} finally { db.close(); }
