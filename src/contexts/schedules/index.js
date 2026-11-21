import express from 'express';
import { randomUUID } from 'node:crypto';
import { fail, now, validDate, wrap } from '../../shared.js';

export const modes = ['walk', 'motorcycle', 'car'];
function validPoint(value) {
  return value && typeof value.lat === 'number' && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90 &&
    typeof value.lng === 'number' && Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180;
}
export function validateSchedule(input) {
  if (!input || !validPoint(input.origin) || !validPoint(input.destination)) fail(400, 'INVALID_SCHEDULE', 'Valid origin and destination coordinates are required');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.arrivalTime || '')) fail(400, 'INVALID_SCHEDULE', 'arrivalTime must be HH:mm');
  if (!modes.includes(input.mode)) fail(400, 'INVALID_SCHEDULE', 'Unsupported travel mode');
  const hasDate = input.date !== undefined && input.date !== null;
  const hasWeekdays = input.weekdays !== undefined && input.weekdays !== null;
  if (hasDate === hasWeekdays) fail(400, 'INVALID_SCHEDULE', 'Set exactly one of date or weekdays');
  if (hasDate && !validDate(input.date)) fail(400, 'INVALID_SCHEDULE', 'Invalid date');
  if (hasWeekdays && (!Array.isArray(input.weekdays) || !input.weekdays.length ||
      input.weekdays.some(x => !Number.isInteger(x) || x < 0 || x > 6) || new Set(input.weekdays).size !== input.weekdays.length)) {
    fail(400, 'INVALID_SCHEDULE', 'weekdays must be unique integers from 0 (Sunday) to 6');
  }
  function optionalText(value, limit, field) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) fail(400, 'INVALID_SCHEDULE', `${field} must be 1–${limit} characters`);
    return value.trim();
  }
  const title = optionalText(input.title, 80, 'title');
  const originLabel = optionalText(input.origin.label, 120, 'origin.label');
  const destinationLabel = optionalText(input.destination.label, 120, 'destination.label');
  const preparationMinutes = input.preparationMinutes ?? 0;
  if (!Number.isInteger(preparationMinutes) || preparationMinutes < 0 || preparationMinutes > 120) {
    fail(400, 'INVALID_SCHEDULE', 'preparationMinutes must be an integer from 0 to 120');
  }
  return { title, origin: { lat: input.origin.lat, lng: input.origin.lng, label: originLabel },
    destination: { lat: input.destination.lat, lng: input.destination.lng, label: destinationLabel }, arrivalTime: input.arrivalTime,
    date: hasDate ? input.date : null, weekdays: hasWeekdays ? [...input.weekdays].sort() : null, mode: input.mode, preparationMinutes };
}
export function occurrenceAllowed(schedule, date) {
  if (!validDate(date)) return false;
  if (schedule.date) return schedule.date === date;
  return schedule.weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
}
function dto(row) {
  return { id: row.id, title: row.title || row.destination_label || 'Perjalanan',
    origin: { lat: row.origin_lat, lng: row.origin_lng, label: row.origin_label },
    destination: { lat: row.destination_lat, lng: row.destination_lng, label: row.destination_label }, arrivalTime: row.arrival_time,
    date: row.travel_date, weekdays: row.weekdays ? JSON.parse(row.weekdays) : null,
    mode: row.mode, preparationMinutes: row.preparation_minutes, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at };
}
export function createSchedulesContext(db, requireUser) {
  function getForUser(userId, id) {
    const row = db.prepare('SELECT * FROM schedules WHERE id=? AND user_id=?').get(id, userId);
    if (!row) fail(404, 'NOT_FOUND', 'Schedule not found');
    return dto(row);
  }
  function listActiveForUser(userId) {
    return db.prepare('SELECT * FROM schedules WHERE user_id=? AND active=1 ORDER BY created_at DESC').all(userId).map(dto);
  }
  const router = express.Router();
  router.use(requireUser);
  router.get('/', wrap((req, res) => {
    const rows = db.prepare('SELECT * FROM schedules WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
    res.json({ items: rows.map(dto) });
  }));
  router.post('/', wrap((req, res) => {
    const s = validateSchedule(req.body);
    const id = randomUUID(); const timestamp = now();
    db.prepare(`INSERT INTO schedules(id,user_id,origin_lat,origin_lng,destination_lat,destination_lng,arrival_time,travel_date,weekdays,mode,active,created_at,updated_at,title,origin_label,destination_label,preparation_minutes)
      VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)`).run(id, req.user.id, s.origin.lat, s.origin.lng, s.destination.lat, s.destination.lng,
      s.arrivalTime, s.date, s.weekdays ? JSON.stringify(s.weekdays) : null, s.mode, timestamp, timestamp,
      s.title, s.origin.label, s.destination.label, s.preparationMinutes);
    res.status(201).json(getForUser(req.user.id, id));
  }));
  router.get('/:id', wrap((req, res) => res.json(getForUser(req.user.id, req.params.id))));
  router.put('/:id', wrap((req, res) => {
    getForUser(req.user.id, req.params.id);
    const s = validateSchedule(req.body);
    db.prepare(`UPDATE schedules SET origin_lat=?,origin_lng=?,destination_lat=?,destination_lng=?,arrival_time=?,travel_date=?,weekdays=?,mode=?,title=?,origin_label=?,destination_label=?,preparation_minutes=?,active=1,updated_at=? WHERE id=? AND user_id=?`)
      .run(s.origin.lat, s.origin.lng, s.destination.lat, s.destination.lng, s.arrivalTime, s.date,
        s.weekdays ? JSON.stringify(s.weekdays) : null, s.mode, s.title, s.origin.label, s.destination.label, s.preparationMinutes,
        now(), req.params.id, req.user.id);
    res.json(getForUser(req.user.id, req.params.id));
  }));
  router.delete('/:id', wrap((req, res) => {
    getForUser(req.user.id, req.params.id);
    db.prepare('UPDATE schedules SET active=0,updated_at=? WHERE id=? AND user_id=?').run(now(), req.params.id, req.user.id);
    res.status(204).end();
  }));
  return { router, getForUser, listActiveForUser, validateInput: validateSchedule, occurrenceAllowed };
}
