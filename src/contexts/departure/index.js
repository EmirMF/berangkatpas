import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { arrivalDate, fail, isoJakarta, now, wrap } from '../../shared.js';
import { computeRecommendation } from './rules.js';

export { computeRecommendation } from './rules.js';

export function createDepartureContext(db, cfg, { schedules, history, external, requireUser, requirePartner }) {
  async function calculate(input, date, bufferMinutes, { fresh = false, calibration = null } = {}) {
    const arrivalAt = isoJakarta(arrivalDate(date, input.arrivalTime));
    const [route, weather] = await Promise.all([
      external.route(input.origin, input.destination, input.mode, fresh),
      external.weather(input.destination, arrivalAt, fresh)
    ]);
    return computeRecommendation({ date, arrivalTime: input.arrivalTime, routeMinutes: route.minutes,
      rainProbability: weather.probability, mode: input.mode, bufferMinutes,
      preparationMinutes: input.preparationMinutes, origin: input.origin, destination: input.destination, calibration, config: cfg,
      source: { route: { provider: route.provider, stale: route.stale, cached: route.cached },
        weather: { provider: weather.provider, stale: weather.stale, cached: weather.cached, unavailable: Boolean(weather.unavailable) } } });
  }
  function recordDto(r) {
    return { id: r.id, scheduleId: r.schedule_id, occurrenceDate: r.occurrence_date, revision: r.revision,
      arrivalAt: r.arrival_at, departAt: r.depart_at, routeMinutes: r.route_minutes,
      weatherMinutes: r.weather_minutes, bufferMinutes: r.buffer_minutes,
      totalMinutes: r.route_minutes + r.weather_minutes + r.buffer_minutes,
      source: JSON.parse(r.source_info), ...(r.result_json ? JSON.parse(r.result_json) : {}) };
  }
  function getForUser(userId, id) {
    const row = db.prepare('SELECT * FROM recommendations WHERE id=? AND user_id=?').get(id, userId);
    if (!row) fail(404, 'NOT_FOUND', 'Recommendation not found');
    return recordDto(row);
  }
  function listForUser(userId) {
    return db.prepare('SELECT * FROM recommendations WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 500').all(userId).map(recordDto);
  }
  async function getOrCreate(userId, s, date) {
    const previous = db.prepare(`SELECT * FROM recommendations WHERE user_id=? AND schedule_id=? AND occurrence_date=?
      ORDER BY created_at DESC,rowid DESC LIMIT 1`).get(userId, s.id, date);
    if (previous && history.hasFeedback(previous.id)) return recordDto(previous);
    const calibration = history.getCalibration(userId);
    const near = departAt => {
      const remaining = new Date(departAt).getTime() - Date.now();
      return remaining >= 0 && remaining <= 2 * 3600_000;
    };
    let result = await calculate(s, date, calibration.currentBufferMinutes, { fresh: previous ? near(previous.depart_at) : false, calibration });
    if (!previous && near(result.departAt)) {
      result = await calculate(s, date, calibration.currentBufferMinutes, { fresh: true, calibration });
    }
    const fingerprint = { scheduleUpdatedAt: s.updatedAt, title: s.title, originLabel: s.origin.label,
      destinationLabel: s.destination.label, arrivalAt: result.arrivalAt, departAt: result.departAt,
      routeMinutes: result.routeMinutes, weatherMinutes: result.weatherMinutes, bufferMinutes: result.bufferMinutes,
      rainProbability: result.rainProbability, mode: result.mode, estimate: result.estimate,
      routeStale: result.source.route.stale, weatherStale: result.source.weather.stale,
      weatherUnavailable: result.source.weather.unavailable, preparationMinutes: result.preparationMinutes,
      feedbackCount: calibration.feedbackCount };
    const revision = createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex').slice(0, 20);
    if (previous?.revision === revision) return recordDto(previous);
    const id = randomUUID();
    db.prepare(`INSERT INTO recommendations(id,user_id,schedule_id,occurrence_date,arrival_at,depart_at,route_minutes,weather_minutes,buffer_minutes,source_info,created_at,revision,result_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, userId, s.id, date, result.arrivalAt, result.departAt,
      result.routeMinutes, result.weatherMinutes, result.bufferMinutes, JSON.stringify(result.source), now(), revision, JSON.stringify(result));
    return { id, scheduleId: s.id, occurrenceDate: date, revision, ...result };
  }
  const scheduleRouter = express.Router();
  scheduleRouter.get('/:id/recommendation', requireUser, wrap(async (req, res) => {
    const s = schedules.getForUser(req.user.id, req.params.id);
    const date = req.query.date;
    if (!s.active || !schedules.occurrenceAllowed(s, date)) {
      fail(400, 'INVALID_OCCURRENCE', 'Date is not an active occurrence of this schedule');
    }
    res.json(await getOrCreate(req.user.id, s, date));
  }));
  scheduleRouter.get('/:id/mode-comparison', requireUser, wrap(async (req, res) => {
    const s = schedules.getForUser(req.user.id, req.params.id);
    const date = req.query.date;
    if (!s.active || !schedules.occurrenceAllowed(s, date)) {
      fail(400, 'INVALID_OCCURRENCE', 'Date is not an active occurrence of this schedule');
    }
    const calibration = history.getCalibration(req.user.id);
    const modes = ['walk', 'motorcycle', 'car'];
    const results = await Promise.allSettled(modes.map(mode => calculate({ ...s, mode }, date, calibration.currentBufferMinutes, { calibration })));
    res.json({ scheduleId: s.id, occurrenceDate: date, options: results.map((result, index) => result.status === 'fulfilled'
      ? { mode: modes[index], ...result.value }
      : { mode: modes[index], error: { code: result.reason.code || 'RECOMMENDATION_UNAVAILABLE', message: result.reason.message || 'Estimate unavailable' } }) });
  }));
  const previewRouter = express.Router();
  previewRouter.post('/preview', requirePartner, wrap(async (req, res) => {
    const s = schedules.validateInput(req.body);
    if (!s.date) fail(400, 'INVALID_OCCURRENCE', 'Preview requires a one-time date');
    const result = await calculate(s, s.date, cfg.defaultBuffer);
    res.json({ arrivalAt: result.arrivalAt, departAt: result.departAt, totalMinutes: result.totalMinutes,
      routeMinutes: result.routeMinutes, weatherMinutes: result.weatherMinutes, bufferMinutes: result.bufferMinutes,
      estimate: result.estimate, sourceStatus: {
        route: result.source.route.stale ? 'stale' : 'available',
        weather: result.source.weather.unavailable ? 'unavailable' : result.source.weather.stale ? 'stale' : 'available'
      } });
  }));
  const manifestRouter = express.Router();
  manifestRouter.get('/manifest', requireUser, wrap(async (req, res) => {
    const days = req.query.days === undefined ? 7 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 1 || days > 7) fail(400, 'INVALID_DAYS', 'days must be an integer from 1 to 7');
    const current = new Date();
    const startDate = isoJakarta(current).slice(0, 10);
    const startUtc = new Date(`${startDate}T00:00:00Z`);
    const items = [], errors = [];
    for (const s of schedules.listActiveForUser(req.user.id)) {
      for (let offset = 0; offset < days; offset++) {
        const date = new Date(startUtc.getTime() + offset * 86400_000).toISOString().slice(0, 10);
        if (!schedules.occurrenceAllowed(s, date) || arrivalDate(date, s.arrivalTime) <= current) continue;
        try {
          const rec = await getOrCreate(req.user.id, s, date);
          if (new Date(rec.departAt) <= current) continue;
          items.push({ reminderKey: `${s.id}:${date}`, scheduleId: s.id, title: s.title,
            origin: s.origin, destination: s.destination, occurrenceDate: date, recommendation: rec, revision: rec.revision });
        } catch (error) {
          errors.push({ scheduleId: s.id, occurrenceDate: date, code: error.code || 'RECOMMENDATION_UNAVAILABLE' });
        }
      }
    }
    items.sort((a, b) => a.recommendation.departAt.localeCompare(b.recommendation.departAt));
    res.json({ generatedAt: isoJakarta(current), items, errors });
  }));
  return { scheduleRouter, previewRouter, manifestRouter, getForUser, listForUser };
}
