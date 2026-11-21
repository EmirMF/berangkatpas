export function calibratedBuffer(before, deltaMinutes) {
  const adjustment = Math.max(-3, Math.min(3, deltaMinutes * 0.25));
  return Math.round(Math.max(0, Math.min(30, before + adjustment)) * 100) / 100;
}
