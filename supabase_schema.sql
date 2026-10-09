-- ==============================================================================
-- ZK VOICE HUB - COMPLETE SUPABASE DATABASE MIGRATION
-- Tables: anime, seasons, episodes
-- Features: Primary & Foreign Keys, Timestamps, Triggers, Indexes, RLS, Realtime
-- ==============================================================================

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. TABLE: anime
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anime (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for anime.updated_at
DROP TRIGGER IF EXISTS trigger_anime_updated_at ON public.anime;
CREATE TRIGGER trigger_anime_updated_at
    BEFORE UPDATE ON public.anime
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TABLE: seasons
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seasons (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL DEFAULT 1,
    title TEXT,
    description TEXT,
    banner_url TEXT,
    poster_url TEXT,
    "order" INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Published',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for seasons.updated_at
DROP TRIGGER IF EXISTS trigger_seasons_updated_at ON public.seasons;
CREATE TRIGGER trigger_seasons_updated_at
    BEFORE UPDATE ON public.seasons
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 4. TABLE: episodes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.episodes (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
    season_id TEXT REFERENCES public.seasons(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for episodes.updated_at
DROP TRIGGER IF EXISTS trigger_episodes_updated_at ON public.episodes;
CREATE TRIGGER trigger_episodes_updated_at
    BEFORE UPDATE ON public.episodes
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_anime_featured ON public.anime(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_anime_trending ON public.anime(trending) WHERE trending = true;
CREATE INDEX IF NOT EXISTS idx_anime_type ON public.anime(type);
CREATE INDEX IF NOT EXISTS idx_anime_created_at ON public.anime(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anime_views ON public.anime(views DESC);

CREATE INDEX IF NOT EXISTS idx_seasons_anime_id ON public.seasons(anime_id);
CREATE INDEX IF NOT EXISTS idx_seasons_order ON public.seasons(anime_id, season_number ASC);

CREATE INDEX IF NOT EXISTS idx_episodes_anime_id ON public.episodes(anime_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON public.episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_episodes_created_at ON public.episodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_order ON public.episodes(anime_id, season_number, episode_number ASC);

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public can view anime" ON public.anime;
    DROP POLICY IF EXISTS "Full access to anime" ON public.anime;
    DROP POLICY IF EXISTS "Public can view seasons" ON public.seasons;
    DROP POLICY IF EXISTS "Full access to seasons" ON public.seasons;
    DROP POLICY IF EXISTS "Public can view episodes" ON public.episodes;
    DROP POLICY IF EXISTS "Full access to episodes" ON public.episodes;
END $$;

-- 6a. Policies for Anime
CREATE POLICY "Public can view anime" 
    ON public.anime 
    FOR SELECT 
    USING (true);

CREATE POLICY "Full access to anime" 
    ON public.anime 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 6b. Policies for Seasons
CREATE POLICY "Public can view seasons" 
    ON public.seasons 
    FOR SELECT 
    USING (true);

CREATE POLICY "Full access to seasons" 
    ON public.seasons 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 6c. Policies for Episodes
CREATE POLICY "Public can view episodes" 
    ON public.episodes 
    FOR SELECT 
    USING (true);

CREATE POLICY "Full access to episodes" 
    ON public.episodes 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. ENABLE REALTIME
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    -- Add tables to the supabase_realtime publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'anime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.anime;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'seasons'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.seasons;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'episodes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.episodes;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If supabase_realtime publication does not exist in standard mode, create it
        NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 8. REFRESH SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
