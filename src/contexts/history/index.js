import express from 'express';
import { calibratedBuffer } from './rules.js';
import { fail, isoJakarta, now, parseIsoInstant, wrap } from '../../shared.js';

export { calibratedBuffer } from './rules.js';

export function createHistoryContext(db, cfg, requireUser, recommendations) {
  function hasFeedback(recommendationId) {
    return Boolean(db.prepare('SELECT 1 FROM feedback WHERE recommendation_id=?').get(recommendationId));
  }
  function getBuffer(userId) {
    let row = db.prepare('SELECT buffer_minutes FROM calibration_profiles WHERE user_id=?').get(userId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO calibration_profiles(user_id,buffer_minutes,updated_at) VALUES(?,?,?)')
        .run(userId, cfg.defaultBuffer, now());
      row = db.prepare('SELECT buffer_minutes FROM calibration_profiles WHERE user_id=?').get(userId);
    }
    return row.buffer_minutes;
  }
  function getCalibration(userId) {
    return { currentBufferMinutes: getBuffer(userId), feedbackCount: db.prepare(`SELECT COUNT(*) AS count FROM feedback f
      JOIN recommendations r ON r.id=f.recommendation_id WHERE r.user_id=?`).get(userId).count };
  }
  const feedbackRouter = express.Router();
  feedbackRouter.use(requireUser);
  feedbackRouter.post('/:id/feedback', wrap((req, res) => {
    const rec = recommendations.getForUser(req.user.id, req.params.id);
    const arrived = parseIsoInstant(req.body?.arrivedAt);
    if (!arrived) fail(400, 'INVALID_FEEDBACK', 'arrivedAt must be an ISO 8601 timestamp with timezone');
    const delta = Math.round(((arrived.getTime() - new Date(rec.arrivalAt).getTime()) / 60_000) * 100) / 100;
    if (Math.abs(delta) > 24 * 60) fail(400, 'INVALID_FEEDBACK', 'Arrival differs from target by more than one day');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (db.prepare('SELECT 1 FROM feedback WHERE recommendation_id=?').get(rec.id)) fail(409, 'FEEDBACK_EXISTS', 'Feedback already submitted');
      const before = getBuffer(req.user.id);
      const after = calibratedBuffer(before, delta);
      db.prepare('INSERT INTO feedback(recommendation_id,arrived_at,delta_minutes,buffer_after,created_at) VALUES(?,?,?,?,?)')
        .run(rec.id, isoJakarta(arrived), delta, after, now());
      db.prepare('UPDATE calibration_profiles SET buffer_minutes=?,updated_at=? WHERE user_id=?').run(after, now(), req.user.id);
      db.exec('COMMIT');
      res.status(201).json({ recommendationId: rec.id, arrivedAt: isoJakarta(arrived), deltaMinutes: delta,
        bufferBefore: before, bufferAfter: after });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }));
  const historyRouter = express.Router();
  historyRouter.use(requireUser);
  historyRouter.get('/', wrap((req, res) => {
    const unique = new Map();
    for (const rec of recommendations.listForUser(req.user.id)) {
      const row = db.prepare('SELECT arrived_at,delta_minutes,buffer_after FROM feedback WHERE recommendation_id=?').get(rec.id);
      const item = { ...rec, feedback: row ? { arrivedAt: row.arrived_at, deltaMinutes: row.delta_minutes, bufferAfter: row.buffer_after } : null };
      const key = `${rec.scheduleId}:${rec.occurrenceDate}`;
      if (!unique.has(key) || (!unique.get(key).feedback && item.feedback)) unique.set(key, item);
    }
    res.json({ items: [...unique.values()].slice(0, 100) });
  }));
  return { getBuffer, getCalibration, hasFeedback, feedbackRouter, historyRouter };
}
