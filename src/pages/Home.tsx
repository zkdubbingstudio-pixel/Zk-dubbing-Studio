import { useState, useEffect, useMemo, useCallback } from 'react';
import { Flame, Sparkles, Trophy, Compass, Film, RotateCcw, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFeaturedAnime, getTrendingAnime, getNewDrops, getAllAnime, isSchemaCachePending, getActiveAnimeTable } from '../lib/dataService';
import { checkSupabaseConnection, supabaseUrl } from '../lib/supabase';
import HeroSlider from '../components/HeroSlider';
import AnimeCard3D from '../components/AnimeCard3D';
import ContinueWatchingRow from '../components/ContinueWatchingRow';
import GenreChipsBar from '../components/GenreChipsBar';
import { HeroSkeleton, SectionSkeleton } from '../components/Skeletons';

const GENRE_LIST = [
  'All',
  'Action',
  'Romance',
  'Fantasy',
  'Comedy',
  'Sci-Fi',
  'Supernatural',
  'Adventure',
  'Drama',
];

export default function Home() {
  const [featuredList, setFeaturedList] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [newDrops, setNewDrops] = useState<any[]>([]);
  const [allAnime, setAllAnime] = useState<any[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRetrying(true);

    try {
      // Pre-flight connection verification to new Supabase project (Requirement 5)
      const health = await checkSupabaseConnection();
      if (!health.ok) {
        console.error('[Supabase Failing Request]: Pre-flight connection verification failed:', {
          endpoint: supabaseUrl,
          message: health.message,
        });
        setError(health.message);
        setLoading(false);
        setRetrying(false);
        return;
      }

      // Use Promise.allSettled to load whatever data resolves immediately (Requirement 3)
      const [featuredRes, trendingRes, dropsRes, allAnimeRes] = await Promise.allSettled([
        getFeaturedAnime(),
        getTrendingAnime(),
        getNewDrops(),
        getAllAnime(),
      ]);

      // Check if primary anime catalog query or all queries failed (Requirement 2 & 8)
      if (allAnimeRes.status === 'rejected') {
        const failureReason = (allAnimeRes as PromiseRejectedResult).reason;
        if (!isSchemaCachePending(failureReason)) {
          const activeTable = await getActiveAnimeTable();
          console.error('[Home Page Failing Request]: Exact error from Supabase:', {
            endpoint: `${supabaseUrl}/rest/v1/${activeTable}`,
            error: failureReason?.message || failureReason,
          });
          setError(failureReason?.message || 'Database connection timed out or endpoint is unreachable.');
          setLoading(false);
          setRetrying(false);
          return;
        }
      }

      const all = allAnimeRes.status === 'fulfilled' ? allAnimeRes.value : [];
      let feat = featuredRes.status === 'fulfilled' ? featuredRes.value : [];
      let trend = trendingRes.status === 'fulfilled' ? trendingRes.value : [];
      const drops = dropsRes.status === 'fulfilled' ? dropsRes.value : [];

      // If featured was empty or failed, use latest 6 from all
      if (feat.length === 0 && all.length > 0) {
        feat = all.slice(0, 6);
      }
      // If trending was empty or failed, use top viewed from all
      if (trend.length === 0 && all.length > 0) {
        trend = [...all].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
      }

      setFeaturedList(feat);
      setTrending(trend);
      setNewDrops(drops);
      setAllAnime(all);
      setError(null);
      setLoading(false);
      setRetrying(false);
    } catch (err: any) {
      const activeTable = await getActiveAnimeTable();
      console.error('[Home Page Failing Request]: Exact error from Supabase:', {
        endpoint: `${supabaseUrl}/rest/v1/${activeTable}`,
        error: err?.message || err,
      });
      setError(err?.message || 'Failed to connect to Supabase. Request timed out or host is unreachable.');
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  // Hard deadline: Stop showing loading skeleton after exactly 10 seconds (Requirement 1, 2, 6)
  useEffect(() => {
    fetchData();

    const tenSecondTimeout = setTimeout(() => {
      setLoading((currLoading) => {
        if (currLoading) {
          console.error('[Home Page Failing Request]: 10-second timeout reached before Supabase response.', {
            endpoint: supabaseUrl,
            deadline: '10000ms',
          });
          setError((currError) => currError || 'Database request timed out after 10 seconds. Please verify Supabase status and retry.');
          setRetrying(false);
          return false;
        }
        return false;
      });
    }, 10000);

    const handleEpisodeDeleted = () => {
      getNewDrops().then(drops => {
        setNewDrops(drops || []);
      }).catch(() => {});
    };

    window.addEventListener('zk_episode_deleted', handleEpisodeDeleted);

    return () => {
      clearTimeout(tenSecondTimeout);
      window.removeEventListener('zk_episode_deleted', handleEpisodeDeleted);
    };
  }, [fetchData]);

  // Filter anime based on selected genre
  const filteredAnime = useMemo(() => {
    if (selectedGenre === 'All') return allAnime;
    return allAnime.filter((a) => {
      if (!a.genres || !Array.isArray(a.genres)) return false;
      return a.genres.some((g: string) => g.toLowerCase() === selectedGenre.toLowerCase());
    });
  }, [allAnime, selectedGenre]);

  // Popular Today: high rating or top view counts
  const popularToday = useMemo(() => {
    const sorted = [...allAnime].sort((a, b) => (b.views || b.rating || 0) - (a.views || a.rating || 0));
    return sorted.slice(0, 10);
  }, [allAnime]);

  // 1. Loading Skeleton (Capped strictly at 10 seconds max)
  if (loading) {
    return (
      <div className="space-y-12 pb-24">
        <HeroSkeleton />
        <SectionSkeleton title="New Drops" />
        <SectionSkeleton title="Trending Now" />
      </div>
    );
  }

  // 2. Error State with Retry Button (Requirement 2 & 8)
  if (error) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="text-center p-8 sm:p-10 glass-cyber-card border border-red-500/30 rounded-3xl max-w-lg shadow-[0_0_45px_rgba(239,68,68,0.25)] space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
              Connection Issue
            </h2>
            <p className="text-sm text-silver/80 leading-relaxed font-mono text-xs break-all bg-black/40 p-3 rounded-xl border border-white/5">
              {error}
            </p>
          </div>

          <p className="text-xs text-silver-dark leading-relaxed">
            Target Host: <span className="font-mono text-cyan-300">{supabaseUrl}</span><br />
            If your Supabase project was paused due to inactivity, restore it in the Supabase Dashboard, then tap retry.
          </p>

          <button
            onClick={() => fetchData()}
            disabled={retrying}
            className="w-full btn-3d-cyan py-3.5 px-8 text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(0,229,255,0.3)]"
          >
            <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'RECONNECTING...' : 'RETRY CONNECTION'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-14 pb-24 overflow-hidden">
      {/* 1. Futuristic 3D Parallax Hero Banner */}
      <HeroSlider featuredList={featuredList} />

      {/* Main Content Sections */}
      <div className="max-w-7xl mx-auto w-full space-y-10 sm:space-y-14">
        
        {/* 2. Continue Watching (Interactive / Logged-in Supabase synced) */}
        <ContinueWatchingRow />

        {/* 3. New Drops Carousel with 3D Anime Cards */}
        {newDrops.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00e5ff]/15 flex items-center justify-center border border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                  <Sparkles className="w-5 h-5 text-brand animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-silver-light tracking-tight">
                    New Drops
                  </h2>
                  <p className="text-xs text-silver-dark font-medium hidden sm:block">
                    Fresh episodes released by ZK Dubbing Studio
                  </p>
                </div>
              </div>

              <Link
                to="/search"
                className="btn-3d-silver text-xs sm:text-sm font-bold px-4 py-1.5 flex items-center gap-1.5 group"
              >
                <span>Explore All</span>
                <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
              </Link>
            </div>

            {/* Horizontal Scroll with 16:9 3D Tilt Cards (Equal width & height) */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 sm:gap-5 pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {newDrops.map((anime: any, index: number) => {
                const epLabel = anime.episodeNumber ? `EP ${anime.episodeNumber}` : anime.latestEpisodeRange || 'EP 1';
                const sLabel = anime.seasonNumber ? `Season ${anime.seasonNumber}` : 'Season 1';

                return (
                  <AnimeCard3D
                    key={anime.dropId ? `drop-${anime.dropId}` : `drop-anime-${anime.id}-${index}`}
                    anime={anime}
                    aspectRatio="video"
                    badgeTopLeft={sLabel}
                    badgeBottomLeft={epLabel}
                    className="flex-none w-64 sm:w-72 md:w-80 snap-start h-full"
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* 4. Trending Now (With Netflix / Crunchyroll 3D Rank Badges) */}
        {trending.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00b4d8]/20 to-[#00e5ff]/20 flex items-center justify-center border border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                  <Flame className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-silver-light tracking-tight">
                    Trending Now
                  </h2>
                  <p className="text-xs text-silver-dark font-medium hidden sm:block">
                    Top watched anime in Hindi Dub this week
                  </p>
                </div>
              </div>

              <Link
                to="/search"
                className="btn-3d-silver text-xs sm:text-sm font-bold px-4 py-1.5 flex items-center gap-1.5 group"
              >
                <span>View Chart</span>
                <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
              </Link>
            </div>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 sm:gap-5 pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {trending.map((anime: any, index: number) => (
                <AnimeCard3D
                  key={anime.id ? `trending-${anime.id}-${index}` : `trending-${index}`}
                  anime={anime}
                  rank={index + 1}
                  className="flex-none w-44 sm:w-52 md:w-60 snap-start"
                />
              ))}
            </div>
          </section>
        )}

        {/* 5. Popular Today (Top Rated Section) */}
        {popularToday.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00e5ff]/15 flex items-center justify-center border border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                  <Trophy className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-silver-light tracking-tight">
                    Popular Today
                  </h2>
                  <p className="text-xs text-silver-dark font-medium hidden sm:block">
                    Community favorites and highest-rated series
                  </p>
                </div>
              </div>
            </div>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 sm:gap-5 pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {popularToday.map((anime: any, index: number) => (
                <AnimeCard3D
                  key={`popular-${anime.id}-${index}`}
                  anime={anime}
                  badgeTopRight="1080P"
                  className="flex-none w-44 sm:w-52 md:w-60 snap-start"
                />
              ))}
            </div>
          </section>
        )}

        {/* 6. Genres with Animated Chips & Dynamic 3D Grid */}
        <section className="px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00e5ff]/15 flex items-center justify-center border border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                <Compass className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-silver-light tracking-tight">
                  Browse by Genre
                </h2>
                <p className="text-xs text-silver-dark font-medium">
                  Select a category to filter your favorite stories
                </p>
              </div>
            </div>

            {/* Total count badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-silver font-semibold bg-white/5 px-3 py-1 rounded-full border border-white/10 font-mono">
                {filteredAnime.length} {filteredAnime.length === 1 ? 'Title' : 'Titles'} Available
              </span>
            </div>
          </div>

          {/* Animated 3D Genre Chips */}
          <GenreChipsBar
            genres={GENRE_LIST}
            selectedGenre={selectedGenre}
            onSelectGenre={setSelectedGenre}
          />

          {/* Filtered Grid or Clean Empty State (Requirement 6) */}
          {filteredAnime.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 pt-2">
              {filteredAnime.map((anime: any, index: number) => (
                <AnimeCard3D
                  key={`filter-${anime.id}-${index}`}
                  anime={anime}
                  className="w-full"
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 glass-cyber-card rounded-3xl border border-white/10 my-6">
              <Film className="w-12 h-12 text-[#00e5ff]/40 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-silver-light">
                {allAnime.length === 0 ? 'No Anime Titles in Database' : `No Anime in "${selectedGenre}" yet`}
              </h3>
              <p className="text-xs text-silver-dark mt-1 max-w-sm mx-auto">
                {allAnime.length === 0
                  ? 'The database is currently empty. Add series or movies from the Admin Panel to populate the catalog.'
                  : 'Check back soon as ZK Dubbing Studio continuously uploads new Hindi dubbed episodes.'}
              </p>
              {allAnime.length > 0 && selectedGenre !== 'All' && (
                <button
                  onClick={() => setSelectedGenre('All')}
                  className="btn-3d-cyan mt-5 px-6 py-2.5 text-xs font-bold cursor-pointer"
                >
                  SHOW ALL ANIME
                </button>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
