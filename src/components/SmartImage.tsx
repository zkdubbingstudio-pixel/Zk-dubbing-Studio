import React from 'react';

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

/**
 * SmartImage Component
 * Requirements:
 * 1. Load poster_url and banner_url directly from Supabase.
 * 2. Do not replace valid URLs with placeholders.
 * 3. Accept external image hosts such as https://files.catbox.moe/ and https://i.ibb.co/
 * 4. Remove any image proxy or URL sanitizer that modifies image URLs.
 * 5. Do not require local assets for posters.
 * 6. If an image fails, log the actual URL to the console.
 * 7. Ensure img src uses the exact database URL without modification.
 * 8. Verify images work in both development and production (Vercel).
 */
export default function SmartImage({
  src,
  alt = 'Anime Artwork',
  className = '',
  style = {},
  loading = 'lazy',
  titleFallback,
  onLoad,
  onError,
}: SmartImageProps) {
  // Use the exact database URL without modification (Requirements 4 & 7)
  const imageUrl = (src || '').trim();

  // If no URL exists in the database, display clean neutral background without broken placeholder icon
  if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
    return (
      <div
        className={`w-full h-full bg-[#0a0e17] flex items-center justify-center ${className}`}
        style={{
          backgroundPosition: 'center center',
          ...style,
        }}
      >
        {titleFallback && (
          <span className="text-[11px] font-bold text-silver-light/60 line-clamp-2 max-w-[90%] text-center px-2">
            {titleFallback}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        // Requirement 6: If an image fails, log the actual URL to the console
        console.error('[Image Error] Failed to load exact database image URL:', imageUrl);
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
}
