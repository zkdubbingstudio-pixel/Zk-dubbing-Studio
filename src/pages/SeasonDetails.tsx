import { useParams, Link } from 'react-router-dom';
import { Play, Clock, ArrowLeft, Star, MonitorPlay } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAnimeById, getSeasonsByAnimeId, getEpisodesByAnimeId } from '../lib/dataService';

export default function SeasonDetails() {
  const { id, seasonId } = useParams();
  
  const [anime, setAnime] = useState<any>(null);
  const [season, setSeason] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const [anData, allSeasons, epsData] = await Promise.all([
          getAnimeById(id),
          getSeasonsByAnimeId(id),
          seasonId ? getEpisodesByAnimeId(id, seasonId) : getEpisodesByAnimeId(id),
        ]);

        if (isMounted) {
          if (anData) setAnime(anData);
          const foundSeason = allSeasons.find(s => s.id === seasonId) || allSeasons[0];
          if (foundSeason) setSeason(foundSeason);
          if (epsData) setEpisodes(epsData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();

    const tenSec = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 10000);

    return () => { 
      isMounted = false; 
      clearTimeout(tenSec);
    };
  }, [id, seasonId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/50">Loading Season...</div>;
  if (!season && !anime) return <div className="min-h-screen flex items-center justify-center text-white/50">Season not found.</div>;

  const currentSeason = season || { title: 'Season 1' };

  return (
    <div className="min-h-screen bg-bg-base text-white pb-16">
      {/* Banner */}
      <div className="relative h-[300px] md:h-[400px] w-full">
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/60 to-transparent z-10" />
        <img 
          src={currentSeason.bannerUrl || currentSeason.banner_url || anime?.bannerUrl || anime?.posterUrl || ""} 
          alt={currentSeason.title}
          className="w-full h-full object-cover"
        />
        
        {/* Navigation back */}
        <div className="absolute top-4 left-4 lg:top-8 lg:left-8 z-20">
          <Link to={`/anime/${id}`} className="flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-black/80 backdrop-blur rounded-md transition-colors text-white font-medium">
            <ArrowLeft className="w-5 h-5" />
            Back to Anime
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-20 -mt-24 md:-mt-32">
        <div className="flex flex-col md:flex-row gap-6 md:gap-10">
          {/* Poster */}
          <div className="w-40 md:w-64 flex-shrink-0 mx-auto md:mx-0">
            <img 
              src={currentSeason.posterUrl || currentSeason.poster_url || anime?.posterUrl || ""} 
              alt={currentSeason.title}
              className="w-full aspect-[2/3] object-cover rounded-xl shadow-2xl ring-1 ring-white/10"
            />
          </div>

          {/* Season Info */}
          <div className="flex-1 flex flex-col justify-end pt-4 md:pt-16 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-bold mb-3">{currentSeason.title}</h1>
            <p className="text-brand font-bold text-lg mb-4">{anime?.title}</p>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-white/70 mb-6">
              {(currentSeason.release_year || currentSeason.releaseYear) && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 text-white">
                  <Star className="w-4 h-4 text-brand" />
                  {currentSeason.release_year || currentSeason.releaseYear}
                </span>
              )}
              {currentSeason.status && (
                <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10">
                  {currentSeason.status}
                </span>
              )}
              <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10">
                {episodes.length} Episodes
              </span>
            </div>

            {currentSeason.description && (
              <p className="text-white/80 leading-relaxed text-sm md:text-base max-w-3xl mb-8">
                {currentSeason.description}
              </p>
            )}
          </div>
        </div>

        {/* Episode List */}
        <div className="mt-12 md:mt-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            Episodes
            <span className="text-brand text-sm px-2 py-0.5 rounded-full bg-brand/10">{episodes.length}</span>
          </h2>
          
          <div className="flex flex-col gap-4">
            {episodes.map((ep) => (
              <Link 
                key={ep.id} 
                to={`/watch/${id}/${seasonId || ep.seasonId || 's1'}/${ep.id}`}
                className="group flex flex-col sm:flex-row gap-4 p-3 pr-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all items-start sm:items-center bg-bg-surface/30"
              >
                {/* Thumbnail container */}
                <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-black/50">
                  <img 
                    src={ep.thumbnailUrl || ep.thumbnail_url || anime?.posterUrl || ""} 
                    alt={ep.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-black pl-1 shadow-lg">
                      <Play className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Duration overlay */}
                  {ep.duration && (
                     <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-bold tracking-wider text-white">
                        {ep.duration}
                     </div>
                  )}
                </div>

                {/* Episode Details */}
                <div className="flex-1 min-w-0 py-1">
                  <div className="text-brand text-sm font-bold mb-1">Episode {ep.episodeNumber || ep.episode_number}</div>
                  <h3 className="text-lg font-bold text-white mb-2 truncate">{ep.title || `Episode ${ep.episodeNumber || ep.episode_number}`}</h3>
                  {ep.releaseDate && (
                    <div className="flex items-center gap-4 text-xs text-white/50 font-medium">
                      <span className="flex items-center gap-1 text-white/70">
                        <Clock className="w-3.5 h-3.5" />
                        {ep.releaseDate}
                      </span>
                    </div>
                  )}
                </div>

                {/* Watch Button (Desktop) */}
                <div className="hidden sm:block">
                  <button className="px-4 py-2 rounded-full border border-white/10 group-hover:border-brand/30 group-hover:bg-brand/10 text-white/70 group-hover:text-brand font-medium transition-all text-sm flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Watch
                  </button>
                </div>
              </Link>
            ))}
            
            {episodes.length === 0 && (
              <div className="text-center py-12 text-white/50 bg-white/5 rounded-xl border border-white/5">
                <MonitorPlay className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No episodes available for this season yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
