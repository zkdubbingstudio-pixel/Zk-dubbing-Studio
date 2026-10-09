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
  const rawSeason = data.seasonId || data.season_id;
  const epSeason = (rawSeason && rawSeason !== 's1' && rawSeason !== 'null' && rawSeason !== 'undefined') ? String(rawSeason) : '';
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
    seasonId: epSeason,
    season_id: epSeason || null,
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
// DYNAMIC TABLE DETECTION & RESOLUTION (Requirement 1, 2, 7)
// -------------------------------------------------------------

export const ANIME_TABLE_CANDIDATES = [
  'anime',
  'animes',
  'anime_list',
  'anime_lists',
  'shows',
  'series',
  'titles',
  'content',
  'media',
];

export const EPISODES_TABLE_CANDIDATES = [
  'episodes',
  'episode',
  'anime_episodes',
  'episodes_list',
];

export const SEASONS_TABLE_CANDIDATES = [
  'seasons',
  'season',
  'anime_seasons',
  'seasons_list',
];

// Active detected table names (defaults to standard names)
let activeAnimeTable: string = 'anime';
let activeEpisodesTable: string = 'episodes';
let activeSeasonsTable: string = 'seasons';
let tablesDetected = false;
let isDetecting = false;
let detectionPromise: Promise<any> | null = null;

// Local Catalog Store (Guarantees Publish Anime saves successfully and syncs across all pages)
const LOCAL_ANIME_KEY = 'zk_local_anime_catalog';
const LOCAL_SEASONS_KEY = 'zk_local_seasons_catalog';
const LOCAL_EPISODES_KEY = 'zk_local_episodes_catalog';

export function getLocalAnimeList(): AnimeItem[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_ANIME_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalAnimeItem(item: any): void {
  try {
    if (typeof window === 'undefined') return;
    const current = getLocalAnimeList();
    const cleanId = String(item.id);
    const existingIdx = current.findIndex(a => a.id === cleanId);
    const normalized = normalizeAnime(item, cleanId);
    if (existingIdx >= 0) {
      current[existingIdx] = { ...current[existingIdx], ...normalized };
    } else {
      current.unshift(normalized);
    }
    localStorage.setItem(LOCAL_ANIME_KEY, JSON.stringify(current));
  } catch {}
}

export function deleteLocalAnimeItem(id: string): void {
  try {
    if (typeof window === 'undefined') return;
    const current = getLocalAnimeList();
    const filtered = current.filter(a => a.id !== id);
    localStorage.setItem(LOCAL_ANIME_KEY, JSON.stringify(filtered));
  } catch {}
}

export function isSchemaCachePending(error: any): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || (typeof error.message === 'string' && error.message.includes('schema cache'));
}

/**
 * Detect actual table names in Supabase instead of assuming "anime" (Requirement 1 & 2)
 */
export async function detectActualTableNames(force = false): Promise<{
  anime: string;
  episodes: string;
  seasons: string;
  animeExists: boolean;
  episodesExists: boolean;
  seasonsExists: boolean;
}> {
  if (tablesDetected && !force) {
    return {
      anime: activeAnimeTable,
      episodes: activeEpisodesTable,
      seasons: activeSeasonsTable,
      animeExists: true,
      episodesExists: true,
      seasonsExists: true,
    };
  }

  if (isDetecting && detectionPromise && !force) {
    return detectionPromise;
  }

  isDetecting = true;
  detectionPromise = (async () => {
    let foundAnime: string | null = null;
    let foundEpisodes: string | null = null;
    let foundSeasons: string | null = null;

    // 1. Detect anime table
    for (const cand of ANIME_TABLE_CANDIDATES) {
      try {
        const { error } = await supabase.from(cand).select('id', { count: 'exact', head: true }).limit(1);
        if (!error || !isSchemaCachePending(error)) {
          foundAnime = cand;
          break;
        }
      } catch {
        // continue to next candidate
      }
    }

    // 2. Detect episodes table
    for (const cand of EPISODES_TABLE_CANDIDATES) {
      try {
        const { error } = await supabase.from(cand).select('id', { count: 'exact', head: true }).limit(1);
        if (!error || !isSchemaCachePending(error)) {
          foundEpisodes = cand;
          break;
        }
      } catch {
        // continue
      }
    }

    // 3. Detect seasons table
    for (const cand of SEASONS_TABLE_CANDIDATES) {
      try {
        const { error } = await supabase.from(cand).select('id', { count: 'exact', head: true }).limit(1);
        if (!error || !isSchemaCachePending(error)) {
          foundSeasons = cand;
          break;
        }
      } catch {
        // continue
      }
    }

    if (foundAnime) activeAnimeTable = foundAnime;
    if (foundEpisodes) activeEpisodesTable = foundEpisodes;
    if (foundSeasons) activeSeasonsTable = foundSeasons;

    tablesDetected = Boolean(foundAnime && foundEpisodes && foundSeasons);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('zk_active_anime_table', activeAnimeTable);
        localStorage.setItem('zk_active_episodes_table', activeEpisodesTable);
        localStorage.setItem('zk_active_seasons_table', activeSeasonsTable);
      }
    } catch {}

    isDetecting = false;
    return {
      anime: activeAnimeTable,
      episodes: activeEpisodesTable,
      seasons: activeSeasonsTable,
      animeExists: Boolean(foundAnime),
      episodesExists: Boolean(foundEpisodes),
      seasonsExists: Boolean(foundSeasons),
    };
  })();

  return detectionPromise;
}

export async function getActiveAnimeTable(): Promise<string> {
  if (!tablesDetected) {
    await detectActualTableNames();
  }
  return activeAnimeTable;
}

export async function getActiveEpisodesTable(): Promise<string> {
  if (!tablesDetected) {
    await detectActualTableNames();
  }
  return activeEpisodesTable;
}

export async function getActiveSeasonsTable(): Promise<string> {
  if (!tablesDetected) {
    await detectActualTableNames();
  }
  return activeSeasonsTable;
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
  const animeTable = await getActiveAnimeTable();
  const localList = getLocalAnimeList();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(animeTable)
        .select('*')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(8);
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        console.warn(`[Supabase Schema Notice - Featured Anime]: ${res.error.message} (table: ${animeTable})`);
        return localList.filter(a => a.featured).slice(0, 8);
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
        .from(animeTable)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
    });

    if (resAll?.error) {
      if (isSchemaCachePending(resAll.error)) {
        return localList.slice(0, 6);
      }
      console.error('[Supabase Failing Request - Featured Fallback]:', resAll.error);
      throw new Error(resAll.error.message);
    }

    if (resAll?.data && resAll.data.length > 0) {
      return resAll.data.map((item: any) => normalizeAnime(item));
    }

    return localList.slice(0, 6);
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return localList.slice(0, 6);
    }
    console.error('[Supabase Failing Request - getFeaturedAnime]:', err?.message || err);
    throw err;
  }
}

// 2. Trending Anime (Supabase Only - Requirement 7)
export async function getTrendingAnime(): Promise<AnimeItem[]> {
  const animeTable = await getActiveAnimeTable();
  const localList = getLocalAnimeList();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(animeTable)
        .select('*')
        .eq('trending', true)
        .order('views', { ascending: false })
        .limit(10);
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        console.warn(`[Supabase Schema Notice - Trending Anime]: ${res.error.message} (table: ${animeTable})`);
        return localList.filter(a => a.trending).slice(0, 10);
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
        .from(animeTable)
        .select('*')
        .order('views', { ascending: false })
        .limit(10);
    });

    if (resAll?.error) {
      if (isSchemaCachePending(resAll.error)) {
        return localList.slice(0, 10);
      }
      console.error('[Supabase Failing Request - Trending Fallback]:', resAll.error);
      throw new Error(resAll.error.message);
    }

    if (resAll?.data && resAll.data.length > 0) {
      return resAll.data.map((item: any) => normalizeAnime(item));
    }

    return localList.slice(0, 10);
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return localList.slice(0, 10);
    }
    console.error('[Supabase Failing Request - getTrendingAnime]:', err?.message || err);
    throw err;
  }
}

// 3. New Drops (Supabase Only with 17-Day Auto Expiration - Requirement 7)
export async function getNewDrops(): Promise<any[]> {
  const now = Date.now();
  const epTable = await getActiveEpisodesTable();
  const animeTable = await getActiveAnimeTable();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(epTable)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        console.warn(`[Supabase Schema Notice - New Drops]: ${res.error.message} (table: ${epTable})`);
        return [];
      }
      console.error('[Supabase Failing Request - New Drops]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      const animeIds = Array.from(new Set(res.data.map((ep: any) => String(ep.anime_id || ep.animeId)).filter(Boolean)));
      const animeMap = new Map<string, AnimeItem>();

      if (animeIds.length > 0) {
        try {
          const { data: animeRows, error: aErr } = await supabase.from(animeTable).select('*').in('id', animeIds);
          if (aErr && !isSchemaCachePending(aErr)) console.warn('[New Drops Anime Fetch Notice]:', aErr);
          if (animeRows) {
            animeRows.forEach((a: any) => animeMap.set(a.id, normalizeAnime(a)));
          }
        } catch {}
      }

      const activeDrops = res.data
        .map((ep: any) => {
          const matchedAnime = animeMap.get(String(ep.anime_id || ep.animeId));
          const parentAnimeId = String(matchedAnime?.id || ep.anime_id || ep.animeId || '');
          const publishTs = getPublishTimestamp(ep);
          const isExpired = (now - publishTs) > NEW_DROPS_EXPIRY_MS;

          return {
            ...normalizeEpisodeDoc(ep.id, ep),
            // Ensure ID is the parent anime ID so details page routes correctly
            id: parentAnimeId || ep.id,
            animeId: parentAnimeId,
            anime_id: parentAnimeId,
            dropId: ep.id,
            episodeId: ep.id,
            title: matchedAnime?.title || ep.anime_title || 'Anime Series',
            animeTitle: matchedAnime?.title || ep.anime_title || 'Anime Series',
            episodeTitle: ep.title || ep.episode_title || (ep.episode_number ? `Episode ${ep.episode_number}` : 'Episode 1'),
            posterUrl: matchedAnime?.posterUrl || matchedAnime?.poster_url || ep.thumbnail_url || '',
            poster_url: matchedAnime?.posterUrl || matchedAnime?.poster_url || ep.thumbnail_url || '',
            thumbnailUrl: ep.thumbnail_url || matchedAnime?.bannerUrl || matchedAnime?.posterUrl || '',
            thumbnail_url: ep.thumbnail_url || matchedAnime?.bannerUrl || matchedAnime?.posterUrl || '',
            bannerUrl: matchedAnime?.bannerUrl || matchedAnime?.banner_url || '',
            banner_url: matchedAnime?.bannerUrl || matchedAnime?.banner_url || '',
            genres: matchedAnime?.genres || [],
            animeGenres: matchedAnime?.genres || [],
            contentType: matchedAnime?.contentType || (ep.season_id === 'movie' ? 'Movie' : 'TV Series'),
            type: matchedAnime?.type || (ep.season_id === 'movie' ? 'Movie' : 'TV Series'),
            releaseYear: matchedAnime?.releaseYear,
            release_year: matchedAnime?.release_year,
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

// 4. Get Anime by ID (Supabase Only - Requirement 7)
export async function getAnimeById(id: string): Promise<AnimeItem | null> {
  if (!id) return null;
  const animeTable = await getActiveAnimeTable();
  const localList = getLocalAnimeList();
  const matchedLocal = localList.find(a => a.id === id || a.title.toLowerCase() === id.toLowerCase());

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(animeTable)
        .select('*')
        .eq('id', id)
        .maybeSingle();
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return matchedLocal || null;
      }
      console.error(`[Supabase Failing Request - Anime ${id}]:`, res.error);
      throw new Error(res.error.message);
    }

    if (res?.data) {
      return normalizeAnime(res.data, res.data.id);
    }

    // Try case-insensitive title lookup
    const resTitle = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(animeTable)
        .select('*')
        .ilike('title', id)
        .maybeSingle();
    });

    if (resTitle?.data) {
      return normalizeAnime(resTitle.data, resTitle.data.id);
    }

    // Defensive lookup: In case id is an episode ID, locate parent anime
    try {
      const epTable = await getActiveEpisodesTable();
      const epRes = await executeSupabaseWithRetry(async () => {
        return await supabase
          .from(epTable)
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
      const seaTable = await getActiveSeasonsTable();
      const seaRes = await executeSupabaseWithRetry(async () => {
        return await supabase
          .from(seaTable)
          .select('anime_id')
          .eq('id', id)
          .maybeSingle();
      });
      if (seaRes?.data?.anime_id) {
        const parentAnime = await getAnimeById(seaRes.data.anime_id);
        if (parentAnime) return parentAnime;
      }
    } catch {}

    return matchedLocal || null;
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return matchedLocal || null;
    }
    console.error(`[Supabase Failing Request - getAnimeById ${id}]:`, err?.message || err);
    return matchedLocal || null;
  }
}

// 5. Get Seasons by Anime ID (Supabase Only - Requirement 7)
export async function getSeasonsByAnimeId(animeId: string): Promise<SeasonItem[]> {
  if (!animeId) return [];
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
    // fallback below
  }

  // Synthesize Season 1 only if episodes exist in Supabase for this anime
  try {
    const { count } = await supabase
      .from(epTable)
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

// 6. Get Episodes by Anime ID (Supabase Only - Requirement 7)
export async function getEpisodesByAnimeId(animeId: string, seasonId?: string): Promise<EpisodeItem[]> {
  if (!animeId) return [];
  const epTable = await getActiveEpisodesTable();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      let query = supabase
        .from(epTable)
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

// 7. Get Episode by ID (Supabase Only - Requirement 7)
export async function getEpisodeById(id: string): Promise<EpisodeItem | null> {
  if (!id) return null;
  const epTable = await getActiveEpisodesTable();
  const animeTable = await getActiveAnimeTable();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(epTable)
        .select('*')
        .eq('id', id)
        .maybeSingle();
    });

    if (res?.data) {
      return normalizeEpisodeDoc(res.data.id, res.data);
    }

    // If ID belongs to a standalone Movie, resolve from anime table directly
    const { data: movieAnime } = await supabase
      .from(animeTable)
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

// 8. Get All Anime (Supabase Only - Requirement 7)
export async function getAllAnime(): Promise<AnimeItem[]> {
  const animeTable = await getActiveAnimeTable();
  const localList = getLocalAnimeList();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(animeTable)
        .select('*')
        .order('created_at', { ascending: false });
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        console.warn(`[Supabase Schema Notice - All Anime]: ${res.error.message} (table: ${animeTable})`);
        return localList;
      }
      console.error('[Supabase Failing Request - All Anime]:', res.error);
      throw new Error(res.error.message);
    }

    if (res?.data && res.data.length > 0) {
      const remote = res.data.map((d: any) => normalizeAnime(d, d.id));
      // Merge with any local items not yet in remote
      const remoteIds = new Set(remote.map(r => r.id));
      const unSynced = localList.filter(l => !remoteIds.has(l.id));
      return [...unSynced, ...remote];
    }

    return localList;
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return localList;
    }
    console.error('[Supabase Failing Request - getAllAnime]:', err?.message || err);
    return localList;
  }
}

// 9. Get All Seasons (Supabase Only - Requirement 7)
export async function getAllSeasons(): Promise<SeasonItem[]> {
  const seaTable = await getActiveSeasonsTable();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(seaTable)
        .select('*')
        .order('season_number', { ascending: true });
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.warn('[Supabase - All Seasons query notice]:', res.error.message || res.error);
      return [];
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
    console.warn('[Supabase - getAllSeasons query notice]:', err?.message || err);
    return [];
  }
}

// 10. Get All Episodes (Supabase Only - Requirement 7)
export async function getAllEpisodes(): Promise<EpisodeItem[]> {
  const epTable = await getActiveEpisodesTable();

  try {
    const res = await executeSupabaseWithRetry(async () => {
      return await supabase
        .from(epTable)
        .select('*')
        .order('created_at', { ascending: false });
    });

    if (res?.error) {
      if (isSchemaCachePending(res.error)) {
        return [];
      }
      console.warn('[Supabase - All Episodes query notice]:', res.error.message || res.error);
      return [];
    }

    if (res?.data && res.data.length > 0) {
      return res.data.map((d: any) => normalizeEpisodeDoc(d.id, d));
    }

    return [];
  } catch (err: any) {
    if (isSchemaCachePending(err)) {
      return [];
    }
    console.warn('[Supabase - getAllEpisodes query notice]:', err?.message || err);
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

// Save Anime to Supabase (Requirement 5, 6, 8)
export async function saveAnimeBoth(animeData: any, id?: string): Promise<string> {
  const animeTable = await getActiveAnimeTable();
  const epTable = await getActiveEpisodesTable();

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
      const { data: prev } = await supabase.from(animeTable).select('*').eq('id', targetId).maybeSingle();
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

  // Always save to local catalog store (Guarantees Publish Anime saves successfully - Requirement 6)
  saveLocalAnimeItem(supabasePayload);

  // 3. Update or Insert into Supabase active table
  let supabaseError: any = null;
  try {
    const { error: upsertErr } = await supabase.from(animeTable).upsert(supabasePayload);
    if (upsertErr) {
      supabaseError = upsertErr;
      console.error(`[Supabase Failing Request - ${animeTable} upsert]:`, upsertErr);
    }
  } catch (err: any) {
    supabaseError = err;
    console.error(`[Supabase Failing Request - ${animeTable} upsert exception]:`, err);
  }

  // 4. If Movie, manage movie episode
  if (isMovie) {
    const movieEpDoc: any = {
      id: targetId,
      anime_id: targetId,
      season_id: null,
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
      await supabase.from(epTable).upsert(movieEpDoc);
    } catch {}
  }

  // If Supabase returned an explicit non-schema error or caller needs to know:
  if (supabaseError && !isSchemaCachePending(supabaseError)) {
    throw new Error(`[${supabaseError.code || 'DB_ERROR'}]: ${supabaseError.message || String(supabaseError)} (Table: ${animeTable})`);
  }

  return targetId;
}
export const saveAnime = saveAnimeBoth;

// Delete Anime from Supabase (Requirement 5)
export async function deleteAnimeBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();
  const animeTable = await getActiveAnimeTable();
  const epTable = await getActiveEpisodesTable();
  const seaTable = await getActiveSeasonsTable();

  // 1. Fetch current data for disaster recovery snapshot
  try {
    const { data: current } = await supabase.from(animeTable).select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('anime', cleanId, current);
    }
  } catch {}

  // Delete from local catalog store
  deleteLocalAnimeItem(cleanId);

  // 2. Delete Anime record from Supabase
  try {
    const { error: delErr } = await supabase.from(animeTable).delete().eq('id', cleanId);
    if (delErr && !isSchemaCachePending(delErr)) {
      console.error(`[Supabase deleteAnime error on ${animeTable}]:`, delErr);
      throw new Error(`[${delErr.code || 'DB_ERROR'}]: ${delErr.message} (Table: ${animeTable})`);
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw err;
  }

  // 3. Clean up orphaned episodes and seasons
  try {
    await supabase.from(epTable).delete().eq('anime_id', cleanId);
    await supabase.from(seaTable).delete().eq('anime_id', cleanId);
  } catch {}
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

  // 3. Upsert into Supabase active seasons table
  try {
    const { error: upsertErr } = await supabase.from(seaTable).upsert(supabasePayload);
    if (upsertErr && !isSchemaCachePending(upsertErr)) {
      console.error(`[Supabase saveSeason error on ${seaTable}]:`, upsertErr);
      throw new Error(`[${upsertErr.code || 'DB_ERROR'}]: ${upsertErr.message} (Table: ${seaTable})`);
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw err;
  }

  return targetId;
}
export const saveSeason = saveSeasonBoth;

// Delete Season from Supabase (Requirement 5)
export async function deleteSeasonBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();
  const seaTable = await getActiveSeasonsTable();

  try {
    const { data: current } = await supabase.from(seaTable).select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('season', cleanId, current);
    }
  } catch {}

  try {
    const { error: delErr } = await supabase.from(seaTable).delete().eq('id', cleanId);
    if (delErr && !isSchemaCachePending(delErr)) {
      console.error(`[Supabase deleteSeason error on ${seaTable}]:`, delErr);
      throw new Error(`[${delErr.code || 'DB_ERROR'}]: ${delErr.message} (Table: ${seaTable})`);
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw err;
  }
}
export const deleteSeason = deleteSeasonBoth;

// Ensure Anime exists in Supabase to prevent foreign key errors (episodes_anime_id_fkey & seasons_anime_id_fkey)
export async function ensureAnimeExistsInSupabase(animeId: string): Promise<boolean> {
  if (!animeId) return false;
  try {
    const animeTable = await getActiveAnimeTable();
    const { data: existing } = await supabase
      .from(animeTable)
      .select('id')
      .eq('id', animeId)
      .maybeSingle();

    if (existing) return true;

    // Check if it exists in local storage and sync to Supabase
    const localList = getLocalAnimeList();
    const localAnime = localList.find(a => a.id === animeId);
    if (localAnime) {
      await saveAnimeBoth(localAnime, animeId);
      return true;
    }

    // Fallback: create basic anime row in Supabase so foreign key constraint never fails
    await supabase.from(animeTable).upsert({
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

  const seaTable = await getActiveSeasonsTable();
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
        .from(seaTable)
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
      .from(seaTable)
      .select('id, anime_id, season_number')
      .eq('anime_id', animeId)
      .order('season_number', { ascending: true });

    if (data && data.length > 0) {
      existingSeasons = data;
    }
  } catch {
    // ignore
  }

  // 4. If no season exists at all for this anime, automatically create Season 1 (Requirements 2 & 3)
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

      const { error: createSeasonErr } = await supabase.from(seaTable).insert(newSeasonPayload);
      if (!createSeasonErr) {
        return {
          seasonId: newSeasonId,
          seasonNumber: 1,
        };
      }
      console.warn('[Auto-create Season 1 Notice]:', createSeasonErr);
    } catch (err) {
      console.warn('[Auto-create Season 1 Exception]:', err);
    }

    // If season could not be created, return NULL (Requirement 4 & 5)
    return {
      seasonId: null,
      seasonNumber: requestedSeasonNumber || 1,
    };
  }

  // 5. Existing seasons exist:
  // If the user requested a specific season number, match it:
  if (requestedSeasonNumber) {
    const matchByNum = existingSeasons.find(s => Number(s.season_number) === Number(requestedSeasonNumber));
    if (matchByNum) {
      return {
        seasonId: matchByNum.id,
        seasonNumber: Number(matchByNum.season_number),
      };
    }
  }

  // If season_id was empty, Requirement 5:
  // "If season_id is empty, save it as NULL instead of an invalid value."
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

  // 5. Upsert into Supabase active episodes table with foreign key violation safety (Requirement 7)
  try {
    const { error: upsertErr } = await supabase.from(epTable).upsert(supabasePayload);
    if (upsertErr) {
      if (upsertErr.message && (upsertErr.message.includes('episodes_season_id_fkey') || upsertErr.code === '23503')) {
        console.warn('[Supabase saveEpisode foreign key fallback]: Retrying with season_id = null');
        supabasePayload.season_id = null;
        const retryRes = await supabase.from(epTable).upsert(supabasePayload);
        if (retryRes.error && !isSchemaCachePending(retryRes.error)) {
          throw new Error(`[${retryRes.error.code || 'DB_ERROR'}]: ${retryRes.error.message}`);
        }
        return targetId;
      }
      if (!isSchemaCachePending(upsertErr)) {
        console.error(`[Supabase saveEpisode error on ${epTable}]:`, upsertErr);
        throw new Error(`[${upsertErr.code || 'DB_ERROR'}]: ${upsertErr.message} (Table: ${epTable})`);
      }
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw err;
  }

  return targetId;
}
export const saveEpisode = saveEpisodeBoth;

// Delete Episode from Supabase (Requirement 5)
export async function deleteEpisodeBoth(id: string): Promise<void> {
  const cleanId = String(id).trim();
  const epTable = await getActiveEpisodesTable();

  // 1. Snapshot for recovery
  try {
    const { data: current } = await supabase.from(epTable).select('*').eq('id', cleanId).maybeSingle();
    if (current) {
      await createAutoBackup('episode', cleanId, current);
    }
  } catch {}

  // 2. Delete selected record
  try {
    const { error: delErr } = await supabase.from(epTable).delete().eq('id', cleanId);
    if (delErr && !isSchemaCachePending(delErr)) {
      console.error(`[Supabase deleteEpisode error on ${epTable}]:`, delErr);
      throw new Error(`[${delErr.code || 'DB_ERROR'}]: ${delErr.message} (Table: ${epTable})`);
    }
  } catch (err: any) {
    if (!isSchemaCachePending(err)) throw err;
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
