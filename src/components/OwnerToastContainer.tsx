import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  ShieldAlert, 
  X, 
  ExternalLink, 
  Volume2, 
  VolumeX, 
  Sparkles,
  CheckCheck
} from 'lucide-react';
import { useOwnerNotificationsStore, OwnerToastNotification } from '../lib/ownerNotificationService';
import { useAuthStore } from '../store/authStore';
import { isAuthorizedAdmin } from '../lib/authService';

export default function OwnerToastContainer() {
  const { user, firebaseUser } = useAuthStore();
  const { toasts, dismissToast, dismissAllToasts, soundEnabled, toggleSound } = useOwnerNotificationsStore();
  const navigate = useNavigate();

  const currentUser = user || firebaseUser;
  const isOwner = Boolean(currentUser?.email && isAuthorizedAdmin(currentUser.email));

  // Only render for the owner (zkdubbingstudio@gmail.com)
  if (!isOwner || toasts.length === 0) {
    return null;
  }

  const handleToastClick = (toast: OwnerToastNotification) => {
    if (toast.actionUrl) {
      navigate(toast.actionUrl);
      dismissToast(toast.id);
    }
  };

  return (
    <div 
      className="fixed top-20 sm:top-24 right-3 sm:right-6 z-[200] flex flex-col items-end gap-3 max-w-sm sm:max-w-md w-[calc(100vw-1.5rem)] pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="Owner Notifications"
    >
      {/* Toast Controls Bar if multiple toasts */}
      {toasts.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#05070b]/90 border border-white/10 backdrop-blur-xl shadow-lg pointer-events-auto text-[11px] text-white/70 animate-in fade-in duration-200">
          <span className="font-bold text-[#00e5ff] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping" />
            {toasts.length} Alerts
          </span>
          <span className="text-white/20">|</span>
          <button
            onClick={toggleSound}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute sound chime' : 'Enable sound chime'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-white/40" />}
            <span>{soundEnabled ? 'Audio On' : 'Muted'}</span>
          </button>
          <span className="text-white/20">|</span>
          <button
            onClick={dismissAllToasts}
            className="hover:text-red-400 transition-colors font-medium cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Stack of active Toast Notifications */}
      {toasts.map((toast) => {
        const isNewUser = toast.type === 'new_user';

        return (
          <div
            key={toast.id}
            onClick={() => handleToastClick(toast)}
            className={`w-full pointer-events-auto rounded-2xl border p-4 backdrop-blur-2xl transition-all duration-300 relative overflow-hidden group shadow-2xl cursor-pointer hover:scale-[1.01] active:scale-[0.99] animate-in slide-in-from-top-3 fade-in duration-300 ${
              isNewUser
                ? 'bg-[#041a14]/95 border-emerald-500/50 shadow-[0_10px_35px_rgba(16,185,129,0.25)] hover:border-emerald-400'
                : 'bg-[#05111d]/95 border-[#00e5ff]/50 shadow-[0_10px_35px_rgba(0,229,255,0.25)] hover:border-[#00e5ff]'
            }`}
          >
            {/* Top ambient highlight line */}
            <div 
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                isNewUser 
                  ? 'from-emerald-400 via-teal-300 to-emerald-500' 
                  : 'from-[#00e5ff] via-cyan-300 to-blue-500'
              }`} 
            />

            <div className="flex items-start gap-3.5">
              {/* Icon badge or avatar */}
              <div className="relative shrink-0 mt-0.5">
                {isNewUser ? (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    {toast.userPhoto ? (
                      <img 
                        src={toast.userPhoto} 
                        alt={toast.userName || 'User'} 
                        className="w-full h-full object-cover rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserPlus className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#00e5ff]/20 border border-[#00e5ff]/40 flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                    <ShieldAlert className="w-5 h-5 text-[#00e5ff]" />
                  </div>
                )}
                <div 
                  className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#05070b] ${
                    isNewUser ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]'
                  }`} 
                />
              </div>

              {/* Toast Content */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 mb-1">
                  <span 
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isNewUser 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30'
                    }`}
                  >
                    {isNewUser ? 'Owner Alert • Registration' : 'Owner Alert • Admin Log'}
                  </span>
                  <span className="text-[10px] text-white/40 ml-auto font-mono">
                    Just now
                  </span>
                </div>

                <h4 className="text-sm font-black text-white leading-snug flex items-center gap-1.5">
                  {toast.title}
                  {isNewUser && <Sparkles className="w-3.5 h-3.5 text-amber-300 inline" />}
                </h4>

                <p className="text-xs text-white/80 font-medium mt-1 leading-relaxed break-words">
                  {toast.details}
                </p>

                {/* Footer action link */}
                {toast.actionUrl && (
                  <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-[#00e5ff] group-hover:underline">
                    <span>View in Admin Panel</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                className="absolute top-3.5 right-3.5 p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle auto-dismiss countdown bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 overflow-hidden">
              <div 
                className={`h-full w-full animate-out duration-[6500ms] ${
                  isNewUser ? 'bg-emerald-400' : 'bg-[#00e5ff]'
                }`}
                style={{
                  animation: 'shrinkWidth 6.5s linear forwards',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
