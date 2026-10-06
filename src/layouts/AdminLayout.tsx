import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { 
  ShieldAlert, LayoutDashboard, Film, Layers, PlaySquare, Home, Users, LogOut, 
  FolderOpen, TrendingUp, Settings, Lock, Plus, X, Sparkles, ExternalLink, 
  CheckCircle2, Bell, Menu, ShieldCheck, ChevronRight, Zap, RefreshCw, HardDrive,
  AlertTriangle
} from 'lucide-react';
import { 
  signInWithGoogle, 
  signOutUser, 
  isAuthorizedAdmin, 
  PRIMARY_ADMIN_EMAIL, 
  getFriendlyAuthErrorMessage 
} from '../lib/authService';
import { logAdminActivity } from '../lib/activityLogger';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/anime', label: 'Anime Manager', icon: Film, shortLabel: 'Anime' },
  { path: '/admin/seasons', label: 'Seasons', icon: Layers, shortLabel: 'Seasons' },
  { path: '/admin/episodes', label: 'Episodes', icon: PlaySquare, shortLabel: 'Episodes' },
  { path: '/admin/media', label: 'Media Library', icon: FolderOpen, shortLabel: 'Media' },
  { path: '/admin/analytics', label: 'Analytics', icon: TrendingUp, shortLabel: 'Stats' },
  { path: '/admin/users', label: 'Users', icon: Users, shortLabel: 'Users' },
  { path: '/admin/settings', label: 'Settings', icon: Settings, shortLabel: 'Config' },
  { path: '/admin/security', label: 'Security', icon: Lock, shortLabel: 'Security' },
];

export default function AdminLayout() {
  const { user, loading, setUser, authSuccessMessage, setAuthSuccessMessage } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFabModal, setShowFabModal] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Auto-dismiss auth success message
  useEffect(() => {
    if (authSuccessMessage) {
      const timer = setTimeout(() => {
        setAuthSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [authSuccessMessage, setAuthSuccessMessage]);

  const isAdmin = Boolean(user && isAuthorizedAdmin(user.email));

  const handleAdminGoogleLogin = async (preferRedirect = false) => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const loggedUser = await signInWithGoogle({ preferRedirect });
      if (loggedUser) {
        logAdminActivity('Admin Logged In via Google', 'security', `Account: ${loggedUser.email}`);
        setAuthSuccessMessage(`Administrator access verified for ${loggedUser.email}`);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        const msg = getFriendlyAuthErrorMessage(err);
        setAuthError(msg);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch {}
    setUser(null);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#07090e] text-white/50">
        <div className="w-12 h-12 border-4 border-white/10 border-t-brand rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]"></div>
        <p className="text-sm font-bold tracking-wider text-white">Verifying ZK Administrator Credentials...</p>
      </div>
    );
  }

  // Admin Gatekeeper Login UI
  if (!isAdmin) {
    const isLoggedNonAdmin = user && !isAdmin;

    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient neon backdrops */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brand/15 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-black/60 border border-brand/40 rounded-3xl p-8 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,229,255,0.2)] relative z-10 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-brand to-purple-500 p-0.5 shadow-[0_0_25px_rgba(0,229,255,0.4)]">
            <div className="w-full h-full bg-[#0a0c14] rounded-2xl flex items-center justify-center overflow-hidden">
              <img 
                src="https://i.ibb.co/2Yp3CDq9/file-000000006f2c8211b20c6bedc9f9ac12.png" 
                alt="ZK Logo" 
                className="w-14 h-14 object-contain"
              />
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight mb-1">ZK Voice Hub</h1>
          <p className="text-xs uppercase tracking-widest text-brand font-bold mb-6">Master Admin Portal</p>

          {isLoggedNonAdmin ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl mb-6 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Access Denied: Unauthorized Account</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                You are currently signed in as <span className="text-white font-mono font-bold">{user.email}</span>. This account does not have administrator privileges.
              </p>
              <p className="text-[11px] text-brand pt-1">
                Authorized Admin: <span className="font-mono font-bold">{PRIMARY_ADMIN_EMAIL}</span>
              </p>
            </div>
          ) : (
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-6 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <ShieldCheck className="w-4 h-4 text-brand" />
                <span>Authorized Administrator Account:</span>
              </div>
              <p className="text-xs font-mono text-cyan-300 bg-black/50 px-3 py-1.5 rounded-lg border border-brand/20">
                {PRIMARY_ADMIN_EMAIL}
              </p>
            </div>
          )}

          {authError && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium text-left break-words">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => handleAdminGoogleLogin(false)}
              disabled={isSigningIn}
              className="w-full py-3 px-4 bg-brand text-black font-extrabold text-sm rounded-xl hover:bg-brand-hover transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {isSigningIn ? 'Authenticating...' : isLoggedNonAdmin ? 'Switch to Admin Google Account' : 'Sign In with Admin Google Account'}
            </button>

            <button
              onClick={() => handleAdminGoogleLogin(true)}
              disabled={isSigningIn}
              className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-xs rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              Android / Mobile Redirect Sign-In
            </button>

            {isLoggedNonAdmin && (
              <button
                onClick={handleLogout}
                className="w-full py-2 text-xs text-red-400 hover:text-red-300 transition-colors font-bold cursor-pointer"
              >
                Sign Out Current Session
              </button>
            )}

            <Link
              to="/"
              className="inline-block text-xs font-bold text-white/50 hover:text-white transition-colors pt-2"
            >
              ← Return to Public Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col md:flex-row relative">
      {/* Global Auth Success Toast Notification */}
      {authSuccessMessage && (
        <div className="fixed top-6 right-6 z-[70] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#051a14]/95 border border-emerald-500/60 rounded-2xl p-4 shadow-[0_0_35px_rgba(16,185,129,0.35)] backdrop-blur-xl flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest mb-0.5">
                Admin Authorized
              </h4>
              <p className="text-xs text-white/95 font-semibold break-words">
                {authSuccessMessage}
              </p>
            </div>
            <button
              onClick={() => setAuthSuccessMessage(null)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Ambient background glows */}
      <div className="fixed top-0 left-64 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[140px] pointer-events-none z-0"></div>
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none z-0"></div>

      {/* Desktop Sidebar (Left) */}
      <aside className="hidden md:flex w-64 lg:w-72 bg-[#090b12]/80 backdrop-blur-2xl border-r border-white/10 flex-col justify-between sticky top-0 h-screen z-30 flex-shrink-0 shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand to-purple-500 p-0.5 shadow-[0_0_15px_rgba(0,229,255,0.35)] flex-shrink-0">
              <div className="w-full h-full bg-[#0a0c14] rounded-xl flex items-center justify-center overflow-hidden">
                <img 
                  src="https://i.ibb.co/2Yp3CDq9/file-000000006f2c8211b20c6bedc9f9ac12.png" 
                  alt="ZK Logo" 
                  className="w-10 h-10 object-contain"
                />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white leading-tight">ZK Voice Hub</span>
                <span className="w-2 h-2 rounded-full bg-brand animate-pulse shadow-[0_0_8px_#00e5ff]"></span>
              </div>
              <span className="text-[9px] uppercase tracking-[0.18em] text-brand/80 font-bold block mt-0.5">
                Studio Admin
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)] custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-brand to-cyan-500 text-black shadow-[0_0_20px_rgba(0,229,255,0.4)] scale-102 font-extrabold'
                      : 'text-white/70 hover:text-white hover:bg-white/5 hover:border-white/10 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-black' : 'text-brand'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-black" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40 space-y-2">
          {/* Dual Sync Badge */}
          <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-[11px]">
            <span className="text-white/50 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Dual DB Sync
            </span>
            <span className="text-emerald-400 font-bold">Online</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-bold transition-all"
            >
              <Home className="w-3.5 h-3.5" />
              Website
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-bold transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 z-10 pb-24 md:pb-8">
        {/* Top Header Bar */}
        <header className="h-16 px-4 md:px-8 border-b border-white/10 bg-[#07090e]/80 backdrop-blur-xl flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-white/50">
                <span>Admin</span>
                <span>/</span>
                <span className="text-white capitalize">
                  {location.pathname.split('/')[2] || 'Dashboard'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Admin Avatar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFabModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand text-black font-extrabold text-xs hover:bg-brand-hover shadow-[0_0_15px_rgba(0,229,255,0.35)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Quick Add
            </button>

            <Link
              to="/admin/security"
              className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-white/5 border border-white/10 hover:border-brand/40 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-brand text-black font-extrabold flex items-center justify-center text-xs shadow-[0_0_10px_rgba(0,229,255,0.4)]">
                ZK
              </div>
              <span className="text-xs font-bold text-white/80 hidden lg:inline">ZK Admin</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Floating Action Button (FAB) on Mobile & Tablet */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        <button
          onClick={() => setShowFabModal(true)}
          className="w-14 h-14 rounded-full bg-brand text-black flex items-center justify-center shadow-[0_0_25px_rgba(0,229,255,0.5)] border-2 border-white/40 active:scale-95 transition-transform"
          aria-label="Quick Actions"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#07090e]/95 backdrop-blur-2xl border-t border-white/10 z-40 px-2 flex items-center justify-around shadow-[0_-10px_25px_rgba(0,0,0,0.8)]">
        {[
          { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/admin/anime', label: 'Anime', icon: Film },
          { path: '/admin/episodes', label: 'Episodes', icon: PlaySquare },
          { path: '/admin/media', label: 'Media', icon: FolderOpen },
          { path: '/admin/settings', label: 'Settings', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all ${
                isActive ? 'text-brand font-bold' : 'text-white/50 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-brand/10 shadow-[0_0_10px_rgba(0,229,255,0.3)]' : ''}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Drawer (When Menu Opened) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-md md:hidden animate-fade-in">
          <div className="w-72 bg-[#090b12] border-r border-white/10 h-full flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <img 
                    src="https://i.ibb.co/2Yp3CDq9/file-000000006f2c8211b20c6bedc9f9ac12.png" 
                    alt="Logo" 
                    className="w-9 h-9 object-contain"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">ZK Voice Hub</h3>
                    <p className="text-[10px] text-brand font-bold">Admin Mobile</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-white/70"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold ${
                        isActive
                          ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2">
              <Link
                to="/"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-white text-xs font-bold"
              >
                <Home className="w-4 h-4" /> Public Website
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action (FAB) Modal */}
      {showFabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f111a] border border-brand/30 rounded-3xl max-w-sm w-full p-6 shadow-[0_0_50px_rgba(0,229,255,0.25)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-white">Quick Creator Action</h3>
              </div>
              <button
                onClick={() => setShowFabModal(false)}
                className="p-1 rounded-full bg-white/5 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <Link
                to="/admin/anime"
                onClick={() => setShowFabModal(false)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-white">Create New Anime</p>
                  <p className="text-[10px] text-white/40">Upload title, poster, genres &amp; metadata</p>
                </div>
              </Link>

              <Link
                to="/admin/episodes"
                onClick={() => setShowFabModal(false)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <PlaySquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-white">Add New Episode</p>
                  <p className="text-[10px] text-white/40">Configure Server 1 &amp; Server 2 embeds</p>
                </div>
              </Link>

              <Link
                to="/admin/seasons"
                onClick={() => setShowFabModal(false)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-white">Add New Season</p>
                  <p className="text-[10px] text-white/40">Group anime series into season arcs</p>
                </div>
              </Link>

              <Link
                to="/admin/media"
                onClick={() => setShowFabModal(false)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 transition-all text-xs font-bold text-white group"
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-white">Media Library</p>
                  <p className="text-[10px] text-white/40">Inspect &amp; copy all poster/banner URLs</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
