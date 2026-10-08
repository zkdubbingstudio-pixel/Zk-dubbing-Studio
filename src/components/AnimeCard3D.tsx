import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Sparkles, Star } from 'lucide-react';

interface AnimeCard3DProps {
  key?: React.Key;
  anime: any;
  rank?: number;
  badgeTopLeft?: string;
  badgeTopRight?: string;
  badgeBottomLeft?: string;
  className?: string;
  aspectRatio?: 'poster' | 'video';
  customPlayLink?: string;
}

export default function AnimeCard3D({
  anime,
  rank,
  badgeTopLeft,
  badgeTopRight,
  badgeBottomLeft,
  className = '',
  aspectRatio = 'poster',
  customPlayLink,
}: AnimeCard3DProps) {
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Smooth tilt: max 12 deg
    const rotX = -((y - centerY) / centerY) * 12;
    const rotY = ((x - centerX) / centerX) * 12;

    setRot({ x: rotX, y: rotY });
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.35,
    });
  };

  const handleMouseLeave = () => {
    setRot({ x: 0, y: 0 });
    setGlare(prev => ({ ...prev, opacity: 0 }));
    setIsHovered(false);
  };

  const posterImg =
    anime.posterUrl ||
    anime.poster_url ||
    anime.thumbnailUrl ||
    anime.thumbnail_url ||
    anime.bannerUrl ||
    anime.banner_url ||
    '';

  const title = anime.title || anime.episodeTitle || 'Untitled Anime';
  const isMovie = Boolean(anime.type === 'Movie' || anime.contentType === 'Movie' || anime.isMovie);
  const seasonInfo =
    badgeTopLeft ||
    (isMovie
      ? 'Movie'
      : anime.SeasonNumber
      ? `Season ${anime.SeasonNumber}`
      : anime.seasonNumber
      ? `Season ${anime.seasonNumber}`
      : anime.latestSeason || 'Season 1');

  const destination = customPlayLink || `/anime/${anime.id}`;

  return (
    <div
      ref={cardRef}
      className={`relative perspective-1000 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        to={destination}
        state={{ anime }}
        className="block w-full h-full outline-none focus:ring-2 focus:ring-brand rounded-2xl"
      >
        {/* 3D Container with physical tilt */}
        <div
          className="relative preserve-3d transition-transform duration-200 ease-out rounded-2xl overflow-hidden glass-cyber-card border border-white/10 group-hover:border-[#00e5ff]/60 shadow-[0_10px_30px_rgba(0,0,0,0.8)] group-hover:shadow-[0_20px_40px_rgba(0,229,255,0.25)]"
          style={{
            transform: `perspective(1000px) rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale3d(${
              isHovered ? 1.04 : 1
            }, ${isHovered ? 1.04 : 1}, 1)`,
          }}
        >
          {/* Animated Neon Rim Glow on Hover */}
          <div
            className={`absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#00e5ff] via-[#cbd5e1] to-[#00b4d8] opacity-0 group-hover:opacity-40 blur-sm transition-opacity duration-500 pointer-events-none`}
          />

          {/* Aspect Ratio Poster Wrapper */}
          <div
            className={`relative w-full ${
              aspectRatio === 'video' ? 'aspect-video' : 'aspect-[2/3]'
            } overflow-hidden bg-[#0a0e17]`}
          >
            {posterImg ? (
              <img
                src={posterImg}
                alt={title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-90 group-hover:opacity-100"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-tr from-[#05070b] via-[#0a0e17] to-[#121c2d]">
                <div className="w-8 h-8 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/30 flex items-center justify-center mb-2">
                  <Play className="w-4 h-4 text-[#00e5ff]" />
                </div>
                <span className="text-xs font-bold text-silver-light line-clamp-2">{title}</span>
              </div>
            )}

            {/* Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/30 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00e5ff]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Dynamic 3D Glare Light Reflection */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, ${glare.opacity}), transparent 60%)`,
              }}
            />

            {/* Trending Ranking Number (Vertically Centered on Left Edge of Poster) */}
            {rank !== undefined && (
              <div
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none select-none z-10 flex items-center justify-start"
              >
                <span
                  className="text-[70px] sm:text-[80px] md:text-[88px] font-black italic tracking-tighter leading-none text-white/30 drop-shadow-[0_0_15px_rgba(0,229,255,0.45)]"
                  style={{ transform: 'translateZ(15px)' }}
                >
                  {rank}
                </span>
              </div>
            )}

            {/* Top Left Badge (Season / Movie Status) */}
            <div
              className="absolute top-2.5 left-2.5 z-20 transition-transform duration-300"
              style={{ transform: isHovered ? 'translateZ(25px)' : 'translateZ(0px)' }}
            >
              <span className={`inline-flex items-center gap-1 ${
                isMovie
                  ? 'bg-[#00e5ff] text-black font-black shadow-[0_0_12px_rgba(0,229,255,0.6)]'
                  : 'bg-[#05070b]/80 backdrop-blur-md text-white font-bold border border-white/10 shadow-lg'
              } text-[10px] sm:text-xs px-2.5 py-1 rounded-lg`}>
                <Sparkles className={`w-3 h-3 ${isMovie ? 'text-black fill-current' : 'text-[#00e5ff]'}`} />
                {seasonInfo}
              </span>
            </div>

            {/* Top Right Badge (Audio / Hindi Dub / Quality) */}
            <div
              className="absolute top-2.5 right-2.5 z-20 transition-transform duration-300"
              style={{ transform: isHovered ? 'translateZ(25px)' : 'translateZ(0px)' }}
            >
              {badgeTopRight ? (
                <span className="bg-[#00e5ff] text-black text-[10px] sm:text-xs font-extrabold px-2.5 py-0.5 rounded-md shadow-[0_0_12px_rgba(0,229,255,0.6)]">
                  {badgeTopRight}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-[#00e5ff]/90 backdrop-blur text-black text-[10px] font-black px-2 py-0.5 rounded shadow-[0_0_10px_rgba(0,229,255,0.5)] border border-[#00e5ff]">
                  HINDI DUB
                </span>
              )}
            </div>

            {/* Bottom Left Badge (Episode Count / Range) */}
            {badgeBottomLeft && (
              <div
                className="absolute bottom-2.5 left-2.5 z-20 transition-transform duration-300"
                style={{ transform: isHovered ? 'translateZ(20px)' : 'translateZ(0px)' }}
              >
                <span className="bg-black/80 backdrop-blur-md text-silver-light text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded border border-white/10">
                  {badgeBottomLeft}
                </span>
              </div>
            )}

            {/* Rating Tag if available */}
            {anime.rating && (
              <div
                className="absolute bottom-2.5 right-2.5 z-20 transition-transform duration-300"
                style={{ transform: isHovered ? 'translateZ(20px)' : 'translateZ(0px)' }}
              >
                <span className="inline-flex items-center gap-1 bg-black/80 backdrop-blur text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-500/20">
                  <Star className="w-2.5 h-2.5 fill-yellow-400" />
                  {anime.rating}
                </span>
              </div>
            )}

            {/* 3D Play Button Overlay hovering in physical space */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ease-out z-30"
              style={{
                transform: isHovered ? 'translateZ(40px) scale(1)' : 'translateZ(10px) scale(0.7)',
                opacity: isHovered ? 1 : 0,
              }}
            >
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#00b4d8] to-[#00f0ff] flex items-center justify-center text-black shadow-[0_0_30px_rgba(0,229,255,0.8),inset_0_1px_2px_rgba(255,255,255,0.8)] border border-white/40">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
            </div>
          </div>

          {/* Bottom Content Area */}
          <div className="p-3 sm:p-3.5 bg-gradient-to-b from-[#0a0e17]/80 to-[#05070b]/95 backdrop-blur-md border-t border-white/5">
            <h3 className="font-bold text-silver-light text-xs sm:text-sm md:text-base leading-snug line-clamp-2 group-hover:text-brand transition-colors duration-300">
              {title}
            </h3>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-silver-dark font-medium">
              <span>{anime.releaseYear || anime.release_year || 'Latest'}</span>
              <span className="text-[#00e5ff]/90 font-semibold text-[10px] tracking-wider uppercase">
                {anime.type || 'TV Series'}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
