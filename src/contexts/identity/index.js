import express from 'express';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { authApi } from './auth.js';
import { fail, now, wrap } from '../../shared.js';

export function createIdentityContext(db, cfg) {
  const auth = authApi(db, cfg);
  const router = express.Router();
  const refreshLifetimeMs = 30 * 24 * 3600_000;
  const hashToken = value => createHash('sha256').update(value).digest('hex');
  function createRefreshToken(userId) {
    const value = `bpr_${randomBytes(32).toString('base64url')}`;
    const timestamp = Date.now();
    db.prepare('INSERT INTO refresh_sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)')
      .run(randomUUID(), userId, hashToken(value), timestamp + refreshLifetimeMs, timestamp);
    return value;
  }
  function session(user) {
    return { user: { id: user.id, email: user.email }, token: auth.token(user),
      refreshToken: createRefreshToken(user.id), expiresInSeconds: 900 };
  }
  router.post('/register', wrap((req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      fail(400, 'INVALID_CREDENTIALS', 'Valid email and password of 8–128 characters required');
    }
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) fail(409, 'EMAIL_EXISTS', 'Email is already registered');
    const user = { id: randomUUID(), email };
    db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)')
      .run(user.id, email, auth.hashPassword(password), now());
    res.status(201).json(session(user));
  }));
  router.post('/login', wrap((req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!user || typeof req.body?.password !== 'string' || !auth.checkPassword(req.body.password, user.password_hash)) {
      fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    res.json(session(user));
  }));
  router.get('/me', auth.requireUser, wrap((req, res) => res.json({ user: req.user })));
  router.post('/refresh', wrap((req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || !/^bpr_[A-Za-z0-9_-]{43}$/.test(refreshToken)) {
      fail(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare(`SELECT s.id,s.user_id,s.expires_at,s.revoked_at,u.email FROM refresh_sessions s
        JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).get(hashToken(refreshToken));
      if (!row || row.revoked_at !== null || row.expires_at <= Date.now()) {
        fail(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
      }
      db.prepare('UPDATE refresh_sessions SET revoked_at=? WHERE id=?').run(Date.now(), row.id);
      const result = session({ id: row.user_id, email: row.email });
      db.exec('COMMIT');
      res.json(result);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }));
  router.post('/logout', wrap((req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || !/^bpr_[A-Za-z0-9_-]{43}$/.test(refreshToken)) {
      fail(400, 'INVALID_REFRESH_TOKEN', 'refreshToken is required');
    }
    db.prepare('UPDATE refresh_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
      .run(Date.now(), hashToken(refreshToken));
    res.status(204).end();
  }));
  return { router, requireUser: auth.requireUser, requirePartner: auth.requirePartner };
}

export function issuePartnerKey(db, group) {
  if (!group || !/^[a-z0-9-]{3,32}$/.test(group)) throw new Error('Group slug must be 3–32 lowercase letters, digits or hyphens');
  const key = `bp_${randomBytes(32).toString('base64url')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  db.prepare('INSERT INTO api_keys(id,group_name,key_hash,created_at) VALUES(?,?,?,?)').run(randomUUID(), group, hash, now());
  return key;
}
