const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(values) {
  const errors = {};
  if (!EMAIL.test((values.email || '').trim())) errors.email = 'Format email tidak valid';
  if (!values.password) errors.password = 'Kata sandi wajib diisi';
  return errors;
}

export function validateRegister(values) {
  const errors = validateLogin(values);
  const pw = values.password || '';
  if (pw && (pw.length < 8 || pw.length > 128)) errors.password = 'Kata sandi 8–128 karakter';
  if (values.ulangPassword !== values.password) errors.ulangPassword = 'Kata sandi tidak sama';
  return errors;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function validPlace(p) {
  return Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

export function validateSchedule(values) {
  const errors = {};
  if ((values.title || '').trim().length > 80) errors.title = 'Judul maksimal 80 karakter';
  if (!validPlace(values.origin)) errors.origin = 'Pilih lokasi asal';
  if (!validPlace(values.destination)) errors.destination = 'Pilih lokasi tujuan';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.arrivalTime || '')) {
    errors.arrivalTime = 'Format jam HH:mm, contoh 08:00';
  }
  if (!['walk', 'motorcycle', 'car'].includes(values.mode)) errors.mode = 'Pilih moda perjalanan';
  if (values.repeat === 'weekly') {
    if (!Array.isArray(values.weekdays) || !values.weekdays.length) {
      errors.weekdays = 'Pilih minimal satu hari';
    }
  } else if (!isRealDate(values.date)) {
    errors.date = 'Format tanggal YYYY-MM-DD, contoh 2026-11-25';
  }
  const prep = String(values.preparationMinutes ?? '').trim();
  if (prep !== '' && (!/^\d+$/.test(prep) || Number(prep) > 120)) {
    errors.preparationMinutes = 'Isi angka 0–120';
  }
  return errors;
}

function cleanPlace(p) {
  const label = (p.label || '').trim();
  return { lat: p.lat, lng: p.lng, ...(label ? { label: label.slice(0, 120) } : {}) };
}

export function buildSchedulePayload(values) {
  const title = (values.title || '').trim();
  const prep = String(values.preparationMinutes ?? '').trim();
  const payload = {
    ...(title ? { title } : {}),
    origin: cleanPlace(values.origin),
    destination: cleanPlace(values.destination),
    arrivalTime: values.arrivalTime,
    mode: values.mode,
    preparationMinutes: prep === '' ? 0 : Number(prep),
  };
  if (values.repeat === 'weekly') payload.weekdays = [...values.weekdays].sort((a, b) => a - b);
  else payload.date = values.date;
  return payload;
}

export function scheduleToForm(schedule) {
  return {
    title: schedule.title && schedule.title !== (schedule.destination && schedule.destination.label) ? schedule.title : '',
    origin: schedule.origin,
    destination: schedule.destination,
    arrivalTime: schedule.arrivalTime,
    mode: schedule.mode,
    repeat: schedule.weekdays ? 'weekly' : 'once',
    date: schedule.date || '',
    weekdays: schedule.weekdays || [],
    preparationMinutes: String(schedule.preparationMinutes ?? 0),
  };
}
