import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '../services/ApiService';
import { clearAllReminders } from '../services/notificationSync';
import { clearCache } from '../services/cache';

const AuthContext = createContext(null);
const USER_KEY = 'bp_cached_user';

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);

  const cacheUser = async (u) => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {
      return;
    }
  };

  const dropSession = useCallback(async () => {
    setUser(null);
    setStatus('signedOut');
    await clearCache();
    try {
      await AsyncStorage.removeItem(USER_KEY);
    } catch {
      return;
    }
    await clearAllReminders();
  }, []);

  useEffect(() => {
    api.setAuthLostHandler(() => {
      dropSession();
    });
  }, [dropSession]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await api.hasSession())) {
        if (alive) setStatus('signedOut');
        return;
      }
      try {
        const u = await api.me();
        if (!alive) return;
        setUser(u);
        setStatus('signedIn');
        cacheUser(u);
      } catch (error) {
        if (!alive) return;
        if (error instanceof ApiError && error.isNetwork) {
          let cached = null;
          try {
            cached = JSON.parse(await AsyncStorage.getItem(USER_KEY));
          } catch {
            cached = null;
          }
          setUser(cached || { email: '' });
          setStatus('signedIn');
        } else if (error instanceof ApiError && error.status === 401) {
          setStatus('signedOut');
        } else {
          setStatus('signedOut');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await api.login(email.trim().toLowerCase(), password);
    setUser(u);
    setStatus('signedIn');
    cacheUser(u);
  }, []);

  const register = useCallback(async (email, password) => {
    const u = await api.register(email.trim().toLowerCase(), password);
    setUser(u);
    setStatus('signedIn');
    cacheUser(u);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    await dropSession();
  }, [dropSession]);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
