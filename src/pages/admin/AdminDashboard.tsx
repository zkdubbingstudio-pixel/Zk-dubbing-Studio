import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Film, PlaySquare, Layers, Clock, TrendingUp, Home, Settings,
  Eye, MonitorSmartphone, Calendar, MessageSquare, Heart, Star,
  Activity, Bell, Plus, CheckCircle2, Sparkles, FolderOpen, Flame, 
  ExternalLink, ArrowUpRight, ShieldCheck, Zap, Radio, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAllAnime, getAllSeasons, getAllEpisodes } from '../../lib/dataService';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { subscribeToLiveVisitors, LiveVisitorRecord } from '../../lib/telemetryService';
import SmartImage from '../../components/SmartImage';

export default function AdminDashboard() {
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [seasonsList, setSeasonsList] = useState<any[]>([]);
  const [episodesList, setEpisodesList] = useState<any[]>([]);
  const [liveVisitors, setLiveVisitors] = useState<LiveVisitorRecord[]>([]);
  const [userCount, setUserCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Fetch Dashboard Data from primary database with retry and error safety
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    try {
      const [animes, seasons, episodes] = await Promise.all([
        getAllAnime().catch(() => []),
        getAllSeasons().catch(() => []),
        getAllEpisodes(false).catch(() => []),
      ]);

      setAnimeList(animes || []);
      setSeasonsList(seasons || []);
      setEpisodesList(episodes || []);

      if (db) {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          setUserCount(usersSnap.size);
        } catch {}
      }
    } catch {
      // ignore transient failures
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  // 1. Initial Load & Real-time Listeners
  useEffect(() => {
    fetchDashboardData(false);

    // Real-time Firestore Live Visitors listener (via onSnapshot)
    const unsubVisitors = subscribeToLiveVisitors((visitors) => {
      setLiveVisitors(visitors || []);
    });

    // Real-time Firestore listener for anime updates
    let unsubAnime: (() => void) | undefined;
    if (db) {
      try {
        unsubAnime = onSnapshot(collection(db, 'anime'), (snapshot) => {
          if (!snapshot.empty) {
            const fAnime: any[] = [];
            snapshot.forEach((docSnap) => {
              fAnime.push({ id: docSnap.id, ...docSnap.data() });
            });
            setAnimeList((prev) => {
              const map = new Map<string, any>();
              prev.forEach((a) => map.set(a.id, a));
              fAnime.forEach((a) => map.set(a.id, { ...map.get(a.id), ...a }));
              return Array.from(map.values());
            });
          }
        }, (err) => {
          console.warn('[Firestore] Anime snapshot error notice:', err);
        });
      } catch {}
    }

    // Real-time Firestore listener for episode updates
    let unsubEpisodes: (() => void) | undefined;
    if (db) {
      try {
        unsubEpisodes = onSnapshot(collection(db, 'episodes'), (snapshot) => {
          if (!snapshot.empty) {
            const fEps: any[] = [];
            snapshot.forEach((docSnap) => {
              fEps.push({ id: docSnap.id, ...docSnap.data() });
            });
            setEpisodesList((prev) => {
              const map = new Map<string, any>();
              prev.forEach((e) => map.set(e.id, e));
              fEps.forEach((e) => map.set(e.id, { ...map.get(e.id), ...e }));
              return Array.from(map.values());
            });
          }
        }, (err) => {
          console.warn('[Firestore] Episodes snapshot error notice:', err);
        });
      } catch {}
    }

    // Real-time Firestore listener for season updates
    let unsubSeasons: (() => void) | undefined;
    if (db) {
      try {
        unsubSeasons = onSnapshot(collection(db, 'seasons'), (snapshot) => {
          const fSeasons: any[] = [];
          snapshot.forEach((docSnap) => {
            fSeasons.push({ id: docSnap.id, ...docSnap.data() });
          });
          setSeasonsList(fSeasons);
        }, (err) => {
          console.warn('[Firestore] Seasons snapshot error notice:', err);
        });
      } catch {}
    }

    // Event listeners for in-app publication triggers
    const handleUpdate = () => {
      fetchDashboardData(true);
    };

    window.addEventListener('zk_data_changed', handleUpdate);
    window.addEventListener('zk_anime_published', handleUpdate);
    window.addEventListener('zk_episode_published', handleUpdate);
    window.addEventListener('zk_views_updated', handleUpdate);

    // Auto-refresh pulse every 8 seconds for real-time views freshness
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 8000);

    return () => {
      unsubVisitors();
      if (unsubAnime) unsubAnime();
      if (unsubEpisodes) unsubEpisodes();
      if (unsubSeasons) unsubSeasons();
      window.removeEventListener('zk_data_changed', handleUpdate);
      window.removeEventListener('zk_anime_published', handleUpdate);
      window.removeEventListener('zk_episode_published', handleUpdate);
      window.removeEventListener('zk_views_updated', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchDashboardData]);

  // Compute Real Metric Values (strictly from real database, zero fake numbers)
  const totalAnime = animeList.length;
  const totalEpisodes = episodesList.length;
  const publishedEpisodes = episodesList.filter(e => e.published !== false).length;
  const pendingPublishCount = episodesList.filter(e => e.published === false).length;
  const featuredCount = animeList.filter(a => a.featured === true).length;
  const trendingCount = animeList.filter(a => a.trending === true).length;

  // Live Viewers: real active visitors currently playing an episode
  const liveViewersCount = liveVisitors.filter(v => Boolean(v.isPlaying)).length;

  // Total Views: real sum of all episode views
  const totalEpisodeViews = episodesList.reduce((acc, curr) => acc + (Number(curr.views) || 0), 0);

  // Most Watched Anime: automatically rank by real views (anime.views or aggregated episode views)
  const mostWatched = useMemo(() => {
    return [...animeList]
      .map((anime) => {
        const episodeViewsSum = episodesList
          .filter((e) => e.animeId === anime.id || e.anime_id === anime.id)
          .reduce((sum, ep) => sum + (Number(ep.views) || 0), 0);
        
        const realTotalViews = Math.max(Number(anime.views) || 0, episodeViewsSum);
        return {
          ...anime,
          realTotalViews,
        };
      })
      .sort((a, b) => b.realTotalViews - a.realTotalViews)
      .slice(0, 5);
  }, [animeList, episodesList]);

  // Highest views for accurate relative bar calculation
  const topWatchedViews = mostWatched[0]?.realTotalViews || 0;

  // Recently Added Anime & Episodes (real data)
  const recentAnime = [...animeList].slice(0, 4);
  const recentEpisodes = [...episodesList].slice(0, 4);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-white/50">
        <div className="w-12 h-12 border-4 border-white/10 border-t-brand rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]"></div>
        <p className="text-sm font-bold">Connecting Live Cloud Firestore Streams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Banner */}
      <div className="relative rounded-3xl p-6 md:p-8 overflow-hidden bg-gradient-to-r from-brand/15 via-[#0e1322] to-purple-600/15 border border-brand/30 shadow-[0_10px_35px_rgba(0,229,255,0.15)]">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand text-black shadow-[0_0_10px_rgba(0,229,255,0.4)]">
                Admin Control Deck
              </span>
              <span className="text-xs text-white/50 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Live Firestore onSnapshot Active</span>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              ZK Voice Hub Dashboard
            </h1>
            <p className="text-xs md:text-sm text-white/60 mt-1 max-w-xl">
              Live telemetry monitoring of streaming viewership, catalog titles, Server 1 &amp; Server 2 embeds, and episode releases.
            </p>
          </div>

          {/* Quick Action Buttons in Banner */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/anime"
              className="flex items-center gap-2 px-4 py-2.5 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover transition-all shadow-[0_0_15px_rgba(0,229,255,0.35)]"
            >
              <Plus className="w-4 h-4" /> Add Anime
            </Link>
            <Link
              to="/admin/episodes"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs rounded-xl border border-white/15 transition-all"
            >
              <PlaySquare className="w-4 h-4 text-purple-400" /> Add Episode
            </Link>
          </div>
        </div>
      </div>

      {/* Core Real-time Metrics Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand" /> Core Platform Metrics
          </h2>
          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Real-Time Sync
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3.5">
          {/* 1. Live Viewers */}
          <div className="bg-black/40 border border-emerald-500/40 hover:border-emerald-400 rounded-2xl p-4 transition-all hover:-translate-y-0.5 group shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Live Viewers</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <Radio className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-400">{liveViewersCount}</p>
            <p className="text-[10px] text-white/40 mt-1">Watching episode</p>
          </div>

          {/* 2. Total Views (Sum of all episode views) */}
          <div className="bg-black/40 border border-brand/30 hover:border-brand rounded-2xl p-4 transition-all hover:-translate-y-0.5 group shadow-[0_0_15px_rgba(0,229,255,0.15)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand">Total Views</span>
              <div className="p-1.5 rounded-lg bg-brand/10 text-brand">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-brand">{totalEpisodeViews.toLocaleString()}</p>
            <p className="text-[10px] text-white/40 mt-1">Sum of episode views</p>
          </div>

          {/* 3. Pending Publish */}
          <div className="bg-black/40 border border-amber-500/30 hover:border-amber-400 rounded-2xl p-4 transition-all hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Pending Publish</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-400">{pendingPublishCount}</p>
            <p className="text-[10px] text-white/40 mt-1">Unpublished drafts</p>
          </div>

          {/* 4. Featured */}
          <div className="bg-black/40 border border-yellow-500/30 hover:border-yellow-400 rounded-2xl p-4 transition-all hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-400">Featured</span>
              <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400">
                <Star className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-yellow-400">{featuredCount}</p>
            <p className="text-[10px] text-white/40 mt-1">Hero banners</p>
          </div>

          {/* 5. Trending */}
          <div className="bg-black/40 border border-rose-500/30 hover:border-rose-400 rounded-2xl p-4 transition-all hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">Trending</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-rose-400">{trendingCount}</p>
            <p className="text-[10px] text-white/40 mt-1">Trending badge</p>
          </div>

          {/* 6. Total Anime */}
          <div className="bg-black/40 border border-white/10 hover:border-brand/40 rounded-2xl p-4 transition-all hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">Total Anime</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Film className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{totalAnime}</p>
            <p className="text-[10px] text-white/40 mt-1">Catalog titles</p>
          </div>

          {/* 7. Total Episodes */}
          <div className="bg-black/40 border border-white/10 hover:border-brand/40 rounded-2xl p-4 transition-all hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">Total Episodes</span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <PlaySquare className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{totalEpisodes}</p>
            <p className="text-[10px] text-white/40 mt-1">Across all seasons</p>
          </div>

          {/* 8. Published Episodes */}
          <div className="bg-black/40 border border-white/10 hover:border-brand/40 rounded-2xl p-4 transition-all hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">Published</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-400">{publishedEpisodes}</p>
            <p className="text-[10px] text-white/40 mt-1">Live to viewers</p>
          </div>
        </div>
      </section>

      {/* Row: Most Watched Anime & Quick Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Watched Anime: Ranked automatically by real views */}
        <div className="lg:col-span-2 bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-brand" /> Most Watched Anime
              </h2>
              <p className="text-xs text-white/50">Automatically ranked by real database total views</p>
            </div>
            <Link to="/admin/analytics" className="text-xs font-bold text-brand hover:underline">
              Full Analytics →
            </Link>
          </div>

          <div className="space-y-3">
            {mostWatched.length === 0 ? (
              <p className="text-xs text-white/40 py-8 text-center">No anime titles found.</p>
            ) : (
              mostWatched.map((anime, idx) => {
                const views = anime.realTotalViews;
                const percentage = topWatchedViews > 0 
                  ? Math.min(Math.round((views / topWatchedViews) * 100), 100) 
                  : 0;

                // Format genres safely
                const genresText = Array.isArray(anime.genres) && anime.genres.length > 0
                  ? anime.genres.slice(0, 2).join(', ')
                  : (typeof anime.genres === 'string' && anime.genres ? anime.genres : 'Anime');

                return (
                  <div 
                    key={anime.id}
                    className="p-3 bg-white/5 border border-white/5 hover:border-brand/30 rounded-2xl flex items-center justify-between gap-4 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        idx === 0 ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)]' :
                        idx === 1 ? 'bg-slate-300 text-black' :
                        idx === 2 ? 'bg-amber-700 text-white' :
                        'bg-white/10 text-white/70'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="w-12 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                        <SmartImage 
                          src={anime.poster_url || anime.posterUrl || anime.banner_url || anime.bannerUrl || ""} 
                          alt={anime.title || 'Anime Poster'} 
                          type="poster"
                          className="w-full h-full"
                          style={{ objectFit: 'cover', objectPosition: 'center center' }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white truncate group-hover:text-brand transition-colors">
                            {anime.title || 'Untitled Anime'}
                          </p>
                          {anime.featured && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-300 font-bold">Featured</span>
                          )}
                          {anime.trending && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">Trending</span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          {anime.status || 'Catalog'} • {genresText}
                        </p>
                        
                        {/* Real Progress Bar */}
                        <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div 
                            className="bg-brand h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-extrabold text-brand">{views.toLocaleString()}</p>
                      <p className="text-[10px] text-white/40">views</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Operations Panel */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between space-y-4">
          <div>
            <div className="pb-3 border-b border-white/10 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand" /> Quick Operations
              </h2>
              <p className="text-xs text-white/50">Instant shortcuts to core studio tools</p>
            </div>

            <div className="space-y-2.5">
              <Link
                to="/admin/anime"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Film className="w-4 h-4" />
                  </div>
                  <span>Add New Anime Title</span>
                </div>
                <Plus className="w-4 h-4 text-white/40 group-hover:text-brand" />
              </Link>

              <Link
                to="/admin/episodes"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <PlaySquare className="w-4 h-4" />
                  </div>
                  <span>Publish Episode Embeds</span>
                </div>
                <Plus className="w-4 h-4 text-white/40 group-hover:text-purple-400" />
              </Link>

              <Link
                to="/admin/seasons"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span>Manage Seasons Arc</span>
                </div>
                <Plus className="w-4 h-4 text-white/40 group-hover:text-emerald-400" />
              </Link>

              <Link
                to="/admin/media"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <span>Inspect Media Library</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-cyan-400" />
              </Link>

              <Link
                to="/admin/settings"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span>Backup &amp; Cache Purge</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-amber-400" />
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
            <span>Firebase Sync Engine:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
            </span>
          </div>
        </div>
      </div>

      {/* Row: Recently Added Anime & Recently Added Episodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recently Added Anime */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-brand" /> Recently Added Anime
              </h2>
              <p className="text-xs text-white/50">Latest titles registered in database</p>
            </div>
            <Link to="/admin/anime" className="text-xs font-bold text-brand hover:underline">
              All Titles →
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentAnime.length === 0 ? (
              <p className="text-xs text-white/40 py-6 text-center">No anime available.</p>
            ) : (
              recentAnime.map(anime => (
                <div 
                  key={anime.id}
                  className="flex items-center justify-between gap-3 p-2.5 bg-white/5 border border-white/5 rounded-2xl hover:border-brand/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                      <SmartImage 
                        src={anime.poster_url || anime.posterUrl || anime.banner_url || anime.bannerUrl || ""} 
                        alt={anime.title || 'Anime Poster'} 
                        type="poster"
                        className="w-full h-full"
                        style={{ objectFit: 'cover', objectPosition: 'center center' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{anime.title || 'Untitled Anime'}</p>
                      <p className="text-[10px] text-white/40">
                        {anime.status || 'Catalog'} • {anime.releaseYear || anime.release_year || 'Series'}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/anime/${anime.id}`}
                    target="_blank"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-brand transition-colors"
                    title="View public page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recently Added Episodes */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <PlaySquare className="w-4 h-4 text-purple-400" /> Recently Added Episodes
              </h2>
              <p className="text-xs text-white/50">Latest episode drops with Server 1 &amp; 2 embeds</p>
            </div>
            <Link to="/admin/episodes" className="text-xs font-bold text-purple-400 hover:underline">
              All Episodes →
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentEpisodes.length === 0 ? (
              <p className="text-xs text-white/40 py-6 text-center">No episodes available.</p>
            ) : (
              recentEpisodes.map(ep => (
                <div 
                  key={ep.id}
                  className="flex items-center justify-between gap-3 p-2.5 bg-white/5 border border-white/5 rounded-2xl hover:border-purple-400/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-black/50 overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center">
                      {ep.thumbnailUrl || ep.thumbnail_url ? (
                        <SmartImage 
                          src={ep.thumbnailUrl || ep.thumbnail_url} 
                          alt={ep.title || `Episode ${ep.episodeNumber}`} 
                          type="poster"
                          className="w-full h-full"
                          style={{ objectFit: 'cover', objectPosition: 'center center' }}
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-white/40">Ep {ep.episodeNumber}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">Episode {ep.episodeNumber}: {ep.title || 'Untitled'}</p>
                      <p className="text-[10px] text-white/40">{ep.duration || 'Standard'} • {ep.published !== false ? 'Published' : 'Draft'}</p>
                    </div>
                  </div>
                  <Link
                    to={ep.animeId ? `/watch/${ep.animeId}/${ep.seasonId || 's1'}/${ep.id}` : `/watch/${ep.id}`}
                    target="_blank"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-purple-400 transition-colors"
                    title="Test watch episode"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
