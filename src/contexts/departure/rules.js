import { arrivalDate, isoJakarta } from '../../shared.js';

export function computeRecommendation({ date, arrivalTime, routeMinutes, rainProbability, mode, bufferMinutes, preparationMinutes = 0, origin, destination, calibration, config, source }) {
  const arrival = arrivalDate(date, arrivalTime);
  const weatherMinutes = rainProbability !== null && rainProbability >= config.rainThreshold
    ? Math.ceil(routeMinutes * config.rainExtra[mode]) : 0;
  const totalMinutes = routeMinutes + weatherMinutes + bufferMinutes;
  const depart = new Date(arrival.getTime() - totalMinutes * 60_000);
  const prepareAt = isoJakarta(new Date(depart.getTime() - preparationMinutes * 60_000));
  const events = new Map();
  function addEvent(time, kind) {
    const at = isoJakarta(time);
    if (!events.has(at)) events.set(at, { at, kinds: [] });
    events.get(at).kinds.push(kind);
  }
  if (preparationMinutes > 0) addEvent(new Date(depart.getTime() - preparationMinutes * 60_000), 'prepare');
  addEvent(new Date(depart.getTime() - 20 * 60_000), 'departure_soon');
  addEvent(depart, 'depart');
  const reminderEvents = [...events.values()].sort((a, b) => a.at.localeCompare(b.at));
  const engine = mode === 'walk' ? 'fossgis_osrm_foot' : 'fossgis_osrm_car';
  const route = origin && destination ? `${origin.lat},${origin.lng};${destination.lat},${destination.lng}` : null;
  const navigationUrl = route ? `https://www.openstreetmap.org/directions?engine=${engine}&route=${encodeURIComponent(route)}` : null;
  return { arrivalAt: isoJakarta(arrival), departAt: isoJakarta(depart), prepareAt, preparationMinutes, reminderEvents,
    reasons: { routeMinutes, weatherMinutes, bufferMinutes }, calibration: calibration ?? null, navigationUrl, routeMinutes,
    weatherMinutes, bufferMinutes, totalMinutes, rainProbability, mode,
    estimate: mode === 'motorcycle' ? 'car_profile_proxy_for_motorcycle' : null, source };
}
