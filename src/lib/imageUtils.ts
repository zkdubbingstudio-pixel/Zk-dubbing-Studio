/**
 * Exact Database Image URL Passthrough
 * Requirements 4 & 7:
 * 4. Remove any image proxy or URL sanitizer that modifies image URLs.
 * 7. Ensure img src uses the exact database URL without modification.
 * 3. Accept external image hosts such as https://files.catbox.moe/ and https://i.ibb.co/
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
  // Return the exact database URL without modification
  return trimmed;
}
