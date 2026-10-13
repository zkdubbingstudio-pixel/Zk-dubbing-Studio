export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes active TTL
export const EXTENDED_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days fallback TTL

// Fast in-memory cache to prevent quota errors and duplicate network calls
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export const getCachedData = <T = any>(key: string, allowStale = false): T | null => {
  try {
    const inMem = memoryCache.get(key);
    if (inMem) {
      const age = Date.now() - inMem.timestamp;
      if (age <= CACHE_TTL || allowStale) {
        return inMem.data as T;
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const setCachedData = (key: string, data: any) => {
  try {
    const timestamp = Date.now();
    memoryCache.set(key, { data, timestamp });
  } catch {
    // Memory cache fail-safe
  }
};

export const clearCachedData = (key: string) => {
  try {
    memoryCache.delete(key);
  } catch {}
};

export const clearCachePrefix = (prefix: string) => {
  try {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  } catch {}
};
