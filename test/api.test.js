import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { isoJakarta } from '../src/shared.js';

const cfg = { jwtSecret: 'test-secret-which-is-at-least-32-characters', timeoutMs: 1000,
  rainThreshold: 50, rainExtra: { walk: .2, motorcycle: .15, car: .1 }, defaultBuffer: 10 };
const schedule = { origin: { lat: -6.9, lng: 107.6 }, destination: { lat: -6.89, lng: 107.61 },
  arrivalTime: '08:00', date: '2026-11-25', mode: 'motorcycle' };
function mockFetch(url) {
  if (String(url).includes('open-meteo')) return Promise.resolve({ ok: true, json: async () => ({
    hourly: { time: ['2026-11-25T08:00'], precipitation_probability: [70] } }) });
  return Promise.resolve({ ok: true, json: async () => ({ code: 'Ok', routes: [{ duration: 1800 }] }) });
}
async function fixture(fetchImpl = mockFetch) {
  const db = openDb(':memory:');
  const server = createApp({ db, cfg, fetchImpl }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', body, headers = {}) {
    const r = await fetch(base + path, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  }
  return { db, base, request, close: async () => { await new Promise(resolve => server.close(resolve)); db.close(); } };
}
test('account, schedule, recommendation, feedback, ownership and partner key', async () => {
  const f = await fixture();
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'a@example.com', password: 'password123' });
    assert.equal(a.status, 201);
    const h = { Authorization: `Bearer ${a.body.token}` };
    const s = await f.request('/api/v1/schedules', 'POST', schedule, h);
    assert.equal(s.status, 201);
    const rec = await f.request(`/api/v1/schedules/${s.body.id}/recommendation?date=2026-11-25`, 'GET', undefined, h);
    assert.equal(rec.status, 200);
    assert.equal(rec.body.weatherMinutes, 5);
    assert.equal(rec.body.bufferMinutes, 10);
    assert.equal(rec.body.estimate, 'car_profile_proxy_for_motorcycle');
    const fb = await f.request(`/api/v1/recommendations/${rec.body.id}/feedback`, 'POST', { arrivedAt: '2026-11-25T08:06:00+07:00' }, h);
    assert.equal(fb.status, 201);
    assert.equal(fb.body.bufferAfter, 11.5);
    assert.equal(f.db.prepare('SELECT buffer_minutes FROM calibration_profiles WHERE user_id=?').get(a.body.user.id).buffer_minutes, 11.5);
    assert.equal(f.db.prepare('SELECT buffer_minutes FROM users WHERE id=?').get(a.body.user.id).buffer_minutes, 10);
    assert.equal((await f.request(`/api/v1/recommendations/${rec.body.id}/feedback`, 'POST', { arrivedAt: '2026-11-25T08:06:00+07:00' }, h)).status, 409);
    const b = await f.request('/api/v1/auth/register', 'POST', { email: 'b@example.com', password: 'password123' });
    assert.equal((await f.request(`/api/v1/schedules/${s.body.id}`, 'GET', undefined, { Authorization: `Bearer ${b.body.token}` })).status, 404);
    assert.equal((await f.request('/api/v1/recommendations/preview', 'POST', schedule)).status, 401);
    const key = 'bp_testkey';
    f.db.prepare('INSERT INTO api_keys(id,group_name,key_hash,created_at) VALUES(?,?,?,?)').run('k1', 'group-a', createHash('sha256').update(key).digest('hex'), new Date().toISOString());
    const preview = await f.request('/api/v1/recommendations/preview', 'POST', schedule, { 'X-API-Key': key });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.bufferMinutes, 10);
    assert.deepEqual(Object.keys(preview.body).sort(), ['arrivalAt', 'bufferMinutes', 'departAt', 'estimate', 'routeMinutes', 'sourceStatus', 'totalMinutes', 'weatherMinutes'].sort());
    assert.deepEqual(preview.body.sourceStatus, { route: 'available', weather: 'available' });
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM recommendations').get().count, 1);
  } finally { await f.close(); }
});
test('preparation, calibration, comparison, and partner isolation', async () => {
  const f = await fixture();
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'features@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const input = { ...schedule, preparationMinutes: 20 };
    const s = await f.request('/api/v1/schedules', 'POST', input, h);
    assert.equal(s.status, 201);
    assert.equal(s.body.preparationMinutes, 20);
    const rec = await f.request(`/api/v1/schedules/${s.body.id}/recommendation?date=${schedule.date}`, 'GET', undefined, h);
    assert.equal(rec.status, 200);
    assert.equal(rec.body.calibration.currentBufferMinutes, 10);
    assert.equal(rec.body.calibration.feedbackCount, 0);
    assert.equal(rec.body.reminderEvents.length, 2);
    assert.match(rec.body.navigationUrl, /fossgis_osrm_car/);
    const comparison = await f.request(`/api/v1/schedules/${s.body.id}/mode-comparison?date=${schedule.date}`, 'GET', undefined, h);
    assert.equal(comparison.status, 200);
    assert.deepEqual(comparison.body.options.map(x => x.mode), ['walk', 'motorcycle', 'car']);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM recommendations').get().count, 1);
    assert.equal((await f.request('/api/v1/schedules', 'POST', { ...input, preparationMinutes: 121 }, h)).status, 400);
    const b = await f.request('/api/v1/auth/register', 'POST', { email: 'otherfeatures@example.com', password: 'password123' });
    assert.equal((await f.request(`/api/v1/schedules/${s.body.id}/mode-comparison?date=${schedule.date}`, 'GET', undefined,
      { Authorization: `Bearer ${b.body.token}` })).status, 404);
  } finally { await f.close(); }
});
test('weather outage degrades clearly; routing outage returns 503', async () => {
  const weatherFails = await fixture(url => String(url).includes('open-meteo') ? Promise.reject(new Error('offline')) : mockFetch(url));
  try {
    const a = await weatherFails.request('/api/v1/auth/register', 'POST', { email: 'a@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const s = await weatherFails.request('/api/v1/schedules', 'POST', schedule, h);
    const r = await weatherFails.request(`/api/v1/schedules/${s.body.id}/recommendation?date=2026-11-25`, 'GET', undefined, h);
    assert.equal(r.status, 200);
    assert.equal(r.body.rainProbability, null);
    assert.equal(r.body.source.weather.unavailable, true);
  } finally { await weatherFails.close(); }
  const routeFails = await fixture(() => Promise.reject(new Error('offline')));
  try {
    const a = await routeFails.request('/api/v1/auth/register', 'POST', { email: 'a@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const s = await routeFails.request('/api/v1/schedules', 'POST', schedule, h);
    const r = await routeFails.request(`/api/v1/schedules/${s.body.id}/recommendation?date=2026-11-25`, 'GET', undefined, h);
    assert.equal(r.status, 503);
  } finally { await routeFails.close(); }
});
test('Swagger UI and YAML contract are served', async () => {
  const f = await fixture();
  try {
    const page = await fetch(f.base + '/api/docs/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Swagger UI/);
    const stylesheet = await fetch(f.base + '/api/docs/swagger-ui.css');
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get('content-type'), /text\/css/);
    const contract = await fetch(f.base + '/api/openapi.yaml');
    assert.equal(contract.status, 200);
    const yaml = await contract.text();
    assert.match(yaml, /BearerAuth/);
    assert.match(yaml, /PartnerKey/);
    assert.match(yaml, /Same host as Swagger UI/);
  } finally { await f.close(); }
});
test('refresh tokens rotate, can be revoked, and me returns the account', async () => {
  const f = await fixture();
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'session@example.com', password: 'password123' });
    assert.equal(a.status, 201);
    assert.equal(a.body.expiresInSeconds, 900);
    assert.ok(a.body.refreshToken.startsWith('bpr_'));
    const me = await f.request('/api/v1/auth/me', 'GET', undefined, { Authorization: `Bearer ${a.body.token}` });
    assert.equal(me.body.user.email, 'session@example.com');
    const next = await f.request('/api/v1/auth/refresh', 'POST', { refreshToken: a.body.refreshToken });
    assert.equal(next.status, 200);
    assert.notEqual(next.body.refreshToken, a.body.refreshToken);
    assert.equal((await f.request('/api/v1/auth/refresh', 'POST', { refreshToken: a.body.refreshToken })).status, 401);
    assert.equal((await f.request('/api/v1/auth/logout', 'POST', { refreshToken: next.body.refreshToken })).status, 204);
    assert.equal((await f.request('/api/v1/auth/refresh', 'POST', { refreshToken: next.body.refreshToken })).status, 401);
    const stored = f.db.prepare('SELECT token_hash FROM refresh_sessions LIMIT 1').get().token_hash;
    assert.notEqual(stored, a.body.refreshToken);
  } finally { await f.close(); }
});
test('places are normalized, cached and restricted to Bandung', async () => {
  let calls = 0;
  const f = await fixture(url => {
    if (String(url).includes('nominatim')) {
      calls++;
      const value = { display_name: 'Institut Teknologi Bandung, Bandung', lat: '-6.8915', lon: '107.6107' };
      return Promise.resolve({ ok: true, json: async () => String(url).includes('/reverse') ? value : [value] });
    }
    return mockFetch(url);
  });
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'places@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const first = await f.request('/api/v1/places/search?q=ITB', 'GET', undefined, h);
    assert.equal(first.status, 200);
    assert.equal(first.body.items[0].lat, -6.8915);
    assert.match(first.body.attribution, /OpenStreetMap/);
    assert.equal((await f.request('/api/v1/places/search?q=ITB', 'GET', undefined, h)).status, 200);
    assert.equal(calls, 1);
    const reverse = await f.request('/api/v1/places/reverse?lat=-6.8915&lng=107.6107', 'GET', undefined, h);
    assert.equal(reverse.body.place.label, 'Institut Teknologi Bandung, Bandung');
    assert.equal((await f.request('/api/v1/places/reverse?lat=0&lng=0', 'GET', undefined, h)).status, 400);
    assert.equal((await f.request('/api/v1/places/search?q=a', 'GET', undefined, h)).status, 400);
  } finally { await f.close(); }
});
test('place provider outage returns 503 or a marked stale cache', async () => {
  let available = true;
  const f = await fixture(url => {
    if (String(url).includes('nominatim')) return available
      ? Promise.resolve({ ok: true, json: async () => [{ display_name: 'Kampus Bandung', lat: '-6.89', lon: '107.61' }] })
      : Promise.reject(new Error('offline'));
    return mockFetch(url);
  });
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'placefail@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    assert.equal((await f.request('/api/v1/places/search?q=Kampus', 'GET', undefined, h)).status, 200);
    available = false;
    f.db.prepare("UPDATE provider_cache SET fetched_at=? WHERE cache_key LIKE 'place-search:%'")
      .run(Date.now() - 8 * 24 * 3600_000);
    const stale = await f.request('/api/v1/places/search?q=Kampus', 'GET', undefined, h);
    assert.equal(stale.status, 200);
    assert.equal(stale.body.stale, true);
    const outage = await f.request('/api/v1/places/search?q=Gedung', 'GET', undefined, h);
    assert.equal(outage.status, 503);
  } finally { await f.close(); }
});
test('manifest reuses unchanged recommendation and replaces it after forecast change', async () => {
  const date = isoJakarta(new Date(Date.now() + 86400_000)).slice(0, 10);
  let probability = 20;
  const f = await fixture(url => {
    if (String(url).includes('open-meteo')) return Promise.resolve({ ok: true, json: async () => ({
      hourly: { time: [`${date}T23:00`], precipitation_probability: [probability] } }) });
    return mockFetch(url);
  });
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'manifest@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const input = { ...schedule, title: 'Kuliah', origin: { ...schedule.origin, label: 'Rumah' },
      destination: { ...schedule.destination, label: 'Kampus' }, date, arrivalTime: '23:00' };
    const s = await f.request('/api/v1/schedules', 'POST', input, h);
    assert.equal(s.status, 201);
    assert.equal(s.body.title, 'Kuliah');
    assert.equal(s.body.destination.label, 'Kampus');
    const one = await f.request(`/api/v1/schedules/${s.body.id}/recommendation?date=${date}`, 'GET', undefined, h);
    const two = await f.request(`/api/v1/schedules/${s.body.id}/recommendation?date=${date}`, 'GET', undefined, h);
    assert.equal(one.body.id, two.body.id);
    const manifest = await f.request('/api/v1/reminders/manifest?days=2', 'GET', undefined, h);
    assert.equal(manifest.status, 200);
    assert.equal(manifest.body.items.length, 1);
    assert.equal(manifest.body.items[0].recommendation.id, one.body.id);
    assert.equal(manifest.body.items[0].reminderKey, `${s.body.id}:${date}`);
    probability = 70;
    f.db.prepare("UPDATE provider_cache SET fetched_at=0 WHERE cache_key LIKE 'forecast:%'").run();
    const changed = await f.request('/api/v1/reminders/manifest?days=2', 'GET', undefined, h);
    assert.equal(changed.status, 200);
    assert.notEqual(changed.body.items[0].revision, manifest.body.items[0].revision);
    assert.equal(changed.body.items[0].recommendation.weatherMinutes, 5);
    const history = await f.request('/api/v1/history', 'GET', undefined, h);
    assert.equal(history.body.items.length, 1);
    assert.equal(history.body.items[0].id, changed.body.items[0].recommendation.id);
  } finally { await f.close(); }
});
test('manifest includes recurring occurrences and reports route errors per occurrence', async () => {
  const firstDate = isoJakarta(new Date(Date.now() + 86400_000)).slice(0, 10);
  const secondDate = isoJakarta(new Date(Date.now() + 2 * 86400_000)).slice(0, 10);
  const weekdays = [firstDate, secondDate].map(d => new Date(`${d}T00:00:00Z`).getUTCDay());
  const f = await fixture(url => String(url).includes('routed-car') ? Promise.reject(new Error('offline')) : mockFetch(url));
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'partial@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const s = await f.request('/api/v1/schedules', 'POST', { ...schedule, date: undefined, weekdays,
      arrivalTime: '23:00', mode: 'car' }, h);
    assert.equal(s.status, 201);
    const manifest = await f.request('/api/v1/reminders/manifest?days=3', 'GET', undefined, h);
    assert.equal(manifest.status, 200);
    assert.equal(manifest.body.items.length, 0);
    assert.equal(manifest.body.errors.length, 2);
    assert.equal(manifest.body.errors[0].code, 'ROUTE_UNAVAILABLE');
  } finally { await f.close(); }
});
test('near departure refreshes aged route and weather caches and changes revision', async () => {
  const arrival = isoJakarta(new Date(Date.now() + 90 * 60_000));
  const date = arrival.slice(0, 10), arrivalTime = arrival.slice(11, 16);
  let duration = 600, probability = 20;
  const f = await fixture(url => String(url).includes('open-meteo')
    ? Promise.resolve({ ok: true, json: async () => ({ hourly: { time: [`${date}T${arrivalTime.slice(0, 2)}:00`], precipitation_probability: [probability] } }) })
    : Promise.resolve({ ok: true, json: async () => ({ code: 'Ok', routes: [{ duration }] }) }));
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'fresh@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const s = await f.request('/api/v1/schedules', 'POST', { ...schedule, date, arrivalTime, mode: 'walk' }, h);
    const path = `/api/v1/schedules/${s.body.id}/recommendation?date=${date}`;
    const first = await f.request(path, 'GET', undefined, h);
    assert.equal(first.status, 200);
    duration = 1200; probability = 70;
    f.db.prepare("UPDATE provider_cache SET fetched_at=? WHERE cache_key LIKE 'route:%'").run(Date.now() - 61 * 60_000);
    f.db.prepare("UPDATE provider_cache SET fetched_at=? WHERE cache_key LIKE 'forecast:%'").run(Date.now() - 16 * 60_000);
    const changed = await f.request(path, 'GET', undefined, h);
    assert.equal(changed.status, 200);
    assert.notEqual(changed.body.revision, first.body.revision);
    assert.equal(changed.body.routeMinutes, 20);
    assert.equal(changed.body.weatherMinutes, 4);
    const same = await f.request(path, 'GET', undefined, h);
    assert.equal(same.body.id, changed.body.id);
  } finally { await f.close(); }
});
test('mode comparison keeps successful modes when one route provider fails', async () => {
  const f = await fixture(url => String(url).includes('routed-foot') ? Promise.reject(new Error('offline')) : mockFetch(url));
  try {
    const a = await f.request('/api/v1/auth/register', 'POST', { email: 'comparepartial@example.com', password: 'password123' });
    const h = { Authorization: `Bearer ${a.body.token}` };
    const s = await f.request('/api/v1/schedules', 'POST', schedule, h);
    const r = await f.request(`/api/v1/schedules/${s.body.id}/mode-comparison?date=${schedule.date}`, 'GET', undefined, h);
    assert.equal(r.status, 200);
    assert.equal(r.body.options[0].error.code, 'ROUTE_UNAVAILABLE');
    assert.equal(r.body.options[1].estimate, 'car_profile_proxy_for_motorcycle');
    assert.ok(r.body.options[2].departAt);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM recommendations').get().count, 0);
  } finally { await f.close(); }
});
