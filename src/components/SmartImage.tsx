import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(resolved));
  const [hasError, setHasError] = useState<boolean>(!resolved);
  const [retryCount, setRetryCount] = useState<number>(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // When input src prop changes, reset state
  useEffect(() => {
    const nextUrl = resolveImageUrl(src, type === 'banner' ? 'banners' : 'posters');
    setCurrentSrc(nextUrl);
    setRetryCount(0);
    if (nextUrl) {
      setIsLoading(true);
      setHasError(false);
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  }, [src, type]);

  const handleLoadSuccess = () => {
    if (!isMounted.current) return;
    setIsLoading(false);
    setHasError(false);
    if (onLoad) onLoad();
  };

  const handleLoadFailure = () => {
    if (!isMounted.current) return;

    // Requirement 6: if image fails, retry once
    if (retryCount === 0 && currentSrc) {
      setRetryCount(1);
      setIsLoading(true);
      // Retry once by re-assigning URL (with cache-bust param if not base64)
      const separator = currentSrc.includes('?') ? '&' : '?';
      const retryUrl = currentSrc.startsWith('data:')
        ? currentSrc
        : `${currentSrc}${separator}retry=${Date.now()}`;

      // Brief delay before retry attempt
      setTimeout(() => {
        if (isMounted.current) {
          setCurrentSrc(retryUrl);
        }
      }, 500);
      return;
    }

    // Only then show placeholder (Requirement 6)
    setIsLoading(false);
    setHasError(true);
    if (onError) onError();
  };

  // Requirement 9:
  // poster: object-fit: cover;
  // banner: object-fit: cover;
  // background-position: center center;
  const mergedStyle: React.CSSProperties = {
    objectFit: 'cover',
    objectPosition: 'center center',
    ...style,
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* 1. Loading Spinner Overlay (Requirement 6) */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#070b12]/80 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-1.5 text-[#00e5ff]">
            <Loader2 className="w-5 h-5 animate-spin drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]" />
            <span className="text-[10px] font-mono tracking-wider text-silver-dark uppercase">
              Loading...
            </span>
          </div>
        </div>
      )}

      {/* 2. Image Element (Requirement 3: Never use placeholder or empty image when valid URL exists) */}
      {currentSrc && !hasError && (
        <img
          src={currentSrc}
          alt={alt}
          loading={loading}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onLoad={handleLoadSuccess}
          onError={handleLoadFailure}
          className={`w-full h-full transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          style={mergedStyle}
        />
      )}

      {/* 3. Placeholder (Only shown when no valid URL exists or after retry has failed - Requirement 6) */}
      {hasError && (
        <div
          className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-tr from-[#05070b] via-[#0a0e17] to-[#121c2d]"
          style={{ backgroundPosition: 'center center' }}
        >
          <div className="w-8 h-8 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/30 flex items-center justify-center mb-1.5 shadow-[0_0_12px_rgba(0,229,255,0.2)]">
            <ImageIcon className="w-4 h-4 text-[#00e5ff]" />
          </div>
          {titleFallback && (
            <span className="text-[11px] font-bold text-silver-light line-clamp-2 max-w-[90%]">
              {titleFallback}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
