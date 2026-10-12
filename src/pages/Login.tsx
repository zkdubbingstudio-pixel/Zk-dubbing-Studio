import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { AlertCircle, RotateCcw, ShieldCheck, Film, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { 
  signInWithGoogle, 
  signInWithGoogleIdToken, 
  processRedirectResult, 
  getFriendlyAuthErrorMessage, 
  getPostLoginRedirectUrl 
} from '../lib/authService';
import { OAUTH_CLIENT_ID, PRODUCTION_DOMAIN, PRODUCTION_ORIGIN } from '../lib/firebase';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, setUser, setAuthSuccessMessage } = useAuthStore();

  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [signingInStatus, setSigningInStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const gisContainerRef = useRef<HTMLDivElement>(null);

  const redirectParam = searchParams.get('redirect');

  // Determine target path after successful authentication
  const getDestinationPath = () => {
    if (redirectParam && redirectParam !== '/login') {
      return decodeURIComponent(redirectParam);
    }
    const saved = getPostLoginRedirectUrl();
    if (saved && saved !== '/login') {
      return saved;
    }
    return '/';
  };

  // If already logged in, redirect immediately
  useEffect(() => {
    if (!loading && user) {
      const dest = getDestinationPath();
      navigate(dest, { replace: true });
    }
  }, [user, loading]);

  // Handle redirect result if returning from Google OAuth redirect flow
  useEffect(() => {
    let isMounted = true;
    processRedirectResult()
      .then((userRecord) => {
        if (!isMounted) return;
        if (userRecord) {
          setUser(userRecord);
          setAuthSuccessMessage(`Welcome back, ${userRecord.displayName || userRecord.email}!`);
          const dest = getDestinationPath();
          navigate(dest, { replace: true });
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        if (err?.code !== 'auth/popup-closed-by-user') {
          setErrorMessage(getFriendlyAuthErrorMessage(err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Google Identity Services (GIS) for seamless Android Chrome / Custom Tabs support
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;

    const initGIS = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id && OAUTH_CLIENT_ID) {
        try {
          window.google.accounts.id.initialize({
            client_id: OAUTH_CLIENT_ID,
            callback: async (response: any) => {
              if (response && response.credential) {
                setIsSigningIn(true);
                setSigningInStatus('Authenticating with Google...');
                setErrorMessage(null);
                try {
                  const loggedUser = await signInWithGoogleIdToken(response.credential);
                  setUser(loggedUser);
                  setAuthSuccessMessage(`Welcome back, ${loggedUser.displayName || loggedUser.email}!`);
                  const dest = getDestinationPath();
                  navigate(dest, { replace: true });
                } catch (err: any) {
                  console.error('Google Identity sign-in error:', err);
                  setErrorMessage(getFriendlyAuthErrorMessage(err));
                } finally {
                  setIsSigningIn(false);
                  setSigningInStatus('');
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Render official Google button if container ref is available
          if (gisContainerRef.current) {
            window.google.accounts.id.renderButton(gisContainerRef.current, {
              theme: 'filled_black',
              size: 'large',
              shape: 'pill',
              text: 'continue_with',
              width: 280,
            });
          }
        } catch (e) {
          console.warn('Google Identity Services initialization warning:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGIS();
    } else {
      checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGIS();
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  // Standard Google Sign-In with popup + redirect fallback
  const handleSignIn = async (preferRedirect = false) => {
    setIsSigningIn(true);
    setErrorMessage(null);
    setSigningInStatus(preferRedirect ? 'Redirecting to Google...' : 'Connecting to Google...');

    try {
      const returnUrl = getDestinationPath();
      const loggedInUser = await signInWithGoogle({ preferRedirect, returnUrl });

      if (loggedInUser) {
        setAuthSuccessMessage(`Welcome back, ${loggedInUser.displayName || loggedInUser.email}!`);
        navigate(returnUrl, { replace: true });
      }
      // If preferRedirect was true, browser redirects to Google OAuth
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        const friendlyMsg = getFriendlyAuthErrorMessage(error);
        setErrorMessage(friendlyMsg);
      }
    } finally {
      setIsSigningIn(false);
      setSigningInStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-[#05070b] text-white flex flex-col justify-center items-center px-4 relative overflow-hidden select-none">
      {/* Background Cyberpunk Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00E5FF]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-cyan-700/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#0b0e14]/90 border border-white/10 rounded-3xl p-8 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative z-10 flex flex-col items-center text-center">
        {/* Brand Logo & Presentation */}
        <div className="relative mb-6">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand to-cyan-400 opacity-40 blur-lg" />
          <img 
            src="https://i.ibb.co/2Yp3CDq9/file-000000006f2c8211b20c6bedc9f9ac12.png" 
            alt="ZK Voice Hub Logo" 
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl relative z-10 border border-brand/40 shadow-[0_0_20px_rgba(0,229,255,0.3)]"
          />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
          ZK Voice Hub
        </h1>
        <p className="text-brand text-[11px] font-black tracking-widest uppercase mb-6">
          Presented by: ZK Dubbing Studio
        </p>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

        <h2 className="text-lg font-bold text-white mb-2">
          Sign In to Continue
        </h2>
        <p className="text-white/60 text-xs sm:text-sm mb-8 leading-relaxed max-w-xs">
          Sign in with your Google account to access all anime series, movies, and sync your watch history.
        </p>

        {/* Error Alert Display (Requirement 6) */}
        {errorMessage && (
          <div className="w-full mb-6 p-4 rounded-2xl bg-red-950/70 border border-red-500/40 text-left flex items-start gap-3 backdrop-blur-md animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-200 leading-snug">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="mt-2 text-[11px] text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Primary Google Sign-In Button */}
        <button
          type="button"
          onClick={() => handleSignIn(false)}
          disabled={isSigningIn}
          className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-white/95 text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:shadow-[0_0_35px_rgba(0,229,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
        >
          {/* Google SVG Logo */}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="tracking-wide">
            {isSigningIn ? signingInStatus || 'Connecting...' : 'Continue with Google'}
          </span>
        </button>

        {/* Secondary Alternative: Mobile / Android Chrome Direct Redirect */}
        <button
          type="button"
          onClick={() => handleSignIn(true)}
          disabled={isSigningIn}
          className="mt-3 w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/5 hover:border-white/10 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5 text-brand" />
          <span>Mobile / Android Chrome Direct Sign-In</span>
        </button>

        {/* Google Identity Services Container for One-Tap / Android Custom Tabs */}
        <div ref={gisContainerRef} className="mt-4 flex items-center justify-center min-h-[44px]" />

        {/* Security & Domain Badge */}
        <div className="mt-8 pt-6 border-t border-white/10 w-full flex items-center justify-center gap-2 text-[11px] text-white/40">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Protected by Google OAuth & Firebase Authentication</span>
        </div>
      </div>

      {/* Footer Info */}
      <p className="mt-8 text-white/30 text-xs text-center relative z-10">
        &copy; {new Date().getFullYear()} ZK Voice Hub &bull; All Rights Reserved
      </p>
    </div>
  );
}
