export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes active TTL
export const EXTENDED_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days fallback TTL

// Fast in-memory cache to prevent quota errors and duplicate network calls
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export const getCachedData = <T = any>(key: string, allowStale = false): T | null => {
  try {
    // 1. Ultra-fast in-memory check (0.005ms)
    const inMem = memoryCache.get(key);
    if (inMem) {
      const age = Date.now() - inMem.timestamp;
      if (age <= CACHE_TTL || allowStale) {
        return inMem.data as T;
      }
    }

    // 2. Fast session storage check for tab session
    if (typeof window !== 'undefined') {
      const rawSession = sessionStorage.getItem(`zk_cache_${key}`);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed && typeof parsed.timestamp === 'number') {
          const age = Date.now() - parsed.timestamp;
          if (age <= CACHE_TTL || allowStale) {
            memoryCache.set(key, parsed);
            return parsed.data as T;
          }
        }
      }

      // 3. Persistent LocalStorage check for instant 0ms first-load on 4G
      const rawLocal = localStorage.getItem(`zk_persistent_${key}`);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed && typeof parsed.timestamp === 'number') {
          const age = Date.now() - parsed.timestamp;
          if (age <= EXTENDED_CACHE_TTL || allowStale) {
            memoryCache.set(key, parsed);
            return parsed.data as T;
          }
        }
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

    // Store catalog & metadata in sessionStorage & persistent localStorage for instant sub-500ms transitions
    if (typeof window !== 'undefined' && !key.includes('auth') && !key.includes('user') && !key.includes('secret')) {
      const payload = JSON.stringify({ data, timestamp });
      try {
        sessionStorage.setItem(`zk_cache_${key}`, payload);
      } catch {}

      // Keep unified catalog and primary lists persistent across reloads
      if (key === 'unified_app_catalog' || key.startsWith('anime_') || key.startsWith('seasons_') || key.startsWith('episodes_')) {
        try {
          localStorage.setItem(`zk_persistent_${key}`, payload);
        } catch {
          // If storage full, remove older persistent cache keys
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('zk_persistent_anime_')) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.slice(0, 10).forEach(k => localStorage.removeItem(k));
            localStorage.setItem(`zk_persistent_${key}`, payload);
          } catch {}
        }
      }
    }
  } catch {
    // Memory cache fail-safe
  }
};

export const clearCachedData = (key: string) => {
  try {
    memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`zk_cache_${key}`);
      localStorage.removeItem(`zk_persistent_${key}`);
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
    if (typeof window !== 'undefined') {
      const sessionKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`zk_cache_${prefix}`)) {
          sessionKeys.push(k);
        }
      }
      sessionKeys.forEach(k => sessionStorage.removeItem(k));

      const localKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`zk_persistent_${prefix}`)) {
          localKeys.push(k);
        }
      }
      localKeys.forEach(k => localStorage.removeItem(k));
    }
  } catch {}
};
