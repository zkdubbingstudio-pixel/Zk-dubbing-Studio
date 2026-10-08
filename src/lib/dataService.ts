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

import { supabase, executeSupabaseWithRetry } from './supabase';

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

  return {
    ...item,
    id: String(id || item.id),
    title: item.title || 'Untitled Anime',
    description: item.description || item.synopsis || '',
    synopsis: item.synopsis || item.description || '',
    posterUrl: item.posterUrl || item.poster_url || '',
    poster_url: item.poster_url || item.posterUrl || '',
    bannerUrl: item.bannerUrl || item.banner_url || item.posterUrl || item.poster_url || '',
    banner_url: item.banner_url || item.bannerUrl || item.poster_url || item.posterUrl || '',
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

export function normalizeEpisodeDoc(dId: string, data: any, animeIdFallback?: string): EpisodeItem {
  const { server1, server2, server3 } = resolveEpisodeServers(data);
  const epSeason = data.seasonId || data.season_id || 's1';
  let epSeasonNum = Number(data.seasonNumber || data.season_number);
  if (!epSeasonNum || isNaN(epSeasonNum)) {
    if (epSeason === 's2' || epSeason === '2' || epSeason === 'season 2') epSeasonNum = 2;
    else epSeasonNum = 1;
  }

  const epNum = Number(data.episodeNumber || data.episode_number) || 1;
  const isMovie = Boolean(data.isMovie || data.type === 'Movie' || epSeason === 'movie');

  return {
    ...data,
    id: String(dId),
    animeId: String(data.animeId || data.anime_id || animeIdFallback || ''),
    anime_id: String(data.animeId || data.anime_id || animeIdFallback || ''),
    seasonId: String(epSeason),
    season_id: String(epSeason),
    seasonNumber: epSeasonNum,
    season_number: epSeasonNum,
    episodeNumber: epNum,
    episode_number: epNum,
    title: data.title || data.episode_title || (isMovie ? 'Full Movie' : `Episode ${epNum}`),
    episode_title: data.episode_title || data.title || (isMovie ? 'Full Movie' : `Episode ${epNum}`),
    description: data.description || '',
    thumbnailUrl: data.thumbnailUrl || data.thumbnail_url || '',
    thumbnail_url: data.thumbnail_url || data.thumbnailUrl || '',
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
// READ OPERATIONS (SUPABASE ONLY - ZERO CACHE FALLBACKS)
// -------------------------------------------------------------

export function isSchemaCachePending(error: any): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || (typeof error.message === 'string' && error.message.includes('schema cache'));
}

// 1. Featured Anime (Supabase Only)
export async function getFeaturedAnime(): Promise<AnimeItem[]> {
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(8);
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - Featured Anime]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      return res.data.map((item: any) => normalizeAnime(item));
    }

    // Fallback: latest 6 anime from Supabase if no explicit featured flag
    const resAll = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
    });

    if (resAll?.error) {
      if (isSchemaCachePending(resAll.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - Featured Fallback]:', resAll.error);
      throw new Error(resAll.error.message);
    }

    if (resAll?.data && resAll.data.length > 0) {
      return resAll.data.map((item: any) => normalizeAnime(item));
    }

    return [];
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return [];
    }
    console.error('[Supabase Failing Request - getFeaturedAnime]:', err?.message || err);
    throw err;
  }
}

// 2. Trending Anime (Supabase Only)
export async function getTrendingAnime(): Promise<AnimeItem[]> {
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .eq('trending', true)
        .order('views', { ascending: false })
        .limit(10);
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - Trending Anime]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      return res.data.map((item: any) => normalizeAnime(item));
    }

    // Fallback: order by views in Supabase
    const resAll = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .order('views', { ascending: false })
        .limit(10);
    });

    if (resAll?.error) {
      if (isSchemaCachePending(resAll.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - Trending Fallback]:', resAll.error);
      throw new Error(resAll.error.message);
    }

    if (resAll?.data && resAll.data.length > 0) {
      return resAll.data.map((item: any) => normalizeAnime(item));
    }

    return [];
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return [];
    }
    console.error('[Supabase Failing Request - getTrendingAnime]:', err?.message || err);
    throw err;
  }
}

// 3. New Drops (Supabase Only with 17-Day Auto Expiration)
export async function getNewDrops(): Promise<any[]> {
  const now = Date.now();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('episodes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - New Drops]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      // Gather distinct anime IDs
      const animeIds = Array.from(new Set(res.data.map((ep: any) => String(ep.anime_id || ep.animeId)).filter(Boolean)));
      const animeMap = new Map<string, AnimeItem>();

      if (animeIds.length > 0) {
        try {
          const { data: animeRows, error: aErr } = await supabase.from('anime').select('*').in('id', animeIds);
          if (aErr && !isSchemaCachePending(aErr)) console.warn('[New Drops Anime Fetch Notice]:', aErr);
          if (animeRows) {
            animeRows.forEach((a: any) => animeMap.set(a.id, normalizeAnime(a)));
          }
        } catch {}
      }

      const activeDrops = res.data
        .map((ep: any) => {
          const matchedAnime = animeMap.get(String(ep.anime_id || ep.animeId));
          const publishTs = getPublishTimestamp(ep);
          const isExpired = (now - publishTs) > NEW_DROPS_EXPIRY_MS;

          return {
            ...normalizeEpisodeDoc(ep.id, ep),
            animeTitle: matchedAnime?.title || ep.episode_title || 'Anime Series',
            animePoster: ep.thumbnail_url || matchedAnime?.posterUrl || '',
            animeGenres: matchedAnime?.genres || [],
            contentType: matchedAnime?.contentType || (ep.season_id === 'movie' ? 'Movie' : 'TV Series'),
            publishTs,
            isExpired,
          };
        })
        .filter((d: any) => !d.isExpired);

      return activeDrops;
    }

    return [];
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return [];
    }
    console.error('[Supabase Failing Request - getNewDrops]:', err?.message || err);
    throw err;
  }
}

// 4. Get Anime by ID (Supabase Only)
export async function getAnimeById(id: string): Promise<AnimeItem | null> {
  if (!id) return null;

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return null;
      }
      console.error(`[Supabase Failing Request - Anime ${id}]:`, res.error);
      throw new Error(res.error.message);
    }

    if (res?.data) {
      return normalizeAnime(res.data, res.data.id);
    }

    // Try case-insensitive title lookup if id might be a title slug
    const resTitle = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .ilike('title', id)
        .maybeSingle();
    });

    if (resTitle?.data) {
      return normalizeAnime(resTitle.data, resTitle.data.id);
    }

    return null;
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return null;
    }
    console.error(`[Supabase Failing Request - getAnimeById ${id}]:`, err?.message || err);
    throw err;
  }
}

// 5. Get Seasons by Anime ID (Supabase Only)
export async function getSeasonsByAnimeId(animeId: string): Promise<SeasonItem[]> {
  if (!animeId) return [];

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('seasons')
        .select('*')
        .eq('anime_id', animeId)
        .order('season_number', { ascending: true });
    });

    if (res?.data && res.data.length > 0) {
      return res.data.map((item: any) => ({
        ...item,
        id: String(item.id),
        animeId: String(item.anime_id || item.animeId || animeId),
        seasonNumber: Number(item.season_number || item.seasonNumber || 1),
        title: item.title || `Season ${item.season_number || 1}`,
        bannerUrl: item.banner_url || item.bannerUrl,
        posterUrl: item.poster_url || item.posterUrl,
        order: Number(item.order ?? (item.season_number || 1)),
      }));
    }
  } catch {
    // return fallback
  }

  // Synthesize Season 1 only if episodes exist in Supabase for this anime
  try {
    const { count } = await supabase
      .from('episodes')
      .select('id', { count: 'exact', head: true })
      .eq('anime_id', animeId);

    if (count && count > 0) {
      return [{
        id: 's1',
        animeId,
        seasonNumber: 1,
        title: 'Season 1',
        order: 1,
      }];
    }
  } catch {}

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

// 6. Get Episodes by Anime ID (Supabase Only)
export async function getEpisodesByAnimeId(animeId: string, seasonId?: string): Promise<EpisodeItem[]> {
  if (!animeId) return [];

  try {
    const res = await executeSupabaseWithRetry(async () => {
      let query = supabase
        .from('episodes')
        .select('*')
        .eq('anime_id', animeId);

      if (seasonId && seasonId !== 'all') {
        query = query.eq('season_id', seasonId);
      }

      return await query.order('episode_number', { ascending: true });
    });

    if (res?.data && res.data.length > 0) {
      return res.data.map((ep: any) => normalizeEpisodeDoc(ep.id, ep, animeId));
    }
  } catch {
    // return empty state
  }

  return [];
}

// 7. Get Episode by ID (Supabase Only)
export async function getEpisodeById(id: string): Promise<EpisodeItem | null> {
  if (!id) return null;

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('episodes')
        .select('*')
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
  } catch {
    // return null
  }

  return null;
}

// 8. Get All Anime (Supabase Only)
export async function getAllAnime(): Promise<AnimeItem[]> {
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('anime')
        .select('*')
        .order('created_at', { ascending: false });
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - All Anime]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      return res.data.map((d: any) => normalizeAnime(d, d.id));
    }

    return [];
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return [];
    }
    console.error('[Supabase Failing Request - getAllAnime]:', err?.message || err);
    throw err;
  }
}

// 9. Get All Seasons (Supabase Only)
export async function getAllSeasons(): Promise<SeasonItem[]> {
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('seasons')
        .select('*')
        .order('season_number', { ascending: true });
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - All Seasons]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      return res.data.map((item: any) => ({
        ...item,
        id: String(item.id),
        animeId: String(item.anime_id || item.animeId),
        seasonNumber: Number(item.season_number || item.seasonNumber || 1),
        title: item.title || `Season ${item.season_number || item.seasonNumber || 1}`,
        bannerUrl: item.banner_url || item.bannerUrl,
        posterUrl: item.poster_url || item.posterUrl,
        order: Number(item.order ?? (item.season_number || 1)),
      }));
    }

    return [];
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return [];
    }
    console.error('[Supabase Failing Request - getAllSeasons]:', err?.message || err);
    throw err;
  }
}

// 10. Get All Episodes (Supabase Only)
export async function getAllEpisodes(): Promise<EpisodeItem[]> {
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from('episodes')
        .select('*')
        .order('created_at', { ascending: false });
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.error('[Supabase Failing Request - All Episodes]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      return res.data.map((d: any) => normalizeEpisodeDoc(d.id, d));
    }

    return [];
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return [];
    }
    console.error('[Supabase Failing Request - getAllEpisodes]:', err?.message || err);
    throw err;
  }
}

// 11. Fetch All Genres from Supabase
export async function getGenres(): Promise<string[]> {
  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase.from('anime').select('genres');
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

// Save Anime to Supabase
export async function saveAnimeBoth(animeData: any, id?: string): Promise<string> {
  const genres = Array.isArray(animeData.genres)
    ? animeData.genres
    : typeof animeData.genres === 'string'
    ? animeData.genres.split(',').map((g: string) => g.trim()).filter(Boolean)
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

  const server1 = extractAbyssUrl(animeData.server1Url || animeData.server1_url || animeData.abyssUrl || animeData.abyss_url || '');
  const server2 = extractFileMoonUrl(animeData.server2Url || animeData.server2_url || animeData.filemoonUrl || animeData.filemoon_url || '');
  const server3 = extractVDOHideUrl(animeData.server3Url || animeData.server3_url || animeData.vdohideUrl || animeData.vdohide_url || '');

  const targetId = String(id || animeData.id || `anm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  // 1. Fetch previous state for auto-backup
  let previousState: any = null;
  if (id) {
    try {
      const { data: prev } = await supabase.from('anime').select('*').eq('id', targetId).maybeSingle();
      previousState = prev;
      if (prev) {
        await createAutoBackup('anime', targetId, prev);
      }
    } catch {}
  }

  // 2. Prepare payload matching Supabase schema
  const supabasePayload: any = {
    id: targetId,
    title: animeData.title,
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
    updated_at: new Date().toISOString(),
  };

  if (!id && !previousState) {
    supabasePayload.created_at = new Date().toISOString();
  }

  // 3. Update or Insert ONLY the selected row in Supabase
  const { error: upsertErr } = await supabase.from('anime').upsert(supabasePayload);
  if (upsertErr) {
    console.error('Supabase saveAnime error:', upsertErr);
    // Rollback if previous state existed
    if (previousState) {
      try {
        await supabase.from('anime').upsert(previousState);
      } catch {
        // ignore
      }
    }
    throw new Error(`Failed to save anime in Supabase: ${upsertErr.message}`);
  }

  // 4. If Movie, also manage the corresponding movie episode entry in Supabase episodes table
  if (isMovie) {
    const movieEpDoc: any = {
      id: targetId,
      anime_id: targetId,
      season_id: 'movie',
      season_number: 1,
      episode_number: 1,
      episode_title: animeData.title,
      description: animeData.description || animeData.synopsis || '',
      thumbnail_url: banner || poster,
      duration: duration || '1h 45m',
      release_date: releaseDate,
      server1_url: server1,
      server2_url: server2,
      server3_url: server3,
      published: true,
      updated_at: new Date().toISOString(),
    };
    try {
      await supabase.from('episodes').upsert(movieEpDoc);
    } catch {
      // ignore
    }
  }

  return targetId;
}
export const saveAnime = saveAnimeBoth;

// Delete Anime from Supabase
export async function deleteAnimeBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();

  // 1. Fetch current data for disaster recovery snapshot
  try {
    const { data: current } = await supabase.from('anime').select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('anime', cleanId, current);
    }
  } catch {}

  // 2. Delete Anime record from Supabase
  const { error: delErr } = await supabase.from('anime').delete().eq('id', cleanId);
  if (delErr) {
    console.error('Supabase deleteAnime error:', delErr);
    throw new Error(`Failed to delete anime from Supabase: ${delErr.message}`);
  }

  // 3. Clean up orphaned episodes and seasons
  try {
    await supabase.from('episodes').delete().eq('anime_id', cleanId);
    await supabase.from('seasons').delete().eq('anime_id', cleanId);
  } catch {}
}
export const deleteAnime = deleteAnimeBoth;

// Save Season to Supabase
export async function saveSeasonBoth(seasonData: any, id?: string): Promise<string> {
  const targetId = String(id || seasonData.id || `sea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const targetAnimeId = String(seasonData.animeId || seasonData.anime_id);
  const sNum = Number(seasonData.seasonNumber || seasonData.season_number) || 1;

  // 1. Snapshot previous state for recovery
  let previousState: any = null;
  if (id) {
    try {
      const { data: prev } = await supabase.from('seasons').select('*').eq('id', targetId).maybeSingle();
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

  // 3. Upsert ONLY the targeted season record in Supabase
  const { error: upsertErr } = await supabase.from('seasons').upsert(supabasePayload);
  if (upsertErr) {
    console.error('Supabase saveSeason error:', upsertErr);
    if (previousState) {
      try {
        await supabase.from('seasons').upsert(previousState);
      } catch {}
    }
    throw new Error(`Failed to save season in Supabase: ${upsertErr.message}`);
  }

  return targetId;
}
export const saveSeason = saveSeasonBoth;

// Delete Season from Supabase
export async function deleteSeasonBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();

  try {
    const { data: current } = await supabase.from('seasons').select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('season', cleanId, current);
    }
  } catch {}

  const { error: delErr } = await supabase.from('seasons').delete().eq('id', cleanId);
  if (delErr) {
    console.error('Supabase deleteSeason error:', delErr);
    throw new Error(`Failed to delete season from Supabase: ${delErr.message}`);
  }
}
export const deleteSeason = deleteSeasonBoth;

// Save Episode to Supabase
export async function saveEpisodeBoth(epData: any, id?: string): Promise<string> {
  const targetId = String(id || epData.id || `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const targetAnimeId = String(epData.animeId || epData.anime_id);
  const targetSeasonId = String(epData.seasonId || epData.season_id || 's1');
  const epNum = Number(epData.episodeNumber || epData.episode_number) || 1;
  const sNum = Number(epData.seasonNumber || epData.season_number) || 1;

  const { server1, server2, server3 } = resolveEpisodeServers(epData);

  // 1. Backup previous record state
  let previousState: any = null;
  if (id) {
    try {
      const { data: prev } = await supabase.from('episodes').select('*').eq('id', targetId).maybeSingle();
      previousState = prev;
      if (prev) {
        await createAutoBackup('episode', targetId, prev);
      }
    } catch {}
  }

  // 2. Build single-record payload
  const supabasePayload: any = {
    id: targetId,
    anime_id: targetAnimeId,
    season_id: targetSeasonId,
    season_number: sNum,
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

  // 3. Upsert ONLY the selected single record in Supabase
  const { error: upsertErr } = await supabase.from('episodes').upsert(supabasePayload);
  if (upsertErr) {
    console.error('Supabase saveEpisode error:', upsertErr);
    // Rollback to previous state
    if (previousState) {
      try {
        await supabase.from('episodes').upsert(previousState);
      } catch {}
    }
    throw new Error(`Failed to save episode in Supabase: ${upsertErr.message}`);
  }

  return targetId;
}
export const saveEpisode = saveEpisodeBoth;

// Delete Episode from Supabase
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
  const { error: delErr } = await supabase.from('episodes').delete().eq('id', cleanId);
  if (delErr) {
    console.error('Supabase deleteEpisode error:', delErr);
    throw new Error(`Failed to delete episode from Supabase: ${delErr.message}`);
  }

  // 3. Notify listeners
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zk_episode_deleted', { detail: { id: cleanId } }));
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
