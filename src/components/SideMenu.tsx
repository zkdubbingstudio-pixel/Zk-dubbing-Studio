import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Layers, 
  Info, 
  User as UserIcon, 
  Settings, 
  LogOut, 
  Shield, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { signOutUser, isAuthorizedAdmin } from '../lib/authService';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAbout: () => void;
}

export default function SideMenu({ isOpen, onClose, onOpenAbout }: SideMenuProps) {
  const { user, setUser, setAuthSuccessMessage, setAuthModalOpen } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isSignedIn = Boolean(user);
  const email = (user?.email || '').toLowerCase();
  const displayName = user?.name || user?.displayName || (email ? email.split('@')[0] : 'User');
  const photoURL = user?.profilePhoto || user?.photoURL || '';
  const isAdmin = Boolean(email && isAuthorizedAdmin(email));

  const handleOpenSignIn = () => {
    onClose();
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch {}
    setUser(null);
    setAuthSuccessMessage('Logged out successfully.');
    onClose();
    navigate('/');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      {/* Dimmed Background Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Cyber Slide-out Drawer */}
      <div className="relative w-full max-w-sm sm:w-80 h-full bg-[#070b14] border-l border-[#00e5ff]/20 shadow-[-15px_0_40px_rgba(0,0,0,0.9)] z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
        
        {/* TOP SECTION */}
        <div>
          {/* Header Bar with Close Button */}
          <div className="p-4 flex items-center justify-between border-b border-white/10 bg-[#0a0f1d]/60">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#00e5ff] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]" />
              Navigation Menu
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Status / Top Info */}
          {isSignedIn ? (
            /* AFTER LOGIN: Show user's profile picture, name, and email at the top */
            <div className="p-5 border-b border-white/10 bg-gradient-to-b from-[#00e5ff]/10 via-transparent to-transparent">
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0">
                  <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.4)] bg-[#0a0e17] flex items-center justify-center">
                    {photoURL ? (
                      <img 
                        src={photoURL} 
                        alt={displayName} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-[#00e5ff]/20 to-[#0a1120] flex items-center justify-center text-xl font-black text-[#00e5ff]">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#070b14] shadow-[0_0_6px_#10b981]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-white text-sm sm:text-base truncate">
                      {displayName}
                    </h3>
                    {isAdmin && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 truncate font-mono mt-0.5">
                    {email}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* GUEST MODE: Visitor Header */
            <div className="p-5 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                  <UserIcon className="w-5 h-5 text-[#00e5ff]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Guest Visitor</h3>
                  <p className="text-[11px] text-white/50">Sign in to save watch history</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5">
            {/* Always visible: Home */}
            <Link
              to="/"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                location.pathname === '/'
                  ? 'bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className="w-4 h-4 text-[#00e5ff]" />
              <span>Home</span>
            </Link>

            {/* Always visible: Browse & Search */}
            <Link
              to="/search"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                location.pathname === '/search'
                  ? 'bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <Search className="w-4 h-4 text-[#00e5ff]" />
              <span>Browse & Search</span>
            </Link>

            {/* Categories */}
            <Link
              to="/search?tab=categories"
              onClick={onClose}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-white/80 hover:text-white hover:bg-white/5 transition-all"
            >
              <Layers className="w-4 h-4 text-[#00e5ff]" />
              <span>Categories</span>
            </Link>

            {/* When NOT logged in: About */}
            {!isSignedIn && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAbout();
                }}
                className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-white/80 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <Info className="w-4 h-4 text-[#00e5ff]" />
                <span>About</span>
              </button>
            )}

            {/* When logged in: My Profile and Settings */}
            {isSignedIn && (
              <>
                <Link
                  to="/profile"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    location.pathname === '/profile'
                      ? 'bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <UserIcon className="w-4 h-4 text-[#00e5ff]" />
                  <span>My Profile</span>
                </Link>

                <Link
                  to="/settings"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    location.pathname === '/settings'
                      ? 'bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Settings className="w-4 h-4 text-[#00e5ff]" />
                  <span>Settings</span>
                </Link>
              </>
            )}

            {/* ONLY VISIBLE AFTER LOGIN: Admin Panel (strictly only for zkdubbingstudio@gmail.com) */}
            {isSignedIn && isAdmin && (
              <div className="pt-2 mt-2 border-t border-white/5">
                <Link
                  to="/admin"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-black text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/25 hover:bg-[#00e5ff]/20 transition-all shadow-[0_0_12px_rgba(0,229,255,0.15)]"
                >
                  <Shield className="w-4 h-4 text-[#00e5ff]" />
                  <span>Admin Panel</span>
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* BOTTOM SECTION */}
        <div className="p-4 border-t border-white/10 bg-[#0a0f1d]/80">
          {!isSignedIn ? (
            /* IF USER IS NOT SIGNED IN: Highlighted Sign In button */
            <div className="space-y-2">
              <button
                onClick={handleOpenSignIn}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:shadow-[0_0_30px_rgba(0,229,255,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-black" />
                <span>Sign In</span>
              </button>
              <p className="text-[10px] text-center text-white/40 font-medium">
                Firebase Email + Password Authentication
              </p>
            </div>
          ) : (
            /* AFTER LOGIN: Logout button */
            <div>
              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
