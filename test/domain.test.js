import test from 'node:test';
import assert from 'node:assert/strict';
import { calibratedBuffer } from '../src/contexts/history/rules.js';
import { computeRecommendation } from '../src/contexts/departure/rules.js';
import { occurrenceAllowed, validateSchedule } from '../src/contexts/schedules/index.js';

const cfg = { rainThreshold: 50, rainExtra: { walk: .2, motorcycle: .15, car: .1 } };
test('departure crosses midnight and contains a full breakdown', () => {
  const r = computeRecommendation({ date: '2026-11-25', arrivalTime: '00:10', routeMinutes: 30,
    rainProbability: 70, mode: 'walk', bufferMinutes: 10, config: cfg, source: {} });
  assert.equal(r.departAt, '2026-11-24T23:24:00+07:00');
  assert.equal(r.weatherMinutes, 6);
  assert.equal(r.totalMinutes, 46);
});
test('preparation and staged reminders cross midnight without changing departure', () => {
  const input = { date: '2026-11-25', arrivalTime: '00:10', routeMinutes: 30,
    rainProbability: 70, mode: 'walk', bufferMinutes: 10, config: cfg, source: {},
    origin: { lat: -6.9, lng: 107.6 }, destination: { lat: -6.8, lng: 107.7 } };
  const r = computeRecommendation({ ...input, preparationMinutes: 20 });
  assert.equal(r.departAt, '2026-11-24T23:24:00+07:00');
  assert.equal(r.prepareAt, '2026-11-24T23:04:00+07:00');
  assert.equal(r.reminderEvents.length, 2);
  assert.deepEqual(r.reminderEvents[0].kinds, ['prepare', 'departure_soon']);
  assert.equal(r.reasons.routeMinutes + r.reasons.weatherMinutes + r.reasons.bufferMinutes, r.totalMinutes);
  assert.match(r.navigationUrl, /openstreetmap.org\/directions/);
  assert.match(r.navigationUrl, /fossgis_osrm_foot/);
  const withoutPrep = computeRecommendation({ ...input, preparationMinutes: 0 });
  assert.equal(withoutPrep.departAt, r.departAt);
});
test('calibration is bounded per trip and overall', () => {
  assert.equal(calibratedBuffer(10, 40), 13);
  assert.equal(calibratedBuffer(1, -40), 0);
  assert.equal(calibratedBuffer(29, 40), 30);
});
test('recurrence and schedule validation', () => {
  const s = validateSchedule({ origin: { lat: -6.9, lng: 107.6 }, destination: { lat: -6.8, lng: 107.7 },
    arrivalTime: '08:00', mode: 'car', weekdays: [1, 3] });
  assert.equal(occurrenceAllowed(s, '2026-11-23'), true);
  assert.equal(occurrenceAllowed(s, '2026-11-24'), false);
  assert.throws(() => validateSchedule({ ...s, date: '2026-11-23', weekdays: [1] }));
});
