import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { assertOwner, sanitizeString, sanitizeUrl } from './security';

export interface AdminWebsiteSettings {
  websiteName: string;
  tagline: string;
  logoUrl: string;
  telegramLink: string;
  discordLink: string;
  youtubeLink: string;
  facebookLink: string;
  theme: 'electric-blue' | 'cyberpunk-neon' | 'obsidian-gold';
  maintenanceMode: boolean;
  maintenanceMessage: string;
  sessionTimeoutMinutes: number;
}

const SETTINGS_KEY = 'zk_admin_website_settings';
const SETTINGS_DOC_ID = 'public_site_settings';

export const DEFAULT_ADMIN_SETTINGS: AdminWebsiteSettings = {
  websiteName: 'ZK Voice Hub',
  tagline: 'PRESENTING BY: ZK DUBBING STUDIO',
  logoUrl: 'https://i.ibb.co/2Yp3CDq9/file-000000006f2c8211b20c6bedc9f9ac12.png',
  telegramLink: 'https://t.me/zkdubbingstudio',
  discordLink: 'https://discord.gg/zkdubbing',
  youtubeLink: 'https://youtube.com/@zkdubbingstudio',
  facebookLink: 'https://facebook.com/zkdubbingstudio',
  theme: 'electric-blue',
  maintenanceMode: false,
  maintenanceMessage: 'ZK Voice Hub is currently undergoing scheduled maintenance. We will be back online shortly!',
  sessionTimeoutMinutes: 60,
};

function mapServerSettings(row: any): AdminWebsiteSettings {
  return {
    websiteName: row.websiteName || row.website_name || DEFAULT_ADMIN_SETTINGS.websiteName,
    tagline: row.tagline ?? DEFAULT_ADMIN_SETTINGS.tagline,
    logoUrl: row.logoUrl || row.logo_url || DEFAULT_ADMIN_SETTINGS.logoUrl,
    telegramLink: row.telegramLink ?? row.telegram_link ?? DEFAULT_ADMIN_SETTINGS.telegramLink,
    discordLink: row.discordLink ?? row.discord_link ?? DEFAULT_ADMIN_SETTINGS.discordLink,
    youtubeLink: row.youtubeLink ?? row.youtube_link ?? DEFAULT_ADMIN_SETTINGS.youtubeLink,
    facebookLink: row.facebookLink ?? row.facebook_link ?? DEFAULT_ADMIN_SETTINGS.facebookLink,
    theme: row.theme || DEFAULT_ADMIN_SETTINGS.theme,
    maintenanceMode: Boolean(row.maintenanceMode ?? row.maintenance_mode),
    maintenanceMessage:
      row.maintenanceMessage || row.maintenance_message || DEFAULT_ADMIN_SETTINGS.maintenanceMessage,
    sessionTimeoutMinutes: Number(row.sessionTimeoutMinutes || row.session_timeout_minutes || 60),
  };
}

export function getAdminSettings(): AdminWebsiteSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_ADMIN_SETTINGS;
}

export async function fetchAdminSettings(): Promise<AdminWebsiteSettings> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID));
      if (snap.exists()) {
        const mapped = mapServerSettings(snap.data());
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(mapped));
        } catch {}
        return mapped;
      }
    } catch {}
  }
  return getAdminSettings();
}

function buildSanitizedSettingsDoc(updated: AdminWebsiteSettings) {
  return {
    websiteName: sanitizeString(updated.websiteName, 120) || DEFAULT_ADMIN_SETTINGS.websiteName,
    tagline: sanitizeString(updated.tagline, 250),
    logoUrl: sanitizeUrl(updated.logoUrl),
    telegramLink: sanitizeUrl(updated.telegramLink),
    discordLink: sanitizeUrl(updated.discordLink),
    youtubeLink: sanitizeUrl(updated.youtubeLink),
    facebookLink: sanitizeUrl(updated.facebookLink),
    theme: updated.theme,
    maintenanceMode: Boolean(updated.maintenanceMode),
    maintenanceMessage: sanitizeString(updated.maintenanceMessage, 1000),
    sessionTimeoutMinutes: Math.max(5, Math.min(1440, Number(updated.sessionTimeoutMinutes) || 60)),
    updatedAt: new Date().toISOString(),
  };
}

export function saveAdminSettings(settings: Partial<AdminWebsiteSettings>): AdminWebsiteSettings {
  try {
    const current = getAdminSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

    if (db) {
      try {
        assertOwner('update website settings');
        const payload = buildSanitizedSettingsDoc(updated);
        setDoc(doc(db, 'settings', SETTINGS_DOC_ID), payload, { merge: true }).catch(() => {});
      } catch {}
    }

    return updated;
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export async function saveAdminSettingsAsync(settings: Partial<AdminWebsiteSettings>): Promise<AdminWebsiteSettings> {
  assertOwner('update website settings');
  const current = getAdminSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {}

  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  const payload = buildSanitizedSettingsDoc(updated);
  await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), payload, { merge: true });
  return updated;
}
