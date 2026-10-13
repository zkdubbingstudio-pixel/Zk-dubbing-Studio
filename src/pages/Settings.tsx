import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isAuthorizedAdmin, signOutUser } from '../lib/authService';
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
  Check,
  Trash2,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { UserSettings } from '../types';

export default function Settings() {
  const { user, setUser, setAuthSuccessMessage, setAuthModalOpen } = useAuthStore();
  const navigate = useNavigate();
  
  const currentUser = user;
  const isSignedIn = Boolean(currentUser);

  const [displayName, setDisplayName] = useState(() => {
    if (user?.name || user?.displayName) return (user.name || user.displayName);
    try {
      const saved = localStorage.getItem('zk_visitor_settings');
      if (saved) return JSON.parse(saved).displayName || '';
    } catch {}
    return '';
  });

  const [photoURL, setPhotoURL] = useState(() => {
    if (user?.profilePhoto || user?.photoURL) return (user.profilePhoto || user.photoURL);
    try {
      const saved = localStorage.getItem('zk_visitor_settings');
      if (saved) return JSON.parse(saved).photoURL || '';
    } catch {}
    return '';
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    if (user?.settings) return user.settings;
    try {
      const saved = localStorage.getItem('zk_visitor_settings');
      if (saved && JSON.parse(saved).settings) return JSON.parse(saved).settings;
    } catch {}
    return {
      appearance: 'Dark', // Default ON
      defaultQuality: 'Auto',
      autoplayNext: true,
      rememberPosition: true,
      newEpisodeNotifications: true,
    };
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (user.displayName || user.name) setDisplayName(user.name || user.displayName);
      if (user.photoURL || user.profilePhoto) setPhotoURL(user.profilePhoto || user.photoURL);
      if (user.settings) {
        setSettings(prev => ({ ...prev, ...user.settings }));
      }
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      if (user) {
        const updatedUser = {
          ...user,
          displayName,
          name: displayName,
          photoURL,
          profilePhoto: photoURL,
          settings
        };
        
        // Sync to Supabase users table
        try {
          await supabase.from('users').update({
            full_name: displayName,
            username: displayName,
            displayName,
            photo_url: photoURL,
            photoURL,
            settings,
          }).eq('id', user.uid);
        } catch {}
        
        setUser(updatedUser);
      } else {
        try {
          localStorage.setItem('zk_visitor_settings', JSON.stringify({
            displayName,
            photoURL,
            settings
          }));
        } catch {}
      }
      
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

  const handleClearWatchHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your entire watch history?')) return;
    try {
      localStorage.removeItem('zk_watch_history');
      if (user?.uid) {
        try {
          await supabase.from('user_progress').delete().eq('user_id', user.uid);
        } catch {}
      }
      setActionNotice('Watch History has been successfully cleared.');
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice('Failed to clear watch history.');
    }
  };

  const handleClearContinueWatching = async () => {
    if (!window.confirm('Are you sure you want to clear all in-progress episodes?')) return;
    try {
      localStorage.removeItem('zk_watch_history');
      if (user?.uid) {
        try {
          await supabase.from('user_progress').delete().eq('user_id', user.uid);
        } catch {}
      }
      setActionNotice('Continue Watching progress has been successfully cleared.');
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice('Failed to clear continue watching.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch {}
    setUser(null);
    setAuthSuccessMessage('Logged out successfully.');
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-brand" />
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      {actionNotice && (
        <div className="mb-6 p-4 rounded-xl bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] text-sm flex items-center gap-3 animate-in fade-in">
          <Check className="w-5 h-5 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="space-y-8">
        {/* Account Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Account Profile</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 mb-6 items-start">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 shrink-0 bg-white/5">
              <img 
                src={photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'Visitor')}&background=00e5ff&color=000`} 
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
                  placeholder="Visitor"
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                <input 
                  type="email" 
                  value={user?.email || 'Guest Visitor (Public Mode)'}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white/50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 1. Dark Theme (default ON) */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Moon className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Theme & Appearance</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['Dark', 'Light', 'System'] as const).map(theme => {
              const isSelected = (settings.appearance || 'Dark') === theme;
              return (
                <button
                  key={theme}
                  onClick={() => updateSetting('appearance', theme)}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#00e5ff] bg-[#00e5ff]/15 text-white shadow-[0_0_15px_rgba(0,229,255,0.25)]' 
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {theme === 'Dark' && <Moon className="w-6 h-6 text-[#00e5ff]" />}
                  {theme === 'Light' && <Sun className="w-6 h-6" />}
                  {theme === 'System' && <Monitor className="w-6 h-6" />}
                  <span className="font-bold text-sm">
                    {theme} Theme {theme === 'Dark' ? '(Default)' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Notification Toggle */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>
          
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">New Episode Notifications</h3>
              <p className="text-sm text-white/50">Get alerts when new Hindi dubbed episodes are released.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.newEpisodeNotifications ?? true} 
                onChange={(e) => updateSetting('newEpisodeNotifications', e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-12 h-6.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-[#00e5ff]"></div>
            </label>
          </div>
        </section>

        {/* Playback Preferences */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Play className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Playback Preferences</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">Default Video Quality</h3>
                <p className="text-sm text-white/50">Choose your preferred streaming resolution.</p>
              </div>
              <select 
                value={settings.defaultQuality || 'Auto'}
                onChange={(e) => updateSetting('defaultQuality', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand"
              >
                <option value="Auto" className="bg-[#0a0a0a]">Auto (Adaptive)</option>
                <option value="480p" className="bg-[#0a0a0a]">480p SD</option>
                <option value="720p" className="bg-[#0a0a0a]">720p HD</option>
                <option value="1080p" className="bg-[#0a0a0a]">1080p Full HD</option>
              </select>
            </div>
            
            <hr className="border-white/5" />
            
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">Autoplay Next Episode</h3>
                <p className="text-sm text-white/50">Automatically start the next episode when current finishes.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.autoplayNext ?? true} 
                  onChange={(e) => updateSetting('autoplayNext', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-12 h-6.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-[#00e5ff]"></div>
              </label>
            </div>

            <hr className="border-white/5" />
            
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">Remember Playback Position</h3>
                <p className="text-sm text-white/50">Resume videos seamlessly from where you left off.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.rememberPosition ?? true} 
                  onChange={(e) => updateSetting('rememberPosition', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-12 h-6.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-[#00e5ff]"></div>
              </label>
            </div>
          </div>
        </section>

        {/* 3 & 4. Storage & History: Clear Watch History & Clear Continue Watching */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <HardDrive className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Data & Storage Management</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Clear Watch History */}
            <button 
              onClick={handleClearWatchHistory}
              className="p-5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white group-hover:text-red-300 transition-colors">
                  Clear Watch History
                </h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Delete your recorded log of viewed anime episodes and timestamps.
              </p>
            </button>

            {/* Clear Continue Watching */}
            <button 
              onClick={handleClearContinueWatching}
              className="p-5 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white group-hover:text-amber-300 transition-colors">
                  Clear Continue Watching
                </h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Remove all in-progress episodes from your continue watching bar.
              </p>
            </button>
          </div>
        </section>

        {/* 5. Session / Logout Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <LogOut className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-bold">Session & Sign Out</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div>
              <p className="font-bold text-white text-sm">
                {isSignedIn ? `Signed in as ${user?.email}` : 'Currently Browsing as Guest'}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {isSignedIn ? 'You can sign out of your account on this device.' : 'Sign in anytime to sync your progress.'}
              </p>
            </div>

            {isSignedIn ? (
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00e5ff] text-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.3)]"
              >
                Sign In
              </button>
            )}
          </div>
        </section>

        {/* Admin Section - Only for zkdubbingstudio@gmail.com */}
        {Boolean(currentUser && isAuthorizedAdmin(currentUser?.email)) && (
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#05070b]/90 backdrop-blur-xl border-t border-white/10 z-50 transform transition-transform">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-white/50 hidden sm:block">
            Don&apos;t forget to save your profile changes
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
              className="flex items-center justify-center gap-2 px-8 py-3 bg-brand text-black font-bold rounded-lg hover:bg-brand-hover hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,229,255,0.3)] w-full sm:w-auto cursor-pointer"
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
