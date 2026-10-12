import React, { useState, useEffect } from 'react';
import { resolveImageUrl, verifyImageReachable } from '../lib/imageUtils';

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
 * 1. Uses exact raw Supabase image URL directly without any proxy, sanitizer or rewrite.
 * 2. Verifies that every image URL is reachable before rendering (Requirement 3).
 * 3. Replaces broken image with proper fallback image ONLY if loading actually fails.
 * 4. Optimizes image loading using lazy loading and browser caching.
 * 5. Keeps object-fit: cover and object-position: center.
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
  const rawUrl = resolveImageUrl(src);
  const [effectiveSrc, setEffectiveSrc] = useState<string>(rawUrl || DEFAULT_FALLBACK_IMAGE);

  useEffect(() => {
    if (!rawUrl) {
      setEffectiveSrc(DEFAULT_FALLBACK_IMAGE);
      return;
    }

    let isMounted = true;

    // Requirement 3: Verify that every image URL is reachable before rendering
    verifyImageReachable(rawUrl).then((reachable) => {
      if (!isMounted) return;
      if (reachable) {
        setEffectiveSrc(rawUrl);
      } else {
        // If raw URL failed, test if an ibb.co viewer link can resolve to direct CDN image
        const ibbMatch = rawUrl.match(/^https?:\/\/ibb\.co\/([a-zA-Z0-9_-]+)\/?$/i);
        if (ibbMatch && ibbMatch[1]) {
          const directIbb = `https://i.ibb.co/${ibbMatch[1]}/image.jpg`;
          verifyImageReachable(directIbb).then((directReachable) => {
            if (!isMounted) return;
            if (directReachable) {
              setEffectiveSrc(directIbb);
            } else {
              setEffectiveSrc(DEFAULT_FALLBACK_IMAGE);
            }
          });
          return;
        }

        setEffectiveSrc(DEFAULT_FALLBACK_IMAGE);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [rawUrl]);

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        // If effectiveSrc somehow fails at browser paint time, gracefully swap to fallback
        if (effectiveSrc !== DEFAULT_FALLBACK_IMAGE) {
          // Check for ibb.co direct candidate before final fallback
          const ibbMatch = effectiveSrc.match(/^https?:\/\/ibb\.co\/([a-zA-Z0-9_-]+)\/?$/i);
          if (ibbMatch && ibbMatch[1]) {
            setEffectiveSrc(`https://i.ibb.co/${ibbMatch[1]}/image.jpg`);
            return;
          }
          setEffectiveSrc(DEFAULT_FALLBACK_IMAGE);
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
