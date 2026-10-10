import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, SkipForward, SkipBack, Server } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getEpisodeById, getAnimeById, getSeasonsByAnimeId, getEpisodesByAnimeId, resolveEpisodeServers, saveUserProgress, getActiveEpisodesTable, getActiveAnimeTable } from '../lib/dataService';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

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
  
  const [episode, setEpisode] = useState<any>(null);
  const [anime, setAnime] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<'server1' | 'server2' | 'server3'>('server1');

  const navigate = useNavigate();
  const { user } = useAuthStore();

  const paramId = (id && id !== 'undefined' && id !== 'null') ? id : undefined;
  const paramAnimeId = (routeAnimeId && routeAnimeId !== 'undefined' && routeAnimeId !== 'null') ? routeAnimeId : undefined;
  const paramSeasonId = (routeSeasonId && routeSeasonId !== 'undefined' && routeSeasonId !== 'null') ? routeSeasonId : undefined;

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

  // Load episode details & anime metadata (Searches Firestore + Supabase)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
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

        // Load anime details if not already loaded
        if (!animeData && effectiveAnimeId) {
          animeData = await getAnimeById(effectiveAnimeId);
        }

        let fetchedSeasons: any[] = [];
        let sEps: any[] = [];
        if (effectiveAnimeId) {
          const [seasonsRes, epsRes] = await Promise.all([
            getSeasonsByAnimeId(effectiveAnimeId),
            getEpisodesByAnimeId(effectiveAnimeId, epData.seasonId || effectiveSeasonId),
          ]);
          fetchedSeasons = seasonsRes || [];
          sEps = epsRes || [];
          if (sEps.length === 0) {
            sEps = await getEpisodesByAnimeId(effectiveAnimeId);
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
          setIsVideoLoading(true);
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
  const { server1: server1Url, server2: server2Url, server3: server3Url } = resolveEpisodeServers(episode);

  const hasServer1 = Boolean(server1Url);
  const hasServer2 = Boolean(server2Url);
  const hasServer3 = Boolean(server3Url);
  const hasAnyServer = hasServer1 || hasServer2 || hasServer3;

  // Priority order: Abyss (Server 1) -> FileMoon (Server 2) -> VDOHide (Server 3)
  // If Abyss URL exists, load it first.
  // If not, automatically use FileMoon.
  // If FileMoon is empty, automatically use VDOHide.
  let effectiveServer: 'server1' | 'server2' | 'server3' = 'server1';
  if (hasServer1) {
    effectiveServer = (selectedServer === 'server2' && hasServer2) ? 'server2'
                    : (selectedServer === 'server3' && hasServer3) ? 'server3'
                    : 'server1';
  } else if (hasServer2) {
    effectiveServer = (selectedServer === 'server3' && hasServer3) ? 'server3' : 'server2';
  } else if (hasServer3) {
    effectiveServer = 'server3';
  }

  // Restore previous server choice from localStorage if valid for this specific episode
  useEffect(() => {
    if (!episode) return;
    const epId = episode.id || paramId;
    const saved = epId ? (localStorage.getItem(`zk_selected_server_${epId}`) as any) : null;

    if (saved === 'server1' && hasServer1) {
      setSelectedServer('server1');
    } else if (saved === 'server2' && hasServer2) {
      setSelectedServer('server2');
    } else if (saved === 'server3' && hasServer3) {
      setSelectedServer('server3');
    } else if (hasServer1) {
      setSelectedServer('server1');
    } else if (hasServer2) {
      setSelectedServer('server2');
    } else if (hasServer3) {
      setSelectedServer('server3');
    }
  }, [episode?.id, paramId, hasServer1, hasServer2, hasServer3]);

  const activeStreamUrl = 
    effectiveServer === 'server1' ? server1Url :
    effectiveServer === 'server2' ? server2Url :
    effectiveServer === 'server3' ? server3Url : '';

  // Auto-hide video loading spinner after timeout
  useEffect(() => {
    setIsVideoLoading(true);
    const timer = setTimeout(() => {
      setIsVideoLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [effectiveServer, activeStreamUrl]);

  const handleSelectServer = (server: 'server1' | 'server2' | 'server3') => {
    if (effectiveServer !== server) {
      setSelectedServer(server);
      setIsVideoLoading(true);
      const epId = episode?.id || paramId;
      if (epId) {
        try {
          localStorage.setItem(`zk_selected_server_${epId}`, server);
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
                {isVideoLoading && activeStreamUrl && (
                  <div className="absolute inset-0 z-0 flex items-center justify-center bg-black/80 pointer-events-none">
                     <div className="w-12 h-12 border-4 border-white/10 border-t-brand rounded-full animate-spin"></div>
                  </div>
                )}

                {!activeStreamUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 p-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-3 shadow-[0_0_20px_rgba(0,229,255,0.25)]">
                          <Play className="w-6 h-6 ml-0.5 opacity-40" />
                        </div>
                        <p className="text-white text-lg font-bold">
                          No streaming source available
                        </p>
                        <p className="text-white/50 text-xs mt-1 max-w-sm">
                          This episode does not have any streaming server URLs configured yet.
                        </p>
                    </div>
                ) : isDirectVideo(activeStreamUrl) ? (
                  <video 
                    key={`${effectiveServer}-${activeStreamUrl}`}
                    src={activeStreamUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain bg-black relative z-10"
                    onLoadedData={() => setIsVideoLoading(false)}
                    onError={() => setIsVideoLoading(false)}
                  />
                ) : (
                  <iframe 
                    key={`${effectiveServer}-${activeStreamUrl}`}
                    src={activeStreamUrl}
                    className="w-full h-full border-0 absolute top-0 left-0 z-10"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                    onLoad={() => setIsVideoLoading(false)}
                  />
                )}
             </div>
             
             {/* Select Server Section (Directly Below Video Player) */}
             {hasAnyServer && (
               <div className="mt-5 w-full bg-[#121214]/90 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-2xl">
                 <div className="flex items-center justify-between mb-3.5">
                   <div className="flex items-center gap-2.5">
                     <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                       <Server className="w-4 h-4" />
                     </div>
                     <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">Select Server</h2>
                   </div>
                 </div>

                 {/* THREE Server Cards in One Row */}
                 <div className="grid grid-cols-3 gap-2.5 sm:gap-4 w-full">
                   {/* Server 1: Abyss (Display only if Server 1 URL exists) */}
                   {hasServer1 && (
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
                       </div>
                       <div className="flex items-center shrink-0" title="Online">
                         <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                         </span>
                       </div>
                     </button>
                   )}

                   {/* Server 2: Filemoon (Display only if Server 2 URL exists) */}
                   {hasServer2 && (
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
                       </div>
                       <div className="flex items-center shrink-0" title="Online">
                         <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                         </span>
                       </div>
                     </button>
                   )}

                   {/* Server 3: VDOHide (Display only if Server 3 URL exists) */}
                   {hasServer3 && (
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
                    <img 
                      src={ep.thumbnailUrl || ep.thumbnail_url || anime?.posterUrl || anime?.poster_url || ""} 
                      alt={ep.title} 
                      className={`w-full h-full object-cover transition-transform duration-500 opacity-90 group-hover:scale-105 group-hover:opacity-100 ${isCurrent ? 'opacity-100 scale-105' : ''}`} 
                      loading="lazy"
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
