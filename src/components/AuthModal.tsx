import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  User as UserIcon,
  Eye, 
  EyeOff, 
  X, 
  ShieldCheck, 
  AlertCircle, 
  UserPlus, 
  LogIn, 
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { 
  signInWithFirebase, 
  signUpWithFirebase, 
  sendFirebasePasswordReset, 
  isAuthorizedAdmin 
} from '../lib/authService';

type AuthTab = 'signin' | 'signup' | 'forgot';

export default function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, setUser, setAuthSuccessMessage } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AuthTab>('signin');
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isAuthModalOpen) return null;

  const isOwnerEmail = isAuthorizedAdmin(email);

  const resetFormState = () => {
    setError(null);
    setResetSuccess(false);
  };

  const switchTab = (tab: AuthTab) => {
    resetFormState();
    setActiveTab(tab);
  };

  const handleClose = () => {
    if (isLoading) return;
    resetFormState();
    setAuthModalOpen(false);
  };

  // 1. Handle Sign In submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await signInWithFirebase(cleanEmail, password);
      setUser(user);

      const isOwner = user.role === 'owner' || isAuthorizedAdmin(user.email);
      const welcomeText = isOwner
        ? 'Welcome back, Studio Owner! Admin access activated.'
        : `Welcome back, ${user.displayName || user.name || 'Anime Fan'}!`;

      setAuthSuccessMessage(welcomeText);
      setAuthModalOpen(false);
      setEmail('');
      setPassword('');

      // Redirect to Home page as specified
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Create Account submission
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError('Please enter your Full Name.');
      return;
    }
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both passwords match.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await signUpWithFirebase(cleanEmail, password, cleanName);
      setUser(user);

      const isOwner = user.role === 'owner' || isAuthorizedAdmin(user.email);
      const welcomeText = isOwner
        ? 'Owner account created and activated with full privileges.'
        : `Account created successfully! Welcome to ZK Voice Hub, ${cleanName}.`;

      setAuthSuccessMessage(welcomeText);
      setAuthModalOpen(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      // Redirect to Home page as specified
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Could not create account. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccess(false);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address to receive reset instructions.');
      return;
    }

    setIsLoading(true);
    try {
      await sendFirebasePasswordReset(cleanEmail);
      setResetSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send password reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Dimmed Backdrop */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity" 
        onClick={handleClose} 
      />

      {/* Cyber Auth Card */}
      <div className="relative w-full max-w-md bg-[#070b14] border border-[#00e5ff]/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,229,255,0.25)] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-36 bg-[#00e5ff]/15 rounded-full blur-[80px] pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#00e5ff]/15 border border-[#00e5ff]/40 flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.35)]">
              {activeTab === 'forgot' ? (
                <KeyRound className="w-5 h-5" />
              ) : activeTab === 'signup' ? (
                <UserPlus className="w-5 h-5" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                ZK Voice Hub
                <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]" />
              </h3>
              <p className="text-[11px] text-white/50 uppercase tracking-widest font-bold">
                Cyberpunk Studio Access
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Switcher: Sign In & Create Account */}
        {activeTab !== 'forgot' && (
          <div className="mt-5 grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10 relative z-10">
            <button
              type="button"
              onClick={() => switchTab('signin')}
              className={`py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('signup')}
              className={`py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        )}

        {/* Owner Account Detected Notice */}
        {isOwnerEmail && activeTab !== 'forgot' && (
          <div className="mt-4 p-3 rounded-xl bg-[#00e5ff]/15 border border-[#00e5ff]/40 text-[#00e5ff] text-xs flex items-center gap-2.5 animate-in fade-in relative z-10">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#00e5ff]" />
            <div>
              <span className="font-black uppercase tracking-wider block text-[10px]">Owner Account Detected</span>
              <span className="text-white/80 text-[11px]">Authorized email: unlocks full Administrator Panel access.</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in relative z-10">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* ----------------- TAB 1: SIGN IN ----------------- */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="mt-5 space-y-4 relative z-10">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className="text-[11px] text-[#00e5ff] hover:text-[#38bdf8] transition-colors cursor-pointer font-semibold"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:shadow-[0_0_30px_rgba(0,229,255,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => switchTab('signup')}
                className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                Don't have an account? <span className="text-[#00e5ff] font-bold">Create Account</span>
              </button>
            </div>
          </form>
        )}

        {/* ----------------- TAB 2: CREATE ACCOUNT ----------------- */}
        {activeTab === 'signup' && (
          <form onSubmit={handleCreateAccount} className="mt-5 space-y-3.5 relative z-10">
            {/* Full Name Input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Create Account Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:shadow-[0_0_30px_rgba(0,229,255,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => switchTab('signin')}
                className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                Already have an account? <span className="text-[#00e5ff] font-bold">Sign In</span>
              </button>
            </div>
          </form>
        )}

        {/* ----------------- TAB 3: FORGOT PASSWORD ----------------- */}
        {activeTab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="mt-5 space-y-4 relative z-10">
            <div>
              <button
                type="button"
                onClick={() => switchTab('signin')}
                className="inline-flex items-center gap-1.5 text-xs text-[#00e5ff] hover:text-[#38bdf8] font-semibold cursor-pointer mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
              <h4 className="text-sm font-bold text-white">Reset Your Password</h4>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                Enter your registered email address and we'll send you a Firebase password reset link.
              </p>
            </div>

            {resetSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div className="leading-relaxed">
                  Password reset link sent! Check your email inbox to choose a new password, then return here to sign in.
                </div>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all"
                />
              </div>
            </div>

            {/* Submit Reset Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:shadow-[0_0_30px_rgba(0,229,255,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send Reset Email</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
