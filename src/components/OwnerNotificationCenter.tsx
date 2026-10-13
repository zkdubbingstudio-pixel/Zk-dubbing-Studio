import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  X, 
  UserPlus, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Trash2, 
  CheckCheck, 
  ExternalLink,
  Clock
} from 'lucide-react';
import { useOwnerNotificationsStore, OwnerToastNotification } from '../lib/ownerNotificationService';

interface OwnerNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OwnerNotificationCenter({ isOpen, onClose }: OwnerNotificationCenterProps) {
  const { 
    history, 
    unreadCount, 
    markAllRead, 
    clearHistory, 
    soundEnabled, 
    toggleSound 
  } = useOwnerNotificationsStore();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleItemClick = (item: OwnerToastNotification) => {
    if (item.actionUrl) {
      navigate(item.actionUrl);
      onClose();
    }
  };

  const formatTime = (ts: number) => {
    try {
      const diff = Date.now() - ts;
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex justify-end">
      {/* Dimmed Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Slide-out Drawer */}
      <div className="relative w-full max-w-md h-full bg-[#070b14] border-l border-[#00e5ff]/25 shadow-[-20px_0_50px_rgba(0,0,0,0.9)] z-10 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0a0f1d]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00e5ff]/15 border border-[#00e5ff]/30 flex items-center justify-center text-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.25)]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">Owner Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#00e5ff] text-black">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/50 font-mono">
                zkdubbingstudio@gmail.com
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleSound}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                soundEnabled 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
              }`}
              title={soundEnabled ? 'Mute Chimes' : 'Enable Chimes'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-4 py-2 border-b border-white/5 bg-[#050810] flex items-center justify-between text-xs">
          <span className="text-white/40 text-[11px]">
            {history.length} recorded events
          </span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-bold text-[#00e5ff] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[11px] text-white/40 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white/70">No Notifications Yet</h4>
                <p className="text-xs text-white/40 mt-1 max-w-xs">
                  Whenever a new user registers or an admin action is performed, real-time alerts will appear here.
                </p>
              </div>
            </div>
          ) : (
            history.map((item) => {
              const isNewUser = item.type === 'new_user';
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                    isNewUser
                      ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/40'
                      : 'bg-[#00e5ff]/5 hover:bg-[#00e5ff]/10 border-[#00e5ff]/25 hover:border-[#00e5ff]/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {isNewUser ? (
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                          <UserPlus className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#00e5ff]/20 border border-[#00e5ff]/30 flex items-center justify-center text-[#00e5ff]">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span 
                          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isNewUser ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[#00e5ff]/20 text-[#00e5ff]'
                          }`}
                        >
                          {isNewUser ? 'User Registration' : 'Admin Action'}
                        </span>
                        <span className="text-[10px] text-white/40 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(item.timestamp)}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-white leading-snug">
                        {item.title}
                      </h5>

                      <p className="text-[11px] text-white/70 mt-0.5 leading-relaxed break-words">
                        {item.details}
                      </p>

                      {item.actionUrl && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#00e5ff] group-hover:underline">
                          <span>Open details</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-white/10 bg-[#0a0f1d]/80 text-center">
          <p className="text-[11px] text-white/40">
            Real-time push alerts powered by Firestore & Audio Chimes
          </p>
        </div>

      </div>
    </div>
  );
}
