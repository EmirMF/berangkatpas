import express from 'express';
import { fail, wrap } from '../../shared.js';

const routeHosts = {
  walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  motorcycle: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving'
};
let routeQueue = Promise.resolve();
let nextRouteRequestAt = 0;
let placeQueue = Promise.resolve();
let nextPlaceRequestAt = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function queuedRouteRequest(task) {
  const result = routeQueue.then(async () => {
    const delay = Math.max(0, nextRouteRequestAt - Date.now());
    if (delay) await wait(delay);
    nextRouteRequestAt = Date.now() + 1100;
    return task();
  });
  routeQueue = result.catch(() => {});
  return result;
}
function queuedPlaceRequest(task) {
  const result = placeQueue.then(async () => {
    const delay = Math.max(0, nextPlaceRequestAt - Date.now());
    if (delay) await wait(delay);
    nextPlaceRequestAt = Date.now() + 1100;
    return task();
  });
  placeQueue = result.catch(() => {});
  return result;
}
function cached(db, key) {
  const row = db.prepare('SELECT body, fetched_at FROM provider_cache WHERE cache_key=?').get(key);
  return row ? { value: JSON.parse(row.body), ageMs: Date.now() - row.fetched_at } : null;
}
function save(db, key, value) {
  db.prepare('INSERT INTO provider_cache(cache_key, body, fetched_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET body=excluded.body, fetched_at=excluded.fetched_at')
    .run(key, JSON.stringify(value), Date.now());
}
async function jsonFetch(fetchImpl, url, timeoutMs) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: {
    'User-Agent': 'BerangkatPas/1.0 (https://berangkatpas.stei.site)', 'Accept-Language': 'id' } });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json();
}
const rounded = n => Number(n).toFixed(4);

export function externalAdapters(db, cfg, fetchImpl = fetch) {
  const routeInFlight = new Map();
  const forecastInFlight = new Map();
  const placeInFlight = new Map();
  async function route(origin, destination, mode, fresh = false) {
    const key = `route:${mode}:${rounded(origin.lat)},${rounded(origin.lng)}:${rounded(destination.lat)},${rounded(destination.lng)}`;
    const hit = cached(db, key);
    if (hit && hit.ageMs < (fresh ? 3600_000 : 24 * 3600_000)) return { ...hit.value, stale: false, cached: true };
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${routeHosts[mode]}/${coordinates}?overview=false`;
    if (routeInFlight.has(key)) return routeInFlight.get(key);
    const pending = (async () => {
      try {
        const data = await queuedRouteRequest(() => jsonFetch(fetchImpl, url, cfg.timeoutMs));
        if (data.code !== 'Ok' || !data.routes?.[0] || !Number.isFinite(data.routes[0].duration)) throw new Error('No route');
        const value = { minutes: Math.max(1, Math.ceil(data.routes[0].duration / 60)), provider: 'OSRM' };
        save(db, key, value);
        return { ...value, stale: false, cached: false };
      } catch {
        if (hit && hit.ageMs < 30 * 24 * 3600_000) return { ...hit.value, stale: true, cached: true };
        fail(503, 'ROUTE_UNAVAILABLE', 'Route estimate is unavailable; retry later');
      }
    })();
    routeInFlight.set(key, pending);
    try { return await pending; } finally { routeInFlight.delete(key); }
  }

  async function weather(destination, arrivalAt, fresh = false) {
    const hour = arrivalAt.slice(0, 13) + ':00';
    const key = `forecast:${rounded(destination.lat)},${rounded(destination.lng)}`;
    const hit = cached(db, key);
    let forecast = hit && hit.ageMs < (fresh ? 15 * 60_000 : 3600_000) ? hit.value : null;
    let stale = false;
    let fromCache = Boolean(forecast);
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', destination.lat);
    url.searchParams.set('longitude', destination.lng);
    url.searchParams.set('hourly', 'precipitation_probability');
    url.searchParams.set('timezone', 'Asia/Jakarta');
    url.searchParams.set('forecast_days', '16');
    if (!forecast) {
      if (!forecastInFlight.has(key)) {
        const pending = jsonFetch(fetchImpl, url, cfg.timeoutMs).then(data => {
          if (!Array.isArray(data.hourly?.time) || !Array.isArray(data.hourly?.precipitation_probability)) throw new Error('Invalid forecast');
          const value = { time: data.hourly.time, probability: data.hourly.precipitation_probability };
          save(db, key, value);
          return value;
        }).finally(() => forecastInFlight.delete(key));
        forecastInFlight.set(key, pending);
      }
      try { forecast = await forecastInFlight.get(key); }
      catch {
        if (hit && hit.ageMs < 6 * 3600_000) { forecast = hit.value; stale = true; fromCache = true; }
      }
    }
    const index = forecast?.time?.indexOf(hour) ?? -1;
    const probability = index >= 0 ? forecast.probability[index] : null;
    if (!Number.isFinite(probability)) return { probability: null, provider: 'Open-Meteo', stale: true, cached: fromCache, unavailable: true };
    return { probability, provider: 'Open-Meteo', stale, cached: fromCache, unavailable: false };
  }

  const attribution = '© OpenStreetMap contributors';
  function placeDto(value) {
    const lat = Number(value.lat), lng = Number(value.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) && typeof value.display_name === 'string'
      ? { label: value.display_name, lat, lng, provider: 'Nominatim' } : null;
  }
  async function placeRequest(key, url, mapResult) {
    const hit = cached(db, key);
    if (hit && hit.ageMs < 7 * 24 * 3600_000) return { value: hit.value, stale: false };
    if (placeInFlight.has(key)) return placeInFlight.get(key);
    const pending = (async () => {
      try {
        const data = await queuedPlaceRequest(() => jsonFetch(fetchImpl, url, cfg.timeoutMs));
        const value = mapResult(data);
        save(db, key, value);
        return { value, stale: false };
      } catch {
        if (hit && hit.ageMs < 30 * 24 * 3600_000) return { value: hit.value, stale: true };
        fail(503, 'PLACE_UNAVAILABLE', 'Place search is unavailable; retry later');
      }
    })();
    placeInFlight.set(key, pending);
    try { return await pending; } finally { placeInFlight.delete(key); }
  }
  const placesRouter = express.Router();
  placesRouter.get('/search', wrap(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 3 || q.length > 100) fail(400, 'INVALID_QUERY', 'q must be 3–100 characters');
    const url = new URL('/search', cfg.geocodingBaseUrl || 'https://nominatim.openstreetmap.org');
    for (const [name, value] of Object.entries({ q, format: 'jsonv2', limit: '5', countrycodes: 'id',
      viewbox: '107.45,-6.75,107.8,-7.1', bounded: '1', addressdetails: '0' })) url.searchParams.set(name, value);
    const result = await placeRequest(`place-search:${q.toLowerCase()}`, url,
      data => Array.isArray(data) ? data.map(placeDto).filter(Boolean) : []);
    res.json({ items: result.value, attribution, stale: result.stale });
  }));
  placesRouter.get('/reverse', wrap(async (req, res) => {
    const lat = Number(req.query.lat), lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -7.1 || lat > -6.75 || lng < 107.45 || lng > 107.8) {
      fail(400, 'OUT_OF_AREA', 'Coordinates must be within the Bandung pilot area');
    }
    const url = new URL('/reverse', cfg.geocodingBaseUrl || 'https://nominatim.openstreetmap.org');
    for (const [name, value] of Object.entries({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18' })) url.searchParams.set(name, value);
    const result = await placeRequest(`place-reverse:${rounded(lat)},${rounded(lng)}`, url, placeDto);
    res.json({ place: result.value, attribution, stale: result.stale });
  }));
  return { route, weather, placesRouter };
}
