import React, { useState, useEffect, useRef } from 'react';
import { 
  resolveImageUrl, 
  isValidImageUrl, 
  getAlternativeImageCandidates,
  markImageVerified,
  isImageVerified
} from '../lib/imageUtils';

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

// Crisp cyberpunk vector fallback anime artwork SVG when image loading fails after retries
export const DEFAULT_FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22600%22%20height%3D%22900%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20900%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23080c14%22%2F%3E%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%230e1726%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2305070b%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23bg)%22%2F%3E%3Ccircle%20cx%3D%22300%22%20cy%3D%22420%22%20r%3D%2270%22%20fill%3D%22%2300e5ff%22%20fill-opacity%3D%220.1%22%20stroke%3D%22%2300e5ff%22%20stroke-width%3D%222%22%20stroke-opacity%3D%220.4%22%2F%3E%3Cpolygon%20points%3D%22285%2C385%20335%2C420%20285%2C455%22%20fill%3D%22%2300e5ff%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%22530%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2220%22%20font-weight%3D%22bold%22%20fill%3D%22%23ffffff%22%20text-anchor%3D%22middle%22%3EZK%20VOICE%20HUB%3C%2Ftext%3E%3Ctext%20x%3D%22300%22%20y%3D%22560%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2212%22%20font-weight%3D%22600%22%20letter-spacing%3D%222%22%20fill%3D%22%2300e5ff%22%20text-anchor%3D%22middle%22%3EHINDI%20DUBBED%20ANIME%3C%2Ftext%3E%3C%2Fsvg%3E`;

const SmartImage = React.memo(function SmartImage({
  src,
  alt = 'Anime Artwork',
  className = '',
  style = {},
  loading = 'lazy',
  onLoad,
  onError,
}: SmartImageProps) {
  const initialResolved = resolveImageUrl(src);
  const isValid = isValidImageUrl(src);

  const [currentSrc, setCurrentSrc] = useState<string>(
    isValid && initialResolved ? initialResolved : DEFAULT_FALLBACK_IMAGE
  );
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(isImageVerified(src));
  const retryTimeoutRef = useRef<any>(null);

  // Sync state if src changes
  useEffect(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    const nextUrl = resolveImageUrl(src);
    if (!isValidImageUrl(src) || !nextUrl) {
      setCurrentSrc(DEFAULT_FALLBACK_IMAGE);
      setRetryCount(0);
      setIsLoaded(true);
      return;
    }

    setCurrentSrc(nextUrl);
    setRetryCount(0);
    setIsLoaded(isImageVerified(nextUrl));

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [src]);

  // Handle browser load error with automatic retries before falling back
  const handleImageError = () => {
    if (currentSrc === DEFAULT_FALLBACK_IMAGE) return;

    // Retry up to 2 times automatically before switching to fallback image
    if (retryCount < 2) {
      const nextAttempt = retryCount + 1;
      setRetryCount(nextAttempt);
      const baseOriginal = resolveImageUrl(src) || currentSrc;
      const retryUrl = getAlternativeImageCandidates(baseOriginal, nextAttempt);

      // Brief delay before retrying with backoff
      retryTimeoutRef.current = setTimeout(() => {
        setCurrentSrc(retryUrl);
      }, 250 * nextAttempt);
      return;
    }

    // Show fallback image ONLY after all automatic retries fail
    setCurrentSrc(DEFAULT_FALLBACK_IMAGE);
    setIsLoaded(true);
    if (onError) onError();
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
    if (src) {
      markImageVerified(src);
    }
    if (currentSrc && currentSrc !== DEFAULT_FALLBACK_IMAGE) {
      markImageVerified(currentSrc);
    }
    if (onLoad) onLoad();
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={handleImageError}
      onLoad={handleImageLoad}
      className={`${className} ${!isLoaded && currentSrc !== DEFAULT_FALLBACK_IMAGE ? 'opacity-90' : 'opacity-100'} transition-opacity duration-300`}
      style={{
        objectFit: 'cover',
        objectPosition: 'center',
        ...style,
      }}
    />
  );
});

export default SmartImage;
