export const CACHE_TTL = 30 * 60 * 1000; // 30 minutes active TTL
export const EXTENDED_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days fallback TTL

// Fast in-memory cache to prevent duplicate parses and instant retrieval
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export const getCachedData = <T = any>(key: string, allowStale = false): T | null => {
  try {
    // 1. Try memory cache first
    const inMem = memoryCache.get(key);
    if (inMem) {
      const age = Date.now() - inMem.timestamp;
      if (age <= CACHE_TTL || allowStale) {
        return inMem.data as T;
      }
    }

    // 2. Try localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Populate memory cache
      memoryCache.set(key, { data, timestamp });

      if (age <= CACHE_TTL || (allowStale && age <= EXTENDED_CACHE_TTL)) {
        return data as T;
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

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(
        key,
        JSON.stringify({
          data,
          timestamp,
        })
      );
    }
  } catch {
    // Graceful fallback if localStorage is full or disabled
  }
};

export const clearCachedData = (key: string) => {
  try {
    memoryCache.delete(key);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  } catch {}
};

export const clearCachePrefix = (prefix: string) => {
  try {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch {}
};
