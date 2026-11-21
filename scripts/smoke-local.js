import { randomUUID } from 'node:crypto';
import { isoJakarta } from '../src/shared.js';

const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
async function request(path, method = 'GET', body, token) {
  const response = await fetch(base + path, { method, headers: {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }, body: body ? JSON.stringify(body) : undefined });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

try {
  await request('/api/health');
  const account = await request('/api/v1/auth/register', 'POST', {
    email: `smoke-${randomUUID()}@example.test`, password: randomUUID() + randomUUID()
  });
  const refreshed = await request('/api/v1/auth/refresh', 'POST', { refreshToken: account.refreshToken });
  const token = refreshed.token;
  const places = await request('/api/v1/places/search?q=Institut%20Teknologi%20Bandung', 'GET', undefined, token);
  if (!places.items.length) throw new Error('Place search returned no results');
  const date = isoJakarta(new Date(Date.now() + 86400_000)).slice(0, 10);
  const schedule = await request('/api/v1/schedules', 'POST', {
    title: 'Smoke test', origin: { label: 'Rumah', lat: -6.9, lng: 107.6 },
    destination: { label: 'Kampus ITB', lat: -6.8915, lng: 107.6107 },
    arrivalTime: '23:00', date, mode: 'car'
  }, token);
  const recommendation = await request(`/api/v1/schedules/${schedule.id}/recommendation?date=${date}`, 'GET', undefined, token);
  const manifest = await request('/api/v1/reminders/manifest?days=2', 'GET', undefined, token);
  if (!manifest.items.some(item => item.recommendation.id === recommendation.id)) throw new Error('Recommendation absent from manifest');
  await request('/api/v1/recommendations/' + recommendation.id + '/feedback', 'POST', {
    arrivedAt: new Date(new Date(recommendation.arrivalAt).getTime() + 6 * 60_000).toISOString()
  }, token);
  const history = await request('/api/v1/history', 'GET', undefined, token);
  if (!history.items.some(item => item.id === recommendation.id && item.feedback)) throw new Error('Feedback absent from history');
  await request('/api/v1/auth/logout', 'POST', { refreshToken: refreshed.refreshToken });
  console.log(JSON.stringify({ status: 'ok', placeResults: places.items.length, routeMinutes: recommendation.routeMinutes,
    weatherMinutes: recommendation.weatherMinutes, manifestItems: manifest.items.length, historyItems: history.items.length }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
