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

export function getAdminSettings(): AdminWebsiteSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_ADMIN_SETTINGS;
}

export function saveAdminSettings(settings: Partial<AdminWebsiteSettings>): AdminWebsiteSettings {
  try {
    const current = getAdminSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}
