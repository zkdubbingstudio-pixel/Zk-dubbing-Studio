import React, { useState, useEffect, useRef } from 'react';
import { 
  resolveImageUrl, 
  isValidImageUrl, 
  getAlternativeImageCandidates,
  getOptimizedWebPUrl,
  markImageVerified,
  isImageVerified,
  DEFAULT_POSTER_FALLBACK,
  DEFAULT_BANNER_FALLBACK
} from '../lib/imageUtils';
import { observeImageIntersection, preloadLCPImage } from '../lib/imageObserver';

export interface SmartImageProps {
  src?: string | null;
  alt?: string;
  type?: 'poster' | 'banner' | 'thumbnail';
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  priority?: boolean; // Critical LCP candidate (loads immediately, bypasses observer, sets fetchPriority="high")
  titleFallback?: string;
  fallbackUrl?: string; // Optional secondary fallback URL before showing vector SVG
  placeholder?: 'shimmer' | 'blur' | 'none';
  onLoad?: () => void;
  onError?: () => void;
}

// 1x1 transparent SVG data URI to avoid broken image icons while awaiting viewport intersection
const TRANSPARENT_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%221%22%20height%3D%221%22%20viewBox%3D%220%200%201%201%22%3E%3C%2Fsvg%3E';

const SmartImage = function SmartImage({
  src,
  alt = 'Anime Artwork',
  type = 'poster',
  className = '',
  style = {},
  loading = 'lazy',
  priority = false,
  fallbackUrl,
  placeholder = 'shimmer',
  onLoad,
  onError,
}: SmartImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultFallback = type === 'poster' ? DEFAULT_POSTER_FALLBACK : DEFAULT_BANNER_FALLBACK;
  const initialResolved = resolveImageUrl(src);
  const isValid = isValidImageUrl(src);
  const alreadyVerified = isImageVerified(src);

  // High priority if explicitly requested or loading="eager"
  const isHighPriority = priority || loading === 'eager';

  // Intersection Observer viewport gating:
  // - High priority or eager images immediately load (optimizing LCP)
  // - Images already verified in current session immediately render
  // - Off-screen images defer until 250px from visible viewport
  const [isInView, setIsInView] = useState<boolean>(() => {
    if (isHighPriority) return true;
    if (alreadyVerified) return true;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return true;
    return false;
  });

  // Calculate compressed WebP URL where possible with raw fallback
  const getInitialTargetSrc = () => {
    if (!isValid || !initialResolved) {
      return resolveImageUrl(fallbackUrl) || defaultFallback;
    }
    // Attempt WebP conversion for 75%+ bandwidth reduction
    const webp = getOptimizedWebPUrl(initialResolved, type);
    return webp || initialResolved;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(getInitialTargetSrc);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [triedOriginalUrl, setTriedOriginalUrl] = useState<boolean>(false);
  const [triedFallbackUrl, setTriedFallbackUrl] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(alreadyVerified);
  const [hasFailed, setHasFailed] = useState<boolean>(!isValid);
  const retryTimeoutRef = useRef<any>(null);

  // Preload critical LCP candidate as soon as component mounts
  useEffect(() => {
    if (isHighPriority && initialResolved) {
      const targetPreload = getOptimizedWebPUrl(initialResolved, type) || initialResolved;
      preloadLCPImage(targetPreload);
    }
  }, [isHighPriority, initialResolved, type]);

  // Progressive Viewport Intersection Observer:
  // Attaches singleton observer to container; defers off-screen image fetching
  useEffect(() => {
    if (isInView) return;
    const el = containerRef.current;
    if (!el) return;

    const unobserve = observeImageIntersection(el, () => {
      setIsInView(true);
    });

    return () => {
      unobserve();
    };
  }, [isInView]);

  // Sync state if src or fallbackUrl changes
  useEffect(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    const nextRawUrl = resolveImageUrl(src);
    if (!isValidImageUrl(src) || !nextRawUrl) {
      const secondary = resolveImageUrl(fallbackUrl);
      if (secondary && isValidImageUrl(secondary)) {
        setCurrentSrc(getOptimizedWebPUrl(secondary, type) || secondary);
        setRetryCount(0);
        setTriedOriginalUrl(false);
        setTriedFallbackUrl(true);
        setIsLoaded(isImageVerified(secondary));
        setHasFailed(false);
      } else {
        setCurrentSrc(defaultFallback);
        setRetryCount(0);
        setIsLoaded(true);
        setHasFailed(true);
      }
      return;
    }

    const nextTarget = getOptimizedWebPUrl(nextRawUrl, type) || nextRawUrl;
    setCurrentSrc(nextTarget);
    setRetryCount(0);
    setTriedOriginalUrl(false);
    setTriedFallbackUrl(false);
    setHasFailed(false);
    setIsLoaded(isImageVerified(nextTarget) || isImageVerified(nextRawUrl));

    if (isHighPriority) {
      preloadLCPImage(nextTarget);
    }

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [src, fallbackUrl, defaultFallback, isHighPriority, type]);

  // Handle browser load error with automatic fallback: WebP -> Original -> Mirrors -> Secondary -> SVG
  const handleImageError = () => {
    const rawOriginal = resolveImageUrl(src);

    // 1. If WebP proxy failed, immediately fall back to raw unproxied original URL
    if (!triedOriginalUrl && rawOriginal && currentSrc !== rawOriginal) {
      setTriedOriginalUrl(true);
      setCurrentSrc(rawOriginal);
      return;
    }

    // 2. Retry primary URL up to 2 times automatically with mirrors or cache-busters
    if (retryCount < 2 && !triedFallbackUrl) {
      const nextAttempt = retryCount + 1;
      setRetryCount(nextAttempt);
      const baseOriginal = rawOriginal || currentSrc;
      const retryUrl = getAlternativeImageCandidates(baseOriginal, nextAttempt);

      retryTimeoutRef.current = setTimeout(() => {
        setCurrentSrc(retryUrl);
      }, 200 * nextAttempt);
      return;
    }

    // 3. Try explicit secondary fallback if provided (e.g. poster for banner or banner for poster)
    if (fallbackUrl && !triedFallbackUrl) {
      const secondary = resolveImageUrl(fallbackUrl);
      if (secondary && isValidImageUrl(secondary) && secondary !== currentSrc) {
        setTriedFallbackUrl(true);
        setRetryCount(0);
        setCurrentSrc(secondary);
        return;
      }
    }

    // 4. Show crisp vector fallback image ONLY after all automatic retries fail
    setCurrentSrc(defaultFallback);
    setIsLoaded(true);
    setHasFailed(true);
    if (onError) onError();
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
    setHasFailed(false);
    if (src) {
      markImageVerified(src);
    }
    if (currentSrc && currentSrc !== defaultFallback) {
      markImageVerified(currentSrc);
    }
    if (onLoad) onLoad();
  };

  // Determine actual image source to render:
  // If not in view yet, use transparent placeholder so 0 HTTP requests are triggered
  const effectiveSrc = isInView ? currentSrc : TRANSPARENT_PLACEHOLDER;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        isolation: 'isolate',
      }}
    >
      {/* High-tech Shimmering Skeleton Loader while awaiting intersection or loading (0 Cumulative Layout Shift) */}
      {placeholder !== 'none' && !isLoaded && !hasFailed && (
        <div 
          aria-hidden="true"
          className="absolute inset-0 bg-[#0a0f19] z-0 overflow-hidden pointer-events-none"
        >
          <div className="absolute inset-0 skeleton-shimmer opacity-80" />
        </div>
      )}

      {/* Actual Image Element with Progressive Fade-in */}
      <img
        src={effectiveSrc}
        alt={alt}
        loading={isHighPriority ? 'eager' : 'lazy'}
        decoding={isHighPriority ? 'sync' : 'async'}
        fetchPriority={isHighPriority ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
        onError={handleImageError}
        onLoad={handleImageLoad}
        className={`${className} relative z-10 w-full h-full transition-opacity duration-300 ${
          (!isLoaded || !isInView) && currentSrc !== defaultFallback 
            ? 'opacity-0' 
            : 'opacity-100'
        }`}
        style={{
          objectFit: 'cover',
          objectPosition: 'center center',
          ...style,
        }}
      />
    </div>
  );
};

export default React.memo(SmartImage, (prev, next) => {
  return (
    prev.src === next.src &&
    prev.fallbackUrl === next.fallbackUrl &&
    prev.alt === next.alt &&
    prev.type === next.type &&
    prev.priority === next.priority &&
    prev.loading === next.loading &&
    prev.className === next.className
  );
});
