import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  LogOut, 
  Shield, 
  Clock, 
  Play, 
  Trash2, 
  User as UserIcon, 
  Compass, 
  Heart, 
  History, 
  Film, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  signOutUser, 
  isAuthorizedAdmin 
} from '../lib/authService';
import { 
  getUserProgress, 
  deleteUserProgress, 
  getWatchHistory, 
  getFavorites, 
  removeFavorite 
} from '../lib/dataService';
import SmartImage from '../components/SmartImage';

type ProfileTab = 'continue' | 'history' | 'favorites' | 'recent';

export default function Profile() {
  const { user, setUser, setAuthSuccessMessage, setAuthModalOpen } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ProfileTab>('continue');
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [favoriteAnime, setFavoriteAnime] = useState<any[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const effectiveUserId = user?.uid || user?.id || null;
  const isSignedIn = Boolean(user);

  // Identifiers
  const email = (user?.email || '').toLowerCase();
  const displayName = user?.name || user?.displayName || (email ? email.split('@')[0] : 'Anime Fan');
  const photoURL = user?.profilePhoto || user?.photoURL || '';
  const isAdmin = Boolean(email && isAuthorizedAdmin(email));

  // Joined Date calculation
  const joinedDate = React.useMemo(() => {
    try {
      const rawTimestamp = user?.createdAt;
      if (rawTimestamp) {
        const d = new Date(typeof rawTimestamp === 'number' ? rawTimestamp : String(rawTimestamp));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {}
    return 'October 2024';
  }, [user]);

  // Load real data for all 4 profile sections (from Supabase / Firestore + local storage fallback)
  useEffect(() => {
    let isMounted = true;

    async function loadAllProfileData() {
      setDataLoading(true);

      // 1. Local fallback data
      let localHistory: any[] = [];
      let localFavorites: any[] = [];
      try {
        const storedHist = localStorage.getItem('zk_watch_history');
        if (storedHist) localHistory = JSON.parse(storedHist);
      } catch {}
      try {
        const storedFavs = localStorage.getItem('zk_local_favorites');
        if (storedFavs) localFavorites = JSON.parse(storedFavs);
      } catch {}

      // 2. Remote database fetch if signed in
      let remoteProgress: any[] = [];
      let remoteHistory: any[] = [];
      let remoteFavorites: any[] = [];

      if (effectiveUserId) {
        try {
          const [prog, hist, favs] = await Promise.all([
            getUserProgress(effectiveUserId),
            getWatchHistory(effectiveUserId),
            getFavorites(effectiveUserId),
          ]);
          remoteProgress = prog || [];
          remoteHistory = hist || [];
          remoteFavorites = favs || [];
        } catch (err) {
          console.warn('Error loading remote profile data:', err);
        }
      }

      if (!isMounted) return;

      // Merge Continue Watching
      const validRemoteProgress = remoteProgress.filter((p: any) => Boolean(p && p.anime_id && p.episode_id));
      const formattedLocalProgress = localHistory.map((item: any) => ({
        id: item.episodeId,
        user_id: effectiveUserId || 'guest',
        anime_id: item.animeId,
        anime_title: item.animeTitle,
        episode_id: item.episodeId,
        episode_title: item.episodeTitle,
        season_id: item.seasonId,
        season_number: item.seasonNumber,
        episode_number: item.episodeNumber,
        poster_url: item.posterUrl,
        current_time: 240,
        duration: 1440,
        updated_at: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
      }));

      // Combine and deduplicate Continue Watching
      const progressMap = new Map<string, any>();
      validRemoteProgress.forEach((p) => progressMap.set(p.episode_id, p));
      formattedLocalProgress.forEach((p) => {
        if (!progressMap.has(p.episode_id)) {
          progressMap.set(p.episode_id, p);
        }
      });
      const mergedContinue = Array.from(progressMap.values());
      setContinueWatching(mergedContinue);

      // Merge Watch History (Full chronological list)
      const mergedHist = remoteHistory.length > 0 ? remoteHistory : formattedLocalProgress;
      setWatchHistory(mergedHist);

      // Recently Watched: Unique anime series extracted from watch history
      const recentAnimeMap = new Map<string, any>();
      mergedHist.forEach((item) => {
        const aid = item.anime_id || item.animeId;
        if (aid && !recentAnimeMap.has(aid)) {
          recentAnimeMap.set(aid, {
            id: aid,
            title: item.anime_title || item.animeTitle || 'Anime',
            posterUrl: item.poster_url || item.posterUrl || '',
            lastEpisode: item.episode_number || item.episodeNumber || 1,
            lastEpisodeTitle: item.episode_title || item.episodeTitle || '',
            seasonNumber: item.season_number || item.seasonNumber || 1,
            seasonId: item.season_id || item.seasonId || 's1',
            episodeId: item.episode_id || item.episodeId || '',
            updatedAt: item.updated_at || item.timestamp,
          });
        }
      });
      setRecentlyWatched(Array.from(recentAnimeMap.values()));

      // Merge Favorites
      const favMap = new Map<string, any>();
      remoteFavorites.forEach((f) => {
        const fid = f.anime_id || f.id;
        if (fid) favMap.set(fid, f);
      });
      localFavorites.forEach((f) => {
        const fid = f.anime_id || f.id;
        if (fid && !favMap.has(fid)) {
          favMap.set(fid, f);
        }
      });
      setFavoriteAnime(Array.from(favMap.values()));

      setDataLoading(false);
    }

    loadAllProfileData();

    return () => {
      isMounted = false;
    };
  }, [effectiveUserId]);

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch {}
    setUser(null);
    setAuthSuccessMessage('Logged out successfully.');
    navigate('/');
  };

  const handleSignIn = () => {
    setAuthModalOpen(true);
  };

  const handleRemoveContinue = async (episodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (effectiveUserId) {
      await deleteUserProgress(effectiveUserId, episodeId);
    }
    // Also remove from local storage
    try {
      const stored = localStorage.getItem('zk_watch_history');
      if (stored) {
        const parsed = JSON.parse(stored).filter((item: any) => item.episodeId !== episodeId);
        localStorage.setItem('zk_watch_history', JSON.stringify(parsed));
      }
    } catch {}
    setContinueWatching((prev) => prev.filter((item) => (item.episode_id || item.episodeId) !== episodeId));
  };

  const handleRemoveFavorite = async (animeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (effectiveUserId) {
      await removeFavorite(effectiveUserId, animeId);
    }
    try {
      const localFavs = JSON.parse(localStorage.getItem('zk_local_favorites') || '[]');
      const filtered = localFavs.filter((f: any) => f.id !== animeId && f.anime_id !== animeId);
      localStorage.setItem('zk_local_favorites', JSON.stringify(filtered));
    } catch {}
    setFavoriteAnime((prev) => prev.filter((f) => (f.anime_id || f.id) !== animeId));
  };

  const formatTimeAgo = (timestamp?: string | number): string => {
    if (!timestamp) return '';
    try {
      const timeMs = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
      const diffMs = Date.now() - timeMs;
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 60) return `${Math.max(1, mins)}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-[#05070b] pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* 1. Header Card: Profile Photo, Display Name, Email, Joined Date */}
        <div className="glass-cyber-card rounded-3xl p-6 sm:p-8 border border-[#00e5ff]/20 shadow-[0_10px_35px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00e5ff]/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative z-10">
            
            {/* User Avatar, Display Name, Email, Joined Date */}
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-[#00e5ff] shadow-[0_0_25px_rgba(0,229,255,0.35)] bg-[#0a0e17] flex items-center justify-center">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-[#00e5ff]/20 to-[#0a1120] flex items-center justify-center text-3xl font-black text-[#00e5ff]">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[#05070b] border border-[#00e5ff]/50 flex items-center justify-center shadow-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                    {displayName}
                  </h1>
                  {isAdmin ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-silver border border-white/10">
                      {isSignedIn ? 'Member' : 'Guest'}
                    </span>
                  )}
                </div>

                <p className="text-sm text-silver/70 font-mono break-all">
                  {email || 'Free Visitor (Guest Mode)'}
                </p>

                {/* Joined Date */}
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-white/50 pt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-[#00e5ff]" />
                  <span>Joined {joinedDate}</span>
                </div>
              </div>
            </div>

            {/* Actions: Sign Out (and Admin Panel ONLY if admin) */}
            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0 w-full sm:w-auto">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[#00e5ff]/15 hover:bg-[#00e5ff]/25 text-[#00e5ff] border border-[#00e5ff]/40 transition-all duration-300 shadow-[0_0_20px_rgba(0,229,255,0.15)]"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Panel</span>
                </Link>
              )}

              {isSignedIn ? (
                <button
                  onClick={handleLogout}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-950/30 hover:bg-red-900/50 text-red-300 hover:text-red-200 border border-red-500/30 transition-all duration-300 cursor-pointer shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black shadow-[0_0_20px_rgba(0,229,255,0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-black" />
                  <span>Sign In</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* 2. Cyber Tabs: Continue Watching | Watch History | Favorite Anime | Recently Watched */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('continue')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'continue'
                ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Continue Watching</span>
            {continueWatching.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#00e5ff]/20 text-[#00e5ff]">
                {continueWatching.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Watch History</span>
            {watchHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-white/70">
                {watchHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Favorite Anime</span>
            {favoriteAnime.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-white/70">
                {favoriteAnime.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('recent')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'recent'
                ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Recently Watched</span>
            {recentlyWatched.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-white/70">
                {recentlyWatched.length}
              </span>
            )}
          </button>
        </div>

        {/* 3. Tab Content */}
        {dataLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="glass-cyber-card rounded-2xl p-3 border border-white/5 animate-pulse space-y-3">
                <div className="aspect-video rounded-xl bg-white/5" />
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* TAB 1: Continue Watching */}
            {activeTab === 'continue' && (
              continueWatching.length === 0 ? (
                <EmptyState
                  icon={<Clock className="w-12 h-12 text-[#00e5ff]" />}
                  title="No Continue Watching Yet"
                  description="You haven't started watching any anime yet. Stream an episode to automatically track and resume your progress here."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {continueWatching.map((item) => {
                    const currentTime = Number(item.current_time) || 0;
                    const duration = Number(item.duration) || 1440;
                    const percent = Math.min(100, Math.max(5, Math.round((currentTime / duration) * 100)));
                    const epId = item.episode_id || item.episodeId;
                    const watchUrl = `/watch/${item.anime_id || item.animeId}/${item.season_id || item.seasonId || 's1'}/${epId}`;

                    return (
                      <div
                        key={item.id || epId}
                        className="group glass-cyber-card rounded-2xl p-3 border border-white/10 hover:border-[#00e5ff]/50 transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                      >
                        <Link to={watchUrl} className="block relative aspect-video rounded-xl overflow-hidden bg-[#0a0e17] mb-3">
                          <SmartImage
                            src={item.poster_url || item.posterUrl || ''}
                            alt={item.anime_title || 'Episode'}
                            type="poster"
                            loading="lazy"
                            className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                            style={{ objectFit: 'cover', objectPosition: 'center center' }}
                            titleFallback={item.anime_title || 'Continue Stream'}
                          />
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-11 h-11 rounded-full bg-[#00e5ff] text-black flex items-center justify-center shadow-[0_0_20px_#00e5ff]">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/70">
                            <div className="h-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]" style={{ width: `${percent}%` }} />
                          </div>
                        </Link>

                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <Link to={watchUrl} className="font-black text-sm text-white group-hover:text-[#00e5ff] transition-colors line-clamp-1">
                              {item.anime_title || item.animeTitle || 'Anime Series'}
                            </Link>
                            <button
                              onClick={(e) => handleRemoveContinue(epId, e)}
                              title="Remove from Continue Watching"
                              className="text-silver-dark hover:text-red-400 p-1 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-xs text-[#00e5ff] font-semibold truncate">
                            {item.episode_title || item.episodeTitle || `Episode ${item.episode_number || item.episodeNumber || 1}`}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-silver-dark pt-0.5">
                            <span>Season {item.season_number || item.seasonNumber || 1}</span>
                            {item.updated_at && <span>{formatTimeAgo(item.updated_at)}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* TAB 2: Watch History */}
            {activeTab === 'history' && (
              watchHistory.length === 0 ? (
                <EmptyState
                  icon={<History className="w-12 h-12 text-[#00e5ff]" />}
                  title="No Watch History"
                  description="Episodes you stream will appear here in chronological order so you can easily review your watch journey."
                />
              ) : (
                <div className="space-y-3">
                  {watchHistory.map((item, idx) => {
                    const epId = item.episode_id || item.episodeId;
                    const watchUrl = `/watch/${item.anime_id || item.animeId}/${item.season_id || item.seasonId || 's1'}/${epId}`;

                    return (
                      <div
                        key={item.id || `${epId}_${idx}`}
                        className="glass-cyber-card p-3.5 sm:p-4 rounded-2xl border border-white/10 hover:border-[#00e5ff]/40 flex items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-12 rounded-xl overflow-hidden bg-[#0a0e17] shrink-0 border border-white/10">
                            <SmartImage
                              src={item.poster_url || item.posterUrl || ''}
                              alt={item.anime_title || 'Episode'}
                              type="poster"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <Link to={watchUrl} className="font-bold text-sm text-white hover:text-[#00e5ff] transition-colors truncate block">
                              {item.anime_title || item.animeTitle || 'Anime Series'}
                            </Link>
                            <p className="text-xs text-[#00e5ff] truncate">
                              {item.episode_title || item.episodeTitle || `Episode ${item.episode_number || item.episodeNumber || 1}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-white/50 hidden sm:inline-block">
                            {formatTimeAgo(item.updated_at || item.timestamp)}
                          </span>
                          <Link
                            to={watchUrl}
                            className="p-2 rounded-xl bg-[#00e5ff]/15 hover:bg-[#00e5ff] text-[#00e5ff] hover:text-black transition-all"
                            title="Replay"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* TAB 3: Favorite Anime */}
            {activeTab === 'favorites' && (
              favoriteAnime.length === 0 ? (
                <EmptyState
                  icon={<Heart className="w-12 h-12 text-[#00e5ff]" />}
                  title="No Favorite Anime Yet"
                  description="Tap the heart icon on any anime details page to pin your favorite series and movies here."
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {favoriteAnime.map((item) => {
                    const aid = item.anime_id || item.id;
                    const detailsUrl = `/anime/${aid}`;

                    return (
                      <div
                        key={aid}
                        className="glass-cyber-card rounded-2xl p-2.5 border border-white/10 hover:border-[#00e5ff]/50 transition-all flex flex-col justify-between group"
                      >
                        <Link to={detailsUrl} className="block relative aspect-[2/3] rounded-xl overflow-hidden bg-[#0a0e17] mb-2.5">
                          <SmartImage
                            src={item.poster_url || item.posterUrl || ''}
                            alt={item.anime_title || item.title || 'Anime'}
                            type="poster"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-[#00e5ff] text-black flex items-center justify-center shadow-[0_0_15px_#00e5ff]">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </div>
                          </div>
                        </Link>

                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <Link to={detailsUrl} className="font-bold text-xs sm:text-sm text-white group-hover:text-[#00e5ff] transition-colors line-clamp-1">
                              {item.anime_title || item.title || 'Anime Series'}
                            </Link>
                            <button
                              onClick={(e) => handleRemoveFavorite(aid, e)}
                              className="text-red-400/70 hover:text-red-400 p-0.5 cursor-pointer shrink-0"
                              title="Remove Favorite"
                            >
                              <Heart className="w-3.5 h-3.5 fill-current" />
                            </button>
                          </div>
                          <span className="text-[10px] text-white/50 block">Favorited Title</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* TAB 4: Recently Watched */}
            {activeTab === 'recent' && (
              recentlyWatched.length === 0 ? (
                <EmptyState
                  icon={<Film className="w-12 h-12 text-[#00e5ff]" />}
                  title="No Recently Watched Series"
                  description="When you start watching episodes, the anime series will be highlighted here for one-tap streaming resumption."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentlyWatched.map((anime) => {
                    const resumeUrl = `/watch/${anime.id}/${anime.seasonId || 's1'}/${anime.episodeId}`;

                    return (
                      <div
                        key={anime.id}
                        className="glass-cyber-card rounded-2xl p-4 border border-white/10 hover:border-[#00e5ff]/50 transition-all flex items-center gap-4 group"
                      >
                        <div className="w-18 h-24 rounded-xl overflow-hidden bg-[#0a0e17] shrink-0 border border-white/10 relative">
                          <SmartImage
                            src={anime.posterUrl}
                            alt={anime.title}
                            type="poster"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="font-bold text-sm text-white group-hover:text-[#00e5ff] transition-colors truncate">
                            {anime.title}
                          </h4>
                          <p className="text-xs text-[#00e5ff] font-semibold truncate">
                            Last: Ep {anime.lastEpisode}
                          </p>
                          <p className="text-[11px] text-white/50">
                            Season {anime.seasonNumber} • {formatTimeAgo(anime.updatedAt)}
                          </p>

                          <div className="pt-2">
                            <Link
                              to={resumeUrl}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00e5ff] text-black font-extrabold text-xs shadow-[0_0_10px_rgba(0,229,255,0.3)] hover:scale-105 transition-all"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play Ep {anime.lastEpisode}</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass-cyber-card rounded-3xl p-10 sm:p-14 text-center border border-white/10 relative overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
      <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#00e5ff]/10 border border-[#00e5ff]/20 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-2">
        {title}
      </h3>
      <p className="text-sm text-silver/70 max-w-md mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 btn-3d-cyan px-7 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(0,229,255,0.3)]"
      >
        <Compass className="w-4 h-4" />
        <span>Explore Anime Catalog</span>
      </Link>
    </div>
  );
}
