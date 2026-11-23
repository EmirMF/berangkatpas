import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bp.trip.v1';
const PENDING_KEY = 'bp.trip.pending.v1';

export async function getTrip() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveTrip(trip) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(trip));
  } catch {
    return;
  }
}

export async function clearTrip() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    return;
  }
}

export async function getPending() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addPending(trip, suggestedArrivedAt) {
  const list = (await getPending()).filter((x) => !(x.scheduleId === trip.scheduleId && x.date === trip.date));
  list.push({
    scheduleId: trip.scheduleId,
    date: trip.date,
    startedAt: trip.startedAt,
    departAt: trip.departAt,
    arrivalAt: trip.arrivalAt,
    suggestedArrivedAt: suggestedArrivedAt || trip.arrivalAt,
  });
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-30)));
  } catch {
    return;
  }
}

export async function removePending(scheduleId, date) {
  const list = (await getPending()).filter((x) => !(x.scheduleId === scheduleId && x.date === date));
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    return;
  }
}
