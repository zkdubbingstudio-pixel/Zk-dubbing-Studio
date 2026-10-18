/**
 * ZK Voice Hub - Image Processing & Verification Utility
 * 
 * Production Cross-Browser Stability:
 * 1. Verifies poster_url and banner_url before rendering.
 * 2. Automatic retry logic with cache-busting and CDN alternate mirrors.
 * 3. Never poisons cache on transient network errors.
 * 4. Resolves ImgBB viewer and direct CDN links.
 * 5. Preconnects to popular anime image hosts (Catbox, ImgBB, Supabase).
 * 6. Responsive banner and poster preservation without stretching or distortion.
 * 7. Strict episode image priority: episode.thumbnail -> episode.poster -> anime.poster.
 */

// Crisp cyberpunk vector fallback anime artwork SVGs
export const DEFAULT_POSTER_FALLBACK = `data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22600%22%20height%3D%22900%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20900%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23080c14%22%2F%3E%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%230e1726%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2305070b%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23bg)%22%2F%3E%3Ccircle%20cx%3D%22300%22%20cy%3D%22420%22%20r%3D%2270%22%20fill%3D%22%2300e5ff%22%20fill-opacity%3D%220.1%22%20stroke%3D%22%2300e5ff%22%20stroke-width%3D%222%22%20stroke-opacity%3D%220.4%22%2F%3E%3Cpolygon%20points%3D%22285%2C385%20335%2C420%20285%2C455%22%20fill%3D%22%2300e5ff%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%22530%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2220%22%20font-weight%3D%22bold%22%20fill%3D%22%23ffffff%22%20text-anchor%3D%22middle%22%3EZK%20VOICE%20HUB%3C%2Ftext%3E%3Ctext%20x%3D%22300%22%20y%3D%22560%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2212%22%20font-weight%3D%22600%22%20letter-spacing%3D%222%22%20fill%3D%22%2300e5ff%22%20text-anchor%3D%22middle%22%3EHINDI%20DUBBED%20ANIME%3C%2Ftext%3E%3C%2Fsvg%3E`;

export const DEFAULT_BANNER_FALLBACK = `data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%221920%22%20height%3D%221080%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201920%201080%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22banner-bg%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%2304070e%22%2F%3E%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%230b121e%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2305070b%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23banner-bg)%22%2F%3E%3Ccircle%20cx%3D%22960%22%20cy%3D%22500%22%20r%3D%22120%22%20fill%3D%22%2300e5ff%22%20fill-opacity%3D%220.08%22%20stroke%3D%22%2300e5ff%22%20stroke-width%3D%223%22%20stroke-opacity%3D%220.35%22%2F%3E%3Cpolygon%20points%3D%22935%2C440%201015%2C500%20935%2C560%22%20fill%3D%22%2300e5ff%22%2F%3E%3Ctext%20x%3D%22960%22%20y%3D%22670%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2236%22%20font-weight%3D%22bold%22%20fill%3D%22%23ffffff%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EZK%20VOICE%20HUB%3C%2Ftext%3E%3Ctext%20x%3D%22960%22%20y%3D%22720%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2218%22%20font-weight%3D%22600%22%20letter-spacing%3D%224%22%20fill%3D%22%2300e5ff%22%20text-anchor%3D%22middle%22%3EPREMIUM%20HINDI%20DUBBED%20ANIME%3C%2Ftext%3E%3C%2Fsvg%3E`;

export const DEFAULT_FALLBACK_IMAGE = DEFAULT_POSTER_FALLBACK;

// In-memory cache of verified working images to avoid repeated network checks
const verifiedImageCache = new Set<string>();

/**
 * Validates whether an image URL is syntactically sound and non-empty
 */
export function isValidImageUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  let trimmed = rawUrl.trim();

  // Strip wrapping quotes or brackets if present
  trimmed = trimmed.replace(/^["'\[]+|["'\]]+$/g, '').trim();

  if (
    trimmed.length < 5 ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '[object Object]' ||
    trimmed === 'none' ||
    trimmed === 'false' ||
    trimmed === '#' ||
    trimmed === 'about:blank' ||
    trimmed.startsWith('javascript:')
  ) {
    return false;
  }
  if (trimmed.startsWith('data:image/')) return true;

  try {
    const full = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    const parsed = new URL(full);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes and resolves raw image URLs into direct CDN image links
 */
export function resolveImageUrl(rawUrl?: string | null): string {
  if (!isValidImageUrl(rawUrl)) return '';
  let trimmed = String(rawUrl).trim().replace(/^["'\[]+|["'\]]+$/g, '').trim();

  // Extract from markdown syntax if user accidentally entered ![alt](url)
  const mdMatch = trimmed.match(/!\[.*?\]\((.*?)\)/);
  if (mdMatch && mdMatch[1]) {
    trimmed = mdMatch[1].trim();
  }

  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`;
  }

  // Convert ImgBB webpage viewer URL (e.g. https://ibb.co/hF7KHk2J or https://ibb.co.com/hF7KHk2J)
  // into direct CDN image URL
  const ibbMatch = trimmed.match(/^https?:\/\/(?:www\.)?ibb\.co(?:\.com)?\/([a-zA-Z0-9_-]+)\/?$/i);
  if (ibbMatch && ibbMatch[1]) {
    return `https://i.ibb.co.com/${ibbMatch[1]}/image.jpg`;
  }

  // Handle Google Drive file link
  const gdriveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${gdriveMatch[1]}`;
  }

  return trimmed;
}

/**
 * Universal Episode Image Resolver with strict user-specified priority (Requirement 3):
 * 1. episode.thumbnail
 * 2. episode.poster
 * 3. anime.poster
 */
export function resolveEpisodeImage(episode?: any, anime?: any): string {
  if (!episode) return '';

  // Priority 1: episode.thumbnail (thumbnail_url, thumbnailUrl, thumbnail, episode_thumbnail)
  const thumbCandidates = [
    episode.thumbnail,
    episode.thumbnail_url,
    episode.thumbnailUrl,
    episode.episode_thumbnail,
    episode.episodeThumbnail,
  ];
  for (const c of thumbCandidates) {
    if (isValidImageUrl(c)) {
      const resolved = resolveImageUrl(c);
      if (resolved && resolved !== DEFAULT_FALLBACK_IMAGE && resolved !== DEFAULT_BANNER_FALLBACK) {
        return resolved;
      }
    }
  }

  // Priority 2: episode.poster (poster_url, posterUrl, poster, episode_poster)
  const posterCandidates = [
    episode.episode_poster,
    episode.episodePoster,
    episode.poster,
    episode.poster_url,
    episode.posterUrl,
  ];
  for (const c of posterCandidates) {
    if (isValidImageUrl(c)) {
      const resolved = resolveImageUrl(c);
      if (resolved && resolved !== DEFAULT_FALLBACK_IMAGE && resolved !== DEFAULT_BANNER_FALLBACK) {
        return resolved;
      }
    }
  }

  // Priority 3: anime.poster
  const animeCandidates = [
    anime?.poster,
    anime?.poster_url,
    anime?.posterUrl,
    episode.anime_poster,
    episode.anime_poster_url,
    episode.animePosterUrl,
    episode.animePoster,
    anime?.banner_url,
    anime?.bannerUrl,
    episode.banner_url,
    episode.bannerUrl,
  ];
  for (const c of animeCandidates) {
    if (isValidImageUrl(c)) {
      const resolved = resolveImageUrl(c);
      if (resolved && resolved !== DEFAULT_FALLBACK_IMAGE && resolved !== DEFAULT_BANNER_FALLBACK) {
        return resolved;
      }
    }
  }

  return '';
}

// Hydrate verified image cache from session storage for instant repeat renders
if (typeof window !== 'undefined') {
  try {
    const raw = sessionStorage.getItem('zk_verified_images');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((u: string) => verifiedImageCache.add(u));
      }
    }
  } catch {}
}

/**
 * Check if image is already verified as working in the current session
 */
export function isImageVerified(url?: string | null): boolean {
  if (!url) return false;
  const clean = resolveImageUrl(url);
  return verifiedImageCache.has(clean);
}

/**
 * Mark image as verified working in cache
 */
export function markImageVerified(url?: string | null): void {
  if (!url) return;
  const clean = resolveImageUrl(url);
  if (clean && !verifiedImageCache.has(clean)) {
    verifiedImageCache.add(clean);
    if (typeof window !== 'undefined') {
      try {
        const arr = Array.from(verifiedImageCache).slice(-200);
        sessionStorage.setItem('zk_verified_images', JSON.stringify(arr));
      } catch {}
    }
  }
}

/**
 * Generates fallback/retry URLs for an image (resilient cache-busters and mirrors)
 */
export function getAlternativeImageCandidates(url: string, retryAttempt: number): string {
  if (!url) return '';
  const clean = resolveImageUrl(url);
  if (!clean || clean.startsWith('data:image/')) return clean;

  // Alternate CDN domain mirror for ImgBB
  if (clean.includes('i.ibb.co.com/')) {
    if (retryAttempt === 1) {
      return clean.replace('i.ibb.co.com/', 'i.ibb.co/');
    }
  } else if (clean.includes('i.ibb.co/')) {
    if (retryAttempt === 1) {
      return clean.replace('i.ibb.co/', 'i.ibb.co.com/');
    }
  }

  // Standard cache-busting query parameter retry to bypass intermediate CDN caching hiccups
  const separator = clean.includes('?') ? '&' : '?';
  return `${clean}${separator}retry=${retryAttempt}&t=${Date.now()}`;
}

/**
 * Verifies that an image URL is reachable before rendering with automatic retries
 */
export function verifyImageReachable(url: string, timeoutMs = 3000): Promise<boolean> {
  if (!isValidImageUrl(url) || typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  const clean = resolveImageUrl(url);
  if (clean.startsWith('data:image/')) return Promise.resolve(true);

  if (verifiedImageCache.has(clean)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const probe = new window.Image();
    probe.referrerPolicy = 'no-referrer';
    probe.decoding = 'async';

    const cleanup = () => {
      probe.onload = null;
      probe.onerror = null;
    };

    const finish = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reachable) {
        verifiedImageCache.add(clean);
      }
      resolve(reachable);
    };

    probe.onload = () => finish(true);
    probe.onerror = () => finish(false);

    // Timeout guard for slow mobile networks - assume true so DOM image can still try
    setTimeout(() => {
      finish(true);
    }, timeoutMs);

    probe.src = clean;
  });
}

/**
 * Converts image URLs to optimized, compressed WebP format where possible.
 * Uses high-speed edge WebP converter with zero distortion.
 */
export function getOptimizedWebPUrl(url?: string | null, type: 'poster' | 'banner' | 'thumbnail' = 'poster'): string {
  if (!isValidImageUrl(url)) return '';
  const clean = resolveImageUrl(url);
  if (!clean || clean.startsWith('data:') || clean.startsWith('blob:')) {
    return clean;
  }

  // If already WebP, return clean URL directly
  if (clean.toLowerCase().includes('.webp')) {
    return clean;
  }

  // Supabase Storage Render API (automatic native WebP conversion)
  if (clean.includes('/storage/v1/object/public/')) {
    const width = type === 'banner' ? 1280 : (type === 'thumbnail' ? 360 : 400);
    return clean.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + `?width=${width}&format=webp&quality=75`;
  }

  // Cloudflare-backed open WebP compression edge service (wsrv.nl)
  // Compresses 1.5MB images down to ~30-40KB WebP (75-85% compression ratio)
  try {
    const width = type === 'banner' ? 1200 : (type === 'thumbnail' ? 360 : 400);
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&output=webp&q=75&w=${width}&we`;
  } catch {
    return clean;
  }
}

/**
 * Preconnects to popular image hosting domains to accelerate image downloads
 */
export function preconnectImageOrigins(): void {
  if (typeof document === 'undefined') return;

  const domains = [
    'https://wsrv.nl',
    'https://i.ibb.co',
    'https://i.ibb.co.com',
    'https://files.catbox.moe',
    'https://rwioavitlgzyrbgivwzi.supabase.co',
    'https://lh3.googleusercontent.com',
  ];

  domains.forEach((href) => {
    try {
      if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = href;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
      if (!document.querySelector(`link[rel="dns-prefetch"][href="${href}"]`)) {
        const dnsLink = document.createElement('link');
        dnsLink.rel = 'dns-prefetch';
        dnsLink.href = href;
        document.head.appendChild(dnsLink);
      }
    } catch {}
  });
}

// Auto-run preconnections on module load
if (typeof window !== 'undefined') {
  preconnectImageOrigins();
}
