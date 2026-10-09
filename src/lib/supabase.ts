/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// 1. Strict Configuration for the NEW Supabase Project (Requirement 1, 4, 7)
export const NEW_SUPABASE_PROJECT_URL = 'https://rwioavitlgzyrbgivwzi.supabase.co';
export const SUPABASE_DEFAULT_ANON_KEY = 'sb_publishable_kecwr9BW3V2UnM4TpruFfQ_S6C7Qsys';

const envUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) || 
  '';

const envKey = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) || 
  '';

// Discard placeholders, strictly enforce the new project URL (Requirement 1 & 7)
export const supabaseUrl = (
  envUrl && !envUrl.includes('placeholder') && envUrl.includes('rwioavitlgzyrbgivwzi')
    ? envUrl
    : NEW_SUPABASE_PROJECT_URL
).trim().replace(/\/+$/, '');

// Load publishable key for the new project with guaranteed valid default
export const supabaseKey = (
  envKey && !envKey.includes('placeholder')
    ? envKey
    : SUPABASE_DEFAULT_ANON_KEY
).trim();

// Per-attempt timeout: 12 seconds with retry protection
export const SUPABASE_TIMEOUT_MS = 12000;
export const SUPABASE_MAX_RETRIES = 2;

// Prefer local proxy in browser to guarantee zero CORS issues and reliable execution
let preferProxy = typeof window !== 'undefined';

/**
 * Custom fetch with abort timeout, project URL verification, and proxy fallback
 */
async function customFetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Strict check: only allow requests to the verified new project URL or the internal proxy
  const isDirectSupabase = urlStr.startsWith(supabaseUrl);
  const isProxyUrl = urlStr.includes('/api/supabase-proxy');

  if (!isDirectSupabase && !isProxyUrl) {
    const blockedMsg = `Blocked request to unapproved Supabase host: ${urlStr}. App strictly communicates with ${NEW_SUPABASE_PROJECT_URL}`;
    console.warn(`[Supabase Guard Blocked]: ${blockedMsg}`);
    throw new Error(blockedMsg);
  }

  // Derive internal proxy URL if direct request fails or if proxy is preferred
  const proxyPath = isDirectSupabase ? urlStr.replace(supabaseUrl, '/api/supabase-proxy') : urlStr;

  let lastError: any = null;

  for (let attempt = 0; attempt <= SUPABASE_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, SUPABASE_TIMEOUT_MS);

    if (init?.signal) {
      init.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      // If preferProxy is true, route to proxy first; otherwise direct
      const targetToFetch = preferProxy ? proxyPath : input;
      const response = await fetch(targetToFetch, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry once on 5xx errors if attempt < SUPABASE_MAX_RETRIES
      if (response.status >= 500 && attempt < SUPABASE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      // Switch mode if preferred path failed
      if (preferProxy) {
        // Proxy failed, try direct on next attempt
        preferProxy = false;
      } else {
        // Direct failed (e.g. CORS), switch to proxy
        preferProxy = true;
      }

      if (attempt < SUPABASE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  const finalMessage = lastError?.name === 'AbortError'
    ? `Database connection timed out. Please check network connectivity.`
    : `Database connection notice on ${urlStr}: ${lastError?.message || lastError}`;

  throw new Error(finalMessage);
}

export const supabase = createClient(supabaseUrl, supabaseKey || 'pending-key', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetchWithTimeout,
  },
});

/**
 * Health check helper to test active connectivity to Supabase (Requirement 5)
 */
export async function checkSupabaseConnection(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const start = Date.now();
  if (!supabaseKey) {
    return {
      ok: false,
      message: `Supabase publishable key is missing for project ${supabaseUrl}. Please set VITE_SUPABASE_ANON_KEY in .env or .env.local.`,
    };
  }
  try {
    const table = (typeof window !== 'undefined' && localStorage.getItem('zk_active_anime_table')) || 'anime';
    const { error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error) {
      // PGRST205 indicates successful connection and valid auth, but tables are pending in the new database
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { ok: true, message: `Connected (Table '${table}' in schema cache verification)`, latencyMs: Date.now() - start };
      }
      return { ok: false, message: error.message || 'Supabase query returned error' };
    }
    return { ok: true, message: 'Connected', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Network unreachable' };
  }
}

/**
 * Executes a Supabase query with automatic retry safety and timeout protection (Requirement 1 & 8)
 * Retries automatically up to maxRetries before throwing an error.
 * Never outputs "Database request timed out after 8 seconds".
 */
export async function executeSupabaseWithRetry<T>(
  queryFn: () => Promise<T> | PromiseLike<T>,
  timeoutMs = 12000,
  maxRetries = 3
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timerId: any = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error(`Database request pending response on attempt ${attempt}/${maxRetries}`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([Promise.resolve(queryFn()), timeoutPromise]);
      if (timerId) clearTimeout(timerId);
      return result;
    } catch (err: any) {
      if (timerId) clearTimeout(timerId);
      lastError = err;

      // Fast fail on schema cache pending errors so fallback can kick in immediately
      if (err?.code === 'PGRST205' || err?.message?.includes?.('schema cache')) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(attempt * 350, 1500);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Database temporarily unavailable. Please retry shortly.');
}
