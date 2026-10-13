import { create } from 'zustand';
import { db } from './firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { isAuthorizedAdmin } from './authService';

export interface OwnerToastNotification {
  id: string;
  type: 'new_user' | 'admin_action';
  title: string;
  details: string;
  timestamp: number;
  category?: string;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  actionUrl?: string;
  read?: boolean;
}

const STORAGE_KEY = 'zk_owner_notifications';
const SOUND_SETTING_KEY = 'zk_owner_notif_sound';

// Native Web Audio synth for crisp, instant cyberpunk notification chime
export function playCyberChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // First high note (Cyber ping)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // E6
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second harmonic chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1320, now + 0.09);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.16); // A6
    gain2.gain.setValueAtTime(0.08, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.35);
  } catch {
    // Silently ignore audio playback errors
  }
}

// Initial stored notifications
function loadStoredHistory(): OwnerToastNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadSoundPref(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_SETTING_KEY);
    return raw !== null ? JSON.parse(raw) : true;
  } catch {
    return true;
  }
}

interface OwnerNotificationsStore {
  toasts: OwnerToastNotification[];
  history: OwnerToastNotification[];
  unreadCount: number;
  soundEnabled: boolean;
  addToast: (item: Omit<OwnerToastNotification, 'id' | 'timestamp'> & { timestamp?: number }) => void;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
  markAllRead: () => void;
  clearHistory: () => void;
  toggleSound: () => void;
}

export const useOwnerNotificationsStore = create<OwnerNotificationsStore>((set, get) => ({
  toasts: [],
  history: loadStoredHistory(),
  unreadCount: loadStoredHistory().filter((n) => !n.read).length,
  soundEnabled: loadSoundPref(),

  addToast: (item) => {
    const id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newNotif: OwnerToastNotification = {
      ...item,
      id,
      timestamp: item.timestamp || Date.now(),
      read: false,
    };

    const state = get();
    if (state.soundEnabled) {
      playCyberChime();
    }

    // Keep up to 4 toasts visible at once
    const updatedToasts = [newNotif, ...state.toasts.slice(0, 3)];

    // Update history (up to 50 items)
    const updatedHistory = [newNotif, ...state.history.filter((h) => h.id !== id)].slice(0, 50);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch {}

    set({
      toasts: updatedToasts,
      history: updatedHistory,
      unreadCount: updatedHistory.filter((n) => !n.read).length,
    });

    // Auto-dismiss after 6.5 seconds
    setTimeout(() => {
      set((current) => ({
        toasts: current.toasts.filter((t) => t.id !== id),
      }));
    }, 6500);
  },

  dismissToast: (id: string) => {
    set((current) => ({
      toasts: current.toasts.filter((t) => t.id !== id),
    }));
  },

  dismissAllToasts: () => {
    set({ toasts: [] });
  },

  markAllRead: () => {
    const updated = get().history.map((h) => ({ ...h, read: true }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    set({ history: updated, unreadCount: 0 });
  },

  clearHistory: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    set({ history: [], unreadCount: 0 });
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    try {
      localStorage.setItem(SOUND_SETTING_KEY, JSON.stringify(next));
    } catch {}
    set({ soundEnabled: next });
    if (next) {
      playCyberChime();
    }
  },
}));

// Set of handled notification IDs to avoid duplicate toasts in current session
const handledNotificationIds = new Set<string>();

/**
 * Dispatch an owner notification across the application and persist to Firestore
 */
export async function dispatchOwnerNotification(
  notification: Omit<OwnerToastNotification, 'id' | 'timestamp'> & { timestamp?: number }
) {
  const timestamp = notification.timestamp || Date.now();
  const tempId = `local_${timestamp}_${Math.random().toString(36).substring(2, 6)}`;
  handledNotificationIds.add(tempId);

  // 1. Immediately trigger local toast for any active session
  useOwnerNotificationsStore.getState().addToast({
    ...notification,
    timestamp,
  });

  // 2. Persist to Firestore admin_notifications collection for cross-device real-time sync
  if (db) {
    try {
      const notifsRef = collection(db, 'admin_notifications');
      await addDoc(notifsRef, {
        type: notification.type,
        title: notification.title,
        details: notification.details,
        category: notification.category || 'general',
        userEmail: notification.userEmail || null,
        userName: notification.userName || null,
        userPhoto: notification.userPhoto || null,
        actionUrl: notification.actionUrl || null,
        timestamp,
        read: false,
      });
    } catch (err) {
      console.warn('Could not write admin notification to Firestore:', err);
    }
  }
}

/**
 * Real-time Firestore listener for the owner (zkdubbingstudio@gmail.com)
 */
export function subscribeToOwnerNotifications(currentUserEmail: string | null | undefined): () => void {
  if (!currentUserEmail || !isAuthorizedAdmin(currentUserEmail) || !db) {
    return () => {};
  }

  // Record mount timestamp - only notify for events occurring after session start
  const sessionStartTime = Date.now() - 3000;

  try {
    const notifsRef = collection(db, 'admin_notifications');
    const q = query(notifsRef, orderBy('timestamp', 'desc'), limit(15));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const docId = change.doc.id;

            // Only show toast if timestamp is recent and hasn't been displayed in this tab
            if (data.timestamp && data.timestamp >= sessionStartTime && !handledNotificationIds.has(docId)) {
              handledNotificationIds.add(docId);
              useOwnerNotificationsStore.getState().addToast({
                type: data.type || 'admin_action',
                title: data.title || 'Notification',
                details: data.details || '',
                category: data.category,
                userEmail: data.userEmail,
                userName: data.userName,
                userPhoto: data.userPhoto,
                actionUrl: data.actionUrl,
                timestamp: data.timestamp,
              });
            }
          }
        });
      },
      (err) => {
        console.warn('Owner notifications snapshot listener notice:', err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to owner notifications:', err);
    return () => {};
  }
}
