/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// 1. Strict Configuration for the NEW Supabase Project (Requirement 1, 4, 7)
export const NEW_SUPABASE_PROJECT_URL = 'https://rwioavitlgzyrbgivwzi.supabase.co';

const envUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  '';

const envKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
  '';

// Discard placeholders, strictly enforce the new project URL (Requirement 1 & 7)
export const supabaseUrl = (
  envUrl && !envUrl.includes('placeholder') && envUrl.includes('rwioavitlgzyrbgivwzi')
    ? envUrl
    : NEW_SUPABASE_PROJECT_URL
).trim().replace(/\/+$/, '');

// Load publishable key for the new project
export const supabaseKey = (
  envKey && !envKey.includes('placeholder')
    ? envKey
    : ''
).trim();

// Per-attempt timeout: 6 seconds so failures are caught quickly within the 10-second deadline
export const SUPABASE_TIMEOUT_MS = 6000;
export const SUPABASE_MAX_RETRIES = 1;

/**
 * Custom fetch with abort timeout, project URL verification, and failing request console logging (Requirement 1, 7, 8)
 */
async function customFetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Strict check: only allow requests to the verified new project URL
  if (!urlStr.startsWith(supabaseUrl)) {
    const blockedMsg = `Blocked request to unapproved Supabase host: ${urlStr}. App strictly communicates with ${NEW_SUPABASE_PROJECT_URL}`;
    console.error(`[Supabase Guard Blocked]: ${blockedMsg}`);
    throw new Error(blockedMsg);
  }

  // Fast-fail if new key is not provided yet
  if (!supabaseKey) {
    const noKeyMsg = `Missing Supabase publishable key for ${supabaseUrl}. Please set VITE_SUPABASE_ANON_KEY in .env or .env.local`;
    console.error(`[Supabase Failing Request]: ${urlStr}`, { error: noKeyMsg });
    throw new Error(noKeyMsg);
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
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry once on 5xx errors if attempt === 0
      if (response.status >= 500 && attempt < SUPABASE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      // Requirement 8: Show console errors with the exact failing request
      console.error(`[Supabase Failing Request]: ${urlStr} (attempt ${attempt + 1}/${SUPABASE_MAX_RETRIES + 1})`, {
        url: urlStr,
        method: init?.method || 'GET',
        error: err?.name === 'AbortError' ? `Request timed out after ${SUPABASE_TIMEOUT_MS}ms` : err?.message || err,
      });

      if (attempt < SUPABASE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  const finalMessage = lastError?.name === 'AbortError'
    ? `Supabase request timed out after ${SUPABASE_TIMEOUT_MS / 1000}s on ${urlStr}`
    : `Supabase connection failed on ${urlStr}: ${lastError?.message || lastError}`;

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
 * Executes a Supabase query with timeout safety (Requirement 2 & 8)
 */
export async function executeSupabaseWithRetry<T>(
  queryFn: () => Promise<T> | PromiseLike<T>,
  timeoutMs = 8000
): Promise<T> {
  let timerId: any = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Database request timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([Promise.resolve(queryFn()), timeoutPromise]);
    if (timerId) clearTimeout(timerId);
    return result;
  } catch (err) {
    if (timerId) clearTimeout(timerId);
    throw err;
  }
}
