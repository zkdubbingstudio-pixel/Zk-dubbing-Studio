import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, X, LogOut, Shield, User, CheckCircle2, LogIn } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { signOutUser, isAuthorizedAdmin } from '../lib/authService';
import Logo3D from '../components/Logo3D';
import CyberParticles from '../components/CyberParticles';
import Footer from '../components/Footer';
import SideMenu from '../components/SideMenu';
import AboutModal from '../components/AboutModal';
import AuthModal from '../components/AuthModal';
import OwnerToastContainer from '../components/OwnerToastContainer';
import { subscribeToOwnerNotifications } from '../lib/ownerNotificationService';

export default function RootLayout() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const { user, setUser, authSuccessMessage, setAuthSuccessMessage, setAuthModalOpen } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
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

  useEffect(() => {
    let last = false;
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      if (scrolled !== last) {
        last = scrolled;
        setIsScrolled(scrolled);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch {}
    setUser(null);
    setAuthSuccessMessage('Logged out successfully.');
    navigate('/', { replace: true });
  };

  const handleNavSignIn = () => {
    setAuthModalOpen(true);
  };

  const currentUser = user;
  const isSignedIn = Boolean(currentUser);
  const isAdmin = Boolean(currentUser && isAuthorizedAdmin(currentUser?.email));

  // Subscribe owner to real-time notifications across the public site
  useEffect(() => {
    if (isAdmin && currentUser?.email) {
      const unsubscribe = subscribeToOwnerNotifications(currentUser.email);
      return () => {
        unsubscribe();
      };
    }
  }, [isAdmin, currentUser?.email]);

  return (
    <div className="min-h-screen flex flex-col bg-[#05070b] text-silver-light relative selection:bg-[#00e5ff] selection:text-black">
      {/* Floating Cyber Particles Background */}
      <CyberParticles />

      {/* Cyber Ambient Background Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#00e5ff]/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#0077b6]/5 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Global Auth Success Toast Notification */}
      {authSuccessMessage && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 w-11/12 max-w-lg z-[150] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#051a14]/95 border border-emerald-500/60 rounded-2xl p-4 shadow-[0_0_35px_rgba(16,185,129,0.35)] backdrop-blur-xl flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest mb-0.5">
                Notification
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

      {/* Floating 3D Cyber Navbar */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#05070b]/85 backdrop-blur-2xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]'
            : 'bg-gradient-to-b from-[#05070b]/90 via-[#05070b]/40 to-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-18 sm:h-20">
            {/* 3D Animated Logo */}
            <Logo3D size="md" />

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 bg-[#0a0e17]/80 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
              <Link
                to="/"
                className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-bold transition-all duration-200 ${
                  location.pathname === '/'
                    ? 'bg-[#00e5ff] text-black shadow-[0_0_15px_rgba(0,229,255,0.6)]'
                    : 'text-silver hover:text-white hover:bg-white/5'
                }`}
              >
                Home
              </Link>
              <Link
                to="/search"
                className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-bold transition-all duration-200 ${
                  location.pathname === '/search'
                    ? 'bg-[#00e5ff] text-black shadow-[0_0_15px_rgba(0,229,255,0.6)]'
                    : 'text-silver hover:text-white hover:bg-white/5'
                }`}
              >
                Browse & Search
              </Link>
              <Link
                to="/search?tab=categories"
                className="px-3 py-1.5 rounded-full text-xs lg:text-sm font-bold text-silver hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                Categories
              </Link>
              {isSignedIn && (
                <Link
                  to="/settings"
                  className={`px-3 py-1.5 rounded-full text-xs lg:text-sm font-bold transition-all duration-200 ${
                    location.pathname === '/settings'
                      ? 'bg-[#00e5ff] text-black shadow-[0_0_15px_rgba(0,229,255,0.6)]'
                      : 'text-silver hover:text-white hover:bg-white/5'
                  }`}
                >
                  Settings
                </Link>
              )}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-3">
              <Link
                to="/search"
                className="p-2.5 text-silver hover:text-brand transition-colors rounded-full hover:bg-white/5 border border-transparent hover:border-white/10"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </Link>

              {/* Admin Panel button - ONLY displayed for zkdubbingstudio@gmail.com */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 bg-[#00e5ff]/20 text-[#00e5ff] rounded-full border border-[#00e5ff]/40 hover:bg-[#00e5ff] hover:text-black transition-all shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                >
                  <Shield className="w-3.5 h-3.5" />
                  ADMIN
                </Link>
              )}

              {/* IF SIGNED IN: Profile Avatar & Logout */}
              {isSignedIn ? (
                <>
                  <Link
                    to="/profile"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                      location.pathname === '/profile'
                        ? 'bg-[#00e5ff]/20 border-brand text-brand shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                        : 'bg-[#0a0e17]/80 hover:bg-white/10 border-white/10 text-white'
                    }`}
                    title="Profile"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-brand/20 flex items-center justify-center border border-brand/40">
                      {(user?.photoURL || user?.profilePhoto) ? (
                        <img
                          src={user?.photoURL || user?.profilePhoto}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-3.5 h-3.5 text-brand" />
                      )}
                    </div>
                    <span className="text-xs font-bold">
                      {(user?.name || user?.displayName) || 'Profile'}
                    </span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-2 text-silver-dark hover:text-red-400 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                /* IF NOT SIGNED IN: Highlighted Sign In button on desktop */
                <button
                  onClick={handleNavSignIn}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,229,255,0.35)] hover:shadow-[0_0_22px_rgba(0,229,255,0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign In</span>
                </button>
              )}

              {/* 3-Line Menu hamburger button on desktop */}
              <button
                onClick={() => setSideMenuOpen(true)}
                className="text-silver hover:text-brand p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                aria-label="Open side menu"
                title="Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile menu action bar */}
            <div className="md:hidden flex items-center space-x-2">
              <Link
                to="/search"
                className="p-2 text-silver hover:text-brand"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </Link>

              {/* 3-Line Menu button on mobile */}
              <button
                onClick={() => setSideMenuOpen(true)}
                className="text-silver hover:text-white p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer"
                aria-label="Open side menu"
              >
                <Menu className="w-6 h-6 text-[#00e5ff]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Side Menu Drawer (3-line menu) */}
      <SideMenu
        isOpen={sideMenuOpen}
        onClose={() => setSideMenuOpen(false)}
        onOpenAbout={() => setAboutModalOpen(true)}
      />

      {/* About Studio Modal */}
      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />

      {/* Email + Password Auth Modal */}
      <AuthModal />

      {/* Main Outlet with Top Margin for Navbar */}
      <main className="flex-1 w-full pt-20 relative z-10">
        <Outlet />
      </main>

      {/* Upgraded Professional Anime Streaming Footer */}
      <Footer />

      {/* Real-time Owner Toast Container for Owner (zkdubbingstudio@gmail.com) */}
      <OwnerToastContainer />
    </div>
  );
}
