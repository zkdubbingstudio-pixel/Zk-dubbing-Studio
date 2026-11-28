/**
 * ZK Voice Hub - Cloud Firestore Data Service
 * 100% Firebase Architecture: Cloud Firestore + Firebase Auth + Firebase Storage + App Check + Analytics
 */

import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  isFirestoreUnavailableError,
  OperationType,
  trackFirebaseAnalyticsEvent,
} from './firebase';
import { useAuthStore } from '../store/authStore';
import { getCachedData, setCachedData, clearCachedData, clearCachePrefix } from './cache';
import { resolveImageUrl } from './imageUtils';
import { assertOwner, isOwnerEmail, sanitizeString, sanitizeUrl } from './security';

export { resolveImageUrl };

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
  studio?: string;
  dubbedBy?: string;
  dubbed_by?: string;
  dubCredits?: any;
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
  releaseYear?: number;
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
  isEarlyAccess?: boolean;
  isPremiumOnly?: boolean;
  introStart?: number;
  introEnd?: number;
  endingStart?: number;
  createdAt?: any;
  created_at?: any;
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

export const NEW_DROPS_EXPIRY_MS = 17 * 24 * 60 * 60 * 1000;

export function formatDbError(error: unknown): string {
  if (!error) return 'Offline mode';
  if (typeof error === 'string') {
    return isFirestoreUnavailableError(error) ? `Offline mode (${error})` : error;
  }
  const err = error as any;
  const code = err?.code ? String(err.code) : '';
  let msg = '';
  if (err?.message) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.error) msg = String(parsed.error);
    } catch {}
    if (!msg) msg = String(err.message);
  } else {
    msg = String(error);
  }

  if (isFirestoreUnavailableError({ code, message: msg })) {
    if (msg.startsWith('Offline mode')) return msg;
    return code ? `Offline mode ([${code}] ${msg})` : `Offline mode (${msg})`;
  }
  if (code && !msg.includes(code)) {
    return `[${code}] ${msg}`;
  }
  return msg;
}

export async function verifyFirestoreHealth(): Promise<{ ok: boolean; details: string }> {
  if (!db) {
    const details = 'Offline mode ([firestore/not-initialized] Firestore instance not initialized)';
    useAuthStore.getState().setDatabaseError(details);
    return { ok: false, details };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    useAuthStore.getState().setDatabaseError(null);
    return { ok: true, details: 'Cloud Firestore rules and connection active' };
  } catch (err) {
    const details = formatDbError(err);
    useAuthStore.getState().setDatabaseError(details);
    return { ok: false, details };
  }
}

export function invalidateCache(_pattern?: string): void {
  clearCachePrefix('');
}

function safeDocId(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getPublishTimestamp(item: any): number {
  if (!item) return 0;
  if (item.createdAt) {
    if (typeof item.createdAt.toMillis === 'function') return item.createdAt.toMillis();
    if (typeof item.createdAt.toDate === 'function') return item.createdAt.toDate().getTime();
    if (typeof item.createdAt.seconds === 'number') return item.createdAt.seconds * 1000;
    if (typeof item.createdAt === 'number') return item.createdAt;
    const parsed = Date.parse(item.createdAt);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.created_at) {
    const parsed = Date.parse(item.created_at);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.releaseDate || item.release_date) {
    const parsed = Date.parse(item.releaseDate || item.release_date);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.updatedAt || item.updated_at) {
    const parsed = Date.parse(item.updatedAt || item.updated_at);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export function extractAbyssUrl(input?: string): string {
  if (!input) return '';
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) url = iframeMatch[1].trim();
  if (url.startsWith('//')) url = `https:${url}`;
  return url;
}

export function extractFileMoonUrl(input?: string): string {
  if (!input) return '';
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) url = iframeMatch[1].trim();
  if (url.includes('filemoon.') && url.includes('/d/')) url = url.replace('/d/', '/e/');
  if (url.startsWith('//')) url = `https:${url}`;
  return url;
}

export function extractVDOHideUrl(input?: string): string {
  if (!input) return '';
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) url = iframeMatch[1].trim();
  if ((url.includes('vdohide.') || url.includes('streamhide.') || url.includes('vidhide.')) && url.includes('/d/')) {
    url = url.replace('/d/', '/e/');
  } else if ((url.includes('vdohide.') || url.includes('streamhide.') || url.includes('vidhide.')) && url.includes('/w/')) {
    url = url.replace('/w/', '/e/');
  }
  if (url.startsWith('//')) url = `https:${url}`;
  return url;
}

export function isValidStreamUrl(input?: any): boolean {
  if (!input || typeof input !== 'string') return false;
  let url = input.trim();
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) url = iframeMatch[1].trim();
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.length < 10) return false;
  const lower = url.toLowerCase();
  if (
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'about:blank' ||
    lower === 'none' ||
    lower === 'false' ||
    lower === '#' ||
    lower.startsWith('javascript:') ||
    lower === 'https://' ||
    lower === 'http://'
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) return false;
    if (parsed.hostname === 'example.com' || parsed.hostname === 'example.org') return false;
    return true;
  } catch {
    return false;
  }
}

const serverReachabilityCache = new Map<string, { ok: boolean; timestamp: number }>();

export async function probeServerReachable(url?: string | null, timeoutMs = 1200): Promise<boolean> {
  if (!isValidStreamUrl(url)) return false;
  const clean = String(url).trim();
  const cached = serverReachabilityCache.get(clean);
  if (cached && Date.now() - cached.timestamp < 60000) return cached.ok;
  if (typeof window === 'undefined') return true;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    await fetch(clean, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timer);
    serverReachabilityCache.set(clean, { ok: true, timestamp: Date.now() });
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      serverReachabilityCache.set(clean, { ok: true, timestamp: Date.now() });
      return true;
    }
    serverReachabilityCache.set(clean, { ok: false, timestamp: Date.now() });
    return false;
  }
}

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
  const isVdoUrl = (u?: string) =>
    u && (u.includes('vdohide') || u.includes('streamhide') || u.includes('vidhide') || u.includes('fembed'));
  if (!s3 && (isVdoUrl(data.videoUrl) || isVdoUrl(data.video_url))) {
    s3 = extractVDOHideUrl(data.videoUrl || data.video_url);
  }
  if (!s1 && (data.videoUrl || data.video_url)) {
    const fallbackUrl = extractAbyssUrl(data.videoUrl || data.video_url);
    if (!fallbackUrl.includes('filemoon') && !isVdoUrl(fallbackUrl)) s1 = fallbackUrl;
  }

  return {
    server1: isValidStreamUrl(s1) ? s1 : '',
    server2: isValidStreamUrl(s2) ? s2 : '',
    server3: isValidStreamUrl(s3) ? s3 : '',
  };
}

export function normalizeAnime(item: any, id?: string): AnimeItem {
  const genres = Array.isArray(item.genres)
    ? item.genres
    : typeof item.genres === 'string'
    ? item.genres
        .split(',')
        .map((g: string) => g.trim())
        .filter(Boolean)
    : [];

  const isMovie = Boolean(
    item.type === 'Movie' ||
      item.contentType === 'Movie' ||
      item.content_type === 'Movie' ||
      item.is_movie ||
      item.isMovie
  );

  const poster = resolveImageUrl(item.posterUrl || item.poster_url || '');
  const banner = resolveImageUrl(item.bannerUrl || item.banner_url || poster);

  return {
    ...item,
    id: String(id || item.id || ''),
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
    studio: item.studio || '',
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
    createdAt: item.createdAt || item.created_at || Date.now(),
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
  };
}

export function normalizeSeasonDoc(dId: string, raw: any, anime?: AnimeItem | null): SeasonItem {
  const sNum = Number(raw.seasonNumber || raw.season_number || 1);
  const poster = resolveImageUrl(raw.posterUrl || raw.poster_url || anime?.posterUrl || '');
  const banner = resolveImageUrl(raw.bannerUrl || raw.banner_url || anime?.bannerUrl || poster);
  return {
    ...raw,
    id: String(dId),
    animeId: String(raw.animeId || raw.anime_id || anime?.id || ''),
    anime_id: String(raw.animeId || raw.anime_id || anime?.id || ''),
    seasonNumber: sNum,
    season_number: sNum,
    title: raw.title || `Season ${sNum}`,
    description: raw.description || '',
    posterUrl: poster,
    poster_url: poster,
    bannerUrl: banner,
    banner_url: banner,
    order: Number(raw.order ?? sNum),
    status: raw.status || 'Published',
    createdAt: raw.createdAt || raw.created_at || Date.now(),
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
  const epSeason =
    rawSeason && rawSeason !== 's1' && rawSeason !== 'null' && rawSeason !== 'undefined' ? String(rawSeason) : '';
  let epSeasonNum = Number(data.seasonNumber || data.season_number);
  if (!epSeasonNum || isNaN(epSeasonNum)) {
    if (epSeason === 's2' || epSeason === '2' || epSeason === 'season 2') epSeasonNum = 2;
    else epSeasonNum = 1;
  }

  const epNum = Number(data.episodeNumber || data.episode_number) || 1;
  const isMovie = Boolean(data.isMovie || data.type === 'Movie' || epSeason === 'movie');

  const animeObj =
    data.anime || (typeof animeIdFallbackOrJoinedAnime === 'object' ? animeIdFallbackOrJoinedAnime : null);
  const seasonObj = data.seasons || data.season || joinedSeasonParam || null;
  const fallbackAnimeId = typeof animeIdFallbackOrJoinedAnime === 'string' ? animeIdFallbackOrJoinedAnime : '';

  const animeTitle = animeObj?.title || data.anime_title || data.animeTitle || '';
  const rawAnimePoster = resolveImageUrl(
    animeObj?.posterUrl || animeObj?.poster_url || data.posterUrl || data.poster_url || ''
  );
  const rawAnimeBanner = resolveImageUrl(
    animeObj?.bannerUrl || animeObj?.banner_url || data.bannerUrl || data.banner_url || rawAnimePoster
  );
  const rawEpThumb = resolveImageUrl(data.thumbnailUrl || data.thumbnail_url || rawAnimePoster);

  const animePoster = rawAnimePoster || rawEpThumb;
  const animeBanner = rawAnimeBanner || animePoster;
  const epThumbnail = rawEpThumb || animePoster;
  const animeGenres = Array.isArray(animeObj?.genres) ? animeObj.genres : [];
  const seasonTitle = seasonObj?.title || (epSeasonNum ? `Season ${epSeasonNum}` : 'Season 1');

  return {
    ...data,
    id: String(dId),
    animeId: String(data.animeId || data.anime_id || animeObj?.id || fallbackAnimeId || ''),
    anime_id: String(data.animeId || data.anime_id || animeObj?.id || fallbackAnimeId || ''),
    seasonId: epSeason || (seasonObj?.id ? String(seasonObj.id) : ''),
    season_id: epSeason || (seasonObj?.id ? String(seasonObj.id) : ''),
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

const inMemoryBackups: BackupRecord[] = [];

export async function createAutoBackup(
  type: 'anime' | 'season' | 'episode' | 'bulk',
  entityId: string,
  currentData: any
): Promise<void> {
  try {
    const backupObj: BackupRecord = {
      id: `bak_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      entityId,
      data: currentData,
      timestamp: Date.now(),
    };
    inMemoryBackups.unshift(backupObj);
    if (inMemoryBackups.length > 30) inMemoryBackups.pop();
  } catch {}
}

export const ANIME_TABLE_CANDIDATES = ['anime'];
export const EPISODES_TABLE_CANDIDATES = ['episodes'];
export const SEASONS_TABLE_CANDIDATES = ['seasons'];

export function getLocalAnimeList(): AnimeItem[] {
  return [];
}
export function saveLocalAnimeItem(_item: any): void {}
export function deleteLocalAnimeItem(_id: string): void {}
export function isSchemaCachePending(_error: any): boolean {
  return false;
}

export async function detectActualTableNames(_force = false) {
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

// -------------------------------------------------------------
// READ OPERATIONS (CLOUD FIRESTORE ONLY + 5-MIN CACHE)
// -------------------------------------------------------------

export interface UnifiedCatalog {
  allAnime: AnimeItem[];
  featuredAnime: AnimeItem[];
  trendingAnime: AnimeItem[];
  newDrops: EpisodeItem[];
  allSeasons: SeasonItem[];
  allEpisodes: EpisodeItem[];
}

export function preloadFirst6HomeImages(catalog: UnifiedCatalog) {
  if (typeof window === 'undefined') return;
  const urls: string[] = [];

  if (catalog.featuredAnime.length > 0) {
    catalog.featuredAnime.slice(0, 2).forEach((a) => {
      const url = a.bannerUrl || a.posterUrl;
      if (url && !urls.includes(url)) urls.push(url);
    });
  }

  const pool = [...catalog.trendingAnime, ...catalog.allAnime];
  for (const a of pool) {
    if (urls.length >= 6) break;
    const url = a.posterUrl || a.bannerUrl;
    if (url && !urls.includes(url)) urls.push(url);
  }

  urls.slice(0, 6).forEach((url) => {
    try {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    } catch {}
  });
}

export async function getUnifiedCatalog(): Promise<UnifiedCatalog> {
  const cacheKey = 'unified_app_catalog';
  const cached = getCachedData<UnifiedCatalog>(cacheKey);
  if (cached && cached.allAnime && cached.allAnime.length > 0) {
    return cached;
  }

  if (!db) {
    return {
      allAnime: [],
      featuredAnime: [],
      trendingAnime: [],
      newDrops: [],
      allSeasons: [],
      allEpisodes: [],
    };
  }

  try {
    const [animeSnap, seasonsSnap, episodesSnap] = await Promise.all([
      getDocs(collection(db, 'anime')),
      getDocs(collection(db, 'seasons')),
      getDocs(query(collection(db, 'episodes'), where('published', '==', true))),
    ]);

    const allAnime: AnimeItem[] = animeSnap.docs
      .map((d) => normalizeAnime(d.data(), d.id))
      .sort((a, b) => getPublishTimestamp(b) - getPublishTimestamp(a));

    const animeMap = new Map<string, AnimeItem>();
    allAnime.forEach((a) => animeMap.set(a.id, a));

    const allSeasons: SeasonItem[] = seasonsSnap.docs
      .map((d) => {
        const raw = d.data();
        const aId = String(raw.animeId || raw.anime_id || '');
        return normalizeSeasonDoc(d.id, raw, animeMap.get(aId) || null);
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const seasonMap = new Map<string, SeasonItem>();
    allSeasons.forEach((s) => seasonMap.set(s.id, s));

    const allEpisodes: EpisodeItem[] = episodesSnap.docs
      .map((d) => {
        const raw = d.data();
        const aId = String(raw.animeId || raw.anime_id || '');
        const sId = String(raw.seasonId || raw.season_id || '');
        return normalizeEpisodeDoc(d.id, raw, animeMap.get(aId) || aId, seasonMap.get(sId) || null);
      })
      .sort((a, b) => getPublishTimestamp(b) - getPublishTimestamp(a));

    let feat = allAnime.filter((a) => a.featured);
    if (feat.length === 0 && allAnime.length > 0) {
      feat = allAnime.slice(0, 6);
    }

    let trend = allAnime.filter((a) => a.trending);
    if (trend.length === 0 && allAnime.length > 0) {
      trend = [...allAnime].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
    }

    const newDrops = [...allEpisodes]
      .filter((ep) => ep.published !== false)
      .sort((a, b) => getPublishTimestamp(b) - getPublishTimestamp(a))
      .slice(0, 40);

    const catalog: UnifiedCatalog = {
      allAnime,
      featuredAnime: feat,
      trendingAnime: trend,
      newDrops,
      allSeasons,
      allEpisodes,
    };

    setCachedData(cacheKey, catalog);
    setCachedData('all_anime', allAnime);
    setCachedData('featured_anime', feat);
    setCachedData('trending_anime', trend);
    setCachedData('new_drops', newDrops);
    setCachedData('all_seasons', allSeasons);
    setCachedData('all_episodes_published', allEpisodes);
    allAnime.forEach((a) => setCachedData(`anime_${a.id}`, a));
    allEpisodes.forEach((ep) => setCachedData(`episode_${ep.id}`, ep));

    return catalog;
  } catch (err) {
    const formatted = formatDbError(err);
    useAuthStore.getState().setDatabaseError(formatted);
    console.warn('[Firestore Error - getUnifiedCatalog]:', formatted);
    const stale = getCachedData<UnifiedCatalog>(cacheKey, true);
    if (stale) return stale;
    return {
      allAnime: [],
      featuredAnime: [],
      trendingAnime: [],
      newDrops: [],
      allSeasons: [],
      allEpisodes: [],
    };
  }
}

export async function getFeaturedAnime(): Promise<AnimeItem[]> {
  const cacheKey = 'featured_anime';
  const cached = getCachedData<AnimeItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  const catalog = await getUnifiedCatalog();
  return catalog.featuredAnime;
}

export async function getTrendingAnime(): Promise<AnimeItem[]> {
  const cacheKey = 'trending_anime';
  const cached = getCachedData<AnimeItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  const catalog = await getUnifiedCatalog();
  return catalog.trendingAnime;
}

export async function getNewDrops(): Promise<any[]> {
  const cacheKey = 'new_drops';
  const cached = getCachedData<any[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  const catalog = await getUnifiedCatalog();
  const now = Date.now();
  return catalog.newDrops
    .map((ep) => {
      const animeObj = ep.anime;
      const parentAnimeId = String(animeObj?.id || ep.animeId || ep.anime_id || '');
      const publishTs = getPublishTimestamp(ep);
      const isExpired = publishTs > 0 ? now - publishTs > NEW_DROPS_EXPIRY_MS : false;
      return {
        ...ep,
        id: parentAnimeId || ep.id,
        animeId: parentAnimeId,
        anime_id: parentAnimeId,
        dropId: ep.id,
        episodeId: ep.id,
        title: animeObj?.title || ep.title || 'Anime Series',
        animeTitle: animeObj?.title || ep.title || 'Anime Series',
        episodeTitle: ep.episode_title || ep.title || `Episode ${ep.episodeNumber || 1}`,
        posterUrl: animeObj?.posterUrl || ep.thumbnailUrl || '',
        poster_url: animeObj?.posterUrl || ep.thumbnailUrl || '',
        thumbnailUrl: ep.thumbnailUrl || animeObj?.posterUrl || '',
        thumbnail_url: ep.thumbnailUrl || animeObj?.posterUrl || '',
        bannerUrl: animeObj?.bannerUrl || animeObj?.posterUrl || '',
        banner_url: animeObj?.bannerUrl || animeObj?.posterUrl || '',
        genres: Array.isArray(animeObj?.genres) ? animeObj.genres : [],
        animeGenres: Array.isArray(animeObj?.genres) ? animeObj.genres : [],
        contentType: animeObj?.contentType || animeObj?.type || 'TV Series',
        type: animeObj?.type || animeObj?.contentType || 'TV Series',
        releaseYear: animeObj?.releaseYear,
        release_year: animeObj?.releaseYear,
        publishTs,
        isExpired,
      };
    })
    .filter((d) => !d.isExpired);
}

export async function getAnimeById(id: string): Promise<AnimeItem | null> {
  if (!id) return null;
  const cacheKey = `anime_${id}`;
  const cached = getCachedData<AnimeItem>(cacheKey);
  if (cached) return cached;
  if (!db) return null;

  try {
    const snap = await getDoc(doc(db, 'anime', id));
    if (snap.exists()) {
      const normalized = normalizeAnime(snap.data(), snap.id);
      setCachedData(cacheKey, normalized);
      return normalized;
    }

    // Fallback: match by catalog title or parent ID from episode/season
    const allAnime = await getAllAnime();
    const byTitle = allAnime.find((a) => a.title.toLowerCase() === id.toLowerCase());
    if (byTitle) {
      setCachedData(cacheKey, byTitle);
      return byTitle;
    }

    const epSnap = await getDoc(doc(db, 'episodes', id)).catch(() => null);
    if (epSnap?.exists()) {
      const epData = epSnap.data();
      const parentId = epData.animeId || epData.anime_id;
      if (parentId) return await getAnimeById(String(parentId));
    }

    const seaSnap = await getDoc(doc(db, 'seasons', id)).catch(() => null);
    if (seaSnap?.exists()) {
      const seaData = seaSnap.data();
      const parentId = seaData.animeId || seaData.anime_id;
      if (parentId) return await getAnimeById(String(parentId));
    }
  } catch (err) {
    console.error(`[Firestore Error - getAnimeById(${id})]:`, formatDbError(err));
  }

  return getCachedData<AnimeItem>(cacheKey, true) || null;
}

export async function getAnimeFullDetails(id: string): Promise<{
  anime: AnimeItem | null;
  seasons: SeasonItem[];
  episodes: EpisodeItem[];
}> {
  if (!id) return { anime: null, seasons: [], episodes: [] };

  const cacheKey = `anime_full_${id}`;
  const cached = getCachedData<{
    anime: AnimeItem;
    seasons: SeasonItem[];
    episodes: EpisodeItem[];
  }>(cacheKey);
  if (cached && cached.anime) return cached;

  const anime = await getAnimeById(id);
  if (!anime) return { anime: null, seasons: [], episodes: [] };

  const [seasonsData, episodesData] = await Promise.all([
    getSeasonsByAnimeId(anime.id),
    getEpisodesByAnimeId(anime.id),
  ]);

  let seasons = seasonsData;
  if (seasons.length === 0 && episodesData.length > 0) {
    seasons = [
      {
        id: 's1',
        animeId: anime.id,
        seasonNumber: 1,
        title: 'Season 1',
        order: 1,
      },
    ];
  }

  const payload = {
    anime,
    seasons,
    episodes: episodesData,
  };

  setCachedData(cacheKey, payload);
  setCachedData(`anime_${anime.id}`, anime);
  setCachedData(`seasons_${anime.id}`, seasons);
  setCachedData(`episodes_${anime.id}`, episodesData);

  return payload;
}

export async function getSeasonsByAnimeId(animeId: string): Promise<SeasonItem[]> {
  if (!animeId) return [];
  const cacheKey = `seasons_${animeId}`;
  const cached = getCachedData<SeasonItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;
  if (!db) return [];

  try {
    const snap = await getDocs(query(collection(db, 'seasons'), where('animeId', '==', animeId)));
    const mapped = snap.docs
      .map((d) => normalizeSeasonDoc(d.id, d.data()))
      .sort((a, b) => (a.seasonNumber || 1) - (b.seasonNumber || 1));

    if (mapped.length > 0) {
      setCachedData(cacheKey, mapped);
      return mapped;
    }

    const epsSnap = await getDocs(
      query(collection(db, 'episodes'), where('animeId', '==', animeId), where('published', '==', true), limit(1))
    );
    if (!epsSnap.empty) {
      const synth: SeasonItem[] = [{ id: 's1', animeId, seasonNumber: 1, title: 'Season 1', order: 1 }];
      setCachedData(cacheKey, synth);
      return synth;
    }
  } catch (err) {
    console.warn(`[Firestore Error - getSeasonsByAnimeId(${animeId})]:`, formatDbError(err));
  }

  return getCachedData<SeasonItem[]>(cacheKey, true) || [];
}

export function matchEpisodeToSeason(
  ep: any,
  selectedSeasonId: string,
  seasons: any[] = [],
  _allEpisodes: any[] = []
): boolean {
  if (!selectedSeasonId) return true;

  const selectedSeasonObj = seasons.find((s) => s.id === selectedSeasonId);
  const targetSeasonNum =
    selectedSeasonObj?.seasonNumber != null ? Number(selectedSeasonObj.seasonNumber) : undefined;

  const epSeasonId = ep.seasonId || ep.season_id;
  const epSeasonNum =
    ep.seasonNumber != null && ep.seasonNumber !== ''
      ? Number(ep.seasonNumber)
      : ep.season_number != null && ep.season_number !== ''
      ? Number(ep.season_number)
      : undefined;

  if (epSeasonId && String(epSeasonId).trim() === String(selectedSeasonId).trim()) return true;
  if (selectedSeasonObj?.id && epSeasonId && String(epSeasonId).trim() === String(selectedSeasonObj.id).trim()) {
    return true;
  }
  if (epSeasonNum !== undefined && targetSeasonNum !== undefined && epSeasonNum === targetSeasonNum) {
    return true;
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

  const isFirstSeason = selectedSeasonObj ? targetSeasonNum === 1 || seasons[0]?.id === selectedSeasonId : true;
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

export async function getEpisodesByAnimeId(animeId: string, seasonId?: string): Promise<EpisodeItem[]> {
  if (!animeId) return [];
  const cacheKey = `episodes_${animeId}`;
  const cached = getCachedData<EpisodeItem[]>(cacheKey);

  let allEpisodes = cached;
  if (!allEpisodes || allEpisodes.length === 0) {
    if (!db) return [];
    try {
      const [anime, seasons, epsSnap] = await Promise.all([
        getAnimeById(animeId),
        getDocs(query(collection(db, 'seasons'), where('animeId', '==', animeId))),
        getDocs(query(collection(db, 'episodes'), where('animeId', '==', animeId), where('published', '==', true))),
      ]);
      const seasonMap = new Map<string, SeasonItem>();
      seasons.docs.forEach((s) => seasonMap.set(s.id, normalizeSeasonDoc(s.id, s.data(), anime)));

      allEpisodes = epsSnap.docs
        .map((d) => {
          const raw = d.data();
          const sId = String(raw.seasonId || raw.season_id || '');
          return normalizeEpisodeDoc(d.id, raw, anime || animeId, seasonMap.get(sId) || null);
        })
        .sort((a, b) => Number(a.episodeNumber || 0) - Number(b.episodeNumber || 0));

      setCachedData(cacheKey, allEpisodes);
    } catch (err) {
      console.error(`[Firestore Error - getEpisodesByAnimeId(${animeId})]:`, formatDbError(err));
      allEpisodes = getCachedData<EpisodeItem[]>(cacheKey, true) || [];
    }
  }

  if (seasonId && seasonId !== 'all') {
    return allEpisodes.filter((ep) => matchEpisodeToSeason(ep, seasonId));
  }
  return allEpisodes;
}

export async function getEpisodesBySeason(seasonId: string, animeId?: string): Promise<EpisodeItem[]> {
  if (!seasonId) return [];
  if (animeId) {
    return await getEpisodesByAnimeId(animeId, seasonId);
  }
  const all = await getAllEpisodes(true);
  return all.filter((ep) => {
    if (ep.seasonId === seasonId || ep.season_id === seasonId) return true;
    if (seasonId === 's1' && (ep.seasonNumber === 1 || !ep.seasonId)) return true;
    return matchEpisodeToSeason(ep, seasonId);
  });
}

export async function getEpisodeById(id: string): Promise<EpisodeItem | null> {
  if (!id) return null;
  const cacheKey = `episode_${id}`;
  const cached = getCachedData<EpisodeItem>(cacheKey);
  if (cached) return cached;
  if (!db) return null;

  try {
    const epSnap = await getDoc(doc(db, 'episodes', id));
    if (epSnap.exists()) {
      const raw = epSnap.data();
      const animeId = String(raw.animeId || raw.anime_id || '');
      const anime = animeId ? await getAnimeById(animeId) : null;
      const normalized = normalizeEpisodeDoc(epSnap.id, raw, anime || animeId);
      setCachedData(cacheKey, normalized);
      return normalized;
    }

    const movieAnime = await getAnimeById(id);
    if (movieAnime && movieAnime.isMovie) {
      const { server1, server2, server3 } = resolveEpisodeServers(movieAnime);
      const movieItem: EpisodeItem = {
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
        thumbnailUrl: movieAnime.bannerUrl || movieAnime.posterUrl || '',
        thumbnail_url: movieAnime.bannerUrl || movieAnime.posterUrl || '',
        duration: movieAnime.duration || '1h 45m',
        releaseDate: movieAnime.releaseDate || '',
        server1Url: server1,
        server1_url: server1,
        server2Url: server2,
        server2_url: server2,
        server3Url: server3,
        server3_url: server3,
        videoUrl: server1 || server2 || server3 || '',
        published: true,
        isMovie: true,
        anime: movieAnime,
      };
      setCachedData(cacheKey, movieItem);
      return movieItem;
    }
  } catch (err) {
    console.error(`[Firestore Error - getEpisodeById(${id})]:`, formatDbError(err));
    return getCachedData<EpisodeItem>(cacheKey, true) || null;
  }

  return null;
}

export async function getAllAnime(): Promise<AnimeItem[]> {
  const cacheKey = 'all_anime';
  const cached = getCachedData<AnimeItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;
  if (!db) return [];

  try {
    const snap = await getDocs(collection(db, 'anime'));
    const list = snap.docs
      .map((d) => normalizeAnime(d.data(), d.id))
      .sort((a, b) => getPublishTimestamp(b) - getPublishTimestamp(a));
    setCachedData(cacheKey, list);
    return list;
  } catch (err) {
    console.error('[Firestore Error - getAllAnime]:', formatDbError(err));
    return getCachedData<AnimeItem[]>(cacheKey, true) || [];
  }
}

export async function getAllSeasons(): Promise<SeasonItem[]> {
  const cacheKey = 'all_seasons';
  const cached = getCachedData<SeasonItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;
  if (!db) return [];

  try {
    const snap = await getDocs(collection(db, 'seasons'));
    const list = snap.docs
      .map((d) => normalizeSeasonDoc(d.id, d.data()))
      .sort((a, b) => (a.seasonNumber || 1) - (b.seasonNumber || 1));
    setCachedData(cacheKey, list);
    return list;
  } catch (err) {
    console.error('[Firestore Error - getAllSeasons]:', formatDbError(err));
    return getCachedData<SeasonItem[]>(cacheKey, true) || [];
  }
}

export async function getAllEpisodes(publishedOnly = true): Promise<EpisodeItem[]> {
  const cacheKey = publishedOnly ? 'all_episodes_published' : 'all_episodes_all';
  const cached = getCachedData<EpisodeItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;
  if (!db) return [];

  try {
    const canReadDrafts = !publishedOnly && isOwnerEmail(auth?.currentUser?.email);
    const epsQuery = canReadDrafts
      ? collection(db, 'episodes')
      : query(collection(db, 'episodes'), where('published', '==', true));

    const [epsSnap, animeList, seasonsList] = await Promise.all([
      getDocs(epsQuery),
      getAllAnime(),
      getAllSeasons(),
    ]);

    const animeMap = new Map<string, AnimeItem>();
    animeList.forEach((a) => animeMap.set(a.id, a));
    const seasonMap = new Map<string, SeasonItem>();
    seasonsList.forEach((s) => seasonMap.set(s.id, s));

    const mapped = epsSnap.docs
      .map((d) => {
        const raw = d.data();
        const aId = String(raw.animeId || raw.anime_id || '');
        const sId = String(raw.seasonId || raw.season_id || '');
        return normalizeEpisodeDoc(d.id, raw, animeMap.get(aId) || aId, seasonMap.get(sId) || null);
      })
      .sort((a, b) => getPublishTimestamp(b) - getPublishTimestamp(a));

    setCachedData(cacheKey, mapped);
    return mapped;
  } catch (err) {
    console.error('[Firestore Error - getAllEpisodes]:', formatDbError(err));
    return getCachedData<EpisodeItem[]>(cacheKey, true) || [];
  }
}

export async function getGenres(): Promise<string[]> {
  const cached = getCachedData<string[]>('all_genres');
  if (cached && cached.length > 0) return cached;

  try {
    const allAnime = await getAllAnime();
    const set = new Set<string>();
    allAnime.forEach((a) => {
      if (Array.isArray(a.genres)) {
        a.genres.forEach((g) => {
          if (g && typeof g === 'string') set.add(g.trim());
        });
      }
    });
    if (set.size > 0) {
      const result = ['All', ...Array.from(set).sort()];
      setCachedData('all_genres', result);
      return result;
    }
  } catch {}

  const fallback = ['All', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Supernatural'];
  setCachedData('all_genres', fallback);
  return fallback;
}

// -------------------------------------------------------------
// WRITE OPERATIONS (CLOUD FIRESTORE - OWNER VERIFIED VIA RULES)
// -------------------------------------------------------------

function clearAnimeCaches() {
  clearCachePrefix('anime');
  clearCachedData('unified_app_catalog');
  clearCachedData('all_anime');
  clearCachedData('featured_anime');
  clearCachedData('trending_anime');
  clearCachedData('new_drops');
  clearCachedData('all_genres');
}

export async function insertAnime(animeData: Partial<AnimeItem>): Promise<AnimeItem> {
  assertOwner('add anime');
  if (!db) throw new Error('Firestore is not initialized.');

  const targetId = safeDocId(String(animeData.id || `anm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`));
  const genres = (
    Array.isArray(animeData.genres)
      ? animeData.genres
      : typeof animeData.genres === 'string'
      ? (animeData.genres as string).split(',').map((g) => g.trim()).filter(Boolean)
      : []
  ).slice(0, 20);

  const poster = sanitizeUrl(animeData.posterUrl || animeData.poster_url || '');
  const banner = sanitizeUrl(animeData.bannerUrl || animeData.banner_url || poster);
  const rating = sanitizeString(animeData.rating || '9.5', 20);
  const releaseYear = sanitizeString(animeData.releaseYear || animeData.release_year || '', 20);
  const status = sanitizeString(animeData.status || 'Ongoing', 50);
  const language = sanitizeString(animeData.language || 'Hindi Dub', 50);
  const studio = sanitizeString(animeData.studio || '', 120);
  const dubbedBy = sanitizeString(animeData.dubbedBy || animeData.dubbed_by || 'ZK Dubbing Studio', 120);
  const featured = Boolean(animeData.featured);
  const trending = Boolean(animeData.trending);
  const type = animeData.type === 'Movie' || animeData.contentType === 'Movie' || animeData.isMovie ? 'Movie' : 'TV Series';
  const isMovie = type === 'Movie';
  const duration = sanitizeString(animeData.duration ? String(animeData.duration).trim() : isMovie ? '1h 45m' : '', 50);
  const releaseDate = sanitizeString(animeData.releaseDate ? String(animeData.releaseDate).trim() : animeData.release_date || releaseYear, 50);

  const server1 = sanitizeUrl(extractAbyssUrl(animeData.server1Url || animeData.server1_url || ''));
  const server2 = sanitizeUrl(extractFileMoonUrl(animeData.server2Url || animeData.server2_url || ''));
  const server3 = sanitizeUrl(extractVDOHideUrl(animeData.server3Url || animeData.server3_url || ''));
  const nowIso = new Date().toISOString();

  const payload: Record<string, any> = {
    id: targetId,
    title: sanitizeString(animeData.title || 'Untitled Anime', 300),
    description: sanitizeString(animeData.description || animeData.synopsis || '', 10000),
    synopsis: sanitizeString(animeData.synopsis || animeData.description || '', 10000),
    posterUrl: poster,
    poster_url: poster,
    bannerUrl: banner,
    banner_url: banner,
    genres,
    rating,
    releaseYear,
    release_year: releaseYear,
    releaseDate,
    release_date: releaseDate,
    status,
    language,
    studio,
    dubbedBy,
    dubbed_by: dubbedBy,
    featured,
    trending,
    views: typeof animeData.views === 'number' ? animeData.views : 0,
    type,
    contentType: type,
    content_type: type,
    isMovie,
    is_movie: isMovie,
    duration,
    server1Url: server1,
    server1_url: server1,
    server2Url: server2,
    server2_url: server2,
    server3Url: server3,
    server3_url: server3,
    createdAt: Date.now(),
    created_at: nowIso,
    updatedAt: nowIso,
    updated_at: nowIso,
  };

  if (animeData.dubCredits && typeof animeData.dubCredits === 'object') {
    payload.dubCredits = animeData.dubCredits;
  }

  try {
    await setDoc(doc(db, 'anime', targetId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `anime/${targetId}`);
  }

  clearAnimeCaches();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_anime_published', { detail: { id: targetId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'anime', id: targetId } }));
  }

  return normalizeAnime(payload, targetId);
}

export async function updateAnime(id: string, animeData: Partial<AnimeItem>): Promise<AnimeItem> {
  assertOwner('edit anime');
  if (!db) throw new Error('Firestore is not initialized.');
  const targetId = safeDocId(id);
  if (!targetId) throw new Error('Cannot update anime: ID is required');

  const payload: Record<string, any> = {
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (animeData.title !== undefined) payload.title = sanitizeString(animeData.title, 300);
  if (animeData.description !== undefined) payload.description = sanitizeString(animeData.description, 10000);
  if (animeData.synopsis !== undefined) payload.synopsis = sanitizeString(animeData.synopsis, 10000);
  if (animeData.posterUrl !== undefined || animeData.poster_url !== undefined) {
    const p = sanitizeUrl(animeData.posterUrl ?? animeData.poster_url ?? '');
    payload.posterUrl = p;
    payload.poster_url = p;
  }
  if (animeData.bannerUrl !== undefined || animeData.banner_url !== undefined) {
    const b = sanitizeUrl(animeData.bannerUrl ?? animeData.banner_url ?? '');
    payload.bannerUrl = b;
    payload.banner_url = b;
  }
  if (animeData.genres !== undefined) {
    payload.genres = (
      Array.isArray(animeData.genres)
        ? animeData.genres
        : typeof animeData.genres === 'string'
        ? (animeData.genres as string).split(',').map((g) => g.trim()).filter(Boolean)
        : []
    ).slice(0, 20);
  }
  if (animeData.rating !== undefined) payload.rating = sanitizeString(animeData.rating, 20);
  if (animeData.releaseYear !== undefined || animeData.release_year !== undefined) {
    const ry = sanitizeString(animeData.releaseYear ?? animeData.release_year ?? '', 20);
    payload.releaseYear = ry;
    payload.release_year = ry;
  }
  if (animeData.status !== undefined) payload.status = sanitizeString(animeData.status, 50);
  if (animeData.language !== undefined) payload.language = sanitizeString(animeData.language, 50);
  if (animeData.studio !== undefined) payload.studio = sanitizeString(animeData.studio, 120);
  if (animeData.dubbedBy !== undefined || animeData.dubbed_by !== undefined) {
    const dbBy = sanitizeString(animeData.dubbedBy ?? animeData.dubbed_by ?? '', 120);
    payload.dubbedBy = dbBy;
    payload.dubbed_by = dbBy;
  }
  if (animeData.dubCredits !== undefined) payload.dubCredits = animeData.dubCredits;
  if (animeData.featured !== undefined) payload.featured = Boolean(animeData.featured);
  if (animeData.trending !== undefined) payload.trending = Boolean(animeData.trending);

  const type = animeData.type || animeData.contentType || (animeData.isMovie ? 'Movie' : undefined);
  if (type !== undefined) {
    const isMovie = type === 'Movie';
    payload.type = type;
    payload.contentType = type;
    payload.content_type = type;
    payload.isMovie = isMovie;
    payload.is_movie = isMovie;
  }
  if (animeData.duration !== undefined) payload.duration = sanitizeString(animeData.duration, 50);
  if (animeData.releaseDate !== undefined || animeData.release_date !== undefined) {
    const rd = sanitizeString(animeData.releaseDate ?? animeData.release_date ?? '', 50);
    payload.releaseDate = rd;
    payload.release_date = rd;
  }
  if (animeData.server1Url !== undefined || animeData.server1_url !== undefined) {
    const s1 = sanitizeUrl(extractAbyssUrl(animeData.server1Url ?? animeData.server1_url ?? ''));
    payload.server1Url = s1;
    payload.server1_url = s1;
  }
  if (animeData.server2Url !== undefined || animeData.server2_url !== undefined) {
    const s2 = sanitizeUrl(extractFileMoonUrl(animeData.server2Url ?? animeData.server2_url ?? ''));
    payload.server2Url = s2;
    payload.server2_url = s2;
  }
  if (animeData.server3Url !== undefined || animeData.server3_url !== undefined) {
    const s3 = sanitizeUrl(extractVDOHideUrl(animeData.server3Url ?? animeData.server3_url ?? ''));
    payload.server3Url = s3;
    payload.server3_url = s3;
  }

  try {
    await updateDoc(doc(db, 'anime', targetId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `anime/${targetId}`);
  }

  clearAnimeCaches();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_anime_published', { detail: { id: targetId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'anime', id: targetId } }));
  }

  const fresh = await getAnimeById(targetId);
  return fresh || normalizeAnime({ ...payload, id: targetId }, targetId);
}

export async function saveAnimeBoth(animeData: any, id?: string): Promise<string> {
  assertOwner('save anime');
  const rawId = id || animeData.id;
  if (rawId && db) {
    const cleanId = safeDocId(rawId);
    const snap = await getDoc(doc(db, 'anime', cleanId)).catch(() => null);
    if (snap?.exists()) {
      const updated = await updateAnime(cleanId, animeData);
      return updated.id;
    }
  }
  const inserted = await insertAnime({ ...animeData, id: rawId });
  return inserted.id;
}
export const saveAnime = saveAnimeBoth;

export async function deleteAnimeBoth(id: string): Promise<void> {
  assertOwner('delete anime');
  if (!db) throw new Error('Firestore is not initialized.');
  const cleanId = safeDocId(id);

  try {
    const existing = await getDoc(doc(db, 'anime', cleanId));
    if (existing.exists()) {
      await createAutoBackup('anime', cleanId, existing.data());
    }
    await deleteDoc(doc(db, 'anime', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `anime/${cleanId}`);
  }

  clearAnimeCaches();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_anime_deleted', { detail: { id: cleanId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'anime', id: cleanId } }));
  }
}
export const deleteAnime = deleteAnimeBoth;

export async function saveSeasonBoth(seasonData: any, id?: string): Promise<string> {
  assertOwner('add or edit seasons');
  if (!db) throw new Error('Firestore is not initialized.');

  const targetId = safeDocId(String(id || seasonData.id || `sea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`));
  const targetAnimeId = safeDocId(String(seasonData.animeId || seasonData.anime_id));
  const sNum = Number(seasonData.seasonNumber || seasonData.season_number) || 1;
  const nowIso = new Date().toISOString();

  const payload: Record<string, any> = {
    id: targetId,
    animeId: targetAnimeId,
    anime_id: targetAnimeId,
    seasonNumber: sNum,
    season_number: sNum,
    title: sanitizeString(seasonData.title || `Season ${sNum}`, 200),
    description: sanitizeString(seasonData.description || '', 5000),
    bannerUrl: sanitizeUrl(seasonData.bannerUrl || seasonData.banner_url || ''),
    banner_url: sanitizeUrl(seasonData.bannerUrl || seasonData.banner_url || ''),
    posterUrl: sanitizeUrl(seasonData.posterUrl || seasonData.poster_url || ''),
    poster_url: sanitizeUrl(seasonData.posterUrl || seasonData.poster_url || ''),
    order: Number(seasonData.order ?? sNum),
    status: sanitizeString(seasonData.status || 'Published', 50),
    updatedAt: nowIso,
    updated_at: nowIso,
  };

  try {
    const existing = await getDoc(doc(db, 'seasons', targetId)).catch(() => null);
    if (!existing?.exists()) {
      payload.createdAt = Date.now();
      payload.created_at = nowIso;
    }
    await setDoc(doc(db, 'seasons', targetId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `seasons/${targetId}`);
  }

  clearCachePrefix('seasons_');
  clearCachedData('all_seasons');
  clearCachedData('unified_app_catalog');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'season', id: targetId, animeId: targetAnimeId } }));
  }

  return targetId;
}
export const saveSeason = saveSeasonBoth;

export async function deleteSeasonBoth(id: string): Promise<void> {
  assertOwner('delete seasons');
  if (!db) throw new Error('Firestore is not initialized.');
  const cleanId = safeDocId(id);

  try {
    await deleteDoc(doc(db, 'seasons', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `seasons/${cleanId}`);
  }

  clearCachePrefix('seasons_');
  clearCachedData('all_seasons');
  clearCachedData('unified_app_catalog');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'season', id: cleanId } }));
  }
}
export const deleteSeason = deleteSeasonBoth;

export async function ensureSeasonExists(
  animeId: string,
  requestedSeasonId?: string | null,
  requestedSeasonNumber?: number
): Promise<{ seasonId: string | null; seasonNumber: number }> {
  if (!animeId || !db) {
    return { seasonId: null, seasonNumber: requestedSeasonNumber || 1 };
  }

  const cleanRequestedId = requestedSeasonId ? safeDocId(requestedSeasonId) : '';
  const isPlaceholder =
    !cleanRequestedId || cleanRequestedId === 'null' || cleanRequestedId === 'undefined' || cleanRequestedId === 's1' || cleanRequestedId === 'movie';

  if (!isPlaceholder) {
    try {
      const snap = await getDoc(doc(db, 'seasons', cleanRequestedId));
      if (snap.exists()) {
        const d = snap.data();
        return {
          seasonId: snap.id,
          seasonNumber: Number(d.seasonNumber || d.season_number || requestedSeasonNumber || 1),
        };
      }
    } catch {}
  }

  try {
    const existingSeasons = await getSeasonsByAnimeId(animeId);
    if (existingSeasons.length > 0 && requestedSeasonNumber) {
      const matchByNum = existingSeasons.find((s) => Number(s.seasonNumber) === Number(requestedSeasonNumber));
      if (matchByNum && matchByNum.id !== 's1') {
        return { seasonId: matchByNum.id, seasonNumber: Number(matchByNum.seasonNumber) };
      }
    }
  } catch {}

  return { seasonId: null, seasonNumber: requestedSeasonNumber || 1 };
}

export async function saveEpisodeBoth(epData: any, id?: string): Promise<string> {
  assertOwner('add or edit episodes');
  if (!db) throw new Error('Firestore is not initialized.');

  const targetId = safeDocId(String(id || epData.id || `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`));
  const targetAnimeId = safeDocId(String(epData.animeId || epData.anime_id));
  const epNum = Number(epData.episodeNumber || epData.episode_number) || 1;
  const rawSeasonId = epData.seasonId || epData.season_id;
  const rawSeasonNum = epData.seasonNumber || epData.season_number;

  const { seasonId: validatedSeasonId, seasonNumber: validatedSeasonNum } = await ensureSeasonExists(
    targetAnimeId,
    rawSeasonId,
    rawSeasonNum ? Number(rawSeasonNum) : 1
  );

  const { server1, server2, server3 } = resolveEpisodeServers(epData);
  const cleanTitle = sanitizeString(epData.title || epData.episode_title || `Episode ${epNum}`, 250);
  const cleanThumb = sanitizeUrl(epData.thumbnailUrl || epData.thumbnail_url || '');
  const nowIso = new Date().toISOString();

  const payload: Record<string, any> = {
    id: targetId,
    animeId: targetAnimeId,
    anime_id: targetAnimeId,
    seasonId: validatedSeasonId || '',
    season_id: validatedSeasonId || '',
    seasonNumber: validatedSeasonNum || 1,
    season_number: validatedSeasonNum || 1,
    episodeNumber: epNum,
    episode_number: epNum,
    title: cleanTitle,
    episode_title: cleanTitle,
    description: sanitizeString(epData.description || '', 5000),
    thumbnailUrl: cleanThumb,
    thumbnail_url: cleanThumb,
    duration: sanitizeString(epData.duration || '24m', 50),
    releaseDate: sanitizeString(epData.releaseDate || epData.release_date || '', 50),
    release_date: sanitizeString(epData.releaseDate || epData.release_date || '', 50),
    server1Url: sanitizeUrl(server1),
    server1_url: sanitizeUrl(server1),
    server2Url: sanitizeUrl(server2),
    server2_url: sanitizeUrl(server2),
    server3Url: sanitizeUrl(server3),
    server3_url: sanitizeUrl(server3),
    published: epData.published !== false,
    isEarlyAccess: Boolean(epData.isEarlyAccess ?? epData.is_early_access),
    is_early_access: Boolean(epData.isEarlyAccess ?? epData.is_early_access),
    isPremiumOnly: Boolean(epData.isPremiumOnly ?? epData.is_premium_only),
    is_premium_only: Boolean(epData.isPremiumOnly ?? epData.is_premium_only),
    isPremium: Boolean(epData.isPremium ?? epData.is_premium ?? epData.isPremiumOnly),
    is_premium: Boolean(epData.isPremium ?? epData.is_premium ?? epData.isPremiumOnly),
    updatedAt: nowIso,
    updated_at: nowIso,
  };

  try {
    const existing = await getDoc(doc(db, 'episodes', targetId)).catch(() => null);
    if (!existing?.exists()) {
      payload.views = 0;
      payload.createdAt = Date.now();
      payload.created_at = nowIso;
    }
    await setDoc(doc(db, 'episodes', targetId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `episodes/${targetId}`);
  }

  clearCachePrefix('episodes_');
  clearCachedData('unified_app_catalog');
  clearCachedData('all_episodes');
  clearCachedData('all_episodes_published');
  clearCachedData('all_episodes_all');
  clearCachedData('new_drops');
  clearCachedData(`episode_${targetId}`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_episode_published', { detail: { id: targetId, animeId: targetAnimeId } }));
    window.dispatchEvent(new CustomEvent('zk_episodes_changed', { detail: { id: targetId, animeId: targetAnimeId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'episode', id: targetId, animeId: targetAnimeId } }));
  }

  return targetId;
}
export const saveEpisode = saveEpisodeBoth;

export async function deleteEpisodeBoth(id: string): Promise<void> {
  assertOwner('delete episodes');
  if (!db) throw new Error('Firestore is not initialized.');
  const cleanId = safeDocId(id);

  try {
    await deleteDoc(doc(db, 'episodes', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `episodes/${cleanId}`);
  }

  clearCachePrefix('episodes_');
  clearCachedData('unified_app_catalog');
  clearCachedData('all_episodes');
  clearCachedData('all_episodes_published');
  clearCachedData('all_episodes_all');
  clearCachedData('new_drops');
  clearCachedData(`episode_${cleanId}`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zk_episode_deleted', { detail: { id: cleanId } }));
    window.dispatchEvent(new CustomEvent('zk_episodes_changed', { detail: { id: cleanId } }));
    window.dispatchEvent(new CustomEvent('zk_data_changed', { detail: { type: 'episode', id: cleanId } }));
  }
}
export const deleteEpisode = deleteEpisodeBoth;

// -------------------------------------------------------------
// USER PROGRESS / CONTINUE WATCHING (FIRESTORE watchHistory)
// -------------------------------------------------------------

export async function getUserProgress(userId: string): Promise<any[]> {
  if (!userId || !db) return [];
  const currentUid = auth?.currentUser?.uid;
  const callerIsOwner = isOwnerEmail(auth?.currentUser?.email);
  if (!currentUid || (currentUid !== userId && !callerIsOwner)) return [];

  const cacheKey = `user_progress_${userId}`;
  const cached = getCachedData<any[]>(cacheKey);
  if (cached && Array.isArray(cached)) return cached;

  try {
    const q = query(collection(db, 'watchHistory'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const rows = snap.docs
      .map((d) => {
        const data = d.data();
        const curr = Number(data.currentTime ?? data.current_time ?? data.progress_seconds ?? 0);
        const dur = Number(data.duration ?? data.duration_seconds ?? 1440);
        return {
          ...data,
          id: d.id,
          userId: data.userId || userId,
          animeId: data.animeId || data.anime_id,
          anime_id: data.animeId || data.anime_id,
          episodeId: data.episodeId || data.episode_id,
          episode_id: data.episodeId || data.episode_id,
          animeTitle: data.animeTitle || data.anime_title || 'Anime',
          anime_title: data.animeTitle || data.anime_title || 'Anime',
          episodeTitle: data.episodeTitle || data.episode_title || '',
          episode_title: data.episodeTitle || data.episode_title || '',
          seasonNumber: data.seasonNumber || data.season_number || 1,
          episodeNumber: data.episodeNumber || data.episode_number || 1,
          posterUrl: data.posterUrl || data.poster_url || '',
          poster_url: data.posterUrl || data.poster_url || '',
          currentTime: curr,
          current_time: curr,
          duration: dur,
          duration_seconds: dur,
          progress_seconds: curr,
          percentage: dur > 0 ? Math.min(100, Math.round((curr / dur) * 100)) : 0,
          updatedAt: data.updatedAt || data.updated_at || 0,
        };
      })
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    setCachedData(cacheKey, rows);
    return rows;
  } catch (err) {
    console.warn('[Firestore Error - getUserProgress]:', formatDbError(err));
    return [];
  }
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
  const currentUid = auth?.currentUser?.uid;
  if (!db || !currentUid || currentUid !== progress.userId || !progress.episodeId) return;

  const cleanUid = safeDocId(currentUid);
  const cleanAnimeId = safeDocId(progress.animeId);
  const cleanEpisodeId = safeDocId(progress.episodeId);
  const docId = `${cleanUid}_${cleanEpisodeId}`;

  clearCachedData(`user_progress_${progress.userId}`);
  const currTime = Math.max(0, Number(progress.currentTime || 0));
  const dur = Math.max(1, Number(progress.duration || 1440));
  const pct = Math.min(100, Math.round((currTime / dur) * 100));
  const nowIso = new Date().toISOString();

  const payload = {
    id: docId,
    userId: currentUid,
    user_id: currentUid,
    animeId: cleanAnimeId,
    anime_id: cleanAnimeId,
    animeTitle: sanitizeString(progress.animeTitle || '', 300),
    anime_title: sanitizeString(progress.animeTitle || '', 300),
    episodeId: cleanEpisodeId,
    episode_id: cleanEpisodeId,
    episodeTitle: sanitizeString(progress.episodeTitle || '', 250),
    episode_title: sanitizeString(progress.episodeTitle || '', 250),
    seasonId: sanitizeString(progress.seasonId || 's1', 128),
    season_id: sanitizeString(progress.seasonId || 's1', 128),
    seasonNumber: Number(progress.seasonNumber || 1),
    season_number: Number(progress.seasonNumber || 1),
    episodeNumber: Number(progress.episodeNumber || 1),
    episode_number: Number(progress.episodeNumber || 1),
    posterUrl: sanitizeUrl(progress.posterUrl || ''),
    poster_url: sanitizeUrl(progress.posterUrl || ''),
    currentTime: currTime,
    current_time: currTime,
    duration: dur,
    duration_seconds: dur,
    progress_seconds: currTime,
    percentage: pct,
    updatedAt: nowIso,
    updated_at: nowIso,
    last_watched: nowIso,
  };

  try {
    await setDoc(doc(db, 'watchHistory', docId), payload, { merge: true });
  } catch (err) {
    console.warn('[Firestore Error - saveUserProgress]:', formatDbError(err));
  }
}

export async function deleteUserProgress(userId: string, episodeId: string): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  if (!db || !currentUid || currentUid !== userId || !episodeId) return;

  clearCachedData(`user_progress_${userId}`);
  const docId = `${safeDocId(currentUid)}_${safeDocId(episodeId)}`;
  try {
    await deleteDoc(doc(db, 'watchHistory', docId));
  } catch (err) {
    console.warn('[Firestore Error - deleteUserProgress]:', formatDbError(err));
  }
}

export async function clearUserWatchHistory(userId: string): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  if (!db || !currentUid || currentUid !== userId) return;
  clearCachedData(`user_progress_${userId}`);

  try {
    const snap = await getDocs(query(collection(db, 'watchHistory'), where('userId', '==', userId)));
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'watchHistory', d.id))));
  } catch (err) {
    console.warn('[Firestore Error - clearUserWatchHistory]:', formatDbError(err));
  }
}

// -------------------------------------------------------------
// WATCH HISTORY, FAVORITES & WATCHLIST (FIRESTORE)
// -------------------------------------------------------------

export async function getWatchHistory(userId: string): Promise<any[]> {
  return await getUserProgress(userId);
}

export async function getFavorites(userId: string): Promise<any[]> {
  if (!userId || !db || !auth?.currentUser || auth.currentUser.uid !== userId) return [];
  const cacheKey = `favorites_${userId}`;
  const cached = getCachedData<any[]>(cacheKey);
  if (cached && Array.isArray(cached)) return cached;

  try {
    const snap = await getDocs(query(collection(db, 'favorites'), where('userId', '==', userId)));
    const rows: any[] = snap.docs
      .map((d): any => {
        const data = d.data();
        return {
          ...data,
          id: data.animeId || d.id,
          docId: d.id,
          anime_id: data.animeId || data.anime_id,
          title: data.animeTitle || data.title || 'Anime',
          poster_url: data.posterUrl || data.poster_url || '',
        };
      })
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    setCachedData(cacheKey, rows);
    return rows;
  } catch (err) {
    console.warn('[Firestore Error - getFavorites]:', formatDbError(err));
    return [];
  }
}

export async function addFavorite(
  userId: string,
  anime: { id: string; title: string; posterUrl?: string }
): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  if (!db || !currentUid || currentUid !== userId || !anime.id) return;

  const cleanUid = safeDocId(currentUid);
  const cleanAnimeId = safeDocId(anime.id);
  const docId = `${cleanUid}_${cleanAnimeId}`;

  clearCachedData(`favorites_${userId}`);
  const cleanTitle = sanitizeString(anime.title, 300);
  const cleanPoster = sanitizeUrl(anime.posterUrl || '');

  try {
    await setDoc(doc(db, 'favorites', docId), {
      id: docId,
      userId: currentUid,
      user_id: currentUid,
      animeId: cleanAnimeId,
      anime_id: cleanAnimeId,
      animeTitle: cleanTitle,
      anime_title: cleanTitle,
      title: cleanTitle,
      posterUrl: cleanPoster,
      poster_url: cleanPoster,
      createdAt: Date.now(),
      created_at: new Date().toISOString(),
    });
    trackFirebaseAnalyticsEvent('add_to_favorites', { anime_id: cleanAnimeId }).catch(() => {});
  } catch (err) {
    console.warn('[Firestore Error - addFavorite]:', formatDbError(err));
  }
}

export async function removeFavorite(userId: string, animeId: string): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  if (!db || !currentUid || currentUid !== userId || !animeId) return;

  clearCachedData(`favorites_${userId}`);
  const docId = `${safeDocId(currentUid)}_${safeDocId(animeId)}`;
  try {
    await deleteDoc(doc(db, 'favorites', docId));
  } catch (err) {
    console.warn('[Firestore Error - removeFavorite]:', formatDbError(err));
  }
}

export async function isFavorite(userId: string, animeId: string): Promise<boolean> {
  if (!userId || !animeId || !auth?.currentUser) return false;
  const favs = await getFavorites(userId);
  return favs.some((f: any) => f.animeId === animeId || f.anime_id === animeId || f.id === animeId);
}

export async function getWatchlist(userId: string): Promise<any[]> {
  if (!userId || !db || !auth?.currentUser || auth.currentUser.uid !== userId) return [];
  const cacheKey = `watchlist_${userId}`;
  const cached = getCachedData<any[]>(cacheKey);
  if (cached && Array.isArray(cached)) return cached;

  try {
    const snap = await getDocs(query(collection(db, 'watchlist'), where('userId', '==', userId)));
    const rows: any[] = snap.docs
      .map((d): any => {
        const data = d.data();
        return {
          ...data,
          id: data.animeId || d.id,
          docId: d.id,
          anime_id: data.animeId || data.anime_id,
          title: data.animeTitle || data.title || 'Anime',
          poster_url: data.posterUrl || data.poster_url || '',
        };
      })
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    setCachedData(cacheKey, rows);
    return rows;
  } catch (err) {
    console.warn('[Firestore Error - getWatchlist]:', formatDbError(err));
    return [];
  }
}

export async function addToWatchlist(
  userId: string,
  anime: { id: string; title: string; posterUrl?: string; status?: string }
): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  if (!db || !currentUid || currentUid !== userId || !anime.id) return;

  const cleanUid = safeDocId(currentUid);
  const cleanAnimeId = safeDocId(anime.id);
  const docId = `${cleanUid}_${cleanAnimeId}`;

  clearCachedData(`watchlist_${userId}`);
  const cleanTitle = sanitizeString(anime.title, 300);
  const cleanPoster = sanitizeUrl(anime.posterUrl || '');

  try {
    await setDoc(doc(db, 'watchlist', docId), {
      id: docId,
      userId: currentUid,
      user_id: currentUid,
      animeId: cleanAnimeId,
      anime_id: cleanAnimeId,
      animeTitle: cleanTitle,
      anime_title: cleanTitle,
      title: cleanTitle,
      posterUrl: cleanPoster,
      poster_url: cleanPoster,
      status: sanitizeString(anime.status || 'Plan to Watch', 50),
      createdAt: Date.now(),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Firestore Error - addToWatchlist]:', formatDbError(err));
  }
}

export async function removeFromWatchlist(userId: string, animeId: string): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  if (!db || !currentUid || currentUid !== userId || !animeId) return;

  clearCachedData(`watchlist_${userId}`);
  const docId = `${safeDocId(currentUid)}_${safeDocId(animeId)}`;
  try {
    await deleteDoc(doc(db, 'watchlist', docId));
  } catch (err) {
    console.warn('[Firestore Error - removeFromWatchlist]:', formatDbError(err));
  }
}

export async function isInWatchlist(userId: string, animeId: string): Promise<boolean> {
  if (!userId || !animeId || !auth?.currentUser) return false;
  const list = await getWatchlist(userId);
  return list.some((w: any) => w.animeId === animeId || w.anime_id === animeId || w.id === animeId);
}

// -------------------------------------------------------------
// BANNERS, COMMENTS, RATINGS, NOTIFICATIONS, PREMIUM PLANS & PAYMENTS
// -------------------------------------------------------------

export async function getActiveBanners(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
  } catch {
    return [];
  }
}

export async function getCommentsByAnimeId(animeId: string): Promise<any[]> {
  if (!db || !animeId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'comments'), where('animeId', '==', animeId)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  } catch {
    return [];
  }
}

export async function addAnimeComment(params: {
  animeId: string;
  episodeId?: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
}): Promise<string | null> {
  if (!db || !auth?.currentUser || auth.currentUser.uid !== params.userId) return null;
  const docRef = await addDoc(collection(db, 'comments'), {
    animeId: safeDocId(params.animeId),
    ...(params.episodeId ? { episodeId: safeDocId(params.episodeId) } : {}),
    userId: auth.currentUser.uid,
    userName: sanitizeString(params.userName, 120),
    userPhoto: sanitizeUrl(params.userPhoto || ''),
    text: sanitizeString(params.text, 2000),
    createdAt: Date.now(),
  });
  return docRef.id;
}

export async function getPublicNotifications(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'notifications'), where('isPublic', '==', true)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  } catch {
    return [];
  }
}

export async function getActivePremiumPlans(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'premiumPlans'), where('active', '==', true)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}
