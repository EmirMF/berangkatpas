const fromEnv =
  typeof process !== 'undefined' && process.env ? process.env.EXPO_PUBLIC_API_URL : undefined;

export const API_BASE_URL = (fromEnv || 'https://berangkatpas.emir.my.id').replace(/\/+$/, '');
export const REQUEST_TIMEOUT_MS = 20000;
export const SYNC_DAYS = 7;
