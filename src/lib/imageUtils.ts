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
