export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const WIB_OFFSET_MS = 7 * 3600_000;

export function jakartaParts(date = new Date()) {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    time: shifted.toISOString().slice(11, 16),
    weekday: shifted.getUTCDay(),
  };
}

export function todayJakarta(now = new Date()) {
  return jakartaParts(now).date;
}

export function clockOf(iso) {
  return typeof iso === 'string' && iso.length >= 16 ? iso.slice(11, 16) : '--:--';
}

export function formatDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return '-';
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${DAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateTime(iso) {
  if (typeof iso !== 'string' || iso.length < 16) return '-';
  return `${formatDate(iso.slice(0, 10))} · ${clockOf(iso)} WIB`;
}

export function weekdaysLabel(weekdays) {
  if (!Array.isArray(weekdays) || !weekdays.length) return '';
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Setiap hari';
  const monToFri = [1, 2, 3, 4, 5];
  if (sorted.length === 5 && monToFri.every((d, i) => sorted[i] === d)) return 'Senin–Jumat';
  return sorted.map((d) => DAY_SHORT[d]).join(', ');
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nextOccurrence(schedule, now = new Date()) {
  const { date: today, time } = jakartaParts(now);
  if (schedule.date) return schedule.date >= today ? schedule.date : null;
  if (!Array.isArray(schedule.weekdays)) return null;
  for (let i = 0; i < 8; i++) {
    const date = addDays(today, i);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (!schedule.weekdays.includes(weekday)) continue;
    if (i === 0 && schedule.arrivalTime <= time) continue;
    return date;
  }
  return null;
}

export function minutesLabel(minutes) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} j ${rest} mnt` : `${h} j`;
}

export function formatDelta(deltaMinutes) {
  const rounded = Math.round(deltaMinutes * 10) / 10;
  if (Math.abs(rounded) < 0.5) return 'Tepat waktu';
  const abs = Math.abs(rounded);
  return rounded > 0 ? `Terlambat ${abs} mnt` : `Lebih awal ${abs} mnt`;
}

export function toIsoWithOffset(date = new Date()) {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return shifted.toISOString().slice(0, 19) + '+07:00';
}

const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function longDate(now = new Date()) {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  return `${DAY_NAMES[shifted.getUTCDay()]}, ${shifted.getUTCDate()} ${MONTHS_LONG[shifted.getUTCMonth()]}`;
}

export function minutesUntil(iso, now = new Date()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / 60000);
}

export function countdownLabel(minutes) {
  if (minutes === null || minutes === undefined) return '';
  if (minutes <= 0) return 'Saatnya berangkat';
  if (minutes < 60) return `${minutes} menit lagi`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)} hari lagi`;
  return m ? `${h} jam ${m} menit lagi` : `${h} jam lagi`;
}