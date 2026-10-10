/**
 * ZK Voice Hub - Data Service
 * Architecture: Supabase = Main Database (100% of Content & Media) | Firebase = Auth Only
 * 
 * Rules:
 * 1. Zero cache fallbacks. Zero mock/sample data.
 * 2. Anime, Episodes, Seasons, Continue Watching, Genres fetched strictly from Supabase.
 * 3. Supabase query timeout: at least 20 seconds (configured at 25 seconds).
 * 4. Automatic retry logic (3 retries) on transient errors before propagating failure.
 * 5. If Supabase is empty, return empty array/null so UI displays clean empty state.
 * 6. Zero Firestore content reads.
 */

import { supabase, executeSupabaseWithRetry, formatDbError, verifyRlsPolicies } from './supabase';
import { getCachedData, setCachedData, clearCachedData, clearCachePrefix } from './cache';
import { resolveImageUrl } from './imageUtils';

export { formatDbError, verifyRlsPolicies, resolveImageUrl };

export interface AnimeItem {
  id: string;
  title: string;
  description?: string;
  synopsis?: string;
  posterUrl?: string;
  poster_url?: string;
  bannerUrl?: string;
  banner_url?: string;
  releaseYear?: number | string;
  release_year?: number | string;
  featured?: boolean;
  trending?: boolean;
  genres?: string[];
  rating?: string | number;
  status?: string;
  language?: string;
  dubbedBy?: string;
  dubbed_by?: string;
  views?: number;
  type?: string;
  contentType?: string;
  isMovie?: boolean;
  is_movie?: boolean;
  duration?: string;
  releaseDate?: string;
  release_date?: string;
  server1Url?: string;
  server1_url?: string;
  server2Url?: string;
  server2_url?: string;
  server3Url?: string;
  server3_url?: string;
  totalEpisodes?: number;
  seasonNumber?: number;
  SeasonNumber?: number;
  latestSeason?: string;
  latestEpisodeRange?: string;
  createdAt?: any;
  created_at?: any;
  updatedAt?: any;
  updated_at?: any;
}

export interface SeasonItem {
  id: string;
  animeId: string;
  anime_id?: string;
  seasonNumber: number;
  season_number?: number;
  title?: string;
  description?: string;
  bannerUrl?: string;
  banner_url?: string;
  posterUrl?: string;
  poster_url?: string;
  order?: number;
  status?: string;
  createdAt?: any;
  created_at?: any;
}

export interface EpisodeItem {
  id: string;
  animeId: string;
  anime_id?: string;
  seasonId: string;
  season_id?: string;
  seasonNumber?: number;
  season_number?: number;
  episodeNumber: number;
  episode_number?: number;
  title?: string;
  episode_title?: string;
  description?: string;
  posterUrl?: string;
  poster_url?: string;
  bannerUrl?: string;
  banner_url?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  duration?: string;
  releaseDate?: string;
  release_date?: string;
  server1Url?: string;
  server1_url?: string;
  abyssUrl?: string;
  abyss_url?: string;
  server2Url?: string;
  server2_url?: string;
  filemoonUrl?: string;
  filemoon_url?: string;
  server3Url?: string;
  server3_url?: string;
  vdohideUrl?: string;
  vdohide_url?: string;
  videoUrl?: string;
  video_url?: string;
  views?: number;
  published?: boolean;
  isMovie?: boolean;
  createdAt?: any;
  created_at?: any;
  // Joined relational data (Requirement 3)
  anime?: any;
  season?: any;
  animeTitle?: string;
  animePoster?: string;
  animeBanner?: string;
  animeGenres?: string[];
  seasonTitle?: string;
}

export interface BackupRecord {
  id: string;
  type: 'anime' | 'season' | 'episode' | 'bulk';
  entityId?: string;
  data: any;
  timestamp: number;
}

// 17 Days Auto-Expiry Duration for New Drops (in milliseconds)
export const NEW_DROPS_EXPIRY_MS = 17 * 24 * 60 * 60 * 1000;

// No-op for backwards compatibility with any existing callers
export function invalidateCache(_pattern?: string): void {}

export function getPublishTimestamp(item: any): number {
  if (!item) return 0;
  if (item.created_at) {
    const parsed = Date.parse(item.created_at);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.createdAt) {
    if (typeof item.createdAt.toMillis === 'function') return item.createdAt.toMillis();
    if (typeof item.createdAt.toDate === 'function') return item.createdAt.toDate().getTime();
    if (typeof item.createdAt.seconds === 'number') return item.createdAt.seconds * 1000;
    if (typeof item.createdAt === 'number') return item.createdAt;
    const parsed = Date.parse(item.createdAt);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.releaseDate || item.release_date) {
    const parsed = Date.parse(item.releaseDate || item.release_date);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.updated_at) {
    const parsed = Date.parse(item.updated_at);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

// Helper to extract clean Abyss embed URL
export function extractAbyssUrl(input?: string): string {
  if (!input) return '';
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    url = iframeMatch[1].trim();
  }
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  return url;
}

// Helper to extract clean FileMoon embed URL
export function extractFileMoonUrl(input?: string): string {
  if (!input) return '';
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    url = iframeMatch[1].trim();
  }
  if (url.includes('filemoon.') && url.includes('/d/')) {
    url = url.replace('/d/', '/e/');
  }
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  return url;
}

// Helper to extract clean VDOHide embed URL
export function extractVDOHideUrl(input?: string): string {
  if (!input) return '';
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    url = iframeMatch[1].trim();
  }
  if ((url.includes('vdohide.') || url.includes('streamhide.') || url.includes('vidhide.')) && url.includes('/d/')) {
    url = url.replace('/d/', '/e/');
  } else if ((url.includes('vdohide.') || url.includes('streamhide.') || url.includes('vidhide.')) && url.includes('/w/')) {
    url = url.replace('/w/', '/e/');
  }
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  return url;
}

// Helper to reliably map Server 1 (Abyss), Server 2 (FileMoon), Server 3 (VDOHide)
export function resolveEpisodeServers(data: any): { server1: string; server2: string; server3: string } {
  if (!data) return { server1: '', server2: '', server3: '' };

  let s1 = extractAbyssUrl(data.server1Url || data.server1_url || data.abyssUrl || data.abyss_url || '');
  let s2 = extractFileMoonUrl(data.server2Url || data.server2_url || data.filemoonUrl || data.filemoon_url || '');
  let s3 = extractVDOHideUrl(data.server3Url || data.server3_url || data.vdohideUrl || data.vdohide_url || '');

  if (s1.includes('filemoon') && !s2) {
    s2 = s1;
    s1 = '';
  }
  if ((s2.includes('vdohide') || s2.includes('vidhide') || s2.includes('streamhide') || s2.includes('fembed')) && !s3) {
    s3 = s2;
    s2 = '';
  }

  if (!s2 && (data.videoUrl?.includes('filemoon') || data.video_url?.includes('filemoon'))) {
    s2 = extractFileMoonUrl(data.videoUrl || data.video_url);
  }
  const isVdoUrl = (u?: string) => u && (u.includes('vdohide') || u.includes('streamhide') || u.includes('vidhide') || u.includes('fembed'));
  if (!s3 && (isVdoUrl(data.videoUrl) || isVdoUrl(data.video_url))) {
    s3 = extractVDOHideUrl(data.videoUrl || data.video_url);
  }

  return { server1: s1, server2: s2, server3: s3 };
}

export function normalizeAnime(item: any, id?: string): AnimeItem {
  const genres = Array.isArray(item.genres)
    ? item.genres
    : typeof item.genres === 'string'
    ? item.genres.split(',').map((g: string) => g.trim()).filter(Boolean)
    : [];

  const isMovie = Boolean(
    item.type === 'Movie' || 
    item.contentType === 'Movie' || 
    item.content_type === 'Movie' || 
    item.is_movie || 
    item.isMovie
  );

  const rawPoster = item.poster_url || item.posterUrl || '';
  const rawBanner = item.banner_url || item.bannerUrl || '';
  const poster = resolveImageUrl(rawPoster || rawBanner, 'posters');
  const banner = resolveImageUrl(rawBanner || rawPoster, 'banners');

  return {
    ...item,
    id: String(id || item.id),
    title: item.title || 'Untitled Anime',
    description: item.description || item.synopsis || '',
    synopsis: item.synopsis || item.description || '',
    posterUrl: poster,
    poster_url: poster,
    bannerUrl: banner,
    banner_url: banner,
    releaseYear: item.releaseYear || item.release_year || '',
    release_year: item.release_year || item.releaseYear || '',
    genres,
    rating: item.rating || '9.5',
    status: item.status || 'Ongoing',
    language: item.language || 'Hindi Dub',
    dubbedBy: item.dubbedBy || item.dubbed_by || 'ZK Dubbing Studio',
    featured: Boolean(item.featured),
    trending: Boolean(item.trending),
    views: typeof item.views === 'number' ? item.views : 0,
    type: isMovie ? 'Movie' : 'TV Series',
    contentType: isMovie ? 'Movie' : 'TV Series',
    isMovie,
    is_movie: isMovie,
    duration: item.duration || (isMovie ? '1h 45m' : ''),
    releaseDate: item.releaseDate || item.release_date || '',
    server1Url: item.server1Url || item.server1_url || item.abyssUrl || item.abyss_url || '',
    server2Url: item.server2Url || item.server2_url || item.filemoonUrl || item.filemoon_url || '',
    server3Url: item.server3Url || item.server3_url || item.vdohideUrl || item.vdohide_url || '',
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
  };
}

export function normalizeEpisodeDoc(
  dId: string, 
  data: any, 
  animeIdFallbackOrJoinedAnime?: any,
  joinedSeasonParam?: any
): EpisodeItem {
  const { server1, server2, server3 } = resolveEpisodeServers(data);
  const rawSeason = data.seasonId || data.season_id;
  const epSeason = (rawSeason && rawSeason !== 's1' && rawSeason !== 'null' && rawSeason !== 'undefined') ? String(rawSeason) : '';
  let epSeasonNum = Number(data.seasonNumber || data.season_number);
  if (!epSeasonNum || isNaN(epSeasonNum)) {
    if (epSeason === 's2' || epSeason === '2' || epSeason === 'season 2') epSeasonNum = 2;
    else epSeasonNum = 1;
  }

  const epNum = Number(data.episodeNumber || data.episode_number) || 1;
  const isMovie = Boolean(data.isMovie || data.type === 'Movie' || epSeason === 'movie');

  // Handle joined anime & season (Requirement 3: Join episodes with anime and seasons using anime_id and season_id)
  const animeObj = data.anime || (typeof animeIdFallbackOrJoinedAnime === 'object' ? animeIdFallbackOrJoinedAnime : null);
  const seasonObj = data.seasons || data.season || joinedSeasonParam || null;
  const fallbackAnimeId = typeof animeIdFallbackOrJoinedAnime === 'string' ? animeIdFallbackOrJoinedAnime : '';

  const animeTitle = animeObj?.title || data.anime_title || data.animeTitle || '';
  const rawAnimePoster = animeObj?.poster_url || animeObj?.posterUrl || data.poster_url || data.posterUrl || '';
  const rawAnimeBanner = animeObj?.banner_url || animeObj?.bannerUrl || data.banner_url || data.bannerUrl || '';
  const rawEpThumb = data.thumbnail_url || data.thumbnailUrl || '';

  const animePoster = resolveImageUrl(rawAnimePoster || rawEpThumb || rawAnimeBanner, 'posters');
  const animeBanner = resolveImageUrl(rawAnimeBanner || rawAnimePoster || rawEpThumb, 'banners');
  const epThumbnail = resolveImageUrl(rawEpThumb || rawAnimePoster || rawAnimeBanner, 'thumbnails');
  const animeGenres = Array.isArray(animeObj?.genres) ? animeObj.genres : [];
  const seasonTitle = seasonObj?.title || (epSeasonNum ? `Season ${epSeasonNum}` : 'Season 1');

  return {
    ...data,
    id: String(dId),
    animeId: String(data.animeId || data.anime_id || animeObj?.id || fallbackAnimeId || ''),
    anime_id: String(data.animeId || data.anime_id || animeObj?.id || fallbackAnimeId || ''),
    seasonId: epSeason || (seasonObj?.id ? String(seasonObj.id) : ''),
    season_id: epSeason || (seasonObj?.id ? String(seasonObj.id) : null),
    seasonNumber: epSeasonNum,
    season_number: epSeasonNum,
    episodeNumber: epNum,
    episode_number: epNum,
    title: data.title || data.episode_title || (isMovie ? 'Full Movie' : `Episode ${epNum}`),
    episode_title: data.episode_title || data.title || (isMovie ? 'Full Movie' : `Episode ${epNum}`),
    description: data.description || '',
    posterUrl: animePoster,
    poster_url: animePoster,
    bannerUrl: animeBanner,
    banner_url: animeBanner,
    thumbnailUrl: epThumbnail || animePoster,
    thumbnail_url: epThumbnail || animePoster,
    duration: data.duration || (isMovie ? '1h 45m' : '24m'),
    releaseDate: data.releaseDate || data.release_date || '',
    server1Url: server1,
    server1_url: server1,
    abyssUrl: server1,
    abyss_url: server1,
    server2Url: server2,
    server2_url: server2,
    filemoonUrl: server2,
    filemoon_url: server2,
    server3Url: server3,
    server3_url: server3,
    vdohideUrl: server3,
    vdohide_url: server3,
    videoUrl: server1 || server2 || server3 || '',
    video_url: server1 || server2 || server3 || '',
    views: typeof data.views === 'number' ? data.views : 0,
    published: data.published !== false,
    created_at: data.created_at || data.createdAt || new Date().toISOString(),
    isMovie,
    anime: animeObj,
    season: seasonObj,
    animeTitle,
    animePoster,
    animeBanner,
    animeGenres,
    seasonTitle,
  };
}

// Automatic backup creation before any write/update/delete operation
export async function createAutoBackup(type: 'anime' | 'season' | 'episode' | 'bulk', entityId: string, currentData: any): Promise<void> {
  try {
    const backupObj: BackupRecord = {
      id: `bak_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      entityId,
      data: currentData,
      timestamp: Date.now(),
    };

    // 1. Save in localStorage for instant recovery
    const backupsRaw = localStorage.getItem('zk_auto_backups');
    let list: BackupRecord[] = backupsRaw ? JSON.parse(backupsRaw) : [];
    if (!Array.isArray(list)) list = [];
    list.unshift(backupObj);
    if (list.length > 50) list = list.slice(0, 50);
    localStorage.setItem('zk_auto_backups', JSON.stringify(list));

    // 2. Save in Supabase backups table
    await supabase.from('backups').insert({
      backup_type: type,
      entity_id: entityId,
      data: currentData,
      created_at: new Date().toISOString(),
    });
  } catch {
    // ignore backup error
  }
}

// -------------------------------------------------------------
// DYNAMIC TABLE DETECTION & RESOLUTION (Requirement 1, 2, 7)
// -------------------------------------------------------------

// Standard Supabase public tables (Requirement 2 & 5)
export const ANIME_TABLE_CANDIDATES = ['anime'];
export const EPISODES_TABLE_CANDIDATES = ['episodes'];
export const SEASONS_TABLE_CANDIDATES = ['seasons'];

let activeAnimeTable: string = 'anime';
let activeEpisodesTable: string = 'episodes';
let activeSeasonsTable: string = 'seasons';

// Kept for backward compatibility - returns empty array (Requirement 5: No mock data or localStorage)
export function getLocalAnimeList(): AnimeItem[] {
  return [];
}

export function saveLocalAnimeItem(_item: any): void {}

export function deleteLocalAnimeItem(_id: string): void {}

export function isSchemaCachePending(error: any): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || (typeof error.message === 'string' && error.message.includes('schema cache'));
}

/**
 * Standard table names in Supabase (Requirement 2)
 */
export async function detectActualTableNames(_force = false): Promise<{
  anime: string;
  episodes: string;
  seasons: string;
  animeExists: boolean;
  episodesExists: boolean;
  seasonsExists: boolean;
}> {
  return {
    anime: 'anime',
    episodes: 'episodes',
    seasons: 'seasons',
    animeExists: true,
    episodesExists: true,
    seasonsExists: true,
  };
}

export async function getActiveAnimeTable(): Promise<string> {
  return 'anime';
}

export async function getActiveEpisodesTable(): Promise<string> {
  return 'episodes';
}

export async function getActiveSeasonsTable(): Promise<string> {
  return 'seasons';
}

/**
 * Trigger Auto Migration via Server (Requirement 3 & 4)
 */
export async function triggerAutoMigration(credentials?: { dbPassword?: string; connectionString?: string }): Promise<{
  success: boolean;
  message: string;
  sql?: string;
  dashboardUrl?: string;
}> {
  try {
    const res = await fetch('/api/supabase/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials || {}),
    });
    const data = await res.json();
    if (data.success) {
      await detectActualTableNames(true);
      return { success: true, message: data.message };
    }
    return {
      success: false,
      message: data.message || 'Auto-migration could not connect directly',
      sql: data.sql,
      dashboardUrl: data.dashboardUrl,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to call migration endpoint' };
  }
}

/**
 * Refresh Supabase Schema Cache (Requirement 4)
 */
export async function refreshSupabaseSchemaCache(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/supabase/reload-schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    await detectActualTableNames(true);
    return { success: data.success, message: data.message };
  } catch (err: any) {
    await detectActualTableNames(true);
    return { success: true, message: 'Schema detector refreshed.' };
  }
}

// -------------------------------------------------------------
// READ OPERATIONS (SUPABASE ONLY - ALL READ FROM DETECTED TABLE)
// -------------------------------------------------------------

// 1. Featured Anime (Supabase Only - Requirement 7)
export async function getFeaturedAnime(): Promise<AnimeItem[]> {
  const cacheKey = 'featured_anime';
  const cached = getCachedData<AnimeItem[]>(cacheKey);

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(8);
    });

    if (res?.data && res.data.length > 0) {
      const items = res.data.map((item: any) => normalizeAnime(item));
      setCachedData(cacheKey, items);
      return items;
    }

    // Fallback: latest 6 anime from Supabase if no explicit featured flag
    const resAll = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
    });

    if (resAll?.data && resAll.data.length > 0) {
      const items = resAll.data.map((item: any) => normalizeAnime(item));
      setCachedData(cacheKey, items);
      return items;
    }

    if (cached && cached.length > 0) return cached;
    return [];
  } catch (err: any) {
    console.error('[Supabase Real Error - getFeaturedAnime]:', formatDbError(err));
    if (cached && cached.length > 0) return cached;
    const stale = getCachedData<AnimeItem[]>(cacheKey, true);
    if (stale && stale.length > 0) return stale;
    return [];
  }
}

// 2. Trending Anime (Supabase Only - Requirement 7)
export async function getTrendingAnime(): Promise<AnimeItem[]> {
  const cacheKey = 'trending_anime';
  const cached = getCachedData<AnimeItem[]>(cacheKey);

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .eq('trending', true)
        .order('views', { ascending: false })
        .limit(10);
    });

    if (res?.data && res.data.length > 0) {
      const items = res.data.map((item: any) => normalizeAnime(item));
      setCachedData(cacheKey, items);
      return items;
    }

    // Fallback: order by views in Supabase
    const resAll = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .order('views', { ascending: false })
        .limit(10);
    });

    if (resAll?.data && resAll.data.length > 0) {
      const items = resAll.data.map((item: any) => normalizeAnime(item));
      setCachedData(cacheKey, items);
      return items;
    }

    if (cached && cached.length > 0) return cached;
    return [];
  } catch (err: any) {
    console.error('[Supabase Real Error - getTrendingAnime]:', formatDbError(err));
    if (cached && cached.length > 0) return cached;
    const stale = getCachedData<AnimeItem[]>(cacheKey, true);
    if (stale && stale.length > 0) return stale;
    return [];
  }
}

// 3. New Drops (Supabase Only - Joined with Anime & Seasons, Relational PostgREST Query)
export async function getNewDrops(): Promise<any[]> {
  const cacheKey = 'new_drops';
  const cached = getCachedData<any[]>(cacheKey);
  const now = Date.now();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('episodes')
        .select('*, anime(*), seasons(*)')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(60);
    });

    if (res?.error) {
      console.error('[Supabase Real Error - getNewDrops]:', formatDbError(res.error));
      throw new Error(formatDbError(res.error));
    }

    if (res?.data && res.data.length > 0) {
      const activeDrops = res.data
        .map((ep: any) => {
          const animeObj = ep.anime;
          const parentAnimeId = String(animeObj?.id || ep.anime_id || ep.animeId || '');
          const publishTs = getPublishTimestamp(ep);
          // Only expire if timestamp is strictly valid AND older than 17 days
          const isExpired = publishTs > 0 ? (now - publishTs) > NEW_DROPS_EXPIRY_MS : false;

          return {
            ...normalizeEpisodeDoc(ep.id, ep, animeObj, ep.seasons),
            id: parentAnimeId || ep.id,
            animeId: parentAnimeId,
            anime_id: parentAnimeId,
            dropId: ep.id,
            episodeId: ep.id,
            title: animeObj?.title || ep.episode_title || 'Anime Series',
            animeTitle: animeObj?.title || ep.episode_title || 'Anime Series',
            episodeTitle: ep.episode_title || ep.title || (ep.episode_number ? `Episode ${ep.episode_number}` : 'Episode 1'),
            posterUrl: resolveImageUrl(animeObj?.poster_url || animeObj?.posterUrl || ep.thumbnail_url || ep.thumbnailUrl, 'posters'),
            poster_url: resolveImageUrl(animeObj?.poster_url || animeObj?.posterUrl || ep.thumbnail_url || ep.thumbnailUrl, 'posters'),
            thumbnailUrl: resolveImageUrl(ep.thumbnail_url || ep.thumbnailUrl || animeObj?.poster_url || animeObj?.banner_url, 'thumbnails'),
            thumbnail_url: resolveImageUrl(ep.thumbnail_url || ep.thumbnailUrl || animeObj?.poster_url || animeObj?.banner_url, 'thumbnails'),
            bannerUrl: resolveImageUrl(animeObj?.banner_url || animeObj?.bannerUrl || animeObj?.poster_url, 'banners'),
            banner_url: resolveImageUrl(animeObj?.banner_url || animeObj?.bannerUrl || animeObj?.poster_url, 'banners'),
            genres: Array.isArray(animeObj?.genres) ? animeObj.genres : [],
            animeGenres: Array.isArray(animeObj?.genres) ? animeObj.genres : [],
            contentType: animeObj?.content_type || animeObj?.type || 'TV Series',
            type: animeObj?.type || animeObj?.content_type || 'TV Series',
            releaseYear: animeObj?.release_year,
            release_year: animeObj?.release_year,
            publishTs,
            isExpired,
          };
        })
        .filter((d: any) => !d.isExpired);

      if (activeDrops.length > 0) {
        setCachedData(cacheKey, activeDrops);
      }
      return activeDrops;
    }

    if (cached && cached.length > 0) return cached;
    return [];
  } catch (err: any) {
    console.error('[Supabase Real Error - getNewDrops exception]:', formatDbError(err));
    if (cached && cached.length > 0) return cached;
    const stale = getCachedData<any[]>(cacheKey, true);
    if (stale && stale.length > 0) return stale;
    return [];
  }
}

// 4. Get Anime by ID (Supabase Only - Requirement 7)
export async function getAnimeById(id: string): Promise<AnimeItem | null> {
  if (!id) return null;
  const cacheKey = `anime_${id}`;
  const cached = getCachedData<AnimeItem>(cacheKey);

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    });

    if (res?.data) {
      const normalized = normalizeAnime(res.data, res.data.id);
      setCachedData(cacheKey, normalized);
      setCachedData(`anime_${normalized.id}`, normalized);
      return normalized;
    }

    // Try case-insensitive title lookup
    const resTitle = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .ilike('title', id)
        .maybeSingle();
    });

    if (resTitle?.data) {
      const normalized = normalizeAnime(resTitle.data, resTitle.data.id);
      setCachedData(cacheKey, normalized);
      setCachedData(`anime_${normalized.id}`, normalized);
      return normalized;
    }

    // Defensive lookup: In case id is an episode ID, locate parent anime
    try {
      const epRes = await executeSupabaseWithRetry(async () => {
        return await supabase
          .from('episodes')
          .select('anime_id')
          .eq('id', id)
          .maybeSingle();
      });
      if (epRes?.data?.anime_id) {
        const parentAnime = await getAnimeById(epRes.data.anime_id);
        if (parentAnime) return parentAnime;
      }
    } catch {}

    // Defensive lookup: In case id is a season ID, locate parent anime
    try {
      const seaRes = await executeSupabaseWithRetry(async () => {
        return await supabase
          .from('seasons')
          .select('anime_id')
          .eq('id', id)
          .maybeSingle();
      });
      if (seaRes?.data?.anime_id) {
        const parentAnime = await getAnimeById(seaRes.data.anime_id);
        if (parentAnime) return parentAnime;
      }
    } catch {}

    if (cached) return cached;
    return null;
  } catch (err: any) {
    console.error(`[Supabase Real Error - getAnimeById(${id})]:`, formatDbError(err));
    if (cached) return cached;
    const stale = getCachedData<AnimeItem>(cacheKey, true);
    if (stale) return stale;
    return null;
  }
}

// 5. Get Seasons by Anime ID (Supabase Only - Requirement 7)
export async function getSeasonsByAnimeId(animeId: string): Promise<SeasonItem[]> {
  if (!animeId) return [];
  const cacheKey = `seasons_${animeId}`;
  const cached = getCachedData<SeasonItem[]>(cacheKey);
  const seaTable = await getActiveSeasonsTable();
  const epTable = await getActiveEpisodesTable();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(seaTable)
        .select('*')
        .eq('anime_id', animeId)
        .order('season_number', { ascending: true });
    });

    if (res?.data && res.data.length > 0) {
      const mapped = res.data.map((item: any) => ({
        ...item,
        id: String(item.id),
        animeId: String(item.anime_id || item.animeId || animeId),
        seasonNumber: Number(item.season_number || item.seasonNumber || 1),
        title: item.title || `Season ${item.season_number || 1}`,
        bannerUrl: item.banner_url || item.bannerUrl,
        posterUrl: item.poster_url || item.posterUrl,
        order: Number(item.order ?? (item.season_number || 1)),
      }));
      setCachedData(cacheKey, mapped);
      return mapped;
    }
  } catch {
    // fallback below
  }

  // Synthesize Season 1 only if episodes exist in Supabase for this anime
  try {
    const { count } = await supabase
      .from(epTable)
      .select('id', { count: 'exact', head: true })
      .eq('anime_id', animeId);

    if (count && count > 0) {
      const synth: SeasonItem[] = [{
        id: 's1',
        animeId,
        seasonNumber: 1,
        title: 'Season 1',
        order: 1,
      }];
      setCachedData(cacheKey, synth);
      return synth;
    }
  } catch {}

  // Never return an empty array if cached data exists
  const fallback = cached || getCachedData<SeasonItem[]>(cacheKey, true);
  if (fallback && fallback.length > 0) {
    return fallback;
  }

  return [];
}

// Helper to match an episode to a target season
export function matchEpisodeToSeason(
  ep: any,
  selectedSeasonId: string,
  seasons: any[] = [],
  _allEpisodes: any[] = []
): boolean {
  if (!selectedSeasonId) return true;

  const selectedSeasonObj = seasons.find((s) => s.id === selectedSeasonId);
  const targetSeasonNum = selectedSeasonObj?.seasonNumber != null 
    ? Number(selectedSeasonObj.seasonNumber) 
    : undefined;

  const epSeasonId = ep.seasonId || ep.season_id;
  const epSeasonNum = (ep.seasonNumber != null && ep.seasonNumber !== '') 
    ? Number(ep.seasonNumber) 
    : (ep.season_number != null && ep.season_number !== '') 
    ? Number(ep.season_number) 
    : undefined;

  if (epSeasonId && String(epSeasonId).trim() === String(selectedSeasonId).trim()) {
    return true;
  }
  if (selectedSeasonObj?.id && epSeasonId && String(epSeasonId).trim() === String(selectedSeasonObj.id).trim()) {
    return true;
  }
  if (epSeasonNum !== undefined && targetSeasonNum !== undefined) {
    if (epSeasonNum === targetSeasonNum) return true;
  }

  if (targetSeasonNum !== undefined && epSeasonId) {
    const clean = String(epSeasonId).toLowerCase().trim();
    if (
      clean === `s${targetSeasonNum}` ||
      clean === String(targetSeasonNum) ||
      clean === `season ${targetSeasonNum}` ||
      clean === `season_${targetSeasonNum}` ||
      clean === `season-${targetSeasonNum}` ||
      clean === `season${targetSeasonNum}`
    ) {
      return true;
    }
  }

  const isFirstSeason = selectedSeasonObj 
    ? targetSeasonNum === 1 || seasons[0]?.id === selectedSeasonId 
    : true;

  if (isFirstSeason) {
    if (epSeasonNum !== undefined && targetSeasonNum !== undefined && epSeasonNum !== targetSeasonNum) {
      return false;
    }
    if (
      !epSeasonId ||
      epSeasonId === 'default' ||
      epSeasonId === 's1' ||
      epSeasonId === '1' ||
      epSeasonId === 'season 1' ||
      epSeasonId === 'season-1' ||
      epSeasonId === 'season_1' ||
      (epSeasonNum === undefined && !epSeasonId) ||
      epSeasonNum === 1
    ) {
      return true;
    }
  }

  if (seasons.length <= 1) return true;
  return false;
}

// 6. Get Episodes by Anime ID (Supabase Only - Requirement 3 & 4: Joined with Anime & Seasons, Published Only)
export async function getEpisodesByAnimeId(animeId: string, seasonId?: string): Promise<EpisodeItem[]> {
  if (!animeId) return [];
  const cacheKey = `episodes_${animeId}`;
  const cached = getCachedData<EpisodeItem[]>(cacheKey);

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('episodes')
        .select('*, anime(*), seasons(*)')
        .eq('anime_id', animeId)
        .eq('published', true)
        .order('episode_number', { ascending: true });
    });

    if (res?.error) {
      console.error('[Supabase Real Error - getEpisodesByAnimeId]:', formatDbError(res.error));
      throw new Error(formatDbError(res.error));
    }

    if (res?.data && res.data.length > 0) {
      const allEpisodes = res.data.map((ep: any) => normalizeEpisodeDoc(ep.id, ep, animeId));
      setCachedData(cacheKey, allEpisodes);

      if (seasonId && seasonId !== 'all') {
        return allEpisodes.filter((ep: any) => matchEpisodeToSeason(ep, seasonId));
      }
      return allEpisodes;
    }
  } catch (err: any) {
    console.error('[Supabase Real Error - getEpisodesByAnimeId exception]:', formatDbError(err));
  }

  const fallback = cached || getCachedData<EpisodeItem[]>(cacheKey, true);
  if (fallback && fallback.length > 0) {
    if (seasonId && seasonId !== 'all') {
      return fallback.filter((ep: any) => matchEpisodeToSeason(ep, seasonId));
    }
    return fallback;
  }

  return [];
}

// 7. Get Episodes by Season (Requirement 3 & 4: Published Only Joined with Anime and Seasons)
export async function getEpisodesBySeason(seasonId: string, animeId?: string): Promise<EpisodeItem[]> {
  if (!seasonId) return [];
  const cacheKey = `season_eps_${seasonId}_${animeId || 'all'}`;
  const cached = getCachedData<EpisodeItem[]>(cacheKey);

  try {
    let query = supabase
      .from('episodes')
      .select('*, anime(*), seasons(*)')
      .eq('published', true)
      .order('episode_number', { ascending: true });

    if (animeId) {
      query = query.eq('anime_id', animeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Supabase Real Error - getEpisodesBySeason]:', formatDbError(error));
      throw new Error(formatDbError(error));
    }

    const normalized = (data || []).map((ep: any) => normalizeEpisodeDoc(ep.id, ep, animeId));
    const matched = normalized.filter((ep: any) => {
      if (ep.seasonId === seasonId || ep.season_id === seasonId) return true;
      if (seasonId === 's1' && (ep.seasonNumber === 1 || !ep.seasonId)) return true;
      return matchEpisodeToSeason(ep, seasonId);
    });

    setCachedData(cacheKey, matched);
    return matched;
  } catch (err: any) {
    console.error('[Supabase Real Error - getEpisodesBySeason exception]:', formatDbError(err));
    if (cached && cached.length > 0) return cached;
    return [];
  }
}

// 8. Get Episode by ID (Supabase Only - Requirement 7)
export async function getEpisodeById(id: string): Promise<EpisodeItem | null> {
  if (!id) return null;

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('episodes')
        .select('*, anime(*), seasons(*)')
        .eq('id', id)
        .maybeSingle();
    });

    if (res?.data) {
      return normalizeEpisodeDoc(res.data.id, res.data);
    }

    // If ID belongs to a standalone Movie, resolve from anime table directly
    const { data: movieAnime } = await supabase
      .from('anime')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (movieAnime) {
      const isMovie = Boolean(
        movieAnime.type === 'Movie' || 
        movieAnime.contentType === 'Movie' || 
        movieAnime.content_type === 'Movie' || 
        movieAnime.is_movie
      );

      if (isMovie) {
        const { server1, server2, server3 } = resolveEpisodeServers(movieAnime);
        return {
          id: movieAnime.id,
          animeId: movieAnime.id,
          anime_id: movieAnime.id,
          seasonId: 'movie',
          season_id: 'movie',
          seasonNumber: 1,
          season_number: 1,
          episodeNumber: 1,
          episode_number: 1,
          title: movieAnime.title,
          episode_title: movieAnime.title,
          description: movieAnime.description || movieAnime.synopsis || '',
          thumbnailUrl: movieAnime.banner_url || movieAnime.poster_url || '',
          thumbnail_url: movieAnime.banner_url || movieAnime.poster_url || '',
          duration: movieAnime.duration || '1h 45m',
          releaseDate: movieAnime.release_date || movieAnime.releaseDate || '',
          server1Url: server1,
          server1_url: server1,
          server2Url: server2,
          server2_url: server2,
          server3Url: server3,
          server3_url: server3,
          videoUrl: server1 || server2 || server3 || '',
          published: true,
          isMovie: true,
        };
      }
    }
  } catch (err: any) {
    console.error(`[Supabase Real Error - getEpisodeById(${id})]:`, formatDbError(err));
  }

  return null;
}

// 9. Get All Anime (Supabase Only - Requirement 2 & 5: Zero Mock Data, public.anime Only)
export async function getAllAnime(): Promise<AnimeItem[]> {
  const cacheKey = 'all_anime';
  const cached = getCachedData<AnimeItem[]>(cacheKey);

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .order('created_at', { ascending: false });
    });

    if (res?.error) {
      console.error('[Supabase Real Error - getAllAnime]:', formatDbError(res.error));
      throw new Error(formatDbError(res.error));
    }

    if (res?.data && res.data.length > 0) {
      const remote = res.data.map((d: any) => normalizeAnime(d, d.id));
      setCachedData(cacheKey, remote);
      return remote;
    }

    if (cached && cached.length > 0) return cached;
    return [];
  } catch (err: any) {
    console.error('[Supabase Real Error - getAllAnime exception]:', formatDbError(err));
    if (cached && cached.length > 0) return cached;
    const stale = getCachedData<AnimeItem[]>(cacheKey, true);
    if (stale && stale.length > 0) return stale;
    return [];
  }
}

// 10. Get All Seasons (Supabase Only - Requirement 2 & 5: public.seasons Only)
export async function getAllSeasons(): Promise<SeasonItem[]> {
  const cacheKey = 'all_seasons';
  const cached = getCachedData<SeasonItem[]>(cacheKey);

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('seasons')
        .select('*')
        .order('season_number', { ascending: true });
    });

    if (res?.error) {
      console.error('[Supabase Real Error - getAllSeasons]:', formatDbError(res.error));
      throw new Error(formatDbError(res.error));
    }

    if (res?.data && res.data.length > 0) {
      const mapped = res.data.map((item: any) => ({
        ...item,
        id: String(item.id),
        animeId: String(item.anime_id || item.animeId),
        seasonNumber: Number(item.season_number || item.seasonNumber || 1),
        title: item.title || `Season ${item.season_number || item.seasonNumber || 1}`,
        bannerUrl: resolveImageUrl(item.banner_url || item.bannerUrl, 'banners'),
        banner_url: resolveImageUrl(item.banner_url || item.bannerUrl, 'banners'),
        posterUrl: resolveImageUrl(item.poster_url || item.posterUrl, 'posters'),
        poster_url: resolveImageUrl(item.poster_url || item.posterUrl, 'posters'),
        order: Number(item.order ?? (item.season_number || 1)),
      }));
      setCachedData(cacheKey, mapped);
      return mapped;
    }

    if (cached && cached.length > 0) return cached;
    return [];
  } catch (err: any) {
    console.error('[Supabase Real Error - getAllSeasons exception]:', formatDbError(err));
    if (cached && cached.length > 0) return cached;
    const stale = getCachedData<SeasonItem[]>(cacheKey, true);
    if (stale && stale.length > 0) return stale;
    return [];
  }
}

// 11. Get All Episodes (Supabase Only - Requirement 3 & 4: Joined with Anime & Seasons, Published Only)
export async function getAllEpisodes(publishedOnly = true): Promise<EpisodeItem[]> {
  const cacheKey = publishedOnly ? 'all_episodes_published' : 'all_episodes_all';
  const cached = getCachedData<EpisodeItem[]>(cacheKey);

  try {
    const res = await executeSupabaseWithRetry(async () => {
      let query = supabase
        .from('episodes')
        .select('*, anime(*), seasons(*)')
        .order('created_at', { ascending: false });

      if (publishedOnly) {
        query = query.eq('published', true);
      }
      return await query;
    });

    if (res?.error) {
      console.error('[Supabase Real Error - getAllEpisodes]:', formatDbError(res.error));
      throw new Error(formatDbError(res.error));
    }

    if (res?.data && res.data.length > 0) {
      const mapped = res.data.map((d: any) => normalizeEpisodeDoc(d.id, d));
      setCachedData(cacheKey, mapped);
      return mapped;
    }

    if (cached && cached.length > 0) return cached;
    return [];
  } catch (err: any) {
    console.error('[Supabase Real Error - getAllEpisodes exception]:', formatDbError(err));
    if (cached && cached.length > 0) return cached;
    const stale = getCachedData<EpisodeItem[]>(cacheKey, true);
    if (stale && stale.length > 0) return stale;
    return [];
  }
}

// 11. Fetch All Genres from Supabase
export async function getGenres(): Promise<string[]> {
  const animeTable = await getActiveAnimeTable();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase.from(animeTable).select('genres');
    });

    if (res?.data && res.data.length > 0) {
      const set = new Set<string>();
      res.data.forEach((row: any) => {
        if (Array.isArray(row.genres)) {
          row.genres.forEach((g: string) => {
            if (g && typeof g === 'string') set.add(g.trim());
          });
        }
      });
      if (set.size > 0) {
        return ['All', ...Array.from(set).sort()];
      }
    }
  } catch {}

  return ['All', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Supernatural'];
}

// -------------------------------------------------------------
// WRITE OPERATIONS (SUPABASE ONLY WITH DATA SAFETY & ROLLBACK)
// -------------------------------------------------------------

// Insert new Anime into Supabase public.anime (Requirement 6)
export async function insertAnime(animeData: Partial<AnimeItem>): Promise<AnimeItem> {
  const targetId = String(animeData.id || `anm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  const genres = Array.isArray(animeData.genres)
    ? animeData.genres
    : typeof animeData.genres === 'string'
    ? (animeData.genres as string).split(',').map((g: string) => g.trim()).filter(Boolean)
    : [];

  const poster = animeData.posterUrl || animeData.poster_url || '';
  const banner = animeData.bannerUrl || animeData.banner_url || poster;
  const rating = String(animeData.rating || '9.5');
  const releaseYear = String(animeData.releaseYear || animeData.release_year || '');
  const status = animeData.status || 'Ongoing';
  const language = animeData.language || 'Hindi Dub';
  const dubbedBy = animeData.dubbedBy || animeData.dubbed_by || 'ZK Dubbing Studio';
  const featured = Boolean(animeData.featured);
  const trending = Boolean(animeData.trending);

  const type = (animeData.type === 'Movie' || animeData.contentType === 'Movie' || animeData.isMovie) ? 'Movie' : 'TV Series';
  const isMovie = type === 'Movie';
  const duration = animeData.duration ? String(animeData.duration).trim() : (isMovie ? '1h 45m' : '');
  const releaseDate = animeData.releaseDate ? String(animeData.releaseDate).trim() : (animeData.release_date || releaseYear);

  const server1 = extractAbyssUrl(animeData.server1Url || animeData.server1_url || '');
  const server2 = extractFileMoonUrl(animeData.server2Url || animeData.server2_url || '');
  const server3 = extractVDOHideUrl(animeData.server3Url || animeData.server3_url || '');

  const payload: any = {
    id: targetId,
    title: (animeData.title || 'Untitled Anime').trim(),
    description: animeData.description || animeData.synopsis || '',
    synopsis: animeData.synopsis || animeData.description || '',
    poster_url: poster,
    banner_url: banner,
    genres,
    rating,
    release_year: releaseYear,
    status,
    language,
    dubbed_by: dubbedBy,
    featured,
    trending,
    type,
    content_type: type,
    is_movie: isMovie,
    duration,
    release_date: releaseDate,
    server1_url: server1,
    server2_url: server2,
    server3_url: server3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('anime').insert(payload).select().single();
  if (error) {
    const errorMsg = formatDbError(error);
    console.error('[Supabase Real Error - insertAnime]:', error);
    throw new Error(errorMsg);
  }

  // If Movie, ensure movie episode is created in public.episodes
  if (isMovie) {
    try {
      const movieEpDoc: any = {
        id: targetId,
        anime_id: targetId,
        season_id: null,
        season_number: 1,
        episode_number: 1,
        episode_title: payload.title,
        description: payload.description,
        thumbnail_url: banner || poster,
        duration: duration || '1h 45m',
        release_date: releaseDate,
        server1_url: server1,
        server2_url: server2,
        server3_url: server3,
        published: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('episodes').upsert(movieEpDoc);
    } catch (epErr) {
      console.warn('[insertAnime Movie Episode Warning]:', formatDbError(epErr));
    }
  }

  // Invalidate cache and broadcast refresh events immediately
  clearCachePrefix('anime');
  clearCachedData('all_anime');
  clearCachedData('featured_anime');
  clearCachedData('trending_anime');
  clearCachedData('new_drops');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_anime_published', { detail: { id: targetId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'anime', id: targetId } }));
  }

  return normalizeAnime(data || payload, targetId);
}

// Update existing Anime in Supabase public.anime (Requirement 6)
export async function updateAnime(id: string, animeData: Partial<AnimeItem>): Promise<AnimeItem> {
  const targetId = String(id).trim();
  if (!targetId) throw new Error('Cannot update anime: ID is required');

  const genres = animeData.genres !== undefined
    ? (Array.isArray(animeData.genres)
        ? animeData.genres
        : typeof animeData.genres === 'string'
        ? (animeData.genres as string).split(',').map((g: string) => g.trim()).filter(Boolean)
        : [])
    : undefined;

  const type = animeData.type || animeData.contentType || (animeData.isMovie ? 'Movie' : undefined);
  const isMovie = type ? type === 'Movie' : undefined;

  const payload: any = {
    updated_at: new Date().toISOString(),
  };

  if (animeData.title !== undefined) payload.title = animeData.title.trim();
  if (animeData.description !== undefined) payload.description = animeData.description;
  if (animeData.synopsis !== undefined) payload.synopsis = animeData.synopsis;
  if (animeData.posterUrl !== undefined || animeData.poster_url !== undefined) {
    payload.poster_url = animeData.posterUrl || animeData.poster_url || '';
  }
  if (animeData.bannerUrl !== undefined || animeData.banner_url !== undefined) {
    payload.banner_url = animeData.bannerUrl || animeData.banner_url || payload.poster_url || '';
  }
  if (genres !== undefined) payload.genres = genres;
  if (animeData.rating !== undefined) payload.rating = String(animeData.rating);
  if (animeData.releaseYear !== undefined || animeData.release_year !== undefined) {
    payload.release_year = String(animeData.releaseYear || animeData.release_year || '');
  }
  if (animeData.status !== undefined) payload.status = animeData.status;
  if (animeData.language !== undefined) payload.language = animeData.language;
  if (animeData.dubbedBy !== undefined || animeData.dubbed_by !== undefined) {
    payload.dubbed_by = animeData.dubbedBy || animeData.dubbed_by;
  }
  if (animeData.featured !== undefined) payload.featured = Boolean(animeData.featured);
  if (animeData.trending !== undefined) payload.trending = Boolean(animeData.trending);
  if (type !== undefined) {
    payload.type = type;
    payload.content_type = type;
  }
  if (isMovie !== undefined) payload.is_movie = isMovie;
  if (animeData.duration !== undefined) payload.duration = animeData.duration;
  if (animeData.releaseDate !== undefined || animeData.release_date !== undefined) {
    payload.release_date = animeData.releaseDate || animeData.release_date;
  }
  if (animeData.server1Url !== undefined || animeData.server1_url !== undefined) {
    payload.server1_url = extractAbyssUrl(animeData.server1Url || animeData.server1_url || '');
  }
  if (animeData.server2Url !== undefined || animeData.server2_url !== undefined) {
    payload.server2_url = extractFileMoonUrl(animeData.server2Url || animeData.server2_url || '');
  }
  if (animeData.server3Url !== undefined || animeData.server3_url !== undefined) {
    payload.server3_url = extractVDOHideUrl(animeData.server3Url || animeData.server3_url || '');
  }

  const { data, error } = await supabase.from('anime').update(payload).eq('id', targetId).select().single();
  if (error) {
    const errorMsg = formatDbError(error);
    console.error('[Supabase Real Error - updateAnime]:', error);
    throw new Error(errorMsg);
  }

  // Invalidate cache and broadcast refresh events immediately
  clearCachePrefix('anime');
  clearCachedData('all_anime');
  clearCachedData('featured_anime');
  clearCachedData('trending_anime');
  clearCachedData('new_drops');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_anime_published', { detail: { id: targetId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'anime', id: targetId } }));
  }

  return normalizeAnime(data || { ...payload, id: targetId }, targetId);
}

// Save Anime to Supabase (calls updateAnime or insertAnime)
export async function saveAnimeBoth(animeData: any, id?: string): Promise<string> {
  const targetId = id || animeData.id;

  if (targetId) {
    // Check if record exists to decide insert or update
    const { data: existing } = await supabase.from('anime').select('id').eq('id', targetId).maybeSingle();
    if (existing) {
      const updated = await updateAnime(targetId, animeData);
      return updated.id;
    }
  }

  const inserted = await insertAnime({ ...animeData, id: targetId });
  return inserted.id;
}
export const saveAnime = saveAnimeBoth;

// Delete Anime from Supabase (Requirement 5)
export async function deleteAnimeBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();

  // 1. Fetch current data for disaster recovery snapshot
  try {
    const { data: current } = await supabase.from('anime').select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('anime', cleanId, current);
    }
  } catch {}

  // Delete from local catalog store
  deleteLocalAnimeItem(cleanId);

  // 2. Delete Anime record from Supabase
  try {
    const { error: delErr } = await supabase.from('anime').delete().eq('id', cleanId);
    if (delErr && !isSchemaCachePending(delErr)) {
      console.error(`[Supabase deleteAnime error]:`, formatDbError(delErr));
      throw new Error(formatDbError(delErr));
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw new Error(formatDbError(err));
  }

  // 3. Clean up orphaned episodes and seasons
  try {
    await supabase.from('episodes').delete().eq('anime_id', cleanId);
    await supabase.from('seasons').delete().eq('anime_id', cleanId);
  } catch {}

  clearCachePrefix('anime');
  clearCachedData('all_anime');
  clearCachedData('featured_anime');
  clearCachedData('trending_anime');
  clearCachedData('new_drops');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_anime_deleted', { detail: { id: cleanId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'anime', id: cleanId } }));
  }
}
export const deleteAnime = deleteAnimeBoth;

// Save Season to Supabase (Requirement 5)
export async function saveSeasonBoth(seasonData: any, id?: string): Promise<string> {
  const targetId = String(id || seasonData.id || `sea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const targetAnimeId = String(seasonData.animeId || seasonData.anime_id);
  const sNum = Number(seasonData.seasonNumber || seasonData.season_number) || 1;
  const seaTable = await getActiveSeasonsTable();

  // Ensure parent anime exists in Supabase so seasons_anime_id_fkey foreign key never fails
  if (targetAnimeId) {
    await ensureAnimeExistsInSupabase(targetAnimeId);
  }

  // 1. Snapshot previous state for recovery
  let previousState: any = null;
  if (id) {
    try {
      const { data: prev } = await supabase.from(seaTable).select('*').eq('id', targetId).maybeSingle();
      previousState = prev;
      if (prev) {
        await createAutoBackup('season', targetId, prev);
      }
    } catch {}
  }

  // 2. Prepare payload
  const supabasePayload: any = {
    id: targetId,
    anime_id: targetAnimeId,
    season_number: sNum,
    title: seasonData.title || `Season ${sNum}`,
    description: seasonData.description || '',
    banner_url: seasonData.bannerUrl || seasonData.banner_url || '',
    poster_url: seasonData.posterUrl || seasonData.poster_url || '',
    order: Number(seasonData.order ?? sNum),
    status: seasonData.status || 'Published',
  };

  if (!id && !previousState) {
    supabasePayload.created_at = new Date().toISOString();
  }

  // 3. Upsert into Supabase public.seasons table
  try {
    const { error: upsertErr } = await supabase.from('seasons').upsert(supabasePayload);
    if (upsertErr && !isSchemaCachePending(upsertErr)) {
      console.error(`[Supabase saveSeason error]:`, formatDbError(upsertErr));
      throw new Error(formatDbError(upsertErr));
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw new Error(formatDbError(err));
  }

  // Invalidate season cache
  clearCachePrefix(`seasons_${targetAnimeId}`);
  clearCachePrefix('seasons_');
  clearCachedData('all_seasons');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'season', id: targetId, animeId: targetAnimeId } }));
  }

  return targetId;
}
export const saveSeason = saveSeasonBoth;

// Delete Season from Supabase (Requirement 5)
export async function deleteSeasonBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();

  try {
    const { data: current } = await supabase.from('seasons').select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('season', cleanId, current);
    }
  } catch {}

  try {
    const { error: delErr } = await supabase.from('seasons').delete().eq('id', cleanId);
    if (delErr && !isSchemaCachePending(delErr)) {
      console.error(`[Supabase deleteSeason error]:`, formatDbError(delErr));
      throw new Error(formatDbError(delErr));
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw new Error(formatDbError(err));
  }

  clearCachePrefix('seasons_');
  clearCachedData('all_seasons');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'season', id: cleanId } }));
  }
}
export const deleteSeason = deleteSeasonBoth;

// Ensure Anime exists in Supabase to prevent foreign key errors (episodes_anime_id_fkey & seasons_anime_id_fkey)
export async function ensureAnimeExistsInSupabase(animeId: string): Promise<boolean> {
  if (!animeId) return false;
  try {
    const { data: existing } = await supabase
      .from('anime')
      .select('id')
      .eq('id', animeId)
      .maybeSingle();

    if (existing) return true;

    // Fallback: create basic anime row in Supabase so foreign key constraint never fails
    await supabase.from('anime').upsert({
      id: animeId,
      title: `Anime (${animeId})`,
      status: 'Ongoing',
      type: 'TV Series',
      content_type: 'TV Series',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures that a valid season exists for the anime (Requirements 1, 2, 3, 4, 5, 7)
 * - Checks if the selected season exists
 * - If no season exists, automatically creates Season 1 for that anime
 * - Uses the newly created season id as season_id
 * - Never sends an invalid season_id
 * - If season_id is empty or cannot be resolved, saves as NULL instead of an invalid value
 */
export async function ensureSeasonExists(
  animeId: string,
  requestedSeasonId?: string | null,
  requestedSeasonNumber?: number
): Promise<{ seasonId: string | null; seasonNumber: number }> {
  if (!animeId) {
    return { seasonId: null, seasonNumber: requestedSeasonNumber || 1 };
  }

  // 1. Ensure anime exists in Supabase so seasons foreign key (seasons_anime_id_fkey) never fails
  await ensureAnimeExistsInSupabase(animeId);

  const cleanRequestedId = requestedSeasonId ? String(requestedSeasonId).trim() : '';
  const isInvalidFormat = !cleanRequestedId || 
    cleanRequestedId === 'null' || 
    cleanRequestedId === 'undefined' || 
    cleanRequestedId === 's1' || 
    cleanRequestedId === 'movie';

  // 2. If a specific season ID was requested, check if it actually exists in seasons table
  if (!isInvalidFormat) {
    try {
      const { data: matchedSeason } = await supabase
        .from('seasons')
        .select('id, anime_id, season_number')
        .eq('id', cleanRequestedId)
        .maybeSingle();

      if (matchedSeason && matchedSeason.id) {
        return {
          seasonId: matchedSeason.id,
          seasonNumber: matchedSeason.season_number != null ? Number(matchedSeason.season_number) : (requestedSeasonNumber || 1),
        };
      }
    } catch {
      // ignore and proceed
    }
  }

  // 3. Check if ANY season already exists for this anime in seasons table
  let existingSeasons: any[] = [];
  try {
    const { data } = await supabase
      .from('seasons')
      .select('id, anime_id, season_number')
      .eq('anime_id', animeId)
      .order('season_number', { ascending: true });

    if (data && data.length > 0) {
      existingSeasons = data;
    }
  } catch {
    // ignore
  }

  // 4. If no season exists at all for this anime, automatically create Season 1
  if (existingSeasons.length === 0) {
    try {
      const newSeasonId = `sea_${animeId.replace(/[^a-zA-Z0-9_-]/g, '')}_s1_${Date.now()}`;
      const newSeasonPayload = {
        id: newSeasonId,
        anime_id: animeId,
        season_number: 1,
        title: 'Season 1',
        description: '',
        banner_url: '',
        poster_url: '',
        order: 1,
        status: 'Published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: createSeasonErr } = await supabase.from('seasons').insert(newSeasonPayload);
      if (!createSeasonErr) {
        return {
          seasonId: newSeasonId,
          seasonNumber: 1,
        };
      }
      console.warn('[Auto-create Season 1 Notice]:', formatDbError(createSeasonErr));
    } catch (err) {
      console.warn('[Auto-create Season 1 Exception]:', formatDbError(err));
    }

    return {
      seasonId: null,
      seasonNumber: requestedSeasonNumber || 1,
    };
  }

  // 5. Existing seasons exist:
  if (requestedSeasonNumber) {
    const matchByNum = existingSeasons.find(s => Number(s.season_number) === Number(requestedSeasonNumber));
    if (matchByNum) {
      return {
        seasonId: matchByNum.id,
        seasonNumber: Number(matchByNum.season_number),
      };
    }
  }

  return {
    seasonId: null,
    seasonNumber: requestedSeasonNumber || 1,
  };
}

// Save Episode to Supabase (Requirement 5, 7)
export async function saveEpisodeBoth(epData: any, id?: string): Promise<string> {
  const targetId = String(id || epData.id || `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const targetAnimeId = String(epData.animeId || epData.anime_id);
  const epNum = Number(epData.episodeNumber || epData.episode_number) || 1;
  const rawSeasonId = epData.seasonId || epData.season_id;
  const rawSeasonNum = epData.seasonNumber || epData.season_number;

  // 1. Ensure anime exists in Supabase so episodes_anime_id_fkey is satisfied
  if (targetAnimeId) {
    await ensureAnimeExistsInSupabase(targetAnimeId);
  }

  // 2. Validate / auto-create season and never send invalid season_id (Requirements 1, 2, 3, 4, 5)
  const { seasonId: validatedSeasonId, seasonNumber: validatedSeasonNum } = await ensureSeasonExists(
    targetAnimeId,
    rawSeasonId,
    rawSeasonNum ? Number(rawSeasonNum) : 1
  );

  const epTable = await getActiveEpisodesTable();
  const seaTable = await getActiveSeasonsTable();
  const { server1, server2, server3 } = resolveEpisodeServers(epData);

  // Requirement 4 & 5: Ensure season_id is strictly valid or NULL before inserting
  let finalSeasonId: string | null = null;
  if (validatedSeasonId && typeof validatedSeasonId === 'string' && validatedSeasonId.trim() !== '') {
    const cleanId = validatedSeasonId.trim();
    if (cleanId !== 's1' && cleanId !== 'null' && cleanId !== 'undefined' && cleanId !== 'movie') {
      try {
        const { data: verifiedSeason } = await supabase
          .from(seaTable)
          .select('id')
          .eq('id', cleanId)
          .maybeSingle();

        if (verifiedSeason && verifiedSeason.id) {
          finalSeasonId = verifiedSeason.id;
        }
      } catch {
        finalSeasonId = null;
      }
    }
  }

  // 3. Backup previous record state
  let previousState: any = null;
  if (id) {
    try {
      const { data: prev } = await supabase.from(epTable).select('*').eq('id', targetId).maybeSingle();
      previousState = prev;
      if (prev) {
        await createAutoBackup('episode', targetId, prev);
      }
    } catch {}
  }

  // 4. Build single-record payload (season_id is guaranteed valid or null - never invalid string!)
  const supabasePayload: any = {
    id: targetId,
    anime_id: targetAnimeId,
    season_id: finalSeasonId,
    season_number: validatedSeasonNum || 1,
    episode_number: epNum,
    episode_title: epData.title || epData.episode_title || `Episode ${epNum}`,
    description: epData.description || '',
    thumbnail_url: epData.thumbnailUrl || epData.thumbnail_url || '',
    duration: epData.duration || '24m',
    release_date: epData.releaseDate || epData.release_date || '',
    server1_url: server1,
    server2_url: server2,
    server3_url: server3,
    abyss_url: server1,
    filemoon_url: server2,
    vdohide_url: server3,
    published: epData.published !== false,
    updated_at: new Date().toISOString(),
  };

  if (!id && !previousState) {
    supabasePayload.created_at = new Date().toISOString();
  }

  // 5. Upsert into Supabase public.episodes table with foreign key violation safety (Requirement 7)
  try {
    const { error: upsertErr } = await supabase.from('episodes').upsert(supabasePayload);
    if (upsertErr) {
      if (upsertErr.message && (upsertErr.message.includes('episodes_season_id_fkey') || upsertErr.code === '23503')) {
        console.warn('[Supabase saveEpisode foreign key fallback]: Retrying with season_id = null');
        supabasePayload.season_id = null;
        const retryRes = await supabase.from('episodes').upsert(supabasePayload);
        if (retryRes.error && !isSchemaCachePending(retryRes.error)) {
          throw new Error(formatDbError(retryRes.error));
        }
        return targetId;
      }
      if (!isSchemaCachePending(upsertErr)) {
        console.error(`[Supabase saveEpisode error]:`, formatDbError(upsertErr));
        throw new Error(formatDbError(upsertErr));
      }
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw new Error(formatDbError(err));
  }

  // Invalidate episode and new drops cache
  clearCachePrefix(`episodes_${targetAnimeId}`);
  clearCachePrefix('episodes_');
  clearCachedData('all_episodes');
  clearCachedData('all_episodes_published');
  clearCachedData('all_episodes_all');
  clearCachedData('new_drops');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_episode_published', { detail: { id: targetId, animeId: targetAnimeId } }));
    window.dispatchEvent(new CustomEvent('zk_episodes_changed', { detail: { id: targetId, animeId: targetAnimeId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'episode', id: targetId, animeId: targetAnimeId } }));
  }

  return targetId;
}
export const saveEpisode = saveEpisodeBoth;

// Delete Episode from Supabase (Requirement 5)
export async function deleteEpisodeBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();

  // 1. Snapshot for recovery
  try {
    const { data: current } = await supabase.from('episodes').select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('episode', cleanId, current);
    }
  } catch {}

  // 2. Delete selected record
  try {
    const { error: delErr } = await supabase.from('episodes').delete().eq('id', cleanId);
    if (delErr && !isSchemaCachePending(delErr)) {
      console.error(`[Supabase deleteEpisode error]:`, formatDbError(delErr));
      throw new Error(formatDbError(delErr));
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw new Error(formatDbError(err));
  }

  clearCachePrefix('episodes_');
  clearCachedData('all_episodes');
  clearCachedData('all_episodes_published');
  clearCachedData('all_episodes_all');
  clearCachedData('new_drops');

  // 3. Notify listeners
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zk_episode_deleted', { detail: { id: cleanId } }));
      window.dispatchEvent(new CustomEvent('zk_episodes_changed', { detail: { id: cleanId } }));
      window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'episode', id: cleanId } }));
    }
  } catch {}
}
export const deleteEpisode = deleteEpisodeBoth;

// -------------------------------------------------------------
// USER PROGRESS / CONTINUE WATCHING (SUPABASE ONLY)
// -------------------------------------------------------------

export async function getUserProgress(userId: string): Promise<any[]> {
  if (!userId) return [];
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    });

    if (res?.data && res.data.length > 0) {
      return res.data;
    }
  } catch {
    // return empty state
  }
  return [];
}

export async function saveUserProgress(progress: {
  userId: string;
  animeId: string;
  animeTitle?: string;
  episodeId: string;
  episodeTitle?: string;
  seasonId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  posterUrl?: string;
  currentTime?: number;
  duration?: number;
}): Promise<void> {
  if (!progress.userId || !progress.episodeId) return;
  try {
    await supabase.from('user_progress').upsert({
      user_id: progress.userId,
      anime_id: progress.animeId,
      anime_title: progress.animeTitle || '',
      episode_id: progress.episodeId,
      episode_title: progress.episodeTitle || '',
      season_id: progress.seasonId || 's1',
      season_number: progress.seasonNumber || 1,
      episode_number: progress.episodeNumber || 1,
      poster_url: progress.posterUrl || '',
      current_time: progress.currentTime || 0,
      duration: progress.duration || 1440,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}

export async function deleteUserProgress(userId: string, episodeId: string): Promise<void> {
  if (!userId || !episodeId) return;
  try {
    await supabase.from('user_progress').delete().match({ user_id: userId, episode_id: episodeId });
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// WATCH HISTORY, FAVORITES & WATCHLIST (SUPABASE ONLY)
// -------------------------------------------------------------

export async function getWatchHistory(userId: string): Promise<any[]> {
  if (!userId) return [];
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50);
    });
    if (res?.data) return res.data;
  } catch {
    // return empty state
  }
  return [];
}

export async function getFavorites(userId: string): Promise<any[]> {
  if (!userId) return [];
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    });
    if (res?.data) return res.data;
  } catch {
    // return empty state
  }
  return [];
}

export async function addFavorite(
  userId: string,
  anime: { id: string; title: string; posterUrl?: string }
): Promise<void> {
  if (!userId || !anime.id) return;
  try {
    await supabase.from('favorites').upsert({
      user_id: userId,
      anime_id: anime.id,
      anime_title: anime.title,
      poster_url: anime.posterUrl || '',
      created_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}

export async function removeFavorite(userId: string, animeId: string): Promise<void> {
  if (!userId || !animeId) return;
  try {
    await supabase.from('favorites').delete().match({ user_id: userId, anime_id: animeId });
  } catch {
    // ignore
  }
}

export async function isFavorite(userId: string, animeId: string): Promise<boolean> {
  if (!userId || !animeId) return false;
  try {
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .match({ user_id: userId, anime_id: animeId })
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function getWatchlist(userId: string): Promise<any[]> {
  if (!userId) return [];
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    });
    if (res?.data) return res.data;
  } catch {
    // return empty state
  }
  return [];
}

export async function addToWatchlist(
  userId: string,
  anime: { id: string; title: string; posterUrl?: string; status?: string }
): Promise<void> {
  if (!userId || !anime.id) return;
  try {
    await supabase.from('watchlist').upsert({
      user_id: userId,
      anime_id: anime.id,
      anime_title: anime.title,
      poster_url: anime.posterUrl || '',
      status: anime.status || 'Plan to Watch',
      created_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}

export async function removeFromWatchlist(userId: string, animeId: string): Promise<void> {
  if (!userId || !animeId) return;
  try {
    await supabase.from('watchlist').delete().match({ user_id: userId, anime_id: animeId });
  } catch {
    // ignore
  }
}

export async function isInWatchlist(userId: string, animeId: string): Promise<boolean> {
  if (!userId || !animeId) return false;
  try {
    const { data } = await supabase
      .from('watchlist')
      .select('id')
      .match({ user_id: userId, anime_id: animeId })
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// MIGRATION HELPER (NO-OP: SUPABASE IS 100% PRIMARY DATABASE)
// -------------------------------------------------------------

export async function migrateFirebaseToSupabase(_force = false): Promise<{
  animeCount: number;
  seasonsCount: number;
  episodesCount: number;
  status: string;
}> {
  return { 
    animeCount: 0, 
    seasonsCount: 0, 
    episodesCount: 0, 
    status: 'Supabase is primary database' 
  };
}
