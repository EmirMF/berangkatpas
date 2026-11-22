import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from '../services/ApiService';
import { syncReminders } from '../services/notificationSync';
import { useAuth } from '../context/AuthContext';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;

export default function ForegroundSync() {
  const { status } = useAuth();
  const nextDepartRef = useRef(null);

  useEffect(() => {
    if (status !== 'signedIn') return undefined;

    const run = async () => {
      try {
        const r = await syncReminders(api);
        nextDepartRef.current = r.nextDepartAt;
      } catch {
        return;
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });

    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const next = nextDepartRef.current;
      if (next && new Date(next).getTime() - Date.now() <= TWO_HOURS) run();
    }, FIFTEEN_MINUTES);

    run();
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [status]);

  return null;
}
