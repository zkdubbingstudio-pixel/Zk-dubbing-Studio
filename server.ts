import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const distPath = path.resolve(__dirname, 'dist');
const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(distPath);

// Silence verbose console logs in production
if (isProduction) {
  console.debug = () => {};
  console.info = () => {};
  console.log = () => {};
}

// ------------------------------------------------------------------------------
// CONSTANTS & ENVIRONMENT VARIABLES
// ------------------------------------------------------------------------------
let FIREBASE_PROJECT_ID = (process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
if (!FIREBASE_PROJECT_ID) {
  try {
    const fbCfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(fbCfgPath)) {
      const fbCfg = JSON.parse(fs.readFileSync(fbCfgPath, 'utf8'));
      FIREBASE_PROJECT_ID = String(fbCfg.projectId || '').trim();
    }
  } catch {
    FIREBASE_PROJECT_ID = '';
  }
}

// ------------------------------------------------------------------------------
// SECURITY HEADERS & CONTENT SECURITY POLICY (Firebase-Only Origins)
// ------------------------------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://www.google.com https://www.gstatic.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.google-analytics.com https://*.analytics.google.com https://*.run.app https://www.google.com",
    "frame-src 'self' https: http:",
    "frame-ancestors 'self' https://*.google.com https://*.run.app https://aistudio.google.com",
    "object-src 'none'",
    "base-uri 'self'",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
});

// ------------------------------------------------------------------------------
// CSRF & ORIGIN PROTECTION
// ------------------------------------------------------------------------------
app.use((req, res, next) => {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (mutatingMethods.includes(req.method)) {
    const origin = req.headers['origin'] || req.headers['referer'];
    if (origin && typeof origin === 'string') {
      try {
        const parsed = new URL(origin);
        const host = req.headers['host'];
        const isSameHost = host && (parsed.host === host || parsed.host.includes(host.split(':')[0]));
        const isTrustedHost =
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname.endsWith('.run.app') ||
          parsed.hostname.endsWith('.vercel.app');
        if (!isSameHost && !isTrustedHost) {
          return res.status(403).json({ error: 'CSRF Protection: Untrusted Origin', status: 403 });
        }
      } catch {
        return res.status(403).json({ error: 'Invalid Origin Header', status: 403 });
      }
    }
  }
  next();
});

app.use(express.json({ limit: '12mb' }));

// ------------------------------------------------------------------------------
// RATE LIMITERS (API + AUTH BRUTE-FORCE + VIEW THROTTLE)
// ------------------------------------------------------------------------------
function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
}

const ipRequestWindow = new Map<string, number[]>();
const MAX_API_REQUESTS_PER_MIN = 120;
const MAX_SENSITIVE_REQUESTS_PER_MIN = 30;

app.use('/api', (req, res, next) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - 60 * 1000;

  const isSensitive =
    req.path.includes('/auth/rate-limit') ||
    req.path.includes('/stream/');

  const maxLimit = isSensitive ? MAX_SENSITIVE_REQUESTS_PER_MIN : MAX_API_REQUESTS_PER_MIN;
  const key = `${ip}_${isSensitive ? 'sensitive' : 'general'}`;

  let timestamps = ipRequestWindow.get(key) || [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= maxLimit) {
    const oldest = timestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000));
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({
      error: 'Too Many Requests: Rate limit exceeded. Please wait before retrying.',
      retryAfterSeconds: retryAfter,
      status: 429,
    });
  }

  timestamps.push(now);
  ipRequestWindow.set(key, timestamps);
  next();
});

interface AuthFailureRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
}
const authFailureStore = new Map<string, AuthFailureRecord>();
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 5 * 60 * 1000;
const AUTH_LOCKOUT_MS = 10 * 60 * 1000;

const viewThrottleStore = new Map<string, number>();

// ------------------------------------------------------------------------------
// INPUT SANITIZATION HELPERS
// ------------------------------------------------------------------------------
function sanitizeText(input: unknown, maxLength = 2000): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function isValidEntityId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(id.trim());
}

function deepSanitizeInput(data: any): any {
  if (typeof data === 'string') {
    const lower = data.trim().toLowerCase();
    if (
      lower.startsWith('data:image/jpeg;base64,') ||
      lower.startsWith('data:image/png;base64,') ||
      lower.startsWith('data:image/webp;base64,')
    ) {
      return data.trim();
    }
    return sanitizeText(data, 15000);
  }
  if (Array.isArray(data)) {
    return data.slice(0, 500).map(deepSanitizeInput);
  }
  if (data && typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      const cleanKey = k.replace(/[^a-zA-Z0-9_$-]/g, '').slice(0, 100);
      if (cleanKey) {
        sanitized[cleanKey] = deepSanitizeInput(v);
      }
    }
    return sanitized;
  }
  return data;
}

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitizeInput(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = deepSanitizeInput(req.query);
  }
  next();
});

async function startServer() {
  // Health check
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      backend: 'firebase',
      projectId: FIREBASE_PROJECT_ID,
      time: new Date().toISOString(),
    });
  });

  // ------------------------------------------------------------------------------
  // SERVER-SIDE AUTH BRUTE-FORCE RATE LIMITER
  // ------------------------------------------------------------------------------
  app.post('/api/auth/rate-limit/check', (req, res) => {
    const email = sanitizeText(req.body?.email || '', 150).toLowerCase();
    const ip = getClientIp(req);
    const key = `${ip}::${email}`;
    const now = Date.now();
    const record = authFailureStore.get(key);

    if (!record) {
      return res.status(200).json({ allowed: true, remainingAttempts: AUTH_MAX_ATTEMPTS, retryAfterSeconds: 0 });
    }

    if (record.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
        message: `Too many failed login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
      });
    }

    if (now - record.firstAttemptAt > AUTH_WINDOW_MS) {
      authFailureStore.delete(key);
      return res.status(200).json({ allowed: true, remainingAttempts: AUTH_MAX_ATTEMPTS, retryAfterSeconds: 0 });
    }

    return res.status(200).json({
      allowed: true,
      remainingAttempts: Math.max(0, AUTH_MAX_ATTEMPTS - record.attempts),
      retryAfterSeconds: 0,
    });
  });

  app.post('/api/auth/rate-limit/record', (req, res) => {
    const email = sanitizeText(req.body?.email || '', 150).toLowerCase();
    const success = Boolean(req.body?.success);
    const ip = getClientIp(req);
    const key = `${ip}::${email}`;
    const now = Date.now();

    if (success) {
      authFailureStore.delete(key);
      return res.status(200).json({ allowed: true, remainingAttempts: AUTH_MAX_ATTEMPTS, locked: false });
    }

    let record = authFailureStore.get(key);
    if (!record || now - record.firstAttemptAt > AUTH_WINDOW_MS) {
      record = { attempts: 1, firstAttemptAt: now, lockedUntil: 0 };
    } else {
      record.attempts += 1;
    }

    if (record.attempts >= AUTH_MAX_ATTEMPTS) {
      record.lockedUntil = now + AUTH_LOCKOUT_MS;
      authFailureStore.set(key, record);
      return res.status(429).json({
        allowed: false,
        locked: true,
        remainingAttempts: 0,
        retryAfterSeconds: Math.ceil(AUTH_LOCKOUT_MS / 1000),
      });
    }

    authFailureStore.set(key, record);
    return res.status(200).json({
      allowed: true,
      locked: false,
      remainingAttempts: Math.max(0, AUTH_MAX_ATTEMPTS - record.attempts),
      retryAfterSeconds: 0,
    });
  });

  // ------------------------------------------------------------------------------
  // STREAM SECURITY VERIFICATION & RATE-LIMITED VIEW COUNTER
  // ------------------------------------------------------------------------------
  app.post('/api/stream/view', async (req, res) => {
    const episodeId = req.body?.episodeId;
    if (!isValidEntityId(episodeId)) {
      return res.status(400).json({ error: 'Valid episodeId required' });
    }

    const ip = getClientIp(req);
    const key = `${ip}::${episodeId}`;
    const now = Date.now();
    const lastHit = viewThrottleStore.get(key) || 0;
    if (now - lastHit < 5 * 60 * 1000) {
      return res.status(200).json({ success: true, counted: false });
    }
    viewThrottleStore.set(key, now);

    if (viewThrottleStore.size > 5000) {
      for (const [k, ts] of viewThrottleStore.entries()) {
        if (now - ts > 10 * 60 * 1000) viewThrottleStore.delete(k);
      }
    }

    return res.status(200).json({ success: true, counted: true });
  });

  if (isProduction && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ZK Voice Hub Firebase-only secure server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
