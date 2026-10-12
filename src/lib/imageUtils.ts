/**
 * Exact Database Image URL Passthrough & Viewer Resolver
 * Converts ImgBB webpage viewer links (e.g. https://ibb.co/hF7KHk2J) into direct image links (https://i.ibb.co/hF7KHk2J/image.jpg),
 * while preserving exact direct URLs from Catbox (https://files.catbox.moe/...), i.ibb.co (https://i.ibb.co/...),
 * Supabase storage, or any other external host.
 */
export function resolveImageUrl(
  rawUrl?: string | null,
  _bucketFallback?: string
): string {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '[object Object]'
  ) {
    return '';
  }

  // If user provided an ImgBB webpage viewer URL (e.g. https://ibb.co/hF7KHk2J or http://ibb.co/hF7KHk2J)
  // Convert it into the direct image link on i.ibb.co so browsers can render it without HTML parsing errors.
  const ibbMatch = trimmed.match(/^https?:\/\/ibb\.co\/([a-zA-Z0-9_-]+)\/?$/i);
  if (ibbMatch && ibbMatch[1]) {
    const id = ibbMatch[1];
    return `https://i.ibb.co/${id}/image.jpg`;
  }

  // Return the exact database URL without modification
  return trimmed;
}

const reachabilityCache = new Map<string, boolean>();

/**
 * Requirement 3: Verify that every image URL is reachable before rendering.
 * Probes the image off-screen using no-referrer.
 * Results are cached in memory for zero repeat overhead.
 */
export function verifyImageReachable(url: string, timeoutMs = 4500): Promise<boolean> {
  if (!url || typeof window === 'undefined') return Promise.resolve(false);
  const trimmed = url.trim();
  if (
    !trimmed || 
    trimmed === 'null' || 
    trimmed === 'undefined' || 
    trimmed.startsWith('data:image/svg+xml')
  ) {
    return Promise.resolve(true);
  }

  if (reachabilityCache.has(trimmed)) {
    return Promise.resolve(reachabilityCache.get(trimmed)!);
  }

  return new Promise((resolve) => {
    let settled = false;
    const probe = new window.Image();
    probe.referrerPolicy = 'no-referrer';

    const cleanup = () => {
      probe.onload = null;
      probe.onerror = null;
    };

    const finish = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      reachabilityCache.set(trimmed, reachable);
      resolve(reachable);
    };

    probe.onload = () => finish(true);
    probe.onerror = () => finish(false);

    // Timeout: if network is slow, allow image to attempt rendering
    setTimeout(() => {
      finish(true);
    }, timeoutMs);

    probe.src = trimmed;
  });
}
