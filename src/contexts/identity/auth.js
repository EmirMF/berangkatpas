import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'node:crypto';

export function authApi(db, cfg) {
  function token(user) { return jwt.sign({ sub: user.id }, cfg.jwtSecret, { expiresIn: '15m', issuer: 'berangkatpas' }); }
  function requireUser(req, _res, next) {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!match) return next(failError(401, 'UNAUTHORIZED', 'Bearer token required'));
    try {
      const payload = jwt.verify(match[1], cfg.jwtSecret, { issuer: 'berangkatpas' });
      const user = db.prepare('SELECT id,email FROM users WHERE id=?').get(payload.sub);
      if (!user) throw new Error('User not found');
      req.user = user;
      next();
    } catch { next(failError(401, 'UNAUTHORIZED', 'Invalid or expired token')); }
  }
  function requirePartner(req, _res, next) {
    const key = req.headers['x-api-key'];
    if (typeof key !== 'string' || !key) return next(failError(401, 'UNAUTHORIZED', 'X-API-Key required'));
    const hash = createHash('sha256').update(key).digest('hex');
    const rows = db.prepare('SELECT group_name,key_hash FROM api_keys WHERE active=1').all();
    const match = rows.find(row => timingSafeEqual(Buffer.from(row.key_hash, 'hex'), Buffer.from(hash, 'hex')));
    if (!match) return next(failError(401, 'UNAUTHORIZED', 'Invalid API key'));
    req.partnerGroup = match.group_name;
    next();
  }
  return { token, requireUser, requirePartner, hashPassword: password => bcrypt.hashSync(password, 10), checkPassword: bcrypt.compareSync };
}
function failError(status, code, message) { const error = new Error(message); error.status = status; error.code = code; return error; }
