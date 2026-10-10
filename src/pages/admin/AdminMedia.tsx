import { useState, useEffect } from 'react';
import { 
  FolderOpen, Search, Copy, Check, ExternalLink, RefreshCw, 
  Image as ImageIcon, Upload, Sparkles, Filter, Trash2 
} from 'lucide-react';
import { getAllAnime, getAllEpisodes, getAllSeasons } from '../../lib/dataService';
import { logAdminActivity } from '../../lib/activityLogger';
import { resolveImageUrl } from '../../lib/imageUtils';
import SmartImage from '../../components/SmartImage';

interface MediaItem {
  id: string;
  url: string;
  type: 'poster' | 'banner' | 'thumbnail';
  title: string;
  parentTitle: string;
  parentId: string;
}

export default function AdminMedia() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'poster' | 'banner' | 'thumbnail'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');

  const loadMedia = async () => {
    setLoading(true);
    try {
      const [animes, seasons, episodes] = await Promise.all([
        getAllAnime().catch(() => []),
        getAllSeasons().catch(() => []),
        getAllEpisodes(false).catch(() => []),
      ]);

      const items: MediaItem[] = [];

      animes.forEach((anime: any) => {
        const poster = anime.posterUrl || anime.poster_url;
        if (poster) {
          items.push({
            id: `anime-poster-${anime.id}`,
            url: resolveImageUrl(poster, 'posters'),
            type: 'poster',
            title: `${anime.title} (Poster)`,
            parentTitle: anime.title,
            parentId: anime.id,
          });
        }
        const banner = anime.bannerUrl || anime.banner_url;
        if (banner) {
          items.push({
            id: `anime-banner-${anime.id}`,
            url: resolveImageUrl(banner, 'banners'),
            type: 'banner',
            title: `${anime.title} (Banner)`,
            parentTitle: anime.title,
            parentId: anime.id,
          });
        }
      });

      seasons.forEach((season: any) => {
        const banner = season.bannerUrl || season.banner_url;
        if (banner) {
          items.push({
            id: `season-banner-${season.id}`,
            url: resolveImageUrl(banner, 'banners'),
            type: 'banner',
            title: `${season.title || 'Season'} (Banner)`,
            parentTitle: `Season ${season.seasonNumber || 1}`,
            parentId: season.id,
          });
        }
      });

      episodes.forEach((ep: any) => {
        const thumb = ep.thumbnailUrl || ep.thumbnail_url;
        if (thumb) {
          items.push({
            id: `ep-thumb-${ep.id}`,
            url: resolveImageUrl(thumb, 'thumbnails'),
            type: 'thumbnail',
            title: ep.title ? `Ep ${ep.episodeNumber}: ${ep.title}` : `Episode ${ep.episodeNumber}`,
            parentTitle: `Episode ${ep.episodeNumber}`,
            parentId: ep.id,
          });
        }
      });

      // Deduplicate by URL
      const seen = new Set<string>();
      const deduped: MediaItem[] = [];
      for (const item of items) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          deduped.push(item);
        }
      }

      setMediaList(deduped);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredMedia = mediaList.filter(item => {
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.parentTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.url.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const posterCount = mediaList.filter(m => m.type === 'poster').length;
  const bannerCount = mediaList.filter(m => m.type === 'banner').length;
  const thumbCount = mediaList.filter(m => m.type === 'thumbnail').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-[0_0_15px_rgba(0,229,255,0.25)]">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Media Library</h1>
              <p className="text-xs text-white/50">Manage, preview, and inspect all anime posters, banners, and thumbnails</p>
            </div>
          </div>
        </div>

        <button 
          onClick={loadMedia} 
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand' : ''}`} />
          Refresh Media
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Total Assets</p>
            <p className="text-2xl font-extrabold text-white mt-0.5">{mediaList.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <ImageIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Posters</p>
            <p className="text-2xl font-extrabold text-cyan-400 mt-0.5">{posterCount}</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">2:3</span>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Banners</p>
            <p className="text-2xl font-extrabold text-purple-400 mt-0.5">{bannerCount}</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">16:9</span>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Thumbnails</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{thumbCount}</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">16:9</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'bg-black/40 text-white/70 hover:text-white border border-white/5'
            }`}
          >
            All ({mediaList.length})
          </button>
          <button
            onClick={() => setActiveTab('poster')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'poster'
                ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'bg-black/40 text-white/70 hover:text-white border border-white/5'
            }`}
          >
            Posters ({posterCount})
          </button>
          <button
            onClick={() => setActiveTab('banner')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'banner'
                ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'bg-black/40 text-white/70 hover:text-white border border-white/5'
            }`}
          >
            Banners ({bannerCount})
          </button>
          <button
            onClick={() => setActiveTab('thumbnail')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'thumbnail'
                ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'bg-black/40 text-white/70 hover:text-white border border-white/5'
            }`}
          >
            Thumbnails ({thumbCount})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search media by title or URL..."
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <div className="w-10 h-10 border-4 border-white/10 border-t-brand rounded-full animate-spin mb-3"></div>
          <p className="text-sm">Scanning media assets across Firestore &amp; Supabase...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="bg-black/40 border border-white/10 rounded-3xl p-12 text-center text-white/50">
          <ImageIcon className="w-12 h-12 mx-auto text-white/20 mb-3" />
          <p className="text-lg font-bold text-white mb-1">No media files found</p>
          <p className="text-xs text-white/40">Try adjusting your search query or filter tab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map(item => {
            const isCopied = copiedId === item.id;
            return (
              <div 
                key={item.id}
                className="group bg-black/40 border border-white/10 hover:border-brand/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_25px_rgba(0,229,255,0.15)] flex flex-col"
              >
                {/* Image Container */}
                <div 
                  onClick={() => setSelectedImage(item)}
                  className="relative aspect-video sm:aspect-[4/3] bg-black/60 overflow-hidden cursor-pointer"
                >
                  <SmartImage 
                    src={item.url} 
                    alt={item.title}
                    type={item.type}
                    className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                    style={{ objectFit: 'cover', objectPosition: 'center center' }}
                    loading="lazy"
                    titleFallback={item.title}
                  />
                  <div className="absolute top-2 left-2 z-10">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md backdrop-blur-md border ${
                      item.type === 'poster' 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                        : item.type === 'banner'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {item.type}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-bold text-white bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20">
                      Preview
                    </span>
                  </div>
                </div>

                {/* Footer / Info */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-brand transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[10px] text-white/40 line-clamp-1 font-mono mt-0.5">
                      {item.url}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(item.url, item.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                        isCopied 
                          ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                          : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10'
                      }`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {isCopied ? 'Copied' : 'Copy URL'}
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors"
                      title="Open full image in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview & Inspect Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f1117] border border-white/15 rounded-3xl max-w-2xl w-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-brand/30">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                  {selectedImage.type}
                </span>
                <h3 className="text-base font-bold text-white mt-1">{selectedImage.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedImage(null)}
                className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="w-full max-h-[360px] bg-black/60 rounded-2xl overflow-hidden flex items-center justify-center border border-white/10">
                <img 
                  src={selectedImage.url} 
                  alt={selectedImage.title} 
                  className="max-h-[360px] w-auto object-contain"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Direct Image URL</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={selectedImage.url} 
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopyUrl(selectedImage.url, selectedImage.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand text-black font-bold text-xs rounded-xl hover:bg-brand-hover transition-colors shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                  >
                    {copiedId === selectedImage.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    Copy
                  </button>
                  <a
                    href={selectedImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold transition-colors"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
