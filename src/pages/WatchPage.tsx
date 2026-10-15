import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, SkipForward, SkipBack, Server, RotateCcw, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  getEpisodeById, 
  getAnimeById, 
  getAnimeFullDetails,
  getSeasonsByAnimeId, 
  getEpisodesByAnimeId, 
  resolveEpisodeServers, 
  isValidStreamUrl,
  probeServerReachable,
  saveUserProgress, 
  getActiveEpisodesTable, 
  getActiveAnimeTable 
} from '../lib/dataService';
import { supabase } from '../lib/supabase';
import { getCachedData } from '../lib/cache';
import { useAuthStore } from '../store/authStore';
import SmartImage from '../components/SmartImage';

function isDirectVideo(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.m3u8') ||
    clean.endsWith('.ogg') ||
    clean.includes('.ia.mp4')
  );
}

function cleanEmbedUrl(input?: string): string {
  if (!input) return '';
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    url = iframeMatch[1].trim();
  }
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  return url;
}

export default function WatchPage() {
  const { id, animeId: routeAnimeId, seasonId: routeSeasonId } = useParams(); // Episode ID or animeId/seasonId/id
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const paramId = (id && id !== 'undefined' && id !== 'null') ? id : undefined;
  const paramAnimeId = (routeAnimeId && routeAnimeId !== 'undefined' && routeAnimeId !== 'null') ? routeAnimeId : undefined;
  const paramSeasonId = (routeSeasonId && routeSeasonId !== 'undefined' && routeSeasonId !== 'null') ? routeSeasonId : undefined;

  // Instant pre-population from route state or cache so video begins playing immediately
  const initialEp = (location.state as any)?.episode || (paramId ? getCachedData<any>(`episode_${paramId}`) : null);
  const initialAnime = (location.state as any)?.anime || (paramAnimeId ? getCachedData<any>(`anime_${paramAnimeId}`) : null);

  const [episode, setEpisode] = useState<any>(initialEp);
  const [anime, setAnime] = useState<any>(initialAnime);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>(initialEp ? [initialEp] : []);
  
  const [loading, setLoading] = useState(!initialEp);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<'server1' | 'server2' | 'server3'>('server1');
  const [deadServers, setDeadServers] = useState<Set<'server1' | 'server2' | 'server3'>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Analytics Tracking (Episode views)
  useEffect(() => {
    const epId = episode?.id || paramId;
    if (!epId || !episode) return;
    
    const trackView = async () => {
      try {
        const epViews = ((episode.views || 0) + 1);
        const epTable = await getActiveEpisodesTable();
        await supabase.from(epTable).update({ views: epViews }).eq('id', epId);
        const anId = episode.animeId || episode.anime_id;
        if (anId) {
          const anViews = ((anime?.views || 0) + 1);
          const anTable = await getActiveAnimeTable();
          await supabase.from(anTable).update({ views: anViews }).eq('id', anId);
        }
      } catch (err) {
        // Safe to ignore if offline
      }
    };
    
    const viewed = sessionStorage.getItem(`viewed_${epId}`);
    if (!viewed) {
      sessionStorage.setItem(`viewed_${epId}`, 'true');
      trackView();
    }
  }, [paramId, episode]);

  // Next / Prev Episode Logic
  const isMovie = Boolean(
    anime?.isMovie ||
    anime?.type === 'Movie' ||
    anime?.contentType === 'Movie' ||
    episode?.seasonId === 'movie' ||
    episode?.type === 'Movie'
  );
  const activeEpisodeId = episode?.id || paramId;
  const currentIndex = seasonEpisodes.findIndex(ep => ep.id === activeEpisodeId);
  const prevEpisode = currentIndex > 0 ? seasonEpisodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex !== -1 && currentIndex < seasonEpisodes.length - 1 ? seasonEpisodes[currentIndex + 1] : null;

  // Immediate episode switch if episode is already in seasonEpisodes (Requirement 2 & 6)
  useEffect(() => {
    if (paramId && seasonEpisodes.length > 0) {
      const match = seasonEpisodes.find(ep => ep.id === paramId || String(ep.episodeNumber) === String(paramId));
      if (match && match.id !== episode?.id) {
        setEpisode(match);
        setLoading(false);
      }
    }
  }, [paramId, seasonEpisodes, episode?.id]);

  // Load episode details & anime metadata (Searches Firestore + Supabase)
  useEffect(() => {
    let isMounted = true;
    if (!episode) {
      setLoading(true);
    }
    setError(null);
    
    const fetchData = async () => {
      try {
        let epData: any = null;
        let animeData: any = null;
        let effectiveAnimeId = paramAnimeId;
        let effectiveSeasonId = paramSeasonId;

        // Step 1: Try searching directly by paramId
        if (paramId) {
          epData = await getEpisodeById(paramId);
          if (epData) {
            effectiveAnimeId = epData.animeId || epData.anime_id || effectiveAnimeId;
            effectiveSeasonId = epData.seasonId || epData.season_id || effectiveSeasonId;
          }
        }

        // Step 2: If episodeId is missing or not found directly, resolve anime and auto-load Episode 1
        if (!epData) {
          const possibleAnimeId = paramAnimeId || paramId;
          if (possibleAnimeId) {
            animeData = await getAnimeById(possibleAnimeId);
            if (animeData) {
              effectiveAnimeId = animeData.id;
            }
          }

          if (effectiveAnimeId) {
            const allAnimeEpisodes = await getEpisodesByAnimeId(effectiveAnimeId);

            if (allAnimeEpisodes && allAnimeEpisodes.length > 0) {
              // Try finding by paramId matching id or episodeNumber
              if (paramId) {
                epData = allAnimeEpisodes.find(e => 
                  e.id === paramId || 
                  String(e.episodeNumber) === String(paramId)
                );
              }

              // Requirement: If episodeId is missing or still not found, load Episode 1 of the selected season automatically
              if (!epData) {
                let seasonFiltered = allAnimeEpisodes;
                if (effectiveSeasonId) {
                  seasonFiltered = allAnimeEpisodes.filter(e => (e.seasonId || e.season_id) === effectiveSeasonId);
                  if (seasonFiltered.length === 0) seasonFiltered = allAnimeEpisodes;
                }

                epData = seasonFiltered.find(e => Number(e.episodeNumber || (e as any).episode_number) === 1) || seasonFiltered[0];
              }

              if (epData) {
                effectiveSeasonId = epData.seasonId || epData.season_id || effectiveSeasonId;
              }
            }
          }
        }

        if (!epData) {
          if (isMounted) {
            setError("Episode not found.");
            setLoading(false);
          }
          return;
        }

        let fetchedSeasons: any[] = [];
        let sEps: any[] = [];
        if (effectiveAnimeId) {
          // Requirement 5: Load anime, seasons and episodes using a single optimized query
          // Requirement 6: Cache API responses for 5 minutes
          const full = await getAnimeFullDetails(effectiveAnimeId);
          if (full.anime) animeData = full.anime;
          fetchedSeasons = full.seasons || [];
          const targetSeasonId = epData.seasonId || effectiveSeasonId;
          if (targetSeasonId && targetSeasonId !== 'all') {
            sEps = full.episodes.filter(e => (e.seasonId || e.season_id) === targetSeasonId);
          }
          if (sEps.length === 0) {
            sEps = full.episodes || [];
          }
        }

        if (isMounted) {
          setEpisode(epData);
          if (animeData) setAnime(animeData);
          if (fetchedSeasons.length > 0) setSeasons(fetchedSeasons);
          if (sEps.length > 0) {
            setSeasonEpisodes(sEps);
          } else {
            setSeasonEpisodes([epData]);
          }
          setLoading(false);
          setError(null);
        }

        // Update local watch history for Continue Watching row on Home page
        try {
          const raw = localStorage.getItem('zk_watch_history');
          let list: any[] = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(list)) list = [];

          const item = {
            animeId: effectiveAnimeId || '',
            seasonId: epData.seasonId || effectiveSeasonId || 's1',
            episodeId: epData.id,
            animeTitle: animeData?.title || epData.title || 'Anime',
            episodeTitle: epData.title || `Episode ${epData.episodeNumber || 1}`,
            seasonNumber: epData.seasonNumber || 1,
            episodeNumber: epData.episodeNumber || 1,
            posterUrl: animeData?.posterUrl || epData.thumbnailUrl || '',
            updatedAt: Date.now(),
          };

          list = list.filter((h: any) => h.episodeId !== epData.id);
          list.unshift(item);
          if (list.length > 20) list.pop();
          localStorage.setItem('zk_watch_history', JSON.stringify(list));

          // Sync to Supabase user_progress table for authenticated users
          if (user?.uid) {
            saveUserProgress({
              userId: user.uid,
              animeId: item.animeId,
              animeTitle: item.animeTitle,
              episodeId: item.episodeId,
              episodeTitle: item.episodeTitle,
              seasonId: item.seasonId,
              seasonNumber: item.seasonNumber,
              episodeNumber: item.episodeNumber,
              posterUrl: item.posterUrl,
              currentTime: 0,
              duration: 1440,
            }).catch(() => {});
          }
        } catch {
          // ignore
        }
      } catch {
        if (isMounted) {
          setError("Failed to load episode details.");
          setLoading(false);
        }
      }
    };
    
    fetchData();

    const tenSec = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 10000);

    const handleEpisodeDeleted = (e: any) => {
      const deletedId = e?.detail?.id;
      if (deletedId) {
        setSeasonEpisodes(prev => prev.filter(ep => (ep.id || (ep as any)._id) !== deletedId));
        if (paramId === deletedId || episode?.id === deletedId) {
          setError("This episode has been deleted by an administrator.");
        }
      }
    };

    const handleEpisodeUpdated = () => {
      fetchData();
    };

    window.addEventListener('zk_episode_deleted', handleEpisodeDeleted);
    window.addEventListener('zk_episode_published', handleEpisodeUpdated);
    window.addEventListener('zk_episodes_changed', handleEpisodeUpdated);
    window.addEventListener('zk_data_changed', handleEpisodeUpdated);

    return () => { 
      isMounted = false; 
      clearTimeout(tenSec);
      window.removeEventListener('zk_episode_deleted', handleEpisodeDeleted);
      window.removeEventListener('zk_episode_published', handleEpisodeUpdated);
      window.removeEventListener('zk_episodes_changed', handleEpisodeUpdated);
      window.removeEventListener('zk_data_changed', handleEpisodeUpdated);
    };
  }, [paramId, paramAnimeId, paramSeasonId]);

  // Streaming Sources: Server 1 (Abyss), Server 2 (FileMoon), Server 3 (VDOHide)
  const { server1: rawServer1, server2: rawServer2, server3: rawServer3 } = resolveEpisodeServers(episode);
  const server1Url = isValidStreamUrl(rawServer1) ? rawServer1 : '';
  const server2Url = isValidStreamUrl(rawServer2) ? rawServer2 : '';
  const server3Url = isValidStreamUrl(rawServer3) ? rawServer3 : '';

  const activeEpId = episode?.id || paramId;

  // Restore dead servers for this episode from sessionStorage (Requirement 1 & 7)
  useEffect(() => {
    if (!activeEpId) return;
    try {
      const saved = sessionStorage.getItem(`zk_dead_servers_${activeEpId}`);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          setDeadServers(new Set(arr));
          return;
        }
      }
    } catch {}
    setDeadServers(new Set());
  }, [activeEpId]);

  // Requirement 4: Show only servers that actually have a valid video URL
  const validServers = useMemo(() => {
    const list: ('server1' | 'server2' | 'server3')[] = [];
    if (server1Url) list.push('server1');
    if (server2Url) list.push('server2');
    if (server3Url) list.push('server3');
    return list;
  }, [server1Url, server2Url, server3Url]);

  // Requirement 1 & 7: Filter out dead/broken/expired servers
  const aliveServers = useMemo(() => {
    return validServers.filter(s => !deadServers.has(s));
  }, [validServers, deadServers]);

  // Priority order: Server 1 -> Server 2 -> Server 3
  const effectiveServer: ('server1' | 'server2' | 'server3') | null = useMemo(() => {
    if (aliveServers.length === 0) return null;
    if (aliveServers.includes(selectedServer)) {
      return selectedServer;
    }
    return aliveServers[0];
  }, [aliveServers, selectedServer]);

  // Keep preferred server alive while switching episodes if alive
  useEffect(() => {
    if (!episode || aliveServers.length === 0) return;
    try {
      const preferred = localStorage.getItem('zk_preferred_server') as any;
      if (preferred && aliveServers.includes(preferred)) {
        setSelectedServer(preferred);
      } else if (!aliveServers.includes(selectedServer)) {
        setSelectedServer(aliveServers[0]);
      }
    } catch {}
  }, [episode?.id, activeEpId, aliveServers]);

  const activeStreamUrl = useMemo(() => {
    if (!effectiveServer) return '';
    return effectiveServer === 'server1' ? server1Url :
           effectiveServer === 'server2' ? server2Url :
           effectiveServer === 'server3' ? server3Url : '';
  }, [effectiveServer, server1Url, server2Url, server3Url]);

  // Immediate failover when a server fails
  const handleServerFailure = useCallback((failedServer: 'server1' | 'server2' | 'server3', reason?: string) => {
    console.warn(`[Video Player] ${failedServer} failed (${reason || 'unreachable'}). Switching server...`);

    setDeadServers(prev => {
      if (prev.has(failedServer)) return prev;
      const nextSet = new Set(prev);
      nextSet.add(failedServer);

      if (activeEpId) {
        try {
          sessionStorage.setItem(`zk_dead_servers_${activeEpId}`, JSON.stringify(Array.from(nextSet)));
        } catch {}
      }

      // Check remaining valid servers
      const remaining = validServers.filter(s => !nextSet.has(s));
      if (remaining.length > 0) {
        setSelectedServer(remaining[0]);
      }

      return nextSet;
    });
  }, [activeEpId, validServers]);

  const handleRetryAll = () => {
    if (activeEpId) {
      try {
        sessionStorage.removeItem(`zk_dead_servers_${activeEpId}`);
      } catch {}
    }
    setDeadServers(new Set());
    if (validServers.length > 0) {
      setSelectedServer(validServers[0]);
    }
  };

  // Preconnect DNS for streaming origins
  useEffect(() => {
    const urls = [server1Url, server2Url, server3Url].filter(Boolean);
    urls.forEach(u => {
      try {
        const origin = new URL(u).origin;
        if (!document.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) {
          const l1 = document.createElement('link');
          l1.rel = 'dns-prefetch';
          l1.href = origin;
          document.head.appendChild(l1);
        }
        if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
          const l2 = document.createElement('link');
          l2.rel = 'preconnect';
          l2.href = origin;
          l2.crossOrigin = 'anonymous';
          document.head.appendChild(l2);
        }
      } catch {}
    });
  }, [server1Url, server2Url, server3Url]);

  // Active verification: Verify server URL before opening and auto-switch from Server 1 to Server 2 (Requirement: VIDEO)
  useEffect(() => {
    let cancelled = false;
    if (!episode) return;

    const verifyServerUrls = async () => {
      // 1. If server1 exists and hasn't been declared dead, verify reachability
      if (server1Url && !deadServers.has('server1')) {
        const isS1Ok = await probeServerReachable(server1Url);
        if (cancelled) return;
        if (!isS1Ok) {
          console.warn('[Video Player] Server 1 unreachable. Automatically switching to Server 2.');
          handleServerFailure('server1', 'Failed URL reachability check');
          return;
        }
      }

      // 2. Check server2 and server3 in background so only working servers are displayed
      if (server2Url && !deadServers.has('server2')) {
        probeServerReachable(server2Url).then((ok) => {
          if (!ok && !cancelled) {
            handleServerFailure('server2', 'Failed URL reachability check');
          }
        });
      }

      if (server3Url && !deadServers.has('server3')) {
        probeServerReachable(server3Url).then((ok) => {
          if (!ok && !cancelled) {
            handleServerFailure('server3', 'Failed URL reachability check');
          }
        });
      }
    };

    verifyServerUrls();

    return () => {
      cancelled = true;
    };
  }, [episode?.id, server1Url, server2Url, server3Url, handleServerFailure]);

  const handleSelectServer = (server: 'server1' | 'server2' | 'server3') => {
    if (effectiveServer !== server && aliveServers.includes(server)) {
      setSelectedServer(server);
      if (activeEpId) {
        try {
          localStorage.setItem(`zk_selected_server_${activeEpId}`, server);
          localStorage.setItem('zk_preferred_server', server);
        } catch {}
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/10 border-t-brand rounded-full animate-spin"></div>
          <span className="text-sm">Loading Episode...</span>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        <div className="text-center p-8 bg-black/60 border border-white/10 rounded-2xl max-w-md">
          <p className="text-white text-lg font-bold mb-3">{error || 'Episode not found.'}</p>
          <Link to="/" className="btn-3d-cyan px-6 py-2 text-xs font-bold inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0b0b]">
      <div className="w-full">
        {/* Main Player Area */}
        <div className="w-full flex flex-col bg-[#0b0b0b] relative pt-16 lg:pt-24 pb-8">
          <div className="absolute top-4 left-4 z-10">
            <Link 
              to={anime ? `/anime/${anime.id}` : '/'} 
              className="flex items-center text-white/70 hover:text-brand transition-colors bg-black/40 backdrop-blur px-3 py-1.5 rounded-full text-sm border border-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Details
            </Link>
          </div>
          
          <div className="w-full max-w-5xl mx-auto px-4 md:px-6 relative flex flex-col">
             
             {/* Title and Badges Above Player */}
             <div className="mb-4">
                {anime && (
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{anime.title}</h1>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {isMovie ? (
                    <>
                      <span className="bg-brand text-black text-xs font-black px-2.5 py-1 rounded shadow-[0_0_10px_rgba(0,229,255,0.4)]">
                        MOVIE
                      </span>
                      {anime?.duration && (
                        <span className="bg-white/10 text-white text-xs font-bold px-2 py-1 rounded border border-white/10">
                          {anime.duration} min
                        </span>
                      )}
                      <span className="text-white/70 text-sm font-medium ml-2">{anime?.title || episode?.title}</span>
                    </>
                  ) : (
                    <>
                      <span className="bg-brand text-black text-xs font-bold px-2 py-1 rounded shadow-[0_0_10px_rgba(0,229,255,0.3)]">
                        Season {seasons.find(s => s.id === episode.seasonId)?.seasonNumber || episode.seasonNumber || 1}
                      </span>
                      <span className="bg-white/10 text-white text-xs font-bold px-2 py-1 rounded border border-white/10">
                        Episode {episode.episodeNumber}
                      </span>
                      <span className="text-white/70 text-sm font-medium ml-2">{episode.title || `Episode ${episode.episodeNumber}`}</span>
                    </>
                  )}
                </div>
             </div>

             {/* Player Container (Server 1 Abyss / Server 2 FileMoon / Server 3 VDOHide / Direct Video Player) */}
             <div className="w-full aspect-video relative rounded-2xl overflow-hidden border border-brand shadow-[0_0_20px_rgba(0,229,255,0.3)] bg-black">
                {/* Requirement 3: If the server is unavailable, show only: "Server unavailable. Please try another server." */}
                {(!activeStreamUrl || aliveServers.length === 0) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/95 p-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_25px_rgba(239,68,68,0.25)]">
                          <AlertCircle className="w-8 h-8" />
                        </div>
                        <p className="text-white text-base sm:text-lg font-bold mb-4">
                          Server unavailable. Please try another server.
                        </p>
                        {validServers.length > 0 && (
                          <button
                            type="button"
                            onClick={handleRetryAll}
                            className="px-5 py-2.5 rounded-xl bg-brand text-black font-bold text-xs hover:brightness-110 flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Retry Server
                          </button>
                        )}
                    </div>
                ) : isDirectVideo(activeStreamUrl) ? (
                  /* Native Video Player - Starts immediately without any custom loading overlay (Requirement 2 & 6) */
                  <video 
                    key={activeStreamUrl}
                    src={activeStreamUrl}
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                    className="w-full h-full object-contain bg-black relative z-10"
                    onError={() => {
                      if (effectiveServer) {
                        handleServerFailure(effectiveServer, 'Direct video playback error');
                      }
                    }}
                  />
                ) : (
                  /* Embed Iframe Player - Starts immediately without any custom loading overlay (Requirement 2 & 6) */
                  <iframe 
                    ref={iframeRef}
                    key={activeStreamUrl}
                    src={activeStreamUrl}
                    loading="eager"
                    className="w-full h-full border-0 absolute top-0 left-0 z-10"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    onError={() => {
                      if (effectiveServer) {
                        handleServerFailure(effectiveServer, 'Embed iframe load error');
                      }
                    }}
                  />
                )}
             </div>
             
             {/* Select Server Section (Directly Below Video Player) */}
             {/* Requirements 4 & 7: Show ONLY servers that have valid URLs and hide dead servers */}
             {aliveServers.length > 0 && (
               <div className="mt-5 w-full bg-[#121214]/90 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-2xl">
                 <div className="flex items-center justify-between mb-3.5">
                   <div className="flex items-center gap-2.5">
                     <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                       <Server className="w-4 h-4" />
                     </div>
                     <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">Select Server</h2>
                   </div>
                   <span className="text-xs text-white/40">
                     {aliveServers.length} active {aliveServers.length === 1 ? 'server' : 'servers'}
                   </span>
                 </div>

                 {/* Server cards dynamically adapted to alive servers */}
                 <div className={`grid gap-2.5 sm:gap-4 w-full ${
                   aliveServers.length === 1 ? 'grid-cols-1 max-w-xs' :
                   aliveServers.length === 2 ? 'grid-cols-2 max-w-lg' :
                   'grid-cols-3'
                 }`}>
                   {/* Server 1: Abyss (Display only if valid and not dead) */}
                   {aliveServers.includes('server1') && (
                     <button
                       type="button"
                       onClick={() => handleSelectServer('server1')}
                       className={`group relative flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl transition-all duration-200 cursor-pointer text-left ${
                         effectiveServer === 'server1'
                           ? 'bg-[#0f1922] border-2 border-brand shadow-[0_0_20px_rgba(0,229,255,0.35)] ring-1 ring-brand/40'
                           : 'bg-[#18181b]/90 border border-white/10 hover:border-brand/40 hover:bg-[#202024] hover:shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                       }`}
                     >
                       <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
                         <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wide truncate ${
                            effectiveServer === "server1" ? "text-brand font-black" : "text-white/90 group-hover:text-white"
                          }`}>
                            Server 1
                          </span>
                          <span className="text-[10px] text-white/40 truncate">Abyss Stream</span>
                       </div>
                       <div className="flex items-center shrink-0" title="Online">
                         <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                         </span>
                       </div>
                     </button>
                   )}

                   {/* Server 2: Filemoon (Display only if valid and not dead) */}
                   {aliveServers.includes('server2') && (
                     <button
                       type="button"
                       onClick={() => handleSelectServer('server2')}
                       className={`group relative flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl transition-all duration-200 cursor-pointer text-left ${
                         effectiveServer === 'server2'
                           ? 'bg-[#0f1922] border-2 border-brand shadow-[0_0_20px_rgba(0,229,255,0.35)] ring-1 ring-brand/40'
                           : 'bg-[#18181b]/90 border border-white/10 hover:border-brand/40 hover:bg-[#202024] hover:shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                       }`}
                     >
                       <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
                         <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wide truncate ${
                            effectiveServer === "server2" ? "text-brand font-black" : "text-white/90 group-hover:text-white"
                          }`}>
                            Server 2
                          </span>
                          <span className="text-[10px] text-white/40 truncate">FileMoon</span>
                       </div>
                       <div className="flex items-center shrink-0" title="Online">
                         <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                         </span>
                       </div>
                     </button>
                   )}

                   {/* Server 3: VDOHide (Display only if valid and not dead) */}
                   {aliveServers.includes('server3') && (
                     <button
                       type="button"
                       onClick={() => handleSelectServer('server3')}
                       className={`group relative flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl transition-all duration-200 cursor-pointer text-left ${
                         effectiveServer === 'server3'
                           ? 'bg-[#0f1922] border-2 border-brand shadow-[0_0_20px_rgba(0,229,255,0.35)] ring-1 ring-brand/40'
                           : 'bg-[#18181b]/90 border border-white/10 hover:border-brand/40 hover:bg-[#202024] hover:shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                       }`}
                     >
                       <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
                         <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wide truncate ${
                            effectiveServer === "server3" ? "text-brand font-black" : "text-white/90 group-hover:text-white"
                          }`}>
                            Server 3
                          </span>
                          <span className="text-[10px] text-white/40 truncate">VDOHide</span>
                       </div>
                       <div className="flex items-center shrink-0" title="Online">
                         <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                         </span>
                       </div>
                     </button>
                   )}
                 </div>
               </div>
             )}

             {/* Controls Below Server Selector (Previous / Next for TV Series) */}
             {!isMovie && (
               <div className="mt-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
                    {prevEpisode ? (
                      <button 
                        onClick={() => {
                          const sId = prevEpisode.seasonId || prevEpisode.season_id || 's1';
                          navigate(anime ? `/watch/${anime.id}/${sId}/${prevEpisode.id}` : `/watch/${prevEpisode.id}`);
                        }} 
                        className="flex items-center gap-1 text-sm font-bold text-white/70 hover:text-brand bg-white/5 border border-white/10 px-4 py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        <SkipBack className="w-4 h-4" /> Previous
                      </button>
                    ) : (
                      <button disabled className="flex items-center gap-1 text-sm font-bold text-white/30 bg-white/5 border border-white/5 px-4 py-2 rounded-lg cursor-not-allowed">
                        <SkipBack className="w-4 h-4" /> Previous
                      </button>
                    )}
                    {nextEpisode ? (
                      <button 
                        onClick={() => {
                          const sId = nextEpisode.seasonId || nextEpisode.season_id || 's1';
                          navigate(anime ? `/watch/${anime.id}/${sId}/${nextEpisode.id}` : `/watch/${nextEpisode.id}`);
                        }} 
                        className="flex items-center gap-1 text-sm font-bold text-black bg-brand px-6 py-2 rounded-lg hover:bg-brand-hover transition-colors shadow-[0_0_15px_rgba(0,229,255,0.4)] cursor-pointer"
                      >
                        Next <SkipForward className="w-4 h-4" />
                      </button>
                    ) : (
                      <button disabled className="flex items-center gap-1 text-sm font-bold text-white/30 bg-white/5 border border-white/5 px-6 py-2 rounded-lg cursor-not-allowed">
                        Next <SkipForward className="w-4 h-4" />
                      </button>
                    )}
                  </div>
               </div>
             )}

             {episode.description && (
               <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-4 md:p-6">
                 <h3 className="text-lg font-bold text-white mb-2">Synopsis</h3>
                 <p className="text-white/70 text-sm leading-relaxed">
                   {episode.description}
                 </p>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Episodes Grid Section Below Player (TV Series only) */}
      {!isMovie && (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Episodes</h2>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-4">
            {seasonEpisodes.map((ep) => {
              const epSeasonId = ep.seasonId || ep.season_id;
              const currentSeason = seasons.find(s => s.id === epSeasonId);
              const seasonNumber = currentSeason?.seasonNumber || ep.seasonNumber || 1;
              const isCurrent = ep.id === activeEpisodeId;
              
              return (
                <Link 
                  key={ep.id} 
                  to={anime ? `/watch/${anime.id}/${epSeasonId || 's1'}/${ep.id}` : `/watch/${ep.id}`} 
                  className={`group flex flex-col rounded-[12px] overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,229,255,0.1)] ${isCurrent ? 'bg-brand/10 border-brand/50 shadow-[0_0_15px_rgba(0,229,255,0.15)]' : 'bg-white/5 border-white/10 hover:border-brand/50'}`}
                >
                  <div className="relative w-full aspect-video bg-black/50 overflow-hidden">
                    <SmartImage 
                      src={anime?.poster_url || anime?.posterUrl || ep.thumbnail_url || ep.thumbnailUrl || anime?.banner_url || anime?.bannerUrl || ""} 
                      alt={ep.title || `Episode ${ep.episodeNumber}`} 
                      type="poster"
                      loading="lazy"
                      className={`w-full h-full transition-transform duration-500 opacity-90 group-hover:scale-105 group-hover:opacity-100 ${isCurrent ? 'opacity-100 scale-105' : ''}`} 
                      style={{ objectFit: 'cover', objectPosition: 'center center' }}
                      titleFallback={ep.title || `Episode ${ep.episodeNumber}`}
                    />
                    <div className="absolute top-1 left-1 z-10">
                      <span className="bg-black/80 backdrop-blur-md text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-lg">
                        {seasonNumber}x{ep.episodeNumber}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                      <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full bg-brand flex items-center justify-center text-black pl-0.5 md:pl-1 shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all duration-300 ${isCurrent ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}>
                        <Play className="w-4 h-4 md:w-6 md:h-6 fill-current" />
                      </div>
                    </div>
                  </div>
                  <div className="p-2 md:p-3 flex-1 flex flex-col justify-center">
                    <h4 className={`text-[10px] md:text-sm font-bold line-clamp-2 transition-colors ${isCurrent ? 'text-brand' : 'text-white group-hover:text-brand'}`}>
                      {ep.title || `Episode ${ep.episodeNumber}`}
                    </h4>
                  </div>
                </Link>
              );
            })}
          </div>
          
          {seasonEpisodes.length === 0 && (
            <div className="text-center py-16 text-white/50 bg-white/5 rounded-3xl border border-white/10 mt-6">
              <p className="text-lg">No episodes found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
