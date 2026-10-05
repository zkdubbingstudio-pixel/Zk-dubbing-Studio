import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, RotateCcw, Clock } from 'lucide-react';

export interface WatchHistoryItem {
  animeId: string;
  seasonId: string;
  episodeId: string;
  animeTitle: string;
  episodeTitle?: string;
  seasonNumber: number;
  episodeNumber: number;
  posterUrl: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export default function ContinueWatchingRow() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('zk_watch_history');
      if (raw) {
        const parsed = JSON.parse(raw) as WatchHistoryItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sort by recently watched
          const sorted = parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          setHistory(sorted);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleClearItem = (e: React.MouseEvent, epId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = history.filter(h => h.episodeId !== epId);
    setHistory(updated);
    try {
      localStorage.setItem('zk_watch_history', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  if (history.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-end mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00e5ff]/15 flex items-center justify-center border border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
            <RotateCcw className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-silver-light tracking-tight flex items-center gap-2">
              Continue Watching
            </h2>
            <p className="text-xs text-silver-dark font-medium hidden sm:block">
              Pick up right where you left off
            </p>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 sm:gap-5 pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {history.map((item) => {
          const progressPercent = item.duration > 0 ? Math.min(100, Math.max(5, (item.currentTime / item.duration) * 100)) : 40;
          const route = `/watch/${item.animeId}/${item.seasonId}/${item.episodeId}`;

          return (
            <div
              key={`cw-${item.episodeId}`}
              className="flex-none w-64 sm:w-72 md:w-80 snap-start group relative"
            >
              <Link
                to={route}
                className="block relative rounded-2xl overflow-hidden glass-cyber-card border border-white/10 hover:border-[#00e5ff]/60 transition-all duration-300 transform hover:-translate-y-1 shadow-[0_8px_25px_rgba(0,0,0,0.7)] hover:shadow-[0_15px_35px_rgba(0,229,255,0.25)]"
              >
                {/* 16:9 Thumbnail view */}
                <div className="relative aspect-video w-full overflow-hidden bg-[#0a0e17]">
                  <img
                    src={item.posterUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=400'}
                    alt={item.animeTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85 group-hover:opacity-100"
                  />

                  {/* Dark vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/40 to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                    <span className="bg-black/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">
                      S{item.seasonNumber} : EP {item.episodeNumber}
                    </span>
                  </div>

                  {/* Play icon overlay */}
                  <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#00b4d8] to-[#00f0ff] flex items-center justify-center text-black shadow-[0_0_20px_rgba(0,229,255,0.8)] transform scale-75 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                    <div
                      className="h-full bg-gradient-to-r from-[#00b4d8] to-[#00f0ff] shadow-[0_0_8px_rgba(0,229,255,0.8)]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="p-3.5 bg-[#0a0e17]/90 flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="font-bold text-silver-light text-sm truncate group-hover:text-brand transition-colors">
                      {item.animeTitle}
                    </h3>
                    <p className="text-xs text-silver-dark flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-silver-dark" />
                      Episode {item.episodeNumber}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleClearItem(e, item.episodeId)}
                    title="Remove from history"
                    className="p-1.5 text-silver-dark hover:text-red-400 hover:bg-white/5 rounded-full transition-colors"
                  >
                    &times;
                  </button>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
