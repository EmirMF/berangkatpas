export function weekStart(dateStr, weekday) {
  const back = (weekday + 6) % 7;
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function weeklyRecap(items, today) {
  const from = weekStart(today.date, today.weekday);
  const mine = items.filter((i) => i.feedback && i.occurrenceDate >= from && i.occurrenceDate <= today.date);
  const onTime = mine.filter((i) => Math.round(i.feedback.deltaMinutes) <= 0).length;
  return {
    total: mine.length,
    onTime,
    percent: mine.length ? Math.round((onTime / mine.length) * 100) : null,
  };
}