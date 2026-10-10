import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { Play, Send, ChevronDown, Sparkles, Star, Film, Calendar, Clock, Mic, Heart, Bookmark } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import SmartImage from '../components/SmartImage';
import { 
  getAnimeById, 
  getSeasonsByAnimeId, 
  getEpisodesByAnimeId, 
  matchEpisodeToSeason,
  isFavorite,
  addFavorite,
  removeFavorite,
  isInWatchlist,
  addToWatchlist,
  removeFromWatchlist
} from '../lib/dataService';

export default function AnimeDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [prevId, setPrevId] = useState(id);
  const [anime, setAnime] = useState<any>(location.state?.anime?.id === id && location.state?.anime?.title ? location.state.anime : null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user, firebaseUser } = useAuthStore();
  const [isFav, setIsFav] = useState(false);
  const [inWl, setInWl] = useState(false);
  const effectiveUserId = user?.uid || firebaseUser?.uid || null;

  useEffect(() => {
    if (effectiveUserId && id) {
      isFavorite(effectiveUserId, id).then(setIsFav).catch(() => {});
      isInWatchlist(effectiveUserId, id).then(setInWl).catch(() => {});
    }
  }, [effectiveUserId, id]);

  // Click-outside listener for season dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleToggleFavorite = async () => {
    if (!effectiveUserId || !anime) return;
    if (isFav) {
      await removeFavorite(effectiveUserId, anime.id);
      setIsFav(false);
    } else {
      await addFavorite(effectiveUserId, {
        id: anime.id,
        title: anime.title,
        posterUrl: anime.posterUrl || anime.poster_url || anime.bannerUrl || anime.banner_url
      });
      setIsFav(true);
    }
  };

  const handleToggleWatchlist = async () => {
    if (!effectiveUserId || !anime) return;
    if (inWl) {
      await removeFromWatchlist(effectiveUserId, anime.id);
      setInWl(false);
    } else {
      await addToWatchlist(effectiveUserId, {
        id: anime.id,
        title: anime.title,
        posterUrl: anime.posterUrl || anime.poster_url || anime.bannerUrl || anime.banner_url,
        status: 'Plan to Watch'
      });
      setInWl(true);
    }
  };

  // Reset state during render when route param changes
  if (id !== prevId) {
    setPrevId(id);
    const incomingAnime = location.state?.anime?.id === id && location.state?.anime?.title ? location.state.anime : null;
    setAnime(incomingAnime);
    setSeasons([]);
    setAllEpisodes([]);
    setSelectedSeason('');
    setInitialLoading(true);
  }

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch anime, seasons, and episodes in parallel (Performance Requirement 6)
        const [animeData, seasonsData, episodesData] = await Promise.all([
          getAnimeById(id),
          getSeasonsByAnimeId(id),
          getEpisodesByAnimeId(id),
        ]);

        if (!isMounted) return;

        if (!animeData) {
          setAnime(null);
          setInitialLoading(false);
          return;
        }

        setAnime(animeData);

        // If the URL id was an alias/episode ID, update URL to canonical anime ID
        if (animeData.id && animeData.id !== id) {
          navigate(`/anime/${animeData.id}`, { replace: true });
        }

        const targetAnimeId = animeData.id;
        let fetchedEpisodes = episodesData || [];
        let fetchedSeasons = seasonsData || [];

        // If anime ID resolved differently from requested id, re-fetch seasons/episodes if needed
        if (targetAnimeId !== id && fetchedEpisodes.length === 0) {
          const [sData, eData] = await Promise.all([
            getSeasonsByAnimeId(targetAnimeId),
            getEpisodesByAnimeId(targetAnimeId),
          ]);
          if (sData && sData.length > 0) fetchedSeasons = sData;
          if (eData && eData.length > 0) fetchedEpisodes = eData;
        }

        if (isMounted) {
          setAllEpisodes(fetchedEpisodes);

          let effectiveSeasons = (fetchedSeasons || []).sort((a: any, b: any) => {
            const numA = Number(a.seasonNumber ?? a.order ?? 1);
            const numB = Number(b.seasonNumber ?? b.order ?? 1);
            return numA - numB;
          });

          // If no seasons exist in DB but episodes exist, synthesize Season 1
          if (effectiveSeasons.length === 0) {
            effectiveSeasons = [{
              id: 's1',
              animeId: targetAnimeId,
              seasonNumber: 1,
              title: 'Season 1',
              order: 1
            }];
          }

          setSeasons(effectiveSeasons);
          setSelectedSeason(prev => {
            if (prev && effectiveSeasons.some((s: any) => s.id === prev)) {
              return prev;
            }
            // Automatically select Season 1 (Requirement 2)
            const season1 = effectiveSeasons.find((s: any) => Number(s.seasonNumber) === 1);
            return season1 ? season1.id : effectiveSeasons[0].id;
          });

          setInitialLoading(false);
        }
      } catch {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };
    fetchData();

    const handleEpisodeDeleted = (event: any) => {
      const deletedId = event?.detail?.id;
      if (deletedId) {
        setAllEpisodes(prev => prev.filter(ep => (ep.id || (ep as any)._id) !== deletedId));
      } else {
        fetchData();
      }
    };

    const handleEpisodeUpdated = () => {
      fetchData();
    };

    window.addEventListener('zk_episode_deleted', handleEpisodeDeleted);
    window.addEventListener('zk_episode_published', handleEpisodeUpdated);
    window.addEventListener('zk_episodes_changed', handleEpisodeUpdated);
    window.addEventListener('zk_anime_published', handleEpisodeUpdated);
    window.addEventListener('zk_data_changed', handleEpisodeUpdated);

    const safetyTimeout = setTimeout(() => {
      if (isMounted) setInitialLoading(false);
    }, 12000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      window.removeEventListener('zk_episode_deleted', handleEpisodeDeleted);
      window.removeEventListener('zk_episode_published', handleEpisodeUpdated);
      window.removeEventListener('zk_episodes_changed', handleEpisodeUpdated);
      window.removeEventListener('zk_anime_published', handleEpisodeUpdated);
      window.removeEventListener('zk_data_changed', handleEpisodeUpdated);
    };
  }, [id, navigate]);

  // Load only episodes from the selected season
  const currentSeasonEpisodes = useMemo(() => {
    if (allEpisodes.length === 0) return [];
    if (!selectedSeason) return allEpisodes;

    return allEpisodes.filter((ep) =>
      matchEpisodeToSeason(ep, selectedSeason, seasons, allEpisodes)
    );
  }, [allEpisodes, selectedSeason, seasons]);

  const isMovie = Boolean(anime?.type === 'Movie' || anime?.contentType === 'Movie' || anime?.isMovie);
  const latestEpisode = allEpisodes.length > 0 ? allEpisodes[allEpisodes.length - 1] : null;

  if (initialLoading) {
    return (
      <div className="pb-24 bg-[#05070b] min-h-screen text-silver-light">
        <div className="relative w-full aspect-video md:aspect-[21/9] max-h-[60vh] bg-[#0a0e17] skeleton-shimmer" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center relative z-10 -mt-24 md:-mt-48 space-y-6">
          <div className="w-48 md:w-64 aspect-[2/3] rounded-3xl bg-white/5 border border-white/10 skeleton-shimmer" />
          <div className="w-72 h-10 rounded-2xl bg-white/10 skeleton-shimmer" />
          <div className="w-48 h-6 rounded-xl bg-white/10 skeleton-shimmer" />
          <div className="w-full max-w-4xl h-64 rounded-3xl bg-white/5 skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-silver-dark bg-[#05070b] px-4">
        <h2 className="text-2xl font-black text-silver-light mb-2">Anime Not Found</h2>
        <p className="text-sm mb-6">The requested title could not be located in the database.</p>
        <Link to="/" className="btn-3d-cyan px-6 py-2.5 text-xs font-black">
          RETURN TO HOME
        </Link>
      </div>
    );
  }

  const currentSeasonObj = seasons.find((s) => s.id === selectedSeason);
  // Requirement 1: Use anime.banner_url for Anime Details page background banner
  const bannerImg =
    anime.banner_url ||
    anime.bannerUrl ||
    currentSeasonObj?.banner_url ||
    currentSeasonObj?.bannerUrl ||
    anime.poster_url ||
    anime.posterUrl ||
    '';

  // Requirement 2: Use anime.poster_url for Details page poster
  const posterImg =
    anime.poster_url ||
    anime.posterUrl ||
    currentSeasonObj?.poster_url ||
    currentSeasonObj?.posterUrl ||
    anime.banner_url ||
    anime.bannerUrl ||
    '';

  return (
    <div className="pb-24 bg-[#05070b] min-h-screen text-silver-light">
      {/* 1. Centered Hero Background Banner & Vertically Centered Poster (Requirements 1, 2, 6, 9) */}
      <div className="relative w-full overflow-hidden bg-[#05070b]">
        <div
          className="relative w-full min-h-[360px] sm:min-h-[420px] md:min-h-[480px] lg:min-h-[520px] flex items-center justify-center overflow-hidden"
          style={{
            backgroundPosition: 'center center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {bannerImg ? (
            <div className="absolute inset-0 w-full h-full pointer-events-none">
              <SmartImage
                src={bannerImg}
                alt={anime.title}
                type="banner"
                loading="eager"
                className="w-full h-full"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center center',
                }}
                titleFallback={anime.title}
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-[#0a0e17]" />
          )}

          {/* Dark gradient overlay (40–60%) for better contrast and text readability */}
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00e5ff]/50 to-transparent shadow-[0_0_15px_rgba(0,229,255,0.6)]" />

          {/* 2. Poster Centered Vertically Over the Banner with Soft Shadow & Rounded Corners */}
          <div className="relative z-10 flex items-center justify-center px-4 py-8 sm:py-10">
            <div className="w-36 sm:w-48 md:w-56 lg:w-64 aspect-[2/3] rounded-2xl sm:rounded-3xl overflow-hidden glass-cyber-card border-2 border-white/20 shadow-[0_15px_45px_rgba(0,0,0,0.85)] hover:border-[#00e5ff]/80 transition-all duration-300 transform hover:scale-105">
              <SmartImage
                src={posterImg}
                alt={anime.title}
                type="poster"
                className="w-full h-full rounded-2xl sm:rounded-3xl"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center center',
                }}
                loading="eager"
                titleFallback={anime.title}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* 3. Title & Quick Meta */}
        <div className="text-center w-full mt-6 sm:mt-8 mb-8 sm:mb-10 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00e5ff]/15 text-[#00e5ff] text-xs font-black border border-[#00e5ff]/30 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
              <Sparkles className="w-3.5 h-3.5" />
              ZK HINDI DUB
            </span>
            {anime.rating && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/60 text-yellow-400 text-xs font-bold border border-yellow-500/20">
                <Star className="w-3.5 h-3.5 fill-yellow-400" />
                {anime.rating}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
            {anime.title}
          </h1>

          {(() => {
            const isMovie = Boolean(anime.type === 'Movie' || anime.contentType === 'Movie' || anime.isMovie);
            return (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-silver">
                  {isMovie ? (
                    <>
                      <span className="bg-[#00e5ff] text-black px-4 py-1.5 rounded-full font-black shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                        MOVIE
                      </span>
                      {anime.duration && (
                        <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10">
                          {anime.duration} min
                        </span>
                      )}
                      <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10 text-[#00e5ff]">
                        1080p Ultra HD
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10">
                        {seasons.length > 0 ? `${seasons.length} ${seasons.length === 1 ? 'Season' : 'Seasons'}` : 'Season 1'}
                      </span>
                      <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10">
                        {allEpisodes.length} {allEpisodes.length === 1 ? 'Episode' : 'Episodes'}
                      </span>
                      <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10 text-[#00e5ff]">
                        1080p Ultra HD
                      </span>
                    </>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (isMovie) {
                        const targetEp = latestEpisode || (allEpisodes.length > 0 ? allEpisodes[0] : null);
                        const epId = targetEp ? targetEp.id : (anime.id || 'movie-ep');
                        const sId = targetEp ? (targetEp.seasonId || targetEp.season_id || 's1') : 's1';
                        navigate(`/watch/${anime.id}/${sId}/${epId}`);
                      } else if (latestEpisode) {
                        const sId = latestEpisode.seasonId || latestEpisode.season_id || 's1';
                        navigate(`/watch/${anime.id}/${sId}/${latestEpisode.id}`);
                      }
                    }}
                    disabled={!isMovie && !latestEpisode}
                    className="btn-3d-cyan inline-flex items-center gap-3 px-8 py-3.5 sm:px-9 sm:py-4 text-sm sm:text-base font-black disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{isMovie ? 'WATCH MOVIE' : 'PLAY LATEST EPISODE'}</span>
                  </button>

                  <button
                    onClick={handleToggleFavorite}
                    title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                    className={`inline-flex items-center gap-2 px-5 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm font-black border transition-all cursor-pointer ${
                      isFav
                        ? 'bg-pink-600/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                        : 'bg-[#101624] border-white/10 text-silver hover:text-white hover:border-pink-500/50'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    <span>{isFav ? 'Favorited' : 'Favorite'}</span>
                  </button>

                  <button
                    onClick={handleToggleWatchlist}
                    title={inWl ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    className={`inline-flex items-center gap-2 px-5 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm font-black border transition-all cursor-pointer ${
                      inWl
                        ? 'bg-[#00e5ff]/20 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                        : 'bg-[#101624] border-white/10 text-silver hover:text-white hover:border-[#00e5ff]/50'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${inWl ? 'fill-current' : ''}`} />
                    <span>{inWl ? 'In Watchlist' : 'Watchlist'}</span>
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        {/* 4. 3D Overview Card */}
        <div className="w-full max-w-4xl glass-cyber-card rounded-3xl p-6 sm:p-8 md:p-10 mb-12 shadow-[0_15px_45px_rgba(0,0,0,0.7)] border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00e5ff]/5 rounded-full blur-[80px] pointer-events-none" />

          <h2 className="text-xl sm:text-2xl font-black text-silver-light mb-4 flex items-center gap-2">
            <Film className="w-5 h-5 text-brand" />
            Overview
          </h2>

          <p className="text-silver/90 leading-relaxed text-sm sm:text-base mb-8">
            {anime.description || 'No description available.'}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm mb-8 pt-6 border-t border-white/5">
            <div>
              <span className="text-silver-dark block mb-1 uppercase tracking-wider text-[11px] font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-brand" /> Genres
              </span>
              <span className="text-silver-light font-semibold text-xs sm:text-sm">
                {Array.isArray(anime.genres) ? anime.genres.join(', ') : anime.genres || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-silver-dark block mb-1 uppercase tracking-wider text-[11px] font-bold flex items-center gap-1">
                <Mic className="w-3 h-3 text-brand" /> Dubbed By
              </span>
              <span className="text-[#00e5ff] font-bold text-xs sm:text-sm">
                {anime.dubbedBy || anime.studio || 'ZK Dubbing Studio'}
              </span>
            </div>
            <div>
              <span className="text-silver-dark block mb-1 uppercase tracking-wider text-[11px] font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-brand" /> Duration
              </span>
              <span className="text-silver-light font-semibold text-xs sm:text-sm">
                {anime.duration ? `${anime.duration} min` : '24 min'}
              </span>
            </div>
            <div>
              <span className="text-silver-dark block mb-1 uppercase tracking-wider text-[11px] font-bold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-brand" /> Release Year
              </span>
              <span className="text-silver-light font-semibold text-xs sm:text-sm">
                {anime.releaseYear || anime.year || '2024'}
              </span>
            </div>
          </div>

          <a
            href="https://t.me/+BrcaJdug2kgwZDM1"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] text-white px-8 py-3.5 rounded-full font-bold transition-all hover:shadow-[0_0_20px_rgba(42,171,238,0.5)] hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Join Telegram Channel
          </a>
        </div>

        {/* 5. Choose Season & Episodes Grid (TV Series only - Requirement 5) */}
        {!isMovie && (
          <div className="w-full max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-silver-light">Episodes</h2>

              {seasons.length > 0 && (
                <div ref={dropdownRef} className="relative w-full sm:w-64 z-20">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    type="button"
                    className={`w-full flex items-center justify-between bg-[#101624]/90 backdrop-blur-md border ${
                      isDropdownOpen ? 'border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10'
                    } rounded-2xl px-5 py-3.5 text-white font-bold cursor-pointer transition-all duration-300 outline-none`}
                  >
                    <span className="truncate pr-4">
                      {seasons.find((s) => s.id === selectedSeason)?.title || (seasons.find((s) => s.id === selectedSeason)?.seasonNumber ? `Season ${seasons.find((s) => s.id === selectedSeason)?.seasonNumber}` : 'Choose Season')}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 shrink-0 transition-transform duration-300 ${
                        isDropdownOpen ? 'rotate-180 text-brand' : 'text-silver-dark'
                      }`}
                    />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0e17]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-30">
                      <div className="max-h-60 overflow-y-auto custom-scrollbar py-2">
                        {seasons.map((season) => {
                          const isSelected = selectedSeason === season.id;
                          return (
                            <button
                              key={season.id}
                              type="button"
                              onClick={() => {
                                setSelectedSeason(season.id);
                                setIsDropdownOpen(false);
                              }}
                              className={`w-full flex items-center px-5 py-3 text-left font-bold transition-colors cursor-pointer ${
                                isSelected
                                  ? 'text-[#00e5ff] bg-[#00e5ff]/10'
                                  : 'text-silver hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {season.title || `Season ${season.seasonNumber || 1}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 6. Episodes Grid with 3D Hover Cards */}
            {currentSeasonEpisodes.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {currentSeasonEpisodes.map((ep) => {
                  const epSeasonId = ep.seasonId || ep.season_id;
                  const currentSeason = seasons.find((s) => s.id === epSeasonId);
                  const seasonNumber = currentSeason?.seasonNumber || ep.seasonNumber || 1;

                  return (
                    <Link
                      key={ep.id}
                      to={`/watch/${anime.id}/${epSeasonId || selectedSeason || 's1'}/${ep.id}`}
                      className="group flex flex-col glass-cyber-card rounded-2xl overflow-hidden border border-white/10 hover:border-[#00e5ff]/70 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgba(0,229,255,0.2)]"
                    >
                      <div className="relative w-full aspect-video bg-[#0a0e17] overflow-hidden">
                        <SmartImage
                          src={
                            anime.poster_url ||
                            anime.posterUrl ||
                            ep.thumbnail_url ||
                            ep.thumbnailUrl ||
                            anime.banner_url ||
                            anime.bannerUrl ||
                            ''
                          }
                          alt={ep.title || `Episode ${ep.episodeNumber}`}
                          type="poster"
                          loading="lazy"
                          className="w-full h-full group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                          style={{ objectFit: 'cover', objectPosition: 'center center' }}
                          titleFallback={ep.title || `Episode ${ep.episodeNumber}`}
                        />

                        <div className="absolute top-2 left-2 z-10">
                          <span className="bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/10 shadow-lg">
                            S{seasonNumber} : EP {ep.episodeNumber}
                          </span>
                        </div>

                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00b4d8] to-[#00f0ff] flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,229,255,0.6)] opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 flex-1 flex flex-col justify-center bg-[#0a0e17]/80">
                        <h4 className="text-xs sm:text-sm font-bold text-silver-light line-clamp-2 group-hover:text-brand transition-colors">
                          {ep.title || `Episode ${ep.episodeNumber}`}
                        </h4>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 px-4 glass-cyber-card rounded-3xl border border-white/10 mt-6 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#00e5ff]/10 border border-[#00e5ff]/20 flex items-center justify-center text-[#00e5ff]">
                  <Film className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-silver-light">No episodes found</h3>
                <p className="text-xs sm:text-sm text-silver-dark max-w-sm mx-auto">
                  No episodes have been released for {seasons.find((s) => s.id === selectedSeason)?.title || 'this season'} yet. Check back soon for new updates!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
