import { useState, useEffect, useMemo } from 'react';
import { Flame, Sparkles, Trophy, Compass, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFeaturedAnime, getTrendingAnime, getNewDrops, getAllAnime } from '../lib/dataService';
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

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [featuredData, trendingData, dropsData, allAnimeData] = await Promise.all([
          getFeaturedAnime(),
          getTrendingAnime(),
          getNewDrops(),
          getAllAnime(),
        ]);

        if (isMounted) {
          setFeaturedList(featuredData || []);
          setTrending(trendingData || []);
          setNewDrops(dropsData || []);
          setAllAnime(allAnimeData || []);
          setLoading(false);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load anime data. Please check your connection.');
          setLoading(false);
        }
      }
    };

    fetchData();

    const handleEpisodeDeleted = () => {
      getNewDrops().then(drops => {
        if (isMounted) setNewDrops(drops || []);
      }).catch(() => {});
    };

    window.addEventListener('zk_episode_deleted', handleEpisodeDeleted);

    return () => {
      isMounted = false;
      window.removeEventListener('zk_episode_deleted', handleEpisodeDeleted);
    };
  }, []);

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

  if (loading) {
    return (
      <div className="space-y-12 pb-24">
        <HeroSkeleton />
        <SectionSkeleton title="New Drops" />
        <SectionSkeleton title="Trending Now" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center p-8 glass-cyber-card border border-red-500/30 rounded-3xl max-w-lg shadow-[0_0_35px_rgba(239,68,68,0.2)]">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            &times;
          </div>
          <h2 className="text-2xl font-black text-silver-light mb-3">Sync Error</h2>
          <p className="text-silver-dark mb-6 text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-3d-cyan px-8 py-3 text-sm font-black"
          >
            RECONNECT DATABASE
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
        
        {/* 2. Continue Watching (Interactive / LocalStorage synced) */}
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

            {/* Horizontal Scroll with 3D Tilt Cards */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 sm:gap-5 pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {newDrops.map((anime: any, index: number) => {
                const epLabel = anime.episodeNumber ? `EP ${anime.episodeNumber}` : anime.latestEpisodeRange || 'EP 1';
                const sLabel = anime.seasonNumber ? `Season ${anime.seasonNumber}` : 'Season 1';

                return (
                  <AnimeCard3D
                    key={anime.dropId ? `drop-${anime.dropId}` : `drop-anime-${anime.id}-${index}`}
                    anime={anime}
                    badgeTopLeft={sLabel}
                    badgeBottomLeft={epLabel}
                    className="flex-none w-44 sm:w-52 md:w-60 snap-start"
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
                <div className="w-9 h-9 rounded-xl bg-[#cbd5e1]/10 flex items-center justify-center border border-white/15 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  <Trophy className="w-5 h-5 text-yellow-400" />
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
              <span className="text-xs text-silver font-semibold bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {filteredAnime.length} Titles Available
              </span>
            </div>
          </div>

          {/* Animated 3D Genre Chips */}
          <GenreChipsBar
            genres={GENRE_LIST}
            selectedGenre={selectedGenre}
            onSelectGenre={setSelectedGenre}
          />

          {/* Filtered Grid with 3D Hover Cards */}
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
              <h3 className="text-lg font-bold text-silver-light">No Anime in &quot;{selectedGenre}&quot; yet</h3>
              <p className="text-xs text-silver-dark mt-1 max-w-sm mx-auto">
                Check back soon as ZK Dubbing Studio continuously uploads new Hindi dubbed episodes.
              </p>
              <button
                onClick={() => setSelectedGenre('All')}
                className="btn-3d-cyan mt-5 px-6 py-2.5 text-xs font-bold"
              >
                SHOW ALL ANIME
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
