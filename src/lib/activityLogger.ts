import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from './firebase';
import { dispatchOwnerNotification } from './ownerNotificationService';
import { isOwnerEmail, sanitizeString } from './security';
import { auth } from './firebase';

export interface ActivityLogItem {
  id: string;
  action: string;
  category: 'anime' | 'season' | 'episode' | 'user' | 'media' | 'settings' | 'security';
  details: string;
  timestamp: number;
  user: string;
}

const STORAGE_KEY = 'zk_admin_activity_log';

function getCategoryUrl(category: ActivityLogItem['category']): string {
  switch (category) {
    case 'anime':
      return '/admin/anime';
    case 'season':
      return '/admin/seasons';
    case 'episode':
      return '/admin/episodes';
    case 'user':
      return '/admin/users';
    case 'media':
      return '/admin/media';
    case 'settings':
      return '/admin/settings';
    case 'security':
      return '/admin/security';
    default:
      return '/admin';
  }
}

export function getAdminActivityLogs(): ActivityLogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function fetchAdminActivityLogs(): Promise<ActivityLogItem[]> {
  if (db && isOwnerEmail(auth?.currentUser?.email)) {
    try {
      const q = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      const logs: ActivityLogItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          action: data.action || 'Action',
          category: data.category || 'security',
          details: data.details || '',
          timestamp: Number(data.timestamp) || Date.now(),
          user: data.user || 'zkdubbingstudio@gmail.com',
        };
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
      } catch {}
      return logs;
    } catch {}
  }
  return getAdminActivityLogs();
}

export function logAdminActivity(
  action: string,
  category: ActivityLogItem['category'],
  details: string,
  user: string = 'zkdubbingstudio@gmail.com'
): void {
  try {
    const logs = getAdminActivityLogs();
    const newLog: ActivityLogItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      action: sanitizeString(action, 200),
      category,
      details: sanitizeString(details, 2000),
      timestamp: Date.now(),
      user: sanitizeString(user, 150),
    };
    logs.unshift(newLog);
    if (logs.length > 100) logs.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

    // Persist directly to Firestore adminLogs collection (verified owner only)
    if (db && isOwnerEmail(auth?.currentUser?.email)) {
      addDoc(collection(db, 'adminLogs'), newLog).catch(() => {});
    }

    dispatchOwnerNotification({
      type: 'admin_action',
      title: `Admin Action: ${action}`,
      details,
      category,
      actionUrl: getCategoryUrl(category),
      timestamp: newLog.timestamp,
    }).catch(() => {});
  } catch {}
}

export async function clearAdminActivityLogs(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  if (db && isOwnerEmail(auth?.currentUser?.email)) {
    try {
      const snap = await getDocs(collection(db, 'adminLogs'));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'adminLogs', d.id))));
    } catch {}
  }
}
