import React, { useState, useEffect } from 'react';
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

// Proper fallback anime artwork SVG when image loading actually fails (Requirement 2)
export const DEFAULT_FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22600%22%20height%3D%22900%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20900%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23080c14%22%2F%3E%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%230e1726%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2305070b%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23bg)%22%2F%3E%3Ccircle%20cx%3D%22300%22%20cy%3D%22420%22%20r%3D%2270%22%20fill%3D%22%2300e5ff%22%20fill-opacity%3D%220.1%22%20stroke%3D%22%2300e5ff%22%20stroke-width%3D%222%22%20stroke-opacity%3D%220.4%22%2F%3E%3Cpolygon%20points%3D%22285%2C385%20335%2C420%20285%2C455%22%20fill%3D%22%2300e5ff%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%22530%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2220%22%20font-weight%3D%22bold%22%20fill%3D%22%23ffffff%22%20text-anchor%3D%22middle%22%3EZK%20VOICE%20HUB%3C%2Ftext%3E%3Ctext%20x%3D%22300%22%20y%3D%22560%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2212%22%20font-weight%3D%22600%22%20letter-spacing%3D%222%22%20fill%3D%22%2300e5ff%22%20text-anchor%3D%22middle%22%3EHINDI%20DUBBED%20ANIME%3C%2Ftext%3E%3C%2Fsvg%3E`;

/**
 * SmartImage Component
 * Requirements:
 * 1. Uses exact image URL stored in Supabase without modification.
 * 2. Replaces broken image with proper fallback image ONLY if loading actually fails.
 * 3. Does not proxy, rewrite, sanitize, trim or modify Catbox, ibb.co or external URLs.
 * 4. Optimizes image loading using lazy loading and browser caching.
 * 6. Logs the actual URL to the console on failure.
 * 7. Keeps object-fit: cover and object-position: center.
 */
const SmartImage = React.memo(function SmartImage({
  src,
  alt = 'Anime Artwork',
  className = '',
  style = {},
  loading = 'lazy',
  onLoad,
  onError,
}: SmartImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(resolveImageUrl(src) || '');

  useEffect(() => {
    setCurrentSrc(resolveImageUrl(src) || '');
  }, [src]);

  const effectiveSrc = currentSrc || DEFAULT_FALLBACK_IMAGE;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        // If currentSrc was an unresolved ibb.co webpage link, attempt direct i.ibb.co resolution before fallback
        const ibbMatch = currentSrc.match(/^https?:\/\/ibb\.co\/([a-zA-Z0-9_-]+)\/?$/i);
        if (ibbMatch && ibbMatch[1]) {
          const directUrl = `https://i.ibb.co/${ibbMatch[1]}/image.jpg`;
          setCurrentSrc(directUrl);
          return;
        }

        // Replace broken image with fallback only if loading actually fails
        if (currentSrc && currentSrc !== DEFAULT_FALLBACK_IMAGE) {
          console.warn('[Image Load Fallback] Replaced with fallback artwork:', currentSrc);
          setCurrentSrc(DEFAULT_FALLBACK_IMAGE);
        }
        if (onError) onError();
      }}
      onLoad={() => {
        if (onLoad) onLoad();
      }}
      className={`w-full h-full ${className}`}
      style={{
        objectFit: 'cover',
        objectPosition: 'center center',
        ...style,
      }}
    />
  );
});

export default SmartImage;
