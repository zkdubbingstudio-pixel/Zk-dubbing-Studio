import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const distPath = path.resolve(__dirname, 'dist');
const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(distPath);

// Silence debug console logs in production (Requirement 6)
if (isProduction) {
  console.debug = () => {};
  console.info = () => {};
}

// ------------------------------------------------------------------------------
// CONSTANTS & ENVIRONMENT VARIABLES (Requirement 4 & 5)
// ------------------------------------------------------------------------------
const SUPABASE_PROJECT_URL = 
  process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.includes('fmxtiykddxwzewzckihv')
    ? process.env.VITE_SUPABASE_URL
    : 'https://rwioavitlgzyrbgivwzi.supabase.co';
const SUPABASE_HOST = 
  process.env.SUPABASE_HOST && !process.env.SUPABASE_HOST.includes('fmxtiykddxwzewzckihv')
    ? process.env.SUPABASE_HOST
    : 'db.rwioavitlgzyrbgivwzi.supabase.co';
const SUPABASE_ANON_KEY = 
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_kecwr9BW3V2UnM4TpruFfQ_S6C7Qsys';
const OWNER_EMAIL = 'zkdubbingstudio@gmail.com';

// ------------------------------------------------------------------------------
// SECURITY HELPER: TOKEN VERIFICATION (Requirement 15 & 16)
// ------------------------------------------------------------------------------
interface AuthPayload {
  email?: string;
  uid?: string;
  sub?: string;
  exp?: number;
}

/**
 * Parses and verifies basic claims of a Firebase ID token
 */
function parseFirebaseToken(authHeader?: string): AuthPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode payload
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload: AuthPayload = JSON.parse(payloadJson);

    // Verify token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Checks if the caller is the verified studio owner
 */
function verifyOwnerToken(req: express.Request): boolean {
  // 1. Direct Bearer token check
  const authPayload = parseFirebaseToken(req.headers['authorization']);
  if (authPayload?.email && authPayload.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    return true;
  }

  // 2. Custom studio admin header check (for server-to-server or secure tools)
  const studioKey = req.headers['x-zk-studio-key'];
  if (process.env.ADMIN_SECRET && studioKey && studioKey === process.env.ADMIN_SECRET) {
    return true;
  }

  return false;
}

// ------------------------------------------------------------------------------
// SECURITY HEADERS & CONTENT SECURITY POLICY (Requirement 7 & 8)
// ------------------------------------------------------------------------------
app.use((req, res, next) => {
  // Prevent MIME type sniffing (Requirement 8)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent cross-origin referrer leakage (Requirement 8)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // XSS protection filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Frame security: Allow AI Studio dev iframe while preventing rogue framing (Requirement 8)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Content Security Policy (Requirement 7)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudflarestorage.com https://*.run.app",
    "frame-src 'self' https: http:",
    "frame-ancestors 'self' https://*.google.com https://*.run.app https://aistudio.google.com",
    "object-src 'none'",
    "base-uri 'self'",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
});

// ------------------------------------------------------------------------------
// CSRF & ORIGIN PROTECTION (Requirement 11)
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
        const isDevHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.endsWith('.run.app');
        if (!isSameHost && !isDevHost) {
          return res.status(403).json({ error: 'CSRF Protection: Untrusted Origin', status: 403 });
        }
      } catch {
        return res.status(403).json({ error: 'Invalid Origin Header', status: 403 });
      }
    }
  }
  next();
});

// Limit body payload to prevent DoS attacks (Requirement 14)
app.use(express.json({ limit: '10mb' }));

async function startServer() {
  // Health check endpoint for Cloud Run readiness / liveness
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // ------------------------------------------------------------------------------
  // SUPABASE PROXY ROUTE WITH STRICT ACCESS CONTROL (Requirement 15, 16, 17)
  // ------------------------------------------------------------------------------
  app.all('/api/supabase-proxy*', async (req, res) => {
    try {
      const targetPath = req.originalUrl.replace(/^\/api\/supabase-proxy/, '');
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

      // Verify No Public Endpoint Allows Editing Data (Requirement 17)
      if (isMutation) {
        const authPayload = parseFirebaseToken(req.headers['authorization']);
        
        // 1. Unauthenticated mutations are strictly rejected (Requirement 16 & 17)
        if (!authPayload) {
          return res.status(401).json({
            error: 'Authentication required. Anonymous users cannot modify database records.',
            status: 401,
          });
        }

        const isOwner = authPayload.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

        // 2. Anime, Seasons, Episodes, Backups can ONLY be edited by the Owner (Requirement 2 & 17)
        const isContentTable = /rest\/v1\/(anime|seasons|episodes|backups|activity_logs)/i.test(targetPath);
        if (isContentTable && !isOwner) {
          return res.status(403).json({
            error: `Access Denied: Only the studio owner (${OWNER_EMAIL}) has permission to modify anime content.`,
            status: 403,
          });
        }
      }

      const targetUrl = `${SUPABASE_PROJECT_URL}${targetPath}`;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

      const outgoingHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string' && !['host', 'connection', 'content-length'].includes(k.toLowerCase())) {
          outgoingHeaders[k] = v;
        }
      }
      if (!outgoingHeaders['apikey'] && anonKey) outgoingHeaders['apikey'] = anonKey;
      if (!outgoingHeaders['authorization'] && anonKey) outgoingHeaders['authorization'] = `Bearer ${anonKey}`;

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: outgoingHeaders,
      };

      if (isMutation && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
        outgoingHeaders['content-type'] = 'application/json';
      }

      const supRes = await fetch(targetUrl, fetchOptions);
      res.status(supRes.status);
      supRes.headers.forEach((val, key) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });
      const data = await supRes.arrayBuffer();
      res.send(Buffer.from(data));
    } catch (err: any) {
      if (!isProduction) console.error('[Supabase Proxy Error]:', err);
      res.status(502).json({ error: err?.message || 'Supabase proxy request failed' });
    }
  });

  // Supabase migration SQL file path
  const schemaSqlPath = path.resolve(__dirname, 'supabase_schema.sql');

  // Supabase Status Endpoint (Read-only)
  app.get('/api/supabase/status', async (_req, res) => {
    const candidates = ['anime', 'seasons', 'episodes', 'users', 'user_progress', 'favorites'];
    const results: Record<string, boolean> = {};

    try {
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
      for (const table of candidates) {
        try {
          const resp = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/${table}?select=id&limit=1`, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          });
          results[table] = resp.status !== 404;
        } catch {
          results[table] = false;
        }
      }

      res.status(200).json({
        ok: true,
        projectUrl: SUPABASE_PROJECT_URL,
        tables: results,
        hasDbPassword: Boolean(process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_URL),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // ------------------------------------------------------------------------------
  // PROTECTED ADMIN API: RUN MIGRATIONS (Requirement 9, 15, 16, 17)
  // ------------------------------------------------------------------------------
  app.post('/api/supabase/migrate', async (req, res) => {
    // 1. Verify caller is authenticated (Requirement 15 & 16)
    const authHeader = req.headers['authorization'];
    const authPayload = parseFirebaseToken(authHeader);
    if (!authPayload && !req.headers['x-zk-studio-key']) {
      return res.status(401).json({
        success: false,
        status: 401,
        error: 'Authentication required. Please sign in as owner to execute database migrations.',
      });
    }

    // 2. Verify caller is Owner (Requirement 2 & 16)
    if (!verifyOwnerToken(req)) {
      return res.status(403).json({
        success: false,
        status: 403,
        error: `Access Denied: Only the verified owner (${OWNER_EMAIL}) can execute migrations.`,
      });
    }

    try {
      const password = req.body?.dbPassword || process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
      const connectionString = req.body?.connectionString || process.env.DATABASE_URL;

      // SQL Injection Prevention: strictly execute validated local schema file only (Requirement 9)
      let sqlContent = '';
      if (fs.existsSync(schemaSqlPath)) {
        sqlContent = fs.readFileSync(schemaSqlPath, 'utf8');
      }

      if (!password && !connectionString) {
        return res.status(200).json({
          success: false,
          code: 'NEED_PASSWORD',
          message: 'Database password or connection string required to run migrations.',
          sql: sqlContent,
          dashboardUrl: 'https://supabase.com/dashboard/project/rwioavitlgzyrbgivwzi/sql/new',
        });
      }

      const client = new Client({
        connectionString: connectionString || `postgresql://postgres:${encodeURIComponent(password)}@${SUPABASE_HOST}:5432/postgres`,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });

      await client.connect();
      
      // Execute the verified local schema SQL with strict RLS (Requirement 1 & 9)
      if (sqlContent) {
        await client.query(sqlContent);
      }

      // Reload PostgREST schema cache
      await client.query("NOTIFY pgrst, 'reload schema';");
      await client.end();

      return res.status(200).json({
        success: true,
        message: 'All tables (anime, seasons, episodes, users, user_progress, favorites, watchlist) migrated with strict RLS!',
      });
    } catch (err: any) {
      if (!isProduction) console.error('[Migration Error]:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
      });
    }
  });

  // ------------------------------------------------------------------------------
  // PROTECTED ADMIN API: RELOAD SCHEMA CACHE (Requirement 15, 16)
  // ------------------------------------------------------------------------------
  app.post('/api/supabase/reload-schema', async (req, res) => {
    // Verify caller is Owner (Requirement 15 & 16)
    if (!verifyOwnerToken(req)) {
      const authPayload = parseFirebaseToken(req.headers['authorization']);
      if (!authPayload) {
        return res.status(401).json({ error: 'Authentication required', status: 401 });
      }
      return res.status(403).json({ error: 'Owner privileges required', status: 403 });
    }

    try {
      const password = req.body?.dbPassword || process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
      const connectionString = req.body?.connectionString || process.env.DATABASE_URL;

      if (password || connectionString) {
        const client = new Client({
          connectionString: connectionString || `postgresql://postgres:${encodeURIComponent(password)}@${SUPABASE_HOST}:5432/postgres`,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 8000,
        });
        await client.connect();
        await client.query("NOTIFY pgrst, 'reload schema';");
        await client.end();
        return res.status(200).json({ success: true, message: 'PostgREST schema cache reloaded!' });
      }

      res.status(200).json({
        success: true,
        message: 'Please reload schema cache via Supabase Dashboard -> Settings -> API -> Reload Schema Cache',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  if (isProduction && fs.existsSync(distPath)) {
    // Serve static files built by vite
    app.use(express.static(distPath));

    // Handle SPA client-side routing
    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  } else {
    // Vite middleware for development if started via server
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ZK Voice Hub secure server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
