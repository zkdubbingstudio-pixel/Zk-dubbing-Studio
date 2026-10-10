import { supabaseUrl, supabase } from './supabase';

/**
 * Validates and converts any image reference (Supabase storage path, absolute URL, base64)
 * into a fully accessible public URL.
 * Strictly satisfies Requirements 4 & 5:
 * 4. Image URLs loaded from the same Supabase project used by the website.
 * 5. If the image URL is a Supabase Storage path, generate the correct public URL.
 */
export function resolveImageUrl(
  rawUrl?: string | null,
  bucketFallback: 'posters' | 'banners' | 'thumbnails' = 'posters'
): string {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[object Object]') {
    return '';
  }

  // 1. Base64 Data URLs
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // 2. Full HTTP/HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it is a Supabase storage URL from another project or has obsolete host:
    // Ensure it uses the active Supabase project URL (Requirement 4)
    if (trimmed.includes('.supabase.co/storage/v1/object/')) {
      const storageSubpath = trimmed.split('/storage/v1/object/')[1];
      if (storageSubpath) {
        const publicSubpath = storageSubpath.startsWith('public/')
          ? storageSubpath
          : `public/${storageSubpath}`;
        return `${supabaseUrl}/storage/v1/object/${publicSubpath}`;
      }
    }
    return trimmed;
  }

  // 3. Supabase Storage relative paths (Requirement 5)
  // E.g.: "/storage/v1/object/public/posters/abc.webp" or "storage/v1/object/public/posters/abc.webp"
  const cleanPath = trimmed.replace(/^\/+/, '');

  if (cleanPath.startsWith('storage/v1/object/')) {
    const sub = cleanPath.replace(/^storage\/v1\/object\//, '');
    const publicSub = sub.startsWith('public/') ? sub : `public/${sub}`;
    return `${supabaseUrl}/storage/v1/object/${publicSub}`;
  }

  // E.g.: "posters/file.jpg", "banners/file.jpg", "thumbnails/file.jpg"
  if (
    cleanPath.startsWith('posters/') ||
    cleanPath.startsWith('banners/') ||
    cleanPath.startsWith('thumbnails/') ||
    cleanPath.startsWith('media/') ||
    cleanPath.startsWith('anime/')
  ) {
    const parts = cleanPath.split('/');
    const bucket = parts[0];
    const filePath = parts.slice(1).join('/');

    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      if (data?.publicUrl) return data.publicUrl;
    } catch {
      // Fallback direct url construction
    }
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
  }

  // Any relative filename without bucket prefix (e.g. "image_123.jpg")
  try {
    const { data } = supabase.storage.from(bucketFallback).getPublicUrl(cleanPath);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}

  return `${supabaseUrl}/storage/v1/object/public/${bucketFallback}/${cleanPath}`;
}
