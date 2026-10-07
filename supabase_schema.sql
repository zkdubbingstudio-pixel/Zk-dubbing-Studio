-- ZK Voice Hub - Supabase Complete Architecture Schema
-- Architecture: Supabase = Main Database, Firebase = Authentication only

-- 1. Anime Table
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
    content_type TEXT DEFAULT 'TV Series',
    is_movie BOOLEAN DEFAULT false,
    duration TEXT,
    release_date TEXT,
    server1_url TEXT,
    server2_url TEXT,
    server3_url TEXT,
    dubbed_by TEXT DEFAULT 'ZK Dubbing Studio',
    dub_credits JSONB,
    featured BOOLEAN DEFAULT false,
    trending BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all columns exist on existing anime table
ALTER TABLE anime ADD COLUMN IF NOT EXISTS synopsis TEXT;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS rating TEXT DEFAULT '9.5';
ALTER TABLE anime ADD COLUMN IF NOT EXISTS release_year TEXT;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'TV Series';
ALTER TABLE anime ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'TV Series';
ALTER TABLE anime ADD COLUMN IF NOT EXISTS is_movie BOOLEAN DEFAULT false;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS release_date TEXT;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS server1_url TEXT;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS server2_url TEXT;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS server3_url TEXT;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS dubbed_by TEXT DEFAULT 'ZK Dubbing Studio';
ALTER TABLE anime ADD COLUMN IF NOT EXISTS dub_credits JSONB;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE anime ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Seasons Table
CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL,
    season_number INTEGER NOT NULL DEFAULT 1,
    title TEXT,
    description TEXT,
    banner_url TEXT,
    poster_url TEXT,
    "order" INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Published',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE seasons ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 1;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Published';

-- 3. Episodes Table
CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL,
    season_id TEXT,
    season_number INTEGER DEFAULT 1,
    episode_number INTEGER NOT NULL DEFAULT 1,
    episode_title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    duration TEXT,
    release_date TEXT,
    server1_url TEXT,
    server2_url TEXT,
    server3_url TEXT,
    abyss_url TEXT,
    filemoon_url TEXT,
    vdohide_url TEXT,
    telegram_file_id TEXT,
    archive_url TEXT,
    dailymotion_url TEXT,
    views INTEGER DEFAULT 0,
    published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS season_number INTEGER DEFAULT 1;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS release_date TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS server1_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS server2_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS server3_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS abyss_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS filemoon_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS vdohide_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Users Table (Hold Firebase UID strings for auth sync)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    username TEXT,
    role TEXT DEFAULT 'user',
    photo_url TEXT,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. WatchHistory Table (Continue Watching)
CREATE TABLE IF NOT EXISTS watchhistory (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    season_id TEXT,
    watched_time INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

ALTER TABLE watchhistory ADD COLUMN IF NOT EXISTS anime_id TEXT;
ALTER TABLE watchhistory ADD COLUMN IF NOT EXISTS season_id TEXT;
ALTER TABLE watchhistory ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0;

-- 6. Backups Table (Automatic disaster recovery snapshots)
CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    backup_type TEXT NOT NULL,
    entity_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_anime_featured ON anime(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_anime_trending ON anime(trending) WHERE trending = true;
CREATE INDEX IF NOT EXISTS idx_anime_type ON anime(type);
CREATE INDEX IF NOT EXISTS idx_anime_created ON anime(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_anime_id ON episodes(anime_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_episodes_created ON episodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seasons_anime_id ON seasons(anime_id);
CREATE INDEX IF NOT EXISTS idx_watchhistory_user ON watchhistory(user_id, updated_at DESC);

-- Enable RLS
ALTER TABLE anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchhistory ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON users;
    DROP POLICY IF EXISTS "Users can insert their own profile." ON users;
    DROP POLICY IF EXISTS "Users can update own profile." ON users;
    DROP POLICY IF EXISTS "Anime is viewable by everyone." ON anime;
    DROP POLICY IF EXISTS "Seasons are viewable by everyone." ON seasons;
    DROP POLICY IF EXISTS "Episodes are viewable by everyone." ON episodes;
    DROP POLICY IF EXISTS "All users can manage anime." ON anime;
    DROP POLICY IF EXISTS "All users can manage seasons." ON seasons;
    DROP POLICY IF EXISTS "All users can manage episodes." ON episodes;
    DROP POLICY IF EXISTS "Users can view own watch history." ON watchhistory;
    DROP POLICY IF EXISTS "Users can insert own watch history." ON watchhistory;
    DROP POLICY IF EXISTS "Users can update own watch history." ON watchhistory;
END $$;

CREATE POLICY "Anime is viewable by everyone" ON anime FOR SELECT USING (true);
CREATE POLICY "Seasons are viewable by everyone" ON seasons FOR SELECT USING (true);
CREATE POLICY "Episodes are viewable by everyone" ON episodes FOR SELECT USING (true);
CREATE POLICY "Public profiles are viewable by everyone" ON users FOR SELECT USING (true);

CREATE POLICY "Allow all operations on anime" ON anime USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on seasons" ON seasons USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on episodes" ON episodes USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on users" ON users USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on watchhistory" ON watchhistory USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on backups" ON backups USING (true) WITH CHECK (true);
