import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { secureTokenStore } from './tokenStore';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isNetwork() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }

  get isServerDown() {
    return this.status >= 500;
  }
}

const FRIENDLY = {
  NETWORK: 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.',
  TIMEOUT: 'Server terlalu lama merespons. Coba lagi sebentar lagi.',
  ROUTE_UNAVAILABLE: 'Estimasi rute sedang tidak tersedia. Coba lagi nanti.',
  PLACE_UNAVAILABLE: 'Pencarian tempat sedang tidak tersedia. Coba lagi nanti.',
  INVALID_CREDENTIALS: 'Email atau kata sandi tidak sesuai.',
  EMAIL_EXISTS: 'Email ini sudah terdaftar. Silakan masuk.',
  OUT_OF_AREA: 'Lokasi berada di luar area layanan (Bandung).',
  FEEDBACK_EXISTS: 'Kedatanganmu untuk perjalanan ini sudah dicatat.',
  INVALID_OCCURRENCE: 'Tanggal ini bukan jadwal aktif.',
};

export function friendlyMessage(error) {
  if (!(error instanceof ApiError)) return 'Terjadi kesalahan tak terduga.';
  if (FRIENDLY[error.code]) return FRIENDLY[error.code];
  if (error.status === 503) return 'Layanan data eksternal sedang gangguan. Coba lagi nanti.';
  if (error.status >= 500) return 'Server sedang bermasalah. Coba lagi nanti.';
  return error.message || 'Permintaan gagal.';
}

function toQuery(params) {
  const parts = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function createApi({
  baseUrl = API_BASE_URL,
  fetchImpl = (...args) => fetch(...args),
  tokenStore = secureTokenStore,
  timeoutMs = REQUEST_TIMEOUT_MS,
  onAuthLost = () => {},
} = {}) {
  let authLostHandler = onAuthLost;
  let refreshing = null;

  async function rawFetch(path, { method = 'GET', body, token } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(baseUrl + path, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new ApiError(0, 'TIMEOUT', FRIENDLY.TIMEOUT);
      }
      throw new ApiError(0, 'NETWORK', FRIENDLY.NETWORK);
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 204) return null;
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const e = data && data.error ? data.error : {};
      throw new ApiError(
        response.status,
        e.code || `HTTP_${response.status}`,
        e.message || `Permintaan gagal (${response.status})`
      );
    }
    return data;
  }

  async function refreshOnce(usedToken) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const current = await tokenStore.get();
        if (current.token && usedToken && current.token !== usedToken) return;
        if (!current.refreshToken) {
          await tokenStore.clear();
          authLostHandler();
          throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Sesi berakhir. Silakan masuk lagi.');
        }
        try {
          const next = await rawFetch('/api/v1/auth/refresh', {
            method: 'POST',
            body: { refreshToken: current.refreshToken },
          });
          await tokenStore.set({ token: next.token, refreshToken: next.refreshToken });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await tokenStore.clear();
            authLostHandler();
          }
          throw error;
        }
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function request(path, options = {}) {
    const { auth = true, ...rest } = options;
    if (!auth) return rawFetch(path, rest);
    const { token } = await tokenStore.get();
    try {
      return await rawFetch(path, { ...rest, token });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await refreshOnce(token);
      const fresh = await tokenStore.get();
      return rawFetch(path, { ...rest, token: fresh.token });
    }
  }

  async function saveSession(session) {
    await tokenStore.set({ token: session.token, refreshToken: session.refreshToken });
    return session.user;
  }

  return {
    setAuthLostHandler(fn) {
      authLostHandler = fn;
    },
    hasSession: async () => Boolean((await tokenStore.get()).refreshToken),
    async register(email, password) {
      const s = await request('/api/v1/auth/register', { method: 'POST', body: { email, password }, auth: false });
      return saveSession(s);
    },
    async login(email, password) {
      const s = await request('/api/v1/auth/login', { method: 'POST', body: { email, password }, auth: false });
      return saveSession(s);
    },
    async me() {
      return (await request('/api/v1/auth/me')).user;
    },
    async logout() {
      const { refreshToken } = await tokenStore.get();
      await tokenStore.clear();
      if (!refreshToken) return;
      try {
        await rawFetch('/api/v1/auth/logout', { method: 'POST', body: { refreshToken } });
      } catch {
        return;
      }
    },
    async listSchedules() {
      return (await request('/api/v1/schedules')).items;
    },
    createSchedule: (payload) => request('/api/v1/schedules', { method: 'POST', body: payload }),
    updateSchedule: (id, payload) => request(`/api/v1/schedules/${id}`, { method: 'PUT', body: payload }),
    deleteSchedule: (id) => request(`/api/v1/schedules/${id}`, { method: 'DELETE' }),
    getRecommendation: (id, date) =>
      request(`/api/v1/schedules/${id}/recommendation${toQuery({ date })}`),
    getModeComparison: (id, date) =>
      request(`/api/v1/schedules/${id}/mode-comparison${toQuery({ date })}`),
    getManifest: (days = 7) => request(`/api/v1/reminders/manifest${toQuery({ days })}`),
    getHistory: async () => (await request('/api/v1/history')).items,
    sendFeedback: (recommendationId, arrivedAt) =>
      request(`/api/v1/recommendations/${recommendationId}/feedback`, {
        method: 'POST',
        body: { arrivedAt },
      }),
    searchPlaces: (q) => request(`/api/v1/places/search${toQuery({ q })}`),
    reversePlace: (lat, lng) => request(`/api/v1/places/reverse${toQuery({ lat, lng })}`),
  };
}

export const api = createApi();
