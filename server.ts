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

const SUPABASE_PROJECT_URL = 'https://rwioavitlgzyrbgivwzi.supabase.co';
const SUPABASE_HOST = 'db.rwioavitlgzyrbgivwzi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kecwr9BW3V2UnM4TpruFfQ_S6C7Qsys';

async function startServer() {
  app.use(express.json());

  // Health check endpoint for Cloud Run readiness / liveness
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // Supabase Proxy Route to eliminate browser CORS / network sandboxing failures
  app.all('/api/supabase-proxy*', async (req, res) => {
    try {
      const targetPath = req.originalUrl.replace(/^\/api\/supabase-proxy/, '');
      const targetUrl = `${SUPABASE_PROJECT_URL}${targetPath}`;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

      const outgoingHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string' && !['host', 'connection', 'content-length'].includes(k.toLowerCase())) {
          outgoingHeaders[k] = v;
        }
      }
      if (!outgoingHeaders['apikey']) outgoingHeaders['apikey'] = anonKey;
      if (!outgoingHeaders['authorization']) outgoingHeaders['authorization'] = `Bearer ${anonKey}`;

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: outgoingHeaders,
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
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
      console.error('[Supabase Proxy Error]:', err);
      res.status(502).json({ error: err?.message || 'Supabase proxy request failed' });
    }
  });

  // Supabase migration SQL loader
  const schemaSqlPath = path.resolve(__dirname, 'supabase_schema.sql');

  // Supabase Status Endpoint
  app.get('/api/supabase/status', async (_req, res) => {
    const candidates = ['anime', 'animes', 'anime_list', 'episodes', 'seasons'];
    const results: Record<string, boolean> = {};

    try {
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kecwr9BW3V2UnM4TpruFfQ_S6C7Qsys';
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

  // Supabase Automated Migration Runner (Requirement 3 & 4)
  app.post('/api/supabase/migrate', async (req, res) => {
    try {
      const password = req.body?.dbPassword || process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
      const connectionString = req.body?.connectionString || process.env.DATABASE_URL;

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
      
      // Execute the schema SQL
      if (sqlContent) {
        await client.query(sqlContent);
      } else {
        // Fallback minimal DDL if file not found
        await client.query(`
          CREATE TABLE IF NOT EXISTS anime (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            synopsis TEXT,
            poster_url TEXT,
            banner_url TEXT,
            genres TEXT[] DEFAULT '{}',
            language TEXT DEFAULT 'Hindi Dub',
            status TEXT DEFAULT 'Ongoing',
            rating TEXT DEFAULT '9.5',
            release_year TEXT,
            type TEXT DEFAULT 'TV Series',
            featured BOOLEAN DEFAULT false,
            trending BOOLEAN DEFAULT false,
            views INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS seasons (
            id TEXT PRIMARY KEY,
            anime_id TEXT NOT NULL,
            season_number INTEGER NOT NULL DEFAULT 1,
            title TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS episodes (
            id TEXT PRIMARY KEY,
            anime_id TEXT NOT NULL,
            season_id TEXT,
            season_number INTEGER DEFAULT 1,
            episode_number INTEGER NOT NULL DEFAULT 1,
            episode_title TEXT,
            thumbnail_url TEXT,
            duration TEXT,
            server1_url TEXT,
            server2_url TEXT,
            server3_url TEXT,
            views INTEGER DEFAULT 0,
            published BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE anime ENABLE ROW LEVEL SECURITY;
          ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
          ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
          CREATE POLICY "Allow select all on anime" ON anime FOR SELECT USING (true);
          CREATE POLICY "Allow all on anime" ON anime USING (true) WITH CHECK (true);
          CREATE POLICY "Allow select all on seasons" ON seasons FOR SELECT USING (true);
          CREATE POLICY "Allow all on seasons" ON seasons USING (true) WITH CHECK (true);
          CREATE POLICY "Allow select all on episodes" ON episodes FOR SELECT USING (true);
          CREATE POLICY "Allow all on episodes" ON episodes USING (true) WITH CHECK (true);
        `);
      }

      // Reload PostgREST schema cache (Requirement 4)
      await client.query("NOTIFY pgrst, 'reload schema';");
      await client.end();

      return res.status(200).json({
        success: true,
        message: 'Tables (anime, episodes, seasons) created and schema cache reloaded successfully!',
      });
    } catch (err: any) {
      console.error('[Migration Error]:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
      });
    }
  });

  // Supabase Reload Schema Cache Endpoint (Requirement 4)
  app.post('/api/supabase/reload-schema', async (req, res) => {
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

      // If no pg connection, return instructions
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
    console.log(`ZK Voice Hub server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
