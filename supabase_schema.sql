-- ==============================================================================
-- ZK VOICE HUB - COMPLETE SUPABASE DATABASE SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- Tables: anime, seasons, episodes, users, user_progress, favorites, watchlist, backups, activity_logs
-- Security: Strict RLS on EVERY table, Owner-only mutations, User self-service
-- Owner: zkdubbingstudio@gmail.com
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

DROP TRIGGER IF EXISTS trigger_episodes_updated_at ON public.episodes;
CREATE TRIGGER trigger_episodes_updated_at
    BEFORE UPDATE ON public.episodes
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. TABLE: users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    uid TEXT,
    email TEXT,
    full_name TEXT,
    username TEXT,
    displayName TEXT,
    role TEXT DEFAULT 'user',
    photo_url TEXT,
    photoURL TEXT,
    isBanned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 6. TABLE: user_progress (Watch History)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_progress (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    progress_seconds NUMERIC DEFAULT 0,
    duration_seconds NUMERIC DEFAULT 0,
    percentage NUMERIC DEFAULT 0,
    last_watched TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_progress_unique 
    ON public.user_progress(user_id, episode_id);

-- ------------------------------------------------------------------------------
-- 7. TABLE: favorites
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique 
    ON public.favorites(user_id, anime_id);

-- ------------------------------------------------------------------------------
-- 8. TABLE: watchlist
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watchlist (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    status TEXT DEFAULT 'plan_to_watch',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_unique 
    ON public.watchlist(user_id, anime_id);

-- ------------------------------------------------------------------------------
-- 9. TABLE: backups
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.backups (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    entity_id TEXT,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. TABLE: activity_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. INDEXES FOR HIGH PERFORMANCE
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

CREATE INDEX IF NOT EXISTS idx_progress_user ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);

-- ------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) ON EVERY TABLE (Requirement 1, 2, 3)
-- ------------------------------------------------------------------------------
ALTER TABLE public.anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies safely
DO $$ BEGIN
    -- Anime
    DROP POLICY IF EXISTS "Public can view anime" ON public.anime;
    DROP POLICY IF EXISTS "Full access to anime" ON public.anime;
    DROP POLICY IF EXISTS "Owner can insert anime" ON public.anime;
    DROP POLICY IF EXISTS "Owner can update anime" ON public.anime;
    DROP POLICY IF EXISTS "Owner can delete anime" ON public.anime;
    -- Seasons
    DROP POLICY IF EXISTS "Public can view seasons" ON public.seasons;
    DROP POLICY IF EXISTS "Full access to seasons" ON public.seasons;
    DROP POLICY IF EXISTS "Owner can insert seasons" ON public.seasons;
    DROP POLICY IF EXISTS "Owner can update seasons" ON public.seasons;
    DROP POLICY IF EXISTS "Owner can delete seasons" ON public.seasons;
    -- Episodes
    DROP POLICY IF EXISTS "Public can view episodes" ON public.episodes;
    DROP POLICY IF EXISTS "Full access to episodes" ON public.episodes;
    DROP POLICY IF EXISTS "Owner can insert episodes" ON public.episodes;
    DROP POLICY IF EXISTS "Owner can update episodes" ON public.episodes;
    DROP POLICY IF EXISTS "Owner can delete episodes" ON public.episodes;
    -- Users
    DROP POLICY IF EXISTS "Public can view users" ON public.users;
    DROP POLICY IF EXISTS "Users can manage own profile" ON public.users;
    DROP POLICY IF EXISTS "Owner full user management" ON public.users;
    -- User Progress
    DROP POLICY IF EXISTS "Users manage own progress" ON public.user_progress;
    -- Favorites
    DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
    -- Watchlist
    DROP POLICY IF EXISTS "Users manage own watchlist" ON public.watchlist;
    -- Backups
    DROP POLICY IF EXISTS "Owner manages backups" ON public.backups;
    -- Activity logs
    DROP POLICY IF EXISTS "Owner manages activity logs" ON public.activity_logs;
END $$;

-- ------------------------------------------------------------------------------
-- 13. POLICIES: ANIME (Public View, Owner Only Edit/Add/Delete)
-- ------------------------------------------------------------------------------
CREATE POLICY "Public can view anime" 
    ON public.anime 
    FOR SELECT 
    USING (true);

CREATE POLICY "Owner can insert anime" 
    ON public.anime 
    FOR INSERT 
    WITH CHECK (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

CREATE POLICY "Owner can update anime" 
    ON public.anime 
    FOR UPDATE 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    )
    WITH CHECK (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

CREATE POLICY "Owner can delete anime" 
    ON public.anime 
    FOR DELETE 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 14. POLICIES: SEASONS (Public View, Owner Only Edit/Add/Delete)
-- ------------------------------------------------------------------------------
CREATE POLICY "Public can view seasons" 
    ON public.seasons 
    FOR SELECT 
    USING (true);

CREATE POLICY "Owner can insert seasons" 
    ON public.seasons 
    FOR INSERT 
    WITH CHECK (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

CREATE POLICY "Owner can update seasons" 
    ON public.seasons 
    FOR UPDATE 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

CREATE POLICY "Owner can delete seasons" 
    ON public.seasons 
    FOR DELETE 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 15. POLICIES: EPISODES (Public View, Owner Only Edit/Add/Delete)
-- ------------------------------------------------------------------------------
CREATE POLICY "Public can view episodes" 
    ON public.episodes 
    FOR SELECT 
    USING (true);

CREATE POLICY "Owner can insert episodes" 
    ON public.episodes 
    FOR INSERT 
    WITH CHECK (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

CREATE POLICY "Owner can update episodes" 
    ON public.episodes 
    FOR UPDATE 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

CREATE POLICY "Owner can delete episodes" 
    ON public.episodes 
    FOR DELETE 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 16. POLICIES: USERS (Self profile management & Owner access)
-- ------------------------------------------------------------------------------
CREATE POLICY "Public can view users" 
    ON public.users 
    FOR SELECT 
    USING (true);

CREATE POLICY "Users can manage own profile" 
    ON public.users 
    FOR ALL 
    USING (
        auth.uid()::text = id 
        OR auth.uid()::text = uid
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    )
    WITH CHECK (
        auth.uid()::text = id 
        OR auth.uid()::text = uid
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 17. POLICIES: USER_PROGRESS (Watch History - Self user only)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users manage own progress" 
    ON public.user_progress 
    FOR ALL 
    USING (
        auth.uid()::text = user_id 
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    )
    WITH CHECK (
        auth.uid()::text = user_id 
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 18. POLICIES: FAVORITES (Self user only)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users manage own favorites" 
    ON public.favorites 
    FOR ALL 
    USING (
        auth.uid()::text = user_id 
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    )
    WITH CHECK (
        auth.uid()::text = user_id 
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 19. POLICIES: WATCHLIST (Self user only)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users manage own watchlist" 
    ON public.watchlist 
    FOR ALL 
    USING (
        auth.uid()::text = user_id 
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    )
    WITH CHECK (
        auth.uid()::text = user_id 
        OR COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com'
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 20. POLICIES: BACKUPS & ACTIVITY LOGS (Owner only)
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner manages backups" 
    ON public.backups 
    FOR ALL 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

CREATE POLICY "Owner manages activity logs" 
    ON public.activity_logs 
    FOR ALL 
    USING (
        COALESCE(auth.jwt() ->> 'email', '') = 'zkdubbingstudio@gmail.com' 
        OR current_user IN ('postgres', 'service_role')
    );

-- ------------------------------------------------------------------------------
-- 21. REALTIME PUBLICATIONS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
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
        NULL;
END $$;

NOTIFY pgrst, 'reload schema';
