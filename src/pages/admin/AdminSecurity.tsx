import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Clock, History, AlertTriangle, Key, 
  Trash2, RefreshCw, UserCheck, ShieldAlert, CheckCircle2 
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getAdminActivityLogs, clearAdminActivityLogs, ActivityLogItem } from '../../lib/activityLogger';
import { getAdminSettings, saveAdminSettings } from '../../lib/adminSettingsStore';

export default function AdminSecurity() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [settings, setSettings] = useState(getAdminSettings());
  const [timeoutMsg, setTimeoutMsg] = useState(false);

  const loadLogs = () => {
    setLogs(getAdminActivityLogs());
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleTimeoutChange = (minutes: number) => {
    const updated = saveAdminSettings({ sessionTimeoutMinutes: minutes });
    setSettings(updated);
    setTimeoutMsg(true);
    setTimeout(() => setTimeoutMsg(false), 2500);
  };

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all recorded activity logs?')) {
      clearAdminActivityLogs();
      setLogs([]);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterCategory === 'all') return true;
    return log.category === filterCategory;
  });

  return (
    <div className="space-y-8 max-w-5xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-[0_0_15px_rgba(0,229,255,0.25)]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Security &amp; Audit Logs</h1>
            <p className="text-xs text-white/50">Manage admin credentials, session timeout policies, and audit trails</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Dual DB Security Rules Active
          </div>
        </div>
      </div>

      {/* Row: Admin Identity & Session Timeout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Admin Login Profile */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Authenticated Admin</span>
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center border border-brand/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand to-purple-500 p-0.5 shadow-[0_0_20px_rgba(0,229,255,0.3)]">
                <div className="w-full h-full bg-[#0a0a0a] rounded-2xl flex items-center justify-center text-white font-extrabold text-xl">
                  ZK
                </div>
              </div>
              <div>
                <p className="text-base font-bold text-white leading-tight">Master Administrator</p>
                <p className="text-xs text-brand font-mono mt-0.5">{user?.email || 'zkdubbingstudio@gmail.com'}</p>
                <p className="text-[10px] text-white/40 mt-1">Role: Super Admin • Full CRUD Permissions</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
            <span>Session Status: Active</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          </div>
        </div>

        {/* Session Timeout Settings */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Security Policy</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Session Inactivity Timeout</h3>
            <p className="text-xs text-white/50 mb-4">
              Automatically locks admin operations after a period of user inactivity.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 120].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleTimeoutChange(mins)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    settings.sessionTimeoutMinutes === mins
                      ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                      : 'bg-white/5 text-white/70 hover:text-white border border-white/5'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>

            {timeoutMsg && (
              <p className="text-[11px] text-emerald-400 font-bold mt-2 animate-fade-in">
                Session timeout policy updated!
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40 flex items-center justify-between">
            <span>Current Inactivity Limit:</span>
            <span className="text-white font-bold">{settings.sessionTimeoutMinutes} Minutes</span>
          </div>
        </div>
      </div>

      {/* Firebase Authentication & Authorized Domains Health Card */}
      <div className="bg-black/40 border border-brand/30 rounded-3xl p-6 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Firebase Authentication &amp; Authorized Domains</h2>
              <p className="text-xs text-white/50">Google Sign-In configuration, Authorized Domains list, and mobile redirect state</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold w-fit">
            Google Provider Enabled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Initialization Pattern</span>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Singleton (Once)
            </p>
            <p className="text-[11px] text-white/50">Firebase App &amp; Auth initialized exactly once with LocalPersistence</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Mobile Chrome Support</span>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Popup + Redirect Fallback
            </p>
            <p className="text-[11px] text-white/50">Bypasses mobile popup blockers on Android &amp; iOS devices</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Firestore User Sync</span>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Collection: /users
            </p>
            <p className="text-[11px] text-white/50">User record merged in Firestore upon every successful login</p>
          </div>
        </div>

        {/* Domains checklist */}
        <div className="mt-4 p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand" /> Required Firebase Authorized Domains:
            </span>
            <span className="text-[11px] text-white/50 font-mono">Current Host: {typeof window !== 'undefined' ? window.location.hostname : 'localhost'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
            {[
              'localhost',
              '127.0.0.1',
              'zk-voicehub.vercel.app',
              typeof window !== 'undefined' ? window.location.hostname : '',
              'gen-lang-client-0843629033.firebaseapp.com'
            ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((dom) => (
              <div key={dom} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 text-white/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="truncate">{dom}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-white/50 pt-1">
            To add new domains: Firebase Console → Authentication → Settings → Authorized Domains → Add Domain.
          </p>
        </div>
      </div>

      {/* Activity Log Section */}
      <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-base font-bold text-white">System Activity Audit Log</h2>
              <p className="text-xs text-white/50">Recorded admin actions, edits, and configuration changes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-bold transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Logs
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['all', 'anime', 'episode', 'season', 'media', 'settings', 'security'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition-all ${
                filterCategory === cat
                  ? 'bg-brand text-black shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Logs List */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-white/40">
              <History className="w-8 h-8 mx-auto text-white/20 mb-2" />
              <p className="text-xs">No activity logs recorded for this category.</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const dateStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
              return (
                <div 
                  key={log.id} 
                  className="flex items-start justify-between gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl hover:border-brand/30 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase mt-0.5 flex-shrink-0 ${
                      log.category === 'security' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                      log.category === 'anime' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                      log.category === 'episode' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      'bg-white/10 text-white/80 border border-white/10'
                    }`}>
                      {log.category}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{log.action}</p>
                      <p className="text-[11px] text-white/50">{log.details}</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-white/40 font-mono flex-shrink-0 whitespace-nowrap">
                    {dateStr}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
