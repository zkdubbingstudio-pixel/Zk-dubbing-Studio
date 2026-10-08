import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  User,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  Play,
  Bell,
  HardDrive,
  Info,
  Shield,
  Save,
  Check
} from 'lucide-react';
import { UserSettings } from '../types';

export default function Settings() {
  const { user, firebaseUser, setUser } = useAuthStore();
  
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [settings, setSettings] = useState<UserSettings>({
    appearance: 'Dark',
    defaultQuality: 'Auto',
    autoplayNext: true,
    rememberPosition: true,
    newEpisodeNotifications: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
      if (user.settings) {
        setSettings(prev => ({ ...prev, ...user.settings }));
      }
    }
  }, [user]);

  if (!user || !firebaseUser) return <Navigate to="/" replace />;

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
            const updatedUser = {
        ...user,
        displayName,
        photoURL,
        settings
      };
      
      // Sync to Supabase users table
      try {
        await supabase.from('users').update({
          username: displayName,
          displayName,
          photo_url: photoURL,
          photoURL,
          settings,
        }).eq('id', user.uid);
      } catch {}
      
      setUser(updatedUser);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving settings", error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-brand" />
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      <div className="space-y-8">
        {/* Account Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Account</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 mb-6 items-start">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 shrink-0 bg-white/5">
              <img 
                src={photoURL || `https://ui-avatars.com/api/?name=${displayName}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-4 w-full">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Photo URL</label>
                <input 
                  type="text" 
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                <input 
                  type="email" 
                  value={user.email}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white/50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Moon className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Appearance</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['Dark', 'Light', 'System'] as const).map(theme => (
              <button
                key={theme}
                onClick={() => updateSetting('appearance', theme)}
                className={`p-4 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${
                  settings.appearance === theme 
                    ? 'border-brand bg-brand/10 text-white' 
                    : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {theme === 'Dark' && <Moon className="w-6 h-6" />}
                {theme === 'Light' && <Sun className="w-6 h-6" />}
                {theme === 'System' && <Monitor className="w-6 h-6" />}
                <span className="font-medium">{theme} Mode</span>
              </button>
            ))}
          </div>
        </section>

        {/* Playback Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Play className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Playback</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">Default Video Quality</h3>
                <p className="text-sm text-white/50">Choose your preferred streaming quality.</p>
              </div>
              <select 
                value={settings.defaultQuality}
                onChange={(e) => updateSetting('defaultQuality', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand"
              >
                <option value="Auto" className="bg-[#0a0a0a]">Auto</option>
                <option value="480p" className="bg-[#0a0a0a]">480p</option>
                <option value="720p" className="bg-[#0a0a0a]">720p</option>
                <option value="1080p" className="bg-[#0a0a0a]">1080p</option>
              </select>
            </div>
            
            <hr className="border-white/5" />
            
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">Autoplay Next Episode</h3>
                <p className="text-sm text-white/50">Automatically play the next episode when the current one ends.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.autoplayNext} 
                  onChange={(e) => updateSetting('autoplayNext', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>

            <hr className="border-white/5" />
            
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">Remember Playback Position</h3>
                <p className="text-sm text-white/50">Resume videos from where you left off.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.rememberPosition} 
                  onChange={(e) => updateSetting('rememberPosition', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>
          
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">New Episode Notifications</h3>
              <p className="text-sm text-white/50">Get notified when new episodes are added for your favorites.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.newEpisodeNotifications} 
                onChange={(e) => updateSetting('newEpisodeNotifications', e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>
        </section>

        {/* Storage Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <HardDrive className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Storage & Data</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors opacity-50 cursor-not-allowed flex flex-col items-center gap-1">
              Clear Watch History
              <span className="text-brand text-xs">Coming Soon</span>
            </button>
            <button className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors opacity-50 cursor-not-allowed flex flex-col items-center gap-1">
              Clear Continue Watching
              <span className="text-brand text-xs">Coming Soon</span>
            </button>
            <button className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors opacity-50 cursor-not-allowed flex flex-col items-center gap-1">
              Clear Cache
              <span className="text-brand text-xs">Coming Soon</span>
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Info className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">About</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-white/70">App Version</span>
              <span className="text-white font-medium">v1.0.0</span>
            </div>
            <hr className="border-white/5" />
            <button className="w-full flex justify-between items-center py-2 group opacity-50 cursor-not-allowed">
              <span className="text-white/70 group-hover:text-white transition-colors">Privacy Policy</span>
              <span className="text-brand text-xs font-medium">Coming Soon</span>
            </button>
            <hr className="border-white/5" />
            <button className="w-full flex justify-between items-center py-2 group opacity-50 cursor-not-allowed">
              <span className="text-white/70 group-hover:text-white transition-colors">Terms of Service</span>
              <span className="text-brand text-xs font-medium">Coming Soon</span>
            </button>
            <hr className="border-white/5" />
            <button className="w-full flex justify-between items-center py-2 group opacity-50 cursor-not-allowed">
              <span className="text-white/70 group-hover:text-white transition-colors">Contact Support</span>
              <span className="text-brand text-xs font-medium">Coming Soon</span>
            </button>
          </div>
        </section>

        {/* Admin Section */}
        {user.role === 'admin' && (
          <section className="glass-panel p-6 sm:p-8 rounded-xl border border-brand/20 bg-brand/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Shield className="w-32 h-32 text-brand" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-brand" />
                <h2 className="text-xl font-bold">Admin Privileges</h2>
              </div>
              <p className="text-white/70 mb-6 max-w-lg">
                You have administrator access. You can manage anime, seasons, episodes, and users from the admin panel.
              </p>
              <Link to="/admin" className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-black font-bold rounded-lg hover:bg-brand-hover transition-colors shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                <Shield className="w-5 h-5" />
                Open Admin Panel
              </Link>
            </div>
          </section>
        )}

      </div>

      {/* Floating Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg-base/80 backdrop-blur-xl border-t border-white/10 z-50 transform transition-transform">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-white/50 hidden sm:block">
            Don't forget to save your changes
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            {saveSuccess && (
              <span className="flex items-center gap-2 text-green-400 text-sm font-medium animate-pulse">
                <Check className="w-4 h-4" />
                Saved successfully!
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-brand text-black font-bold rounded-lg hover:bg-brand-hover hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,229,255,0.3)] w-full sm:w-auto"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Spacer for bottom bar */}
      <div className="h-24"></div>
    </div>
  );
}
