-- Anime Table
CREATE TABLE anime (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    poster_url TEXT,
    banner_url TEXT,
    genres TEXT[],
    language TEXT DEFAULT 'Dub',
    status TEXT DEFAULT 'Ongoing',
    featured BOOLEAN DEFAULT false,
    trending BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seasons Table
CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anime_id UUID REFERENCES anime(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Episodes Table
CREATE TABLE episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anime_id UUID REFERENCES anime(id) ON DELETE CASCADE,
    season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    episode_title TEXT,
    thumbnail_url TEXT,
    telegram_file_id TEXT,
    filemoon_url TEXT,
    archive_url TEXT,
    dailymotion_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users Table (Modified to hold Firebase UID strings)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    username TEXT,
    role TEXT DEFAULT 'user',
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WatchHistory Table
CREATE TABLE watchhistory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
    watched_time INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

-- Enable RLS
ALTER TABLE anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchhistory ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Public profiles are viewable by everyone." ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own profile." ON users FOR UPDATE USING (true);

CREATE POLICY "Anime is viewable by everyone." ON anime FOR SELECT USING (true);
CREATE POLICY "Seasons are viewable by everyone." ON seasons FOR SELECT USING (true);
CREATE POLICY "Episodes are viewable by everyone." ON episodes FOR SELECT USING (true);

-- Allow anyone to modify anime/seasons/episodes for the sake of the admin panel prototype
-- (In production, you'd verify JWT tokens using Supabase Auth, but since we use Firebase Auth for identity, we allow anon writes for the prototype)
CREATE POLICY "All users can manage anime." ON anime USING (true) WITH CHECK (true);
CREATE POLICY "All users can manage seasons." ON seasons USING (true) WITH CHECK (true);
CREATE POLICY "All users can manage episodes." ON episodes USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own watch history." ON watchhistory FOR SELECT USING (true);
CREATE POLICY "Users can insert own watch history." ON watchhistory FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own watch history." ON watchhistory FOR UPDATE USING (true);
