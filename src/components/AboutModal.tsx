import React from 'react';
import { X, ShieldCheck, Mail, Send, Sparkles, ExternalLink, Film, CheckCircle2 } from 'lucide-react';
import Logo3D from './Logo3D';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
        onClick={onClose} 
      />

      {/* Cyberpunk Dialog */}
      <div className="relative w-full max-w-xl bg-[#070b14] border border-[#00e5ff]/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,229,255,0.25)] text-left z-10 max-h-[90vh] overflow-y-auto">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#00e5ff]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 relative z-10 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] text-[10px] font-black uppercase tracking-wider border border-[#00e5ff]/30">
              <Sparkles className="w-3 h-3" />
              <span>About Studio</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              ZK Voice Hub
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-silver-light relative z-10">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-[#00e5ff]/20 to-[#0077b6]/20 border border-[#00e5ff]/40 flex items-center justify-center text-[#00e5ff] shrink-0">
              <Film className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-white text-base">Premier Hindi Dubbing Network</h4>
              <p className="text-xs text-white/60 mt-0.5">
                Dedicated to bringing top-tier Hindi dubbed anime productions with high studio-grade sound quality.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#00e5ff]">Key Features</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                'Crystal-clear 1080p responsive streaming',
                'Multi-server automatic failover & fallback',
                'Native Hindi voice acting & localized scripts',
                '100% Free streaming without mandatory login'
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white/80">
                  <CheckCircle2 className="w-4 h-4 text-[#00e5ff] shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-white/10">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#00e5ff]">Connect With Us</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="mailto:zkdubbingstudio@gmail.com"
                className="p-3.5 rounded-xl bg-[#00e5ff]/5 border border-[#00e5ff]/20 hover:border-[#00e5ff]/50 transition-all flex items-center gap-3 text-white group"
              >
                <div className="w-9 h-9 rounded-lg bg-[#00e5ff]/20 flex items-center justify-center text-[#00e5ff]">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-white/50 uppercase font-bold">Email Studio</div>
                  <div className="text-xs font-bold truncate group-hover:text-[#00e5ff] transition-colors">
                    zkdubbingstudio@gmail.com
                  </div>
                </div>
              </a>

              <a
                href="https://t.me/+BrcaJdug2kgwZDM1"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-[#00e5ff]/5 border border-[#00e5ff]/20 hover:border-[#00e5ff]/50 transition-all flex items-center gap-3 text-white group"
              >
                <div className="w-9 h-9 rounded-lg bg-[#00e5ff]/20 flex items-center justify-center text-[#00e5ff]">
                  <Send className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-white/50 uppercase font-bold">Community</div>
                  <div className="text-xs font-bold truncate group-hover:text-[#00e5ff] transition-colors flex items-center gap-1">
                    Join Telegram <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
