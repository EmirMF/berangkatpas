export function config(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('replace-')) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters');
  }
  const result = {
    port: Number(env.PORT ?? 3000),
    dbPath: env.DB_PATH || './data/berangkatpas.db',
    jwtSecret,
    timeoutMs: Number(env.PROVIDER_TIMEOUT_MS ?? 5000),
    geocodingBaseUrl: env.GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org',
    rainThreshold: Number(env.RAIN_THRESHOLD_PERCENT ?? 50),
    rainExtra: {
      walk: Number(env.RAIN_EXTRA_WALK ?? 0.20),
      motorcycle: Number(env.RAIN_EXTRA_MOTORCYCLE ?? 0.15),
      car: Number(env.RAIN_EXTRA_CAR ?? 0.10)
    },
    defaultBuffer: Number(env.DEFAULT_BUFFER_MINUTES ?? 10)
  };
  if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535 ||
      !Number.isFinite(result.timeoutMs) || result.timeoutMs < 100 ||
      !Number.isFinite(result.rainThreshold) || result.rainThreshold < 0 || result.rainThreshold > 100 ||
      !Number.isFinite(result.defaultBuffer) || result.defaultBuffer < 0 || result.defaultBuffer > 30 ||
      Object.values(result.rainExtra).some(n => !Number.isFinite(n) || n < 0 || n > 1)) {
    throw new Error('Invalid numeric configuration');
  }
  return result;
}
