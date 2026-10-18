import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Info, ChevronLeft, ChevronRight, Volume2, Sparkles, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCachedData } from '../lib/cache';
import SmartImage from './SmartImage';

interface HeroSliderProps {
  featuredList: any[];
}

const HeroSlider = React.memo(function HeroSlider({ featuredList }: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const navigate = useNavigate();

  const isFinePointer = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Resolve watch target immediately without making extra API queries on mount (Requirement 5 & 6)
  const getWatchTarget = useCallback((anime: any): string => {
    if (!anime) return '/';
    // 1. If anime already has episodes embedded from unified catalog
    if (Array.isArray(anime.episodes) && anime.episodes.length > 0) {
      const ep = anime.episodes[0];
      return `/watch/${anime.id}/${ep.season_id || ep.seasonId || 's1'}/${ep.id}`;
    }
    // 2. Check cached episodes
    const allEps = getCachedData<any[]>('all_episodes');
    if (allEps) {
      const match = allEps.find(e => (e.animeId === anime.id || e.anime_id === anime.id) && Number(e.episodeNumber || 1) === 1) ||
                    allEps.find(e => e.animeId === anime.id || e.anime_id === anime.id);
      if (match) {
        return `/watch/${anime.id}/${match.seasonId || match.season_id || 's1'}/${match.id}`;
      }
    }
    // 3. Fallback: navigate to watch page with animeId which auto-resolves episode 1 in 0ms
    return `/watch/${anime.id}`;
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === featuredList.length - 1 ? 0 : prev + 1));
  }, [featuredList.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? featuredList.length - 1 : prev - 1));
  }, [featuredList.length]);

  // Auto-slide every 6 seconds
  useEffect(() => {
    if (featuredList.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [featuredList.length, isPaused, nextSlide]);

  // Parallax mouse move with RAF throttling (desktop only)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isFinePointer || !containerRef.current) return;
    if (rafId.current) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
      setMouseOffset({ x: x * 15, y: y * 10 });
    });
  };

  const handleMouseLeave = () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setIsPaused(false);
    setMouseOffset({ x: 0, y: 0 });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  if (featuredList.length === 0) return null;

  return (
    <section
      ref={containerRef}
      className="relative w-full h-[58vh] min-h-[390px] max-h-[490px] sm:h-[65vh] sm:min-h-[500px] lg:h-[70vh] lg:max-h-[780px] bg-[#05070b] overflow-hidden group perspective-1000 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Animated Subtle Ambient Top Neon Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent z-40 opacity-70 shadow-[0_0_15px_rgba(0,229,255,0.8)]" />

      {featuredList.map((featured, index) => {
        const isCurrent = index === currentIndex;

        return (
          <div
            key={featured.id ? `hero-${featured.id}-${index}` : `hero-${index}`}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Parallax Background Image */}
            <div
              className="absolute inset-0 w-full h-full overflow-hidden transition-transform duration-500 ease-out"
              style={{
                transform: isCurrent
                  ? `scale(1.06) translate(${mouseOffset.x * -0.3}px, ${mouseOffset.y * -0.3}px)`
                  : 'scale(1)',
              }}
            >
              <SmartImage
                src={
                  featured.banner_url ||
                  featured.bannerUrl ||
                  featured.poster_url ||
                  featured.posterUrl ||
                  ''
                }
                fallbackUrl={featured.poster_url || featured.posterUrl || ''}
                alt={featured.title}
                type="banner"
                className="w-full h-full"
                style={{ objectFit: 'cover', objectPosition: 'center center' }}
                loading={index === 0 ? 'eager' : 'lazy'}
                priority={index === 0}
                titleFallback={featured.title}
              />

              {/* Light transparent overlay for text readability while keeping full brightness */}
              <div className="absolute inset-0 bg-black/15 sm:bg-black/[0.18] pointer-events-none" />

              {/* Subtle bottom gradient behind text */}
              <div className="absolute bottom-0 left-0 right-0 h-[70%] sm:h-[55%] bg-gradient-to-t from-[#05070b]/90 via-[#05070b]/40 to-transparent pointer-events-none" />
            </div>

            {/* Content Overlay */}
            <div className="relative z-20 w-full h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-end pb-9 sm:pb-14 md:pb-18">
              <div
                className={`max-w-2xl space-y-2 sm:space-y-3.5 md:space-y-4 transition-all duration-700 transform ${
                  isCurrent ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                }`}
                style={{
                  transform: isCurrent
                    ? `translate(${mouseOffset.x * 0.6}px, ${mouseOffset.y * 0.6}px)`
                    : 'translateY(30px)',
                }}
              >
                {/* Futuristic Badges Row */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                  {(featured.type === 'Movie' || featured.contentType === 'Movie' || featured.isMovie) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#00e5ff] text-black text-[10px] sm:text-xs font-black shadow-[0_0_12px_rgba(0,229,255,0.6)]">
                      MOVIE
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#00e5ff]/25 text-[#00e5ff] text-[10px] sm:text-xs font-black backdrop-blur-md border border-[#00e5ff]/50 shadow-[0_0_12px_rgba(0,229,255,0.35)]">
                    <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
                    HINDI DUBBED
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-black/70 text-silver-light text-[10px] sm:text-xs font-bold backdrop-blur-md border border-white/20">
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#00e5ff]" />
                    {featured.status || 'Exclusive'}
                  </span>

                  {featured.rating && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/75 text-yellow-400 text-[10px] sm:text-xs font-bold border border-yellow-500/40">
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-yellow-400" />
                      {featured.rating}
                    </span>
                  )}
                </div>

                {/* Main Anime Title */}
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12] sm:leading-[1.08] drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] line-clamp-2">
                  {featured.title}
                </h1>

                {/* Genre Chips */}
                {featured.genres && featured.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {featured.genres.slice(0, 3).map((g: string, i: number) => (
                      <span
                        key={`${g}-${i}`}
                        className="px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-md bg-[#05070b]/90 text-silver text-[10px] sm:text-[11px] font-semibold border border-white/15 backdrop-blur-sm"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description */}
                <p className="text-xs sm:text-sm md:text-base text-silver-light/90 font-medium line-clamp-2 max-w-xl leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  {featured.description}
                </p>

                {/* 3D Action Buttons */}
                <div className="flex items-center gap-2.5 sm:gap-3.5 pt-1 sm:pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(getWatchTarget(featured), { state: { anime: featured } });
                    }}
                    className="btn-3d-cyan flex items-center justify-center gap-2 px-5 py-2.5 sm:px-8 sm:py-3.5 text-xs sm:text-sm md:text-base font-black cursor-pointer group/btn"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current transition-transform group-hover/btn:scale-110" />
                    <span>
                      {(featured.type === 'Movie' || featured.contentType === 'Movie' || featured.isMovie)
                        ? 'WATCH MOVIE'
                        : 'WATCH NOW'}
                    </span>
                  </button>

                  <Link
                    to={`/anime/${featured.id}`}
                    state={{ anime: featured }}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-3d-silver flex items-center justify-center gap-2 px-4 py-2.5 sm:px-7 sm:py-3.5 text-xs sm:text-sm md:text-base font-bold cursor-pointer"
                  >
                    <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>MORE INFO</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 3D Glass Navigation Arrows */}
      {featuredList.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            aria-label="Previous Slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full glass-cyber text-white hover:text-black hover:bg-[#00e5ff] border border-white/10 hover:border-[#00e5ff] hover:shadow-[0_0_20px_rgba(0,229,255,0.6)] flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 hidden md:flex cursor-pointer hover:scale-110 active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            aria-label="Next Slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full glass-cyber text-white hover:text-black hover:bg-[#00e5ff] border border-white/10 hover:border-[#00e5ff] hover:shadow-[0_0_20px_rgba(0,229,255,0.6)] flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 hidden md:flex cursor-pointer hover:scale-110 active:scale-95"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Carousel Indicators */}
      {featuredList.length > 1 && (
        <div className="absolute bottom-2.5 sm:bottom-4 md:bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/10 shadow-lg">
          {featuredList.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`transition-all duration-500 rounded-full cursor-pointer ${
                index === currentIndex
                  ? 'w-6 sm:w-8 h-1.5 sm:h-2 bg-gradient-to-r from-[#00b4d8] to-[#00f0ff] shadow-[0_0_12px_rgba(0,229,255,0.9)]'
                  : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-silver-dark/40 hover:bg-silver'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export default HeroSlider;
