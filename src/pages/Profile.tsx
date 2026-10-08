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
  AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  signOutUser, 
  isAuthorizedAdmin, 
  signInWithGoogle 
} from '../lib/authService';
import { 
  getUserProgress, 
  deleteUserProgress 
} from '../lib/dataService';

export default function Profile() {
  const { user, firebaseUser, loading } = useAuthStore();
  const navigate = useNavigate();

  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const effectiveUserId = user?.uid || firebaseUser?.uid || null;

  // If the user is not signed in, redirect to Google Sign-In instead of showing fake profile data
  useEffect(() => {
    if (!loading && !user && !firebaseUser) {
      setIsRedirecting(true);
      signInWithGoogle({ preferRedirect: true }).catch((err) => {
        console.warn('Google Sign-In redirect initiation:', err);
        setIsRedirecting(false);
        setAuthError(err?.message || 'Please sign in with Google to view your profile.');
      });
    }
  }, [loading, user, firebaseUser]);

  // Load Continue Watching ONLY from user's real watch history in Supabase user_progress table
  useEffect(() => {
    let isMounted = true;

    async function loadWatchHistory() {
      if (!effectiveUserId) {
        if (isMounted) setDataLoading(false);
        return;
      }

      setDataLoading(true);
      try {
        const progressList = await getUserProgress(effectiveUserId);
        if (isMounted) {
          // Strictly verify real records: must have anime_id and episode_id
          const validRecords = (progressList || []).filter(
            (item: any) => Boolean(item && item.anime_id && item.episode_id)
          );
          setContinueWatching(validRecords);
        }
      } catch (err) {
        console.error('Error loading Supabase continue watching data:', err);
      } finally {
        if (isMounted) setDataLoading(false);
      }
    }

    loadWatchHistory();

    return () => {
      isMounted = false;
    };
  }, [effectiveUserId]);

  const handleLogout = async () => {
    try {
      await signOutUser();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleRemoveProgress = async (episodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!effectiveUserId) return;
    await deleteUserProgress(effectiveUserId, episodeId);
    setContinueWatching((prev) => prev.filter((item) => item.episode_id !== episodeId));
  };

  const formatTimeAgo = (timestamp?: string): string => {
    if (!timestamp) return '';
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
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

  // Identifiers: Only Avatar, Display Name, Email
  const displayName = firebaseUser?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User';
  const email = firebaseUser?.email || user?.email || '';
  const photoURL = firebaseUser?.photoURL || user?.photoURL;
  const isAdmin = isAuthorizedAdmin(email) || user?.role === 'admin';

  // 1. Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070b] pt-28 pb-16 flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-3 border-[#00e5ff] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(0,229,255,0.4)] mb-4" />
        <p className="text-[#00e5ff] text-xs tracking-widest font-mono uppercase">Loading Profile...</p>
      </div>
    );
  }

  // 2. Unauthenticated: Redirect to Google Sign-In with one-tap access (Zero fake profile data)
  if (!user && !firebaseUser) {
    return (
      <div className="min-h-screen bg-[#05070b] pt-28 pb-16 flex items-center justify-center px-4">
        <div className="max-w-md w-full glass-cyber-card rounded-2xl p-8 border border-[#00e5ff]/20 text-center shadow-[0_0_35px_rgba(0,229,255,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00e5ff]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-[#00e5ff]/10 border border-[#00e5ff]/30 mx-auto flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,229,255,0.25)]">
            <UserIcon className="w-8 h-8 text-[#00e5ff]" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-wide mb-2">Sign-In Required</h2>
          <p className="text-sm text-silver/80 mb-6 leading-relaxed">
            {isRedirecting 
              ? 'Redirecting to Google Sign-In to access your profile and watch history...' 
              : 'Please sign in with your Google account to view your profile and continue watching.'}
          </p>

          {authError && (
            <div className="mb-6 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          <button
            onClick={() => {
              setIsRedirecting(true);
              signInWithGoogle({ preferRedirect: false }).catch((err) => {
                setIsRedirecting(false);
                setAuthError(err?.message || 'Login failed. Please try again.');
              });
            }}
            className="w-full btn-3d-cyan py-3.5 px-6 rounded-xl font-black text-sm flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(0,229,255,0.3)] cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070b] pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* 1. Header Card: Keep ONLY User Avatar, Display Name, Email, Sign Out & (if admin) Admin Panel */}
        <div className="glass-cyber-card rounded-2xl p-6 sm:p-8 border border-[#00e5ff]/20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00e5ff]/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative z-10">
            
            {/* User Avatar, Display Name, Email */}
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
                  <div className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                    {displayName}
                  </h1>
                  {isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                      Admin
                    </span>
                  )}
                </div>

                <p className="text-sm text-silver/70 font-mono break-all">
                  {email}
                </p>
              </div>
            </div>

            {/* Actions: Sign Out (and Admin Panel if admin) - NO Settings */}
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

              <button
                onClick={handleLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-950/30 hover:bg-red-900/50 text-red-300 hover:text-red-200 border border-red-500/30 transition-all duration-300 cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>

          </div>
        </div>

        {/* 2. Section: Continue Watching ONLY (Real data from Supabase user_progress table) */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#00e5ff]" />
              <h2 className="text-xl font-black text-white tracking-wide">Continue Watching</h2>
            </div>
            {continueWatching.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 font-bold">
                {continueWatching.length} {continueWatching.length === 1 ? 'Title' : 'Titles'}
              </span>
            )}
          </div>

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
          ) : continueWatching.length === 0 ? (
            /* Requirement 6: "No Continue Watching Yet" with clean empty-state illustration */
            <div className="glass-cyber-card rounded-2xl p-10 sm:p-14 text-center border border-white/10 relative overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-0 bg-gradient-to-b from-[#00e5ff]/5 via-transparent to-transparent pointer-events-none" />

              {/* Clean Empty-State Cyber Illustration */}
              <div className="relative w-36 h-36 mx-auto mb-6 flex items-center justify-center">
                {/* Background holographic glow rings */}
                <div className="absolute inset-0 rounded-full border border-[#00e5ff]/20 animate-ping opacity-30" />
                <div className="absolute inset-2 rounded-full border border-[#00e5ff]/30 bg-[#00e5ff]/5" />
                
                {/* Clean SVG Illustration */}
                <svg className="w-20 h-20 text-[#00e5ff] relative z-10" viewBox="0 0 80 80" fill="none">
                  {/* Cyber monitor frame */}
                  <rect x="10" y="14" width="60" height="42" rx="6" stroke="#00e5ff" strokeWidth="2.5" strokeDasharray="3 2" />
                  <path d="M10 24H70" stroke="#00e5ff" strokeWidth="1.5" strokeOpacity="0.4" />
                  {/* Stand */}
                  <path d="M34 56L30 66H50L46 56" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="24" y1="66" x2="56" y2="66" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Neon Play Button in center */}
                  <circle cx="40" cy="37" r="12" fill="#00e5ff" fillOpacity="0.15" stroke="#00e5ff" strokeWidth="2" />
                  <polygon points="37,31 47,37 37,43" fill="#00e5ff" />
                  {/* Screen dots */}
                  <circle cx="16" cy="19" r="1.5" fill="#00e5ff" />
                  <circle cx="22" cy="19" r="1.5" fill="#00e5ff" fillOpacity="0.5" />
                  <circle cx="28" cy="19" r="1.5" fill="#00e5ff" fillOpacity="0.3" />
                </svg>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-2">
                No Continue Watching Yet
              </h3>
              
              <p className="text-sm text-silver/70 max-w-md mx-auto mb-6 leading-relaxed">
                You haven&apos;t started watching any anime yet. Stream an episode to automatically track and resume your progress here.
              </p>

              <Link
                to="/"
                className="inline-flex items-center gap-2.5 btn-3d-cyan px-7 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(0,229,255,0.3)]"
              >
                <Compass className="w-4 h-4" />
                <span>Explore Anime Catalog</span>
              </Link>
            </div>
          ) : (
            /* Real Supabase watch records only (Zero fake anime, zero Jujutsu Kaisen hardcoding) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {continueWatching.map((item) => {
                const currentTime = Number(item.current_time) || 0;
                const duration = Number(item.duration) || 1440;
                const percent = Math.min(100, Math.max(5, Math.round((currentTime / duration) * 100)));
                const watchUrl = `/watch/${item.anime_id}/${item.season_id || 's1'}/${item.episode_id}`;

                return (
                  <div
                    key={item.id || `${item.user_id}_${item.episode_id}`}
                    className="group glass-cyber-card rounded-2xl p-3 border border-white/10 hover:border-[#00e5ff]/50 transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                  >
                    <Link to={watchUrl} className="block relative aspect-video rounded-xl overflow-hidden bg-[#0a0e17] mb-3">
                      {item.poster_url ? (
                        <img
                          src={item.poster_url}
                          alt={item.anime_title || 'Episode'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-[#05070b] to-[#101726] text-silver-dark font-bold text-xs p-3 text-center">
                          <Play className="w-6 h-6 text-[#00e5ff] mb-1 opacity-70" />
                          <span className="line-clamp-2 text-white/80">{item.anime_title || 'Continue Stream'}</span>
                        </div>
                      )}

                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-[#00e5ff] text-black flex items-center justify-center shadow-[0_0_20px_#00e5ff]">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/70">
                        <div
                          className="h-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </Link>

                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={watchUrl}
                          className="font-black text-sm text-white group-hover:text-[#00e5ff] transition-colors line-clamp-1"
                        >
                          {item.anime_title || 'Anime Series'}
                        </Link>
                        <button
                          onClick={(e) => handleRemoveProgress(item.episode_id, e)}
                          title="Remove from Continue Watching"
                          className="text-silver-dark hover:text-red-400 p-1 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs text-[#00e5ff] font-semibold truncate">
                        {item.episode_title || `Episode ${item.episode_number || 1}`}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-silver-dark pt-0.5">
                        <span>Season {item.season_number || 1}</span>
                        {item.updated_at && <span>{formatTimeAgo(item.updated_at)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
