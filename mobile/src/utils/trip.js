import { toIsoWithOffset } from './time';

export const READY_LEAD_MIN = 10;
export const MISSED_GRACE_MIN = 30;
export const TRIP_TIMEOUT_MIN = 30;
export const ARRIVAL_PROMPT_DELAY_MIN = 5;

const MIN = 60000;

export function arrivalIso(date, arrivalTime) {
  return `${date}T${arrivalTime}:00+07:00`;
}

export function diffMinutes(fromIso, toIso) {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / MIN);
}

export function tripPhase({ departAt, arrivalAt, trip, now = new Date() }) {
  const t = now.getTime();
  const dep = new Date(departAt).getTime();
  if (Number.isNaN(dep)) return 'upcoming';
  const arr = arrivalAt ? new Date(arrivalAt).getTime() : dep + 60 * MIN;
  if (trip) {
    return t > arr + TRIP_TIMEOUT_MIN * MIN ? 'expired' : 'trip';
  }
  if (t < dep - READY_LEAD_MIN * MIN) return 'upcoming';
  if (t > arr + MISSED_GRACE_MIN * MIN) return 'missed';
  return 'ready';
}

export function readyLabel(minutes) {
  if (minutes === null || minutes === undefined) return '';
  if (minutes > 0) return `${minutes} menit lagi`;
  if (minutes === 0) return 'Berangkat sekarang';
  return `Telat ${-minutes} menit`;
}

export function departureNote(plannedIso, actualIso) {
  const d = diffMinutes(plannedIso, actualIso);
  if (d === null) return '';
  if (Math.abs(d) < 1) return 'tepat waktu';
  return d > 0 ? `telat ${d} mnt` : `lebih awal ${-d} mnt`;
}

export function arrivalPromptTime(arrivalAt, now = new Date()) {
  const base = new Date(arrivalAt).getTime() + ARRIVAL_PROMPT_DELAY_MIN * MIN;
  const earliest = now.getTime() + 10 * MIN;
  return new Date(Math.max(Number.isNaN(base) ? earliest : base, earliest));
}

export function stepArrival(iso, deltaMin, { minIso, maxDate = new Date() } = {}) {
  let ms = new Date(iso).getTime() + deltaMin * MIN;
  const lo = minIso ? new Date(minIso).getTime() : -Infinity;
  const hi = maxDate.getTime();
  if (Number.isNaN(ms)) ms = hi;
  ms = Math.min(Math.max(ms, lo), hi);
  return toIsoWithOffset(new Date(ms));
}