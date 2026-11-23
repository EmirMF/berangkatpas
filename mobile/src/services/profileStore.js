import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'bp.profile.v1.';
export const DEFAULT_PROFILE = { name: '', defaultMode: 'motorcycle', defaultPrepMinutes: 15 };
export const NAME_MAX = 40;
const MODES = ['walk', 'motorcycle', 'car'];

export function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

export function initialOf(name, email) {
  const source = cleanName(name) || String(email || '').trim();
  const ch = source.charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

export function normalizeProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const prep = Number(p.defaultPrepMinutes);
  return {
    name: cleanName(p.name),
    defaultMode: MODES.includes(p.defaultMode) ? p.defaultMode : DEFAULT_PROFILE.defaultMode,
    defaultPrepMinutes: Number.isInteger(prep) && prep >= 0 && prep <= 120 ? prep : DEFAULT_PROFILE.defaultPrepMinutes,
  };
}

export async function getProfile(userKey) {
  if (!userKey) return { ...DEFAULT_PROFILE };
  try {
    const raw = await AsyncStorage.getItem(PREFIX + userKey);
    return normalizeProfile(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(userKey, profile) {
  const clean = normalizeProfile(profile);
  if (userKey) await AsyncStorage.setItem(PREFIX + userKey, JSON.stringify(clean));
  return clean;
}
