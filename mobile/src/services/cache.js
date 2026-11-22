import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bp.jadwal.cache.v1';

export async function saveCache(data) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch {}
}

export async function loadCache() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearCache() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
