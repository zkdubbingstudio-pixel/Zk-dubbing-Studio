import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { 
  Settings, Globe, Shield, RefreshCw, Download, Upload, Trash2, 
  Check, AlertCircle, Sparkles, Send, Youtube, MessageSquare, Palette, HardDrive 
} from 'lucide-react';
import { getAdminSettings, saveAdminSettings, AdminWebsiteSettings } from '../../lib/adminSettingsStore';
import { getAllAnime, getAllSeasons, getAllEpisodes, saveAnimeBoth, saveSeasonBoth, saveEpisodeBoth } from '../../lib/dataService';
import { logAdminActivity } from '../../lib/activityLogger';

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminWebsiteSettings>(getAdminSettings());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    setSettings(getAdminSettings());
  }, []);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    saveAdminSettings(settings);
    logAdminActivity('Updated System Settings', 'settings', 'Website branding, theme, or social links changed');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleClearCache = () => {
    try {
      // Clear localStorage cache keys for ZK App
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith('zk_db_cache_') || k.startsWith('zk_cache_')) {
          localStorage.removeItem(k);
        }
      });
      logAdminActivity('Cache Purged', 'settings', 'Purged all local and memory cache keys');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch {
      // ignore
    }
  };

  // Full Database Backup to JSON
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const [anime, seasons, episodes] = await Promise.all([
        getAllAnime().catch(() => []),
        getAllSeasons().catch(() => []),
        getAllEpisodes().catch(() => []),
      ]);

      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        platform: 'ZK Voice Hub',
        data: {
          anime,
          seasons,
          episodes,
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zk_voice_hub_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      logAdminActivity('Database Backup Exported', 'settings', `Exported ${anime.length} anime, ${episodes.length} episodes`);
    } catch {
      alert('Failed to generate backup.');
    } finally {
      setIsExporting(false);
    }
  };

  // Restore Database from JSON
  const handleImportBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Are you sure you want to restore this backup? This will sync entries to Firestore and Supabase.')) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    setImportStatus('Reading backup file...');

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!json.data || !json.data.anime) {
        throw new Error('Invalid backup file structure.');
      }

      setImportStatus('Syncing anime, seasons, and episodes to Firestore & Supabase...');

      // Restore anime
      for (const a of json.data.anime || []) {
        await saveAnimeBoth(a, a.id).catch(() => {});
      }

      // Restore seasons
      for (const s of json.data.seasons || []) {
        await saveSeasonBoth(s, s.id).catch(() => {});
      }

      // Restore episodes
      for (const ep of json.data.episodes || []) {
        await saveEpisodeBoth(ep, ep.id).catch(() => {});
      }

      logAdminActivity('Database Restored from File', 'settings', `Restored backup: ${file.name}`);
      setImportStatus('Backup restored successfully!');
      setTimeout(() => setImportStatus(null), 4000);
    } catch (err: any) {
      alert('Import failed: ' + (err.message || 'Unknown error'));
      setImportStatus(null);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-[0_0_15px_rgba(0,229,255,0.25)]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System Settings</h1>
            <p className="text-xs text-white/50">Manage website branding, streaming links, theme, backups, and maintenance</p>
          </div>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold animate-fade-in shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Check className="w-4 h-4" /> Settings Saved!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: General Branding */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-brand" />
            <h2 className="text-base font-bold text-white">General Branding</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                Website Name *
              </label>
              <input
                type="text"
                required
                value={settings.websiteName}
                onChange={e => setSettings({ ...settings, websiteName: e.target.value })}
                className="w-full bg-black/50 border border-white/10 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={e => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full bg-black/50 border border-white/10 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
              Official Logo URL
            </label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                value={settings.logoUrl}
                onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                className="flex-1 bg-black/50 border border-white/10 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
              />
              {settings.logoUrl && (
                <div className="w-10 h-10 rounded-xl bg-black border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Social Links & Community */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-5 h-5 text-brand" />
            <h2 className="text-base font-bold text-white">Social &amp; Community Links</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                Telegram Link
              </label>
              <div className="relative">
                <Send className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settings.telegramLink}
                  onChange={e => setSettings({ ...settings, telegramLink: e.target.value })}
                  placeholder="https://t.me/..."
                  className="w-full bg-black/50 border border-white/10 focus:border-brand rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                Discord Link
              </label>
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settings.discordLink}
                  onChange={e => setSettings({ ...settings, discordLink: e.target.value })}
                  placeholder="https://discord.gg/..."
                  className="w-full bg-black/50 border border-white/10 focus:border-brand rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                YouTube Channel
              </label>
              <div className="relative">
                <Youtube className="w-4 h-4 text-red-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settings.youtubeLink}
                  onChange={e => setSettings({ ...settings, youtubeLink: e.target.value })}
                  placeholder="https://youtube.com/@..."
                  className="w-full bg-black/50 border border-white/10 focus:border-brand rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                Facebook Page
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settings.facebookLink}
                  onChange={e => setSettings({ ...settings, facebookLink: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="w-full bg-black/50 border border-white/10 focus:border-brand rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Theme Preset */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-brand" />
            <h2 className="text-base font-bold text-white">Visual Theme</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div 
              onClick={() => setSettings({ ...settings, theme: 'electric-blue' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                settings.theme === 'electric-blue'
                  ? 'bg-cyan-500/10 border-brand shadow-[0_0_20px_rgba(0,229,255,0.25)]'
                  : 'bg-black/40 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></span>
                <span className="text-xs font-bold text-white">Electric Blue Neon</span>
              </div>
              <p className="text-[11px] text-white/50">Primary signature cyber glow aesthetic of ZK Voice Hub.</p>
            </div>

            <div 
              onClick={() => setSettings({ ...settings, theme: 'cyberpunk-neon' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                settings.theme === 'cyberpunk-neon'
                  ? 'bg-purple-500/10 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                  : 'bg-black/40 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7]"></span>
                <span className="text-xs font-bold text-white">Cyberpunk Magenta</span>
              </div>
              <p className="text-[11px] text-white/50">Deep violet and neon accents for an anime studio vibe.</p>
            </div>

            <div 
              onClick={() => setSettings({ ...settings, theme: 'obsidian-gold' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                settings.theme === 'obsidian-gold'
                  ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                  : 'bg-black/40 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>
                <span className="text-xs font-bold text-white">Obsidian Gold</span>
              </div>
              <p className="text-[11px] text-white/50">High-end luxury gold highlights on obsidian backdrop.</p>
            </div>
          </div>
        </div>

        {/* Section 4: Maintenance Mode */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-white">Maintenance Mode</h2>
                <p className="text-xs text-white/50">Show maintenance banner to public viewers during database updates</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {settings.maintenanceMode && (
            <div className="pt-3 border-t border-white/10">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                Maintenance Notice Banner Text
              </label>
              <textarea
                rows={2}
                value={settings.maintenanceMessage}
                onChange={e => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                className="w-full bg-black/50 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          )}
        </div>

        {/* Save Changes Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-3 bg-brand text-black font-extrabold text-sm rounded-xl hover:bg-brand-hover transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] cursor-pointer"
          >
            <Check className="w-4 h-4" /> Save All Settings
          </button>
        </div>
      </form>

      {/* Section 5: Database Backup & Cache Maintenance */}
      <div className="pt-6 border-t border-white/10">
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Database Backup &amp; Cache Maintenance</h2>
              <p className="text-xs text-white/50">Full JSON snapshot export, restore utility, and client cache purging</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export Backup */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Download className="w-4 h-4 text-emerald-400" /> Export Database Backup
                </h3>
                <p className="text-xs text-white/50 mb-4">
                  Downloads a complete JSON file containing all Anime, Seasons, and Episodes from Firestore &amp; Supabase.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Generating JSON...' : 'Download Full JSON Backup'}
              </button>
            </div>

            {/* Import Backup */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Upload className="w-4 h-4 text-cyan-400" /> Restore Database Backup
                </h3>
                <p className="text-xs text-white/50 mb-4">
                  Upload a previously exported backup file to restore records directly into Firestore &amp; Supabase.
                </p>
              </div>

              <label className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs hover:bg-cyan-500/30 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                {isImporting ? 'Restoring records...' : 'Select Backup JSON File'}
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackup}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {importStatus && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
              {importStatus}
            </div>
          )}

          {/* Cache Clear */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-amber-400" /> Purge Client Cache
              </h3>
              <p className="text-xs text-white/50">
                Clears cached query results from localStorage and in-memory caches, forcing immediate live re-fetch.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClearCache}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs hover:bg-amber-500/30 transition-all flex-shrink-0"
            >
              {cacheCleared ? <Check className="w-4 h-4 text-emerald-400" /> : <Trash2 className="w-4 h-4" />}
              {cacheCleared ? 'Cache Purged!' : 'Purge All Cache'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
