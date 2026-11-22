import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { planNotifications, applyPlanToStore } from './notificationPlanner';
import { SYNC_DAYS } from '../config';

const STORE_KEY = 'bp_reminder_store_v1';
const CHANNEL_ID = 'berangkat';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let running = null;

async function readStore() {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeStore(value) {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export async function ensurePermission(ask = true) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Pengingat berangkat',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  return status === 'granted';
}

function dateTrigger(at) {
  const date = new Date(at);
  const types = Notifications.SchedulableTriggerInputTypes;
  const base = types && types.DATE ? { type: types.DATE, date } : { date };
  return Platform.OS === 'android' ? { ...base, channelId: CHANNEL_ID } : base;
}

async function cancelIds(ids) {
  await Promise.all(
    (ids || []).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}

async function runSync(api) {
  const granted = await ensurePermission(true);
  const manifest = await api.getManifest(SYNC_DAYS);
  if (!granted) {
    return { granted: false, scheduled: 0, nextDepartAt: null, hasErrors: manifest.errors.length > 0 };
  }
  const stored = await readStore();
  const plan = planNotifications({ items: manifest.items, errors: manifest.errors, stored });

  for (const key of plan.cancelKeys) await cancelIds(stored[key]?.ids);

  const idsByKey = {};
  const revisionByKey = {};
  for (const n of plan.schedule) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: n.title, body: n.body, data: n.data, sound: true },
        trigger: dateTrigger(n.at),
      });
      (idsByKey[n.reminderKey] = idsByKey[n.reminderKey] || []).push(id);
      revisionByKey[n.reminderKey] = n.revision;
    } catch {
      continue;
    }
  }

  await writeStore(applyPlanToStore(stored, plan, idsByKey, revisionByKey));
  const scheduled = Object.values(idsByKey).reduce((sum, ids) => sum + ids.length, 0);
  return {
    granted: true,
    scheduled,
    nextDepartAt: plan.nextDepartAt,
    hasErrors: plan.hasErrors,
    dropped: plan.dropped,
  };
}

export function syncReminders(api) {
  if (!running) {
    running = runSync(api).finally(() => {
      running = null;
    });
  }
  return running;
}

export async function clearAllReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return;
  }
  await writeStore({});
}
