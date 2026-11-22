import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'bp_token';
const REFRESH_KEY = 'bp_refresh_token';

export const secureTokenStore = {
  async get() {
    const [token, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    return { token, refreshToken };
  },
  async set({ token, refreshToken }) {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  },
};

export function createMemoryTokenStore(initial = { token: null, refreshToken: null }) {
  let state = { ...initial };
  return {
    async get() {
      return { ...state };
    },
    async set(next) {
      state = { token: next.token, refreshToken: next.refreshToken };
    },
    async clear() {
      state = { token: null, refreshToken: null };
    },
  };
}
