import { dispatchOwnerNotification } from './ownerNotificationService';

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
    case 'anime': return '/admin/anime';
    case 'season': return '/admin/seasons';
    case 'episode': return '/admin/episodes';
    case 'user': return '/admin/users';
    case 'media': return '/admin/media';
    case 'settings': return '/admin/settings';
    case 'security': return '/admin/security';
    default: return '/admin';
  }
}

export function getAdminActivityLogs(): ActivityLogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed default initial logs for realistic experience
      const defaultLogs: ActivityLogItem[] = [
        {
          id: 'log-1',
          action: 'System Initialized',
          category: 'security',
          details: 'Dual sync Firestore + Supabase connection verified active',
          timestamp: Date.now() - 1000 * 60 * 30,
          user: 'zkdubbingstudio@gmail.com',
        },
        {
          id: 'log-2',
          action: 'Streaming Server Updated',
          category: 'settings',
          details: 'Configured Server 1 (Abyss), Server 2 (FileMoon), Server 3 (VDOHide)',
          timestamp: Date.now() - 1000 * 60 * 15,
          user: 'zkdubbingstudio@gmail.com',
        },
        {
          id: 'log-3',
          action: 'Admin Panel Authenticated',
          category: 'security',
          details: 'Admin session started successfully',
          timestamp: Date.now() - 1000 * 60 * 5,
          user: 'zkdubbingstudio@gmail.com',
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultLogs));
      return defaultLogs;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
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
      action,
      category,
      details,
      timestamp: Date.now(),
      user,
    };
    logs.unshift(newLog);
    if (logs.length > 100) logs.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

    // Alert the owner (zkdubbingstudio@gmail.com) via real-time toast notification
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

export function clearAdminActivityLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
