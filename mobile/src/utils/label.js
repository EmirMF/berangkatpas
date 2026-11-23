export function shortTitle(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const head = text.split(',')[0].trim();
  return head || text;
}
