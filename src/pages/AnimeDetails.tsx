import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { Play, Send, ChevronDown, Sparkles, Star, Film, Calendar, Clock, Mic } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getAnimeById, getSeasonsByAnimeId, getEpisodesByAnimeId, matchEpisodeToSeason } from '../lib/dataService';

export default function AnimeDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [prevId, setPrevId] = useState(id);
  const [anime, setAnime] = useState<any>(location.state?.anime?.id === id ? location.state.anime : null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Reset state during render when route param changes
  if (id !== prevId) {
    setPrevId(id);
    const incomingAnime = location.state?.anime?.id === id ? location.state.anime : null;
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
        const [animeData, seasonsData, episodesData] = await Promise.all([
          getAnimeById(id),
          getSeasonsByAnimeId(id),
          getEpisodesByAnimeId(id),
        ]);

        if (isMounted) {
          if (animeData) setAnime(animeData);

          const fetchedEpisodes = episodesData || [];
          setAllEpisodes(fetchedEpisodes);

          let effectiveSeasons = seasonsData || [];
          // If no seasons exist in DB but episodes exist, synthesize Season 1
          if (effectiveSeasons.length === 0 && fetchedEpisodes.length > 0) {
            effectiveSeasons = [{
              id: 's1',
              animeId: id,
              seasonNumber: 1,
              title: 'Season 1',
              order: 1
            }];
          }

          if (effectiveSeasons.length > 0) {
            setSeasons(effectiveSeasons);
            setSelectedSeason(prev => {
              if (prev && effectiveSeasons.some((s: any) => s.id === prev)) {
                return prev;
              }
              return effectiveSeasons[0].id;
            });
          }

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

    window.addEventListener('zk_episode_deleted', handleEpisodeDeleted);

    return () => {
      isMounted = false;
      window.removeEventListener('zk_episode_deleted', handleEpisodeDeleted);
    };
  }, [id]);

  const currentSeasonEpisodes = useMemo(() => {
    if (allEpisodes.length === 0) return [];
    if (!selectedSeason || seasons.length <= 1) return allEpisodes;

    const matched = allEpisodes.filter((ep) =>
      matchEpisodeToSeason(ep, selectedSeason, seasons, allEpisodes)
    );

    // Requirement 3: Do not show "No episodes found" if episodes exist
    if (matched.length > 0) return matched;
    return allEpisodes;
  }, [allEpisodes, selectedSeason, seasons]);

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

  return (
    <div className="pb-24 bg-[#05070b] min-h-screen text-silver-light">
      {/* 1. Parallax Cinematic Banner */}
      <div className="relative w-full aspect-[4/3] sm:aspect-video md:aspect-[21/9] max-h-[65vh] overflow-hidden">
        <img
          src={
            anime.bannerUrl ||
            anime.posterUrl ||
            'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&q=80'
          }
          alt={anime.title}
          className="w-full h-full object-cover scale-105"
          loading="eager"
        />
        {/* Layered Cyber Dark Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00e5ff]/50 to-transparent shadow-[0_0_15px_rgba(0,229,255,0.6)]" />
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center relative z-10 -mt-28 sm:-mt-40 md:-mt-52">
        {/* 2. 3D Poster with Specular Border */}
        <div className="perspective-1000 group mb-6">
          <div className="w-44 sm:w-56 md:w-64 rounded-3xl overflow-hidden glass-cyber-card border-2 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] group-hover:border-[#00e5ff]/80 transition-all duration-500 transform group-hover:scale-105 group-hover:-translate-y-2">
            <img
              src={
                anime.posterUrl ||
                'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&q=80'
              }
              alt={anime.title}
              className="w-full aspect-[2/3] object-cover"
              loading="eager"
            />
          </div>
        </div>

        {/* 3. Title & Quick Meta */}
        <div className="text-center w-full mb-10 space-y-4">
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

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
            {anime.title}
          </h1>

          <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-bold text-silver">
            <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10">
              {seasons.length > 0 ? `${seasons.length} Seasons` : 'Season 1'}
            </span>
            <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10">
              {allEpisodes.length} Episodes
            </span>
            <span className="bg-[#101624] px-4 py-1.5 rounded-full border border-white/10 text-[#00e5ff]">
              1080p Ultra HD
            </span>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                if (latestEpisode) {
                  const sId = latestEpisode.seasonId || latestEpisode.season_id || 's1';
                  navigate(`/watch/${anime.id}/${sId}/${latestEpisode.id}`);
                }
              }}
              disabled={!latestEpisode}
              className="btn-3d-cyan inline-flex items-center gap-3 px-9 py-4 text-sm sm:text-base font-black disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY LATEST EPISODE</span>
            </button>
          </div>
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] text-white px-8 py-3.5 rounded-full font-bold transition-all hover:shadow-[0_0_20px_rgba(42,171,238,0.5)] hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4" />
            Join Telegram Channel
          </a>
        </div>

        {/* 5. Choose Season & Episodes Grid */}
        <div className="w-full max-w-5xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-silver-light">Episodes</h2>

            {seasons.length > 0 && (
              <div className="relative w-full sm:w-64 z-20">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  className={`w-full flex items-center justify-between bg-[#101624]/90 backdrop-blur-md border ${
                    isDropdownOpen ? 'border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'border-white/10'
                  } rounded-2xl px-5 py-3.5 text-white font-bold cursor-pointer transition-all duration-300 outline-none`}
                >
                  <span className="truncate pr-4">
                    {seasons.find((s) => s.id === selectedSeason)?.title || 'Choose Season'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform duration-300 ${
                      isDropdownOpen ? 'rotate-180 text-brand' : 'text-silver-dark'
                    }`}
                  />
                </button>

                <div
                  className={`absolute top-full left-0 right-0 mt-2 bg-[#0a0e17]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 origin-top z-30 ${
                    isDropdownOpen
                      ? 'opacity-100 scale-y-100'
                      : 'opacity-0 scale-y-95 pointer-events-none'
                  }`}
                >
                  <div className="max-h-60 overflow-y-auto custom-scrollbar py-2">
                    {seasons.map((season) => {
                      const isSelected = selectedSeason === season.id;
                      return (
                        <button
                          key={season.id}
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
                          {season.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. Episodes Grid with 3D Hover Cards */}
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
                    <img
                      src={
                        ep.thumbnailUrl ||
                        anime.posterUrl ||
                        'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&q=80'
                      }
                      alt={ep.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                      loading="lazy"
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

          {currentSeasonEpisodes.length === 0 && (
            <div className="text-center py-16 text-silver-dark glass-cyber-card rounded-3xl border border-white/10 mt-6">
              <p className="text-base font-semibold">No episodes found for this season.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
