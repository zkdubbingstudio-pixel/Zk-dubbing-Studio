import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  Film,
  Search,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Info,
  Mail,
  FileText,
  AlertTriangle,
  Scale,
  Send,
  ExternalLink,
  X,
  ChevronRight,
  ArrowUp,
  CheckCircle2,
  Heart,
  Radio
} from 'lucide-react';
import Logo3D from './Logo3D';

type InfoModalType = 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer' | 'dmca' | null;

export default function Footer() {
  const [activeModal, setActiveModal] = useState<InfoModalType>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openInfo = (type: InfoModalType) => {
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <>
      {/* Professional Anime Streaming Footer */}
      <footer className="relative z-10 bg-[#05070c] border-t border-white/10 mt-auto overflow-hidden">
        {/* Animated Neon Cyan Top Glow Rim */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-[1.5px] bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent shadow-[0_0_25px_rgba(0,229,255,0.9)] pointer-events-none" />
        
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00e5ff]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#00b4d8]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 relative z-10">
          {/* Main 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-14 border-b border-white/10">
            
            {/* Column 1: Brand & Studio Intro (4 cols on desktop) */}
            <div className="lg:col-span-4 flex flex-col space-y-5">
              <Logo3D size="lg" />
              
              <p className="text-xs sm:text-sm text-silver-dark leading-relaxed max-w-sm">
                ZK Voice Hub is your premier destination for high-definition Hindi Dubbed anime streaming. 
                Experience immersive storytelling powered by community voice artists and sound creators.
              </p>

              {/* Glowing Feature Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#00e5ff]/10 text-brand border border-[#00e5ff]/25 shadow-[0_0_12px_rgba(0,229,255,0.15)]">
                  <Sparkles className="w-3 h-3 text-brand" />
                  Hindi Dubbed
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/5 text-silver-light border border-white/10">
                  <Film className="w-3 h-3 text-[#00b4d8]" />
                  1080p Ultra HD
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Fast CDN Streaming
                </span>
              </div>
            </div>

            {/* Column 2: Quick Links (3 cols on desktop) */}
            <div className="lg:col-span-3 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00b4d8]/20 to-[#00e5ff]/20 border border-[#00e5ff]/30 flex items-center justify-center text-brand shadow-[0_0_10px_rgba(0,229,255,0.3)]">
                  <Compass className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Quick Links</h3>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm font-medium text-silver-dark">
                <li>
                  <Link
                    to="/"
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Home</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/search"
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Browse Anime</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/search"
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Search</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/search?filter=latest"
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Latest Episodes</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/search?filter=popular"
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Popular Anime</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Information (2 cols on desktop) */}
            <div className="lg:col-span-2 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00b4d8]/20 to-[#00e5ff]/20 border border-[#00e5ff]/30 flex items-center justify-center text-brand shadow-[0_0_10px_rgba(0,229,255,0.3)]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Information</h3>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm font-medium text-silver-dark">
                <li>
                  <button
                    type="button"
                    onClick={() => openInfo('about')}
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>About ZK Voice Hub</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openInfo('contact')}
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Contact Us</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openInfo('privacy')}
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Privacy Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openInfo('terms')}
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Terms of Service</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openInfo('disclaimer')}
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>Disclaimer</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openInfo('dmca')}
                    className="group inline-flex items-center gap-2 text-silver-light/80 hover:text-brand transition-colors duration-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand group-hover:translate-x-1 transition-all duration-200" />
                    <span>DMCA Policy</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Community & Telegram (3 cols on desktop) */}
            <div className="lg:col-span-3 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00b4d8]/20 to-[#00e5ff]/20 border border-[#00e5ff]/30 flex items-center justify-center text-brand shadow-[0_0_10px_rgba(0,229,255,0.3)]">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Community</h3>
              </div>

              {/* Glassmorphism Telegram Card */}
              <div className="relative rounded-2xl p-4 sm:p-5 glass-cyber-card border border-white/10 hover:border-[#00e5ff]/60 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,229,255,0.2)] group flex flex-col justify-between overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#00e5ff]/10 rounded-full blur-xl pointer-events-none" />
                
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-ping" />
                      Telegram Channel
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#00e5ff]/20 text-brand border border-[#00e5ff]/30">
                      OFFICIAL
                    </span>
                  </div>
                  <p className="text-xs text-silver-dark leading-relaxed mb-4">
                    Join our official Telegram community for instant episode release alerts, dubbing sneak peeks, and voice requests.
                  </p>
                </div>

                <a
                  href="https://t.me/+BrcaJdug2kgwZDM1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full btn-3d-cyan py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.35)] group-hover:scale-102 transition-transform duration-200"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                  <span>Join Telegram Channel</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
                </a>
              </div>
            </div>

          </div>

          {/* Bottom Bar: Copyright, Presenter & Scroll to Top */}
          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-5 text-xs text-silver-dark">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2 text-center sm:text-left">
              <span className="font-semibold text-silver-light">
                &copy; 2026 ZK Voice Hub.
              </span>
              <span className="text-silver-dark font-medium">
                Presenting by <strong className="text-white font-bold">ZK Dubbing Studio</strong>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-silver-dark">
                <span>Made for Anime Fans</span>
                <span>•</span>
                <span className="text-[#00e5ff]">Ultra HD Dubbing</span>
              </div>

              {/* Scroll to Top Button */}
              <button
                type="button"
                onClick={scrollToTop}
                aria-label="Scroll to top"
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-[#00e5ff]/15 border border-white/10 hover:border-[#00e5ff]/40 text-silver-light hover:text-brand flex items-center justify-center transition-all duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Information Dialog Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl glass-cyber-card bg-[#070b12]/95 border border-[#00e5ff]/40 shadow-[0_0_50px_rgba(0,229,255,0.3)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-[#00e5ff]/10 via-transparent to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00e5ff]/15 border border-[#00e5ff]/30 flex items-center justify-center text-brand shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                  {activeModal === 'about' && <Info className="w-5 h-5" />}
                  {activeModal === 'contact' && <Mail className="w-5 h-5" />}
                  {activeModal === 'privacy' && <ShieldCheck className="w-5 h-5" />}
                  {activeModal === 'terms' && <Scale className="w-5 h-5" />}
                  {activeModal === 'disclaimer' && <AlertTriangle className="w-5 h-5" />}
                  {activeModal === 'dmca' && <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    {activeModal === 'about' && 'About ZK Voice Hub'}
                    {activeModal === 'contact' && 'Contact Us'}
                    {activeModal === 'privacy' && 'Privacy Policy'}
                    {activeModal === 'terms' && 'Terms of Service'}
                    {activeModal === 'disclaimer' && 'Disclaimer'}
                    {activeModal === 'dmca' && 'DMCA Policy'}
                  </h2>
                  <p className="text-[11px] text-silver-dark font-medium">
                    ZK Voice Hub • ZK Dubbing Studio Official
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Quick Tabs */}
            <div className="flex overflow-x-auto gap-2 p-3 sm:px-6 bg-white/[0.02] border-b border-white/5 [&::-webkit-scrollbar]:hidden">
              {(['about', 'contact', 'privacy', 'terms', 'disclaimer', 'dmca'] as InfoModalType[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveModal(tab)}
                  className={`flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeModal === tab
                      ? 'bg-[#00e5ff] text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                      : 'bg-white/5 text-silver-dark hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab === 'about' && 'About'}
                  {tab === 'contact' && 'Contact'}
                  {tab === 'privacy' && 'Privacy'}
                  {tab === 'terms' && 'Terms'}
                  {tab === 'disclaimer' && 'Disclaimer'}
                  {tab === 'dmca' && 'DMCA'}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-4 text-xs sm:text-sm text-silver-dark leading-relaxed">
              {activeModal === 'about' && (
                <div className="space-y-4 text-silver-light">
                  <p className="text-white text-sm font-semibold">
                    Welcome to ZK Voice Hub — Powered by ZK Dubbing Studio.
                  </p>
                  <p>
                    ZK Voice Hub is an entertainment platform dedicated to bringing world-class anime to Hindi-speaking audiences worldwide. 
                    Our studio brings together passionate community voice artists, audio engineers, and sound designers to deliver authentic, high-fidelity Hindi dubbing.
                  </p>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <h4 className="text-white font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brand" />
                      Our Key Pillars
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-silver-dark text-xs">
                      <li>Crystal-clear 1080p video delivery with responsive CDN streaming</li>
                      <li>High quality multi-track Hindi voice acting and sound design</li>
                      <li>Modern, seamless 3D cyberpunk interface for desktop and mobile</li>
                      <li>Community-driven voice artist collaboration and feedback</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeModal === 'contact' && (
                <div className="space-y-4 text-silver-light">
                  <p>
                    We welcome inquiries from fans, voice talent, and copyright owners. For general feedback, dub requests, or technical support, reach out through the channels below:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2 text-white font-bold">
                        <Mail className="w-4 h-4 text-brand" />
                        <span>Email Support</span>
                      </div>
                      <p className="text-xs text-silver-dark mb-2">For business, voice auditions & support:</p>
                      <a href="mailto:zkdubbingstudio@gmail.com" className="text-brand font-bold text-xs hover:underline">
                        zkdubbingstudio@gmail.com
                      </a>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2 text-white font-bold">
                        <Send className="w-4 h-4 text-brand" />
                        <span>Telegram Channel</span>
                      </div>
                      <p className="text-xs text-silver-dark mb-2">For live community updates & chat:</p>
                      <a 
                        href="https://t.me/+BrcaJdug2kgwZDM1" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-brand font-bold text-xs hover:underline inline-flex items-center gap-1"
                      >
                        Join Telegram <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'privacy' && (
                <div className="space-y-3 text-silver-light">
                  <h4 className="text-white font-bold">Privacy Policy</h4>
                  <p>
                    Your privacy is important to us. ZK Voice Hub does not sell, rent, or trade your personal information to third parties.
                  </p>
                  <p>
                    <strong>Data Stored:</strong> When creating an account or viewing anime, we store basic watch progress, watchlist items, and account profiles using secure Google Firebase authentication and encrypted local storage.
                  </p>
                  <p>
                    <strong>Cookies & Local Storage:</strong> We use minimal client-side storage to remember your playback volume, selected server preference (Server 1 vs Server 2), and session authorization.
                  </p>
                  <p>
                    <strong>Third-Party Players:</strong> Streaming embeds from external storage providers (e.g., FileMoon, VDOHide) may have their own privacy policies governing embed playback.
                  </p>
                </div>
              )}

              {activeModal === 'terms' && (
                <div className="space-y-3 text-silver-light">
                  <h4 className="text-white font-bold">Terms of Service</h4>
                  <p>
                    By accessing or using ZK Voice Hub, you agree to comply with and be bound by these Terms of Service.
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-silver-dark">
                    <li>This platform is intended for personal, non-commercial entertainment purposes.</li>
                    <li>Users agree not to scrape, exploit, or disrupt server infrastructure.</li>
                    <li>ZK Voice Hub reserves the right to modify or discontinue any feature without prior notice.</li>
                    <li>Community members agree to maintain respectful conduct in all affiliated channels and Telegram communities.</li>
                  </ul>
                </div>
              )}

              {activeModal === 'disclaimer' && (
                <div className="space-y-3 text-silver-light">
                  <h4 className="text-white font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    Content Disclaimer
                  </h4>
                  <p>
                    ZK Voice Hub does not store or host any copyrighted video files on its own servers. All video media, streams, and thumbnails are hosted by non-affiliated third-party providers or uploaded by independent community users.
                  </p>
                  <p>
                    All original anime characters, storylines, artwork, and trademarks belong to their respective copyright holders, animation studios, and original creators. Hindi dub audio tracks are created for educational, cultural, and localized appreciation by community voice artists under fair use principles.
                  </p>
                </div>
              )}

              {activeModal === 'dmca' && (
                <div className="space-y-3 text-silver-light">
                  <h4 className="text-white font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand" />
                    DMCA Notice & Takedown Policy
                  </h4>
                  <p>
                    ZK Voice Hub respects the intellectual property rights of others and strictly complies with the Digital Millennium Copyright Act (DMCA).
                  </p>
                  <p>
                    If you are a copyright owner or an authorized agent and believe that content accessible on ZK Voice Hub infringes upon your copyright, please contact our designated agent with:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-silver-dark">
                    <li>Identification of the copyrighted work claimed to have been infringed.</li>
                    <li>Specific URL(s) or page locations where the claimed infringement exists.</li>
                    <li>Contact information (email address, telephone number, and postal address).</li>
                    <li>A statement of good faith belief that the disputed use is not authorized.</li>
                  </ul>
                  <div className="pt-2">
                    <span className="text-xs text-silver-dark font-medium">Send takedown notices directly to: </span>
                    <a href="mailto:zkdubbingstudio@gmail.com" className="text-brand font-bold text-xs hover:underline">
                      zkdubbingstudio@gmail.com
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-white/10 bg-white/[0.02] flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="btn-3d-cyan py-2 px-6 text-xs font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
