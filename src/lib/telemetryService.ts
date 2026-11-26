import { db, trackFirebaseAnalyticsEvent } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { dispatchOwnerNotification } from './ownerNotificationService';

export interface LiveVisitorRecord {
  visitorId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  isLoggedIn: boolean;
  device: 'Mobile' | 'Desktop' | 'Tablet' | 'Smart TV';
  browser: string;
  os: string;
  country: string;
  countryCode: string;
  currentPage: string;
  currentTitle: string;
  currentAnimeTitle?: string | null;
  currentEpisode?: number | null;
  currentAnimeId?: string | null;
  currentEpisodeId?: string | null;
  isPlaying: boolean;
  lastActivityAt: number;
  startedAt: number;
  referrer: string;
}

export interface AnalyticsEventRecord {
  id?: string;
  type: 'page_view' | 'play' | 'duration' | 'completion' | 'search' | 'favorite' | 'rating' | 'comment';
  path: string;
  animeId?: string | null;
  animeTitle?: string | null;
  episodeId?: string | null;
  episodeNumber?: number | null;
  userId?: string | null;
  userEmail?: string | null;
  visitorId: string;
  device: string;
  browser: string;
  country: string;
  referrer: string;
  duration?: number;
  progressSeconds?: number;
  queryText?: string;
  ratingValue?: number;
  timestamp: number;
}

// Country detection helper from client timezone
export function detectClientCountry(): { country: string; code: string } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzLower = tz.toLowerCase();

    if (tzLower.includes('calcutta') || tzLower.includes('kolkata') || tzLower.includes('india')) {
      return { country: 'India', code: 'IN' };
    }
    if (tzLower.includes('karachi') || tzLower.includes('pakistan')) {
      return { country: 'Pakistan', code: 'PK' };
    }
    if (tzLower.includes('dhaka') || tzLower.includes('bangladesh')) {
      return { country: 'Bangladesh', code: 'BD' };
    }
    if (tzLower.includes('kathmandu') || tzLower.includes('nepal')) {
      return { country: 'Nepal', code: 'NP' };
    }
    if (tzLower.includes('dubai') || tzLower.includes('uae') || tzLower.includes('abu_dhabi')) {
      return { country: 'United Arab Emirates', code: 'AE' };
    }
    if (tzLower.includes('riyadh') || tzLower.includes('saudi')) {
      return { country: 'Saudi Arabia', code: 'SA' };
    }
    if (tzLower.includes('london') || tzLower.includes('united_kingdom') || tzLower.includes('belfast')) {
      return { country: 'United Kingdom', code: 'GB' };
    }
    if (tzLower.includes('new_york') || tzLower.includes('los_angeles') || tzLower.includes('chicago') || tzLower.includes('america')) {
      return { country: 'United States', code: 'US' };
    }
    if (tzLower.includes('toronto') || tzLower.includes('vancouver') || tzLower.includes('canada')) {
      return { country: 'Canada', code: 'CA' };
    }
    if (tzLower.includes('sydney') || tzLower.includes('melbourne') || tzLower.includes('australia')) {
      return { country: 'Australia', code: 'AU' };
    }
    if (tzLower.includes('tokyo') || tzLower.includes('japan')) {
      return { country: 'Japan', code: 'JP' };
    }
    if (tzLower.includes('singapore')) {
      return { country: 'Singapore', code: 'SG' };
    }
    if (tzLower.includes('berlin') || tzLower.includes('germany')) {
      return { country: 'Germany', code: 'DE' };
    }
    if (tzLower.includes('paris') || tzLower.includes('france')) {
      return { country: 'France', code: 'FR' };
    }
    if (tzLower.includes('colombo') || tzLower.includes('sri_lanka')) {
      return { country: 'Sri Lanka', code: 'LK' };
    }

    // Fallback: extract region from timezone string if possible
    if (tz.includes('/')) {
      const parts = tz.split('/');
      const city = parts[1].replace(/_/g, ' ');
      return { country: city, code: 'GL' };
    }

    return { country: 'Global', code: 'UN' };
  } catch {
    return { country: 'India', code: 'IN' };
  }
}

// Device detection helper
export function detectClientDevice(): 'Mobile' | 'Desktop' | 'Tablet' | 'Smart TV' {
  if (typeof window === 'undefined') return 'Desktop';
  const ua = (navigator.userAgent || '').toLowerCase();
  
  if (ua.includes('smart-tv') || ua.includes('tizen') || ua.includes('webos') || ua.includes('appletv') || ua.includes('googletv') || ua.includes('hbbtv')) {
    return 'Smart TV';
  }
  
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua);
  if (isTablet || (window.innerWidth >= 600 && window.innerWidth <= 1024 && 'ontouchstart' in window)) {
    return 'Tablet';
  }
  
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/.test(ua) || (window.innerWidth < 640);
  if (isMobile) {
    return 'Mobile';
  }
  
  return 'Desktop';
}

// Browser detection helper
export function detectClientBrowser(): string {
  if (typeof window === 'undefined') return 'Browser';
  const ua = navigator.userAgent;
  
  if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  
  return 'Chrome';
}

// OS detection helper
export function detectClientOS(): string {
  if (typeof window === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('CrOS')) return 'ChromeOS';
  
  return 'Unknown OS';
}

// Persistent visitor ID and visit counter
const VISITOR_ID_KEY = 'zk_visitor_id';
const VISIT_COUNT_KEY = 'zk_visit_count';
const LAST_VISIT_TIME_KEY = 'zk_last_visit_time';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server_guest';
  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(VISITOR_ID_KEY, vid);
  }
  return vid;
}

export function recordVisitorSession(): { isReturning: boolean; visitCount: number } {
  if (typeof window === 'undefined') return { isReturning: false, visitCount: 1 };
  
  const countStr = localStorage.getItem(VISIT_COUNT_KEY);
  const lastTimeStr = localStorage.getItem(LAST_VISIT_TIME_KEY);
  const now = Date.now();
  
  let count = countStr ? parseInt(countStr, 10) : 0;
  const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
  
  // Count as new session if > 30 minutes since last activity
  if (!lastTime || now - lastTime > 30 * 60 * 1000) {
    count += 1;
    localStorage.setItem(VISIT_COUNT_KEY, count.toString());
  }
  
  localStorage.setItem(LAST_VISIT_TIME_KEY, now.toString());
  return { isReturning: count > 1, visitCount: count };
}

// Referrer parser
export function getTrafficSource(): string {
  if (typeof document === 'undefined') return 'Direct';
  const ref = document.referrer || '';
  if (!ref) return 'Direct';
  
  try {
    const url = new URL(ref);
    const host = url.hostname.toLowerCase();
    
    if (host.includes('google')) return 'Google Search';
    if (host.includes('youtube')) return 'YouTube';
    if (host.includes('t.me') || host.includes('telegram')) return 'Telegram';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
    if (host.includes('twitter') || host.includes('x.com')) return 'X / Twitter';
    if (host.includes('reddit')) return 'Reddit';
    if (host.includes('bing') || host.includes('yahoo')) return 'Search Engine';
    
    return host.replace(/^www\./, '');
  } catch {
    return 'Referral';
  }
}

// Current active session state
let currentSession: {
  visitorId: string;
  currentPage: string;
  currentTitle: string;
  currentAnimeTitle?: string | null;
  currentEpisode?: number | null;
  currentAnimeId?: string | null;
  currentEpisodeId?: string | null;
  isPlaying: boolean;
  startedAt: number;
} | null = null;

let heartbeatTimer: any = null;

/**
 * Publishes heartbeat for live visitor presence
 */
export async function sendVisitorHeartbeat(
  user?: { uid?: string; email?: string | null; displayName?: string | null } | null
): Promise<void> {
  if (!db || typeof window === 'undefined') return;
  
  const visitorId = getVisitorId();
  const geo = detectClientCountry();
  const device = detectClientDevice();
  const browser = detectClientBrowser();
  const os = detectClientOS();
  const referrer = getTrafficSource();
  const now = Date.now();
  
  const record: LiveVisitorRecord = {
    visitorId,
    userId: user?.uid || null,
    userName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Guest Visitor'),
    userEmail: user?.email || null,
    isLoggedIn: Boolean(user?.uid),
    device,
    browser,
    os,
    country: geo.country,
    countryCode: geo.code,
    currentPage: currentSession?.currentPage || window.location.pathname,
    currentTitle: currentSession?.currentTitle || document.title,
    currentAnimeTitle: currentSession?.currentAnimeTitle || null,
    currentEpisode: currentSession?.currentEpisode || null,
    currentAnimeId: currentSession?.currentAnimeId || null,
    currentEpisodeId: currentSession?.currentEpisodeId || null,
    isPlaying: Boolean(currentSession?.isPlaying),
    lastActivityAt: now,
    startedAt: currentSession?.startedAt || now,
    referrer,
  };

  try {
    const visitorDocRef = doc(db, 'live_visitors', visitorId);
    await setDoc(visitorDocRef, record, { merge: true });
  } catch (err) {
    // Non-blocking for offline or restricted environments
  }
}

/**
 * Start presence tracking across the application
 */
export function startTelemetryPresence(
  user?: { uid?: string; email?: string | null; displayName?: string | null } | null
): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const visitorId = getVisitorId();
  recordVisitorSession();
  
  if (!currentSession) {
    currentSession = {
      visitorId,
      currentPage: window.location.pathname,
      currentTitle: document.title,
      isPlaying: false,
      startedAt: Date.now(),
    };
  }

  // Send initial ping immediately
  sendVisitorHeartbeat(user);

  // Send periodic ping every 25 seconds
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    sendVisitorHeartbeat(user);
  }, 25000);

  // Handle visibility changes
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      sendVisitorHeartbeat(user);
    } else if (currentSession) {
      currentSession.isPlaying = false;
      sendVisitorHeartbeat(user);
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

/**
 * Track a page visit
 */
export async function trackPageVisit(
  path: string,
  title: string,
  user?: { uid?: string; email?: string | null } | null
): Promise<void> {
  const visitorId = getVisitorId();
  const geo = detectClientCountry();
  const device = detectClientDevice();
  const browser = detectClientBrowser();
  const referrer = getTrafficSource();
  const now = Date.now();

  if (currentSession) {
    currentSession.currentPage = path;
    currentSession.currentTitle = title;
  } else {
    currentSession = {
      visitorId,
      currentPage: path,
      currentTitle: title,
      isPlaying: false,
      startedAt: now,
    };
  }

  // Heartbeat immediately update current page
  sendVisitorHeartbeat(user);

  // Record telemetry event in Firestore + Firebase Analytics
  trackFirebaseAnalyticsEvent('page_view', {
    page_path: path,
    page_title: title,
  }).catch(() => {});

  if (db) {
    try {
      const eventsRef = collection(db, 'analytics_events');
      await addDoc(eventsRef, {
        type: 'page_view',
        path,
        title,
        visitorId,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        device,
        browser,
        country: geo.country,
        referrer,
        timestamp: now,
      });
    } catch {}
  }
}

/**
 * Track a video play start
 */
export async function trackPlayStart(params: {
  animeId: string;
  animeTitle: string;
  episodeId: string;
  episodeNumber: number;
  user?: { uid?: string; email?: string | null } | null;
}): Promise<void> {
  const { animeId, animeTitle, episodeId, episodeNumber, user } = params;
  const visitorId = getVisitorId();
  const geo = detectClientCountry();
  const device = detectClientDevice();
  const browser = detectClientBrowser();
  const referrer = getTrafficSource();
  const now = Date.now();

  if (currentSession) {
    currentSession.currentAnimeId = animeId;
    currentSession.currentAnimeTitle = animeTitle;
    currentSession.currentEpisodeId = episodeId;
    currentSession.currentEpisode = episodeNumber;
    currentSession.isPlaying = true;
  }

  sendVisitorHeartbeat(user);

  trackFirebaseAnalyticsEvent('video_start', {
    anime_id: animeId,
    anime_title: animeTitle,
    episode_id: episodeId,
    episode_number: episodeNumber,
  }).catch(() => {});

  if (db) {
    try {
      const eventsRef = collection(db, 'analytics_events');
      await addDoc(eventsRef, {
        type: 'play',
        path: window.location.pathname,
        animeId,
        animeTitle,
        episodeId,
        episodeNumber,
        visitorId,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        device,
        browser,
        country: geo.country,
        referrer,
        timestamp: now,
      });
    } catch {}
  }
}

/**
 * Track video watch duration and progress
 */
export async function trackWatchProgress(params: {
  animeId: string;
  animeTitle: string;
  episodeId: string;
  episodeNumber: number;
  progressSeconds: number;
  durationSeconds: number;
  user?: { uid?: string; email?: string | null } | null;
}): Promise<void> {
  const { animeId, animeTitle, episodeId, episodeNumber, progressSeconds, durationSeconds, user } = params;
  const now = Date.now();

  // If completed (> 88%)
  const isCompleted = durationSeconds > 0 && (progressSeconds / durationSeconds) >= 0.88;

  if (isCompleted) {
    trackFirebaseAnalyticsEvent('video_complete', {
      anime_id: animeId,
      episode_id: episodeId,
      episode_number: episodeNumber,
    }).catch(() => {});
  }

  if (db && isCompleted) {
    try {
      const eventsRef = collection(db, 'analytics_events');
      await addDoc(eventsRef, {
        type: 'completion',
        path: window.location.pathname,
        animeId,
        animeTitle,
        episodeId,
        episodeNumber,
        visitorId: getVisitorId(),
        userId: user?.uid || null,
        timestamp: now,
      });
    } catch {}
  }
}

/**
 * Track search queries
 */
export async function trackSearchTelemetry(queryText: string): Promise<void> {
  const clean = (queryText || '').trim();
  if (!clean || clean.length < 2 || !db) return;

  trackFirebaseAnalyticsEvent('search', { search_term: clean }).catch(() => {});

  try {
    const eventsRef = collection(db, 'analytics_events');
    await addDoc(eventsRef, {
      type: 'search',
      queryText: clean,
      visitorId: getVisitorId(),
      timestamp: Date.now(),
    });
  } catch {}
}

/**
 * Track system alerts to owner notification center
 */
export function dispatchSystemAlert(alert: {
  type: 'high_traffic' | 'failed_login' | 'server_error' | 'database_error' | 'new_episode';
  title: string;
  details: string;
  metadata?: any;
}): void {
  dispatchOwnerNotification({
    type: alert.type as any,
    title: alert.title,
    details: alert.details,
    category: 'system_alert',
    timestamp: Date.now(),
  }).catch(() => {});
}

// ------------------------------------------------------------------------------
// REAL-TIME SUBSCRIBERS FOR ADMIN ANALYTICS DASHBOARD
// ------------------------------------------------------------------------------

/**
 * Real-time listener for live online visitors
 */
export function subscribeToLiveVisitors(callback: (visitors: LiveVisitorRecord[]) => void): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  try {
    const visitorsRef = collection(db, 'live_visitors');
    // Active within the last 3 minutes
    const q = query(visitorsRef, orderBy('lastActivityAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const activeWindowMs = 2.5 * 60 * 1000; // 2.5 minutes active window
        const list: LiveVisitorRecord[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LiveVisitorRecord;
          if (data && data.lastActivityAt && (now - data.lastActivityAt < activeWindowMs)) {
            list.push(data);
          }
        });

        callback(list);
      },
      (err) => {
        console.warn('[Telemetry] Live visitors snapshot notice:', err);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[Telemetry] Error setting up live visitors listener:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Real-time listener for recent analytics events
 */
export function subscribeToAnalyticsEvents(callback: (events: AnalyticsEventRecord[]) => void): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  try {
    const eventsRef = collection(db, 'analytics_events');
    const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const events: AnalyticsEventRecord[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          events.push({ id: docSnap.id, ...(d as any) });
        });
        callback(events);
      },
      (err) => {
        console.warn('[Telemetry] Analytics events snapshot notice:', err);
        callback([]);
      }
    );

    return unsubscribe;
  } catch {
    callback([]);
    return () => {};
  }
}
