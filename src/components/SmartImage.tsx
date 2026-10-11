import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUtils';

export interface SmartImageProps {
  src?: string | null;
  alt?: string;
  type?: 'poster' | 'banner' | 'thumbnail';
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  titleFallback?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * SmartImage component:
 * - Uses native <img> element (Vite SPA - no Next.js Image optimization overhead)
 * - Directly loads external images (e.g., https://files.catbox.moe/*) without proxying
 * - Removes crossOrigin attribute to eliminate CORS errors on Vercel
 * - Employs referrerPolicy="no-referrer" so external image CDNs never block hotlinking
 * - Strictly enforces object-fit: cover and object-position: center
 * - Does NOT display broken image placeholder boxes over valid URLs
 */
export default function SmartImage({
  src,
  alt = 'Anime Artwork',
  type = 'poster',
  className = '',
  style = {},
  loading = 'lazy',
  titleFallback,
  onLoad,
  onError,
}: SmartImageProps) {
  const resolved = resolveImageUrl(src, type === 'banner' ? 'banners' : 'posters');

  const [currentSrc, setCurrentSrc] = useState<string>(resolved);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [retried, setRetried] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync whenever input src changes
  useEffect(() => {
    const next = resolveImageUrl(src, type === 'banner' ? 'banners' : 'posters');
    setCurrentSrc(next);
    setRetried(false);
  }, [src, type]);

  // Check if image is already cached/complete in DOM
  useEffect(() => {
    if (imgRef.current?.complete) {
      setIsLoading(false);
    }
  }, [currentSrc]);

  const handleLoadSuccess = () => {
    setIsLoading(false);
    if (onLoad) onLoad();
  };

  const handleLoadFailure = () => {
    // If first attempt failed, retry once
    if (!retried && currentSrc) {
      setRetried(true);
      // Clean retry
      const retryUrl = currentSrc.startsWith('data:')
        ? currentSrc
        : currentSrc.includes('?')
        ? currentSrc
        : `${currentSrc}?t=${Date.now()}`;
      setCurrentSrc(retryUrl);
      return;
    }
    setIsLoading(false);
    if (onError) onError();
  };

  // Requirement 6: Keep object-fit: cover and object-position: center
  const mergedStyle: React.CSSProperties = {
    objectFit: 'cover',
    objectPosition: 'center center',
    ...style,
  };

  // Only if no URL is provided at all, render clean dark backdrop
  if (!currentSrc) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-tr from-[#05070b] via-[#0a0e17] to-[#121c2d] flex items-center justify-center ${className}`}
        style={{ backgroundPosition: 'center center' }}
      >
        {titleFallback && (
          <span className="text-[11px] font-bold text-silver-light/60 line-clamp-2 max-w-[90%] text-center px-2">
            {titleFallback}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Subtle loading spinner overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#070b12]/40 pointer-events-none">
          <Loader2 className="w-5 h-5 animate-spin text-[#00e5ff] drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]" />
        </div>
      )}

      {/* Normal <img> element for external images (Requirements 3, 4, 5, 6, 7) */}
      {/* NO crossOrigin attribute so Catbox and external CDNs load without CORS blocks on Vercel */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={loading}
        referrerPolicy="no-referrer"
        onLoad={handleLoadSuccess}
        onError={handleLoadFailure}
        className="w-full h-full"
        style={mergedStyle}
      />
    </div>
  );
}
