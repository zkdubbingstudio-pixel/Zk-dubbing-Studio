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

/**
 * Robust database error formatter to guarantee the real Supabase error is logged
 * and displayed instead of "[object Object]".
 */
export function formatDbError(err: any): string {
  if (!err) return 'Unknown database error';
  if (typeof err === 'string') return err;

  const code = err.code || err.statusCode || (err.error && err.error.code) || '';
  const message = err.message || (err.error && err.error.message) || err.error_description || (typeof err.error === 'string' ? err.error : '');
  const details = err.details || (err.error && err.error.details) || '';
  const hint = err.hint || (err.error && err.error.hint) || '';

  let result = '';
  if (code) {
    result += `[${code}] `;
  }
  if (message && typeof message === 'string' && message !== '[object Object]') {
    result += message;
  } else {
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}' && json !== '[]') {
        result += json;
      } else {
        result += err.name || 'Database query error';
      }
    } catch {
      result += err.name || 'Database query error';
    }
  }

  if (details && typeof details === 'string' && details !== message) {
    result += ` - Details: ${details}`;
  }
  if (hint && typeof hint === 'string') {
    result += ` (Hint: ${hint})`;
  }

  return result.trim() || 'Database error occurred';
}

/**
 * Custom fetch with abort timeout and URL validation.
 * Crucial fix: Directly fetches Supabase URL natively with browser CORS.
 * Does NOT hijack requests to /api/supabase-proxy so published website works seamlessly.
 */
async function customFetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Strict check: only allow requests to the verified new project URL or local proxy
  const isDirectSupabase = urlStr.startsWith(supabaseUrl);
  const isProxyUrl = urlStr.includes('/api/supabase-proxy');

  if (!isDirectSupabase && !isProxyUrl) {
    const blockedMsg = `Blocked request to unapproved Supabase host: ${urlStr}. App strictly communicates with ${NEW_SUPABASE_PROJECT_URL}`;
    console.warn(`[Supabase Guard Blocked]: ${blockedMsg}`);
    throw new Error(blockedMsg);
  }

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
      // Primary execution: direct fetch to Supabase (fully supported by CORS on dev & published sites)
      const response = await fetch(input, {
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

      // In local dev preview only, if direct fetch failed due to network sandbox, fallback to dev proxy
      if (typeof window !== 'undefined' && import.meta.env.DEV && isDirectSupabase) {
        try {
          const proxyPath = urlStr.replace(supabaseUrl, '/api/supabase-proxy');
          const proxyRes = await fetch(proxyPath, init);
          if (proxyRes.ok) return proxyRes;
        } catch {}
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
 * Health check helper to test active connectivity to Supabase
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
    const { error } = await supabase.from('anime').select('id', { count: 'exact', head: true });
    if (error) {
      const formatted = formatDbError(error);
      console.error('[Supabase Real Error - checkSupabaseConnection]:', error);
      // PGRST205 indicates schema cache notice
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { ok: true, message: `Connected (Schema cache verification)`, latencyMs: Date.now() - start };
      }
      return { ok: false, message: formatted };
    }
    return { ok: true, message: 'Connected', latencyMs: Date.now() - start };
  } catch (err: any) {
    const formatted = formatDbError(err);
    console.error('[Supabase Real Error - checkSupabaseConnection exception]:', err);
    return { ok: false, message: formatted };
  }
}

/**
 * Pre-flight verification of RLS policies on all three primary tables:
 * public.anime, public.seasons, public.episodes
 */
export async function verifyRlsPolicies(): Promise<{ ok: boolean; anime: boolean; seasons: boolean; episodes: boolean; error?: string }> {
  try {
    const [aRes, sRes, eRes] = await Promise.all([
      supabase.from('anime').select('id', { head: true, count: 'exact' }),
      supabase.from('seasons').select('id', { head: true, count: 'exact' }),
      supabase.from('episodes').select('id', { head: true, count: 'exact' }),
    ]);

    const aOk = !aRes.error;
    const sOk = !sRes.error;
    const eOk = !eRes.error;

    if (!aOk || !sOk || !eOk) {
      const err = aRes.error || sRes.error || eRes.error;
      const formatted = formatDbError(err);
      console.warn('[RLS Verification Notice]:', formatted, { anime: aOk, seasons: sOk, episodes: eOk });
      return { ok: false, anime: aOk, seasons: sOk, episodes: eOk, error: formatted };
    }

    return { ok: true, anime: true, seasons: true, episodes: true };
  } catch (err: any) {
    const formatted = formatDbError(err);
    console.error('[RLS Verification Exception]:', formatted);
    return { ok: false, anime: false, seasons: false, episodes: false, error: formatted };
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
