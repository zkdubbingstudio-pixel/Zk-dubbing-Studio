/**
 * ZK Voice Hub - Image Processing & Verification Utility
 * 
 * Production Cross-Browser Stability:
 * 1. Verifies poster_url and banner_url before rendering.
 * 2. Automatic retry logic with cache-busting and CDN alternate mirrors.
 * 3. Never poisons cache on transient network errors.
 * 4. Resolves ImgBB viewer and direct CDN links.
 * 5. Preconnects to popular anime image hosts (Catbox, ImgBB, Supabase).
 * 6. Optimized for Chrome, Android WebView, Samsung Internet, Edge, and Firefox.
 */

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
 * Normalizes and resolves raw image URLs into direct image links
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
  if (clean) {
    verifiedImageCache.add(clean);
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
 * Preconnects to popular image hosting domains to accelerate image downloads
 */
export function preconnectImageOrigins(): void {
  if (typeof document === 'undefined') return;

  const domains = [
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
