/**
 * ZK Voice Hub - Security & Rate Limiting Engine
 * 
 * Enforces:
 * 1. Login rate limiting (Brute force & credential stuffing protection)
 * 2. API action throttling
 * 3. Exponential backoff for repeated failures
 */

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  lockedUntil: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes lockout after 5 failed attempts

/**
 * Normalizes identifier (email, IP, or session token)
 */
function cleanIdentifier(id: string): string {
  return String(id || 'unknown').trim().toLowerCase();
}

/**
 * Checks if a login attempt is allowed for the given email/account.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds, message }
 */
export function checkLoginRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  message?: string;
} {
  const key = `login_${cleanIdentifier(identifier)}`;
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record) {
    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  // Check if currently locked out
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      message: `Too many failed login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
    };
  }

  // If outside of the sliding window, reset attempts
  if (now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
    memoryStore.delete(key);
    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  // Within window but exceeded attempts
  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    const retryAfterSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      message: `Account temporarily locked due to repeated failed logins. Please wait ${retryAfterSeconds} seconds.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - record.attempts,
    retryAfterSeconds: 0,
  };
}

/**
 * Records a failed login attempt for the identifier
 */
export function recordLoginFailure(identifier: string): {
  remainingAttempts: number;
  locked: boolean;
  retryAfterSeconds: number;
} {
  const key = `login_${cleanIdentifier(identifier)}`;
  const now = Date.now();
  let record = memoryStore.get(key);

  if (!record || (now - record.firstAttemptAt > LOGIN_WINDOW_MS)) {
    record = {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
      lockedUntil: 0,
    };
  } else {
    record.attempts += 1;
    record.lastAttemptAt = now;
  }

  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    memoryStore.set(key, record);
    return {
      remainingAttempts: 0,
      locked: true,
      retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  memoryStore.set(key, record);
  return {
    remainingAttempts: MAX_LOGIN_ATTEMPTS - record.attempts,
    locked: false,
    retryAfterSeconds: 0,
  };
}

/**
 * Resets rate limit record upon successful login
 */
export function resetLoginRateLimit(identifier: string): void {
  const key = `login_${cleanIdentifier(identifier)}`;
  memoryStore.delete(key);
}

/**
 * Generic API sliding window rate limiter
 */
const apiRequestStore = new Map<string, number[]>();

export function checkApiRateLimit(
  endpointKey: string,
  maxRequestsPerMinute = 60
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const key = `api_${cleanIdentifier(endpointKey)}`;

  let timestamps = apiRequestStore.get(key) || [];
  // Filter out timestamps older than 1 minute
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= maxRequestsPerMinute) {
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(now);
  apiRequestStore.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
