export const MAX_SCHEDULED = 60;

const KIND_TEXT = {
  prepare: (title) => `Mulai bersiap untuk ${title}`,
  departure_soon: () => '20 menit lagi waktunya berangkat',
  depart: () => 'Saatnya berangkat sekarang',
};

export function eventBody(kinds, title) {
  const order = ['prepare', 'departure_soon', 'depart'];
  return order
    .filter((k) => kinds.includes(k))
    .map((k) => KIND_TEXT[k](title))
    .join('. ');
}

export function eventTitle(kinds) {
  if (kinds.includes('depart')) return 'Waktunya berangkat';
  if (kinds.includes('departure_soon')) return 'Bersiap berangkat';
  return 'Mulai bersiap';
}

export function planNotifications({ items, errors = [], stored = {}, now = new Date() }) {
  const nowMs = now.getTime();
  const errorKeys = new Set(errors.map((e) => `${e.scheduleId}:${e.occurrenceDate}`));
  const manifestKeys = new Set(items.map((i) => i.reminderKey));
  const cancelKeys = [];
  const keep = [];
  const schedule = [];

  for (const key of Object.keys(stored)) {
    if (!manifestKeys.has(key) && !errorKeys.has(key)) cancelKeys.push(key);
  }

  for (const item of items) {
    const entry = stored[item.reminderKey];
    if (entry && entry.revision === item.revision && entry.ids && entry.ids.length) {
      keep.push(item.reminderKey);
      continue;
    }
    if (entry) cancelKeys.push(item.reminderKey);
    const title = item.title || item.destination?.label || 'perjalanan';
    const events = (item.recommendation?.reminderEvents || []).filter(
      (e) => new Date(e.at).getTime() > nowMs
    );
    for (const e of events) {
      schedule.push({
        reminderKey: item.reminderKey,
        revision: item.revision,
        at: e.at,
        kinds: e.kinds,
        title: eventTitle(e.kinds),
        body: eventBody(e.kinds, title),
        data: {
          reminderKey: item.reminderKey,
          scheduleId: item.scheduleId,
          occurrenceDate: item.occurrenceDate,
          navigationUrl: item.recommendation?.navigationUrl || null,
        },
      });
    }
    if (!events.length && !entry) keep.push(item.reminderKey);
  }

  schedule.sort((a, b) => new Date(a.at) - new Date(b.at));
  const capped = schedule.slice(0, MAX_SCHEDULED);

  const nextDepartAt = items
    .map((i) => i.recommendation?.departAt)
    .filter(Boolean)
    .sort()[0] || null;

  return {
    cancelKeys,
    keep,
    schedule: capped,
    dropped: schedule.length - capped.length,
    nextDepartAt,
    hasErrors: errors.length > 0,
  };
}

export function applyPlanToStore(stored, plan, scheduledIdsByKey, revisionByKey) {
  const next = { ...stored };
  for (const key of plan.cancelKeys) delete next[key];
  for (const [key, ids] of Object.entries(scheduledIdsByKey)) {
    next[key] = { revision: revisionByKey[key], ids };
  }
  return next;
}
