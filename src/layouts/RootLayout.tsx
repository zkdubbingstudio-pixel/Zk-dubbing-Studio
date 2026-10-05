import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Search, Menu, X, LogOut, Shield, User, Sliders } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { auth, googleProvider, browserPopupRedirectResolver } from '../lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import Logo3D from '../components/Logo3D';
import CyberParticles from '../components/CyberParticles';
import Footer from '../components/Footer';

export default function RootLayout() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, firebaseUser } = useAuthStore();
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        console.error('Error signing in with Google', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05070b] text-silver-light relative selection:bg-[#00e5ff] selection:text-black">
      {/* Floating Cyber Particles Background */}
      <CyberParticles />

      {/* Cyber Ambient Background Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#00e5ff]/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#0077b6]/5 rounded-full blur-[140px] pointer-events-none z-0" />

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
                to="/settings"
                className={`px-3 py-1.5 rounded-full text-xs lg:text-sm font-bold transition-all duration-200 ${
                  location.pathname === '/settings'
                    ? 'bg-[#00e5ff] text-black shadow-[0_0_15px_rgba(0,229,255,0.6)]'
                    : 'text-silver hover:text-white hover:bg-white/5'
                }`}
              >
                Settings
              </Link>
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

              {firebaseUser ? (
                <div className="flex items-center space-x-3 bg-[#0a0e17]/80 backdrop-blur-xl pl-3 pr-2 py-1.5 rounded-full border border-white/10">
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-1 text-xs font-black px-2.5 py-1 bg-[#00e5ff]/20 text-brand rounded-full border border-[#00e5ff]/30 hover:bg-[#00e5ff] hover:text-black transition-all"
                    >
                      <Shield className="w-3 h-3" />
                      ADMIN
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 hover:border-brand transition-colors relative group"
                    title={firebaseUser.displayName || 'Profile'}
                  >
                    <img
                      src={
                        firebaseUser.photoURL ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          firebaseUser.displayName || 'Anime Fan'
                        )}&background=00e5ff&color=000`
                      }
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-1.5 text-silver-dark hover:text-red-400 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="btn-3d-cyan px-6 py-2.5 text-xs sm:text-sm font-black tracking-wider cursor-pointer"
                >
                  SIGN IN
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              <Link
                to="/search"
                className="p-2 text-silver hover:text-brand"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-silver hover:text-white p-2 rounded-lg bg-white/5 border border-white/10"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6 text-brand" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-cyber border-t border-white/10 animate-in slide-in-from-top duration-300">
            <div className="px-4 py-4 space-y-2">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-silver-light hover:bg-[#00e5ff]/10 hover:text-brand transition-colors"
              >
                Home
              </Link>
              <Link
                to="/search"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-silver-light hover:bg-[#00e5ff]/10 hover:text-brand transition-colors"
              >
                Browse & Search
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-silver-light hover:bg-[#00e5ff]/10 hover:text-brand transition-colors"
              >
                Settings
              </Link>

              <div className="pt-2 border-t border-white/10">
                {!firebaseUser ? (
                  <button
                    onClick={() => {
                      handleLogin();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full btn-3d-cyan py-3 text-sm font-black text-center mt-2 cursor-pointer"
                  >
                    SIGN IN WITH GOOGLE
                  </button>
                ) : (
                  <div className="space-y-2 pt-1">
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10"
                    >
                      <User className="w-4 h-4 text-brand" />
                      <span>My Profile</span>
                    </Link>
                    {user?.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/20"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Outlet with Top Margin for Navbar */}
      <main className="flex-1 w-full pt-20 relative z-10">
        <Outlet />
      </main>

      {/* Upgraded Professional Anime Streaming Footer */}
      <Footer />
    </div>
  );
}
