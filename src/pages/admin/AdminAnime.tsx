import React, { useState, useEffect } from "react";
import { 
  Film, Plus, Edit2, Trash2, X, Search, Filter, Star, Flame, 
  GripVertical, CheckCircle2, AlertCircle, Sparkles, LayoutGrid, 
  Table as TableIcon, ArrowUpDown, Globe, Check, Eye, Server, Clapperboard,
  Database, RefreshCw, Copy, ExternalLink, Play, Layers
} from 'lucide-react';
import { 
  getAllAnime, saveAnimeBoth, deleteAnimeBoth, 
  extractAbyssUrl, extractFileMoonUrl, extractVDOHideUrl,
  detectActualTableNames, getActiveAnimeTable, triggerAutoMigration, refreshSupabaseSchemaCache,
  getSeasonsByAnimeId, saveSeasonBoth, deleteSeasonBoth
} from '../../lib/dataService';
import ImageUpload from '../../components/admin/ImageUpload';
import { logAdminActivity } from '../../lib/activityLogger';

const COMMON_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 
  'Romance', 'Sci-Fi', 'Supernatural', 'Shounen', 'Slice of Life'
];

const LANGUAGES = [
  'All', 'Hindi Dubbed', 'Japanese (Sub)', 'English Dubbed', 'Tamil Dubbed', 'Telugu Dubbed'
];

export default function AdminAnime() {
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Schema & Table Detection State (Requirement 1, 2, 3, 4)
  const [schemaInfo, setSchemaInfo] = useState<{ anime: string; episodes: string; seasons: string; animeExists: boolean } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [dbPasswordInput, setDbPasswordInput] = useState('');
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedContentType, setSelectedContentType] = useState<'All' | 'TV Series' | 'Movie'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'TV Series' | 'Movie'>('TV Series');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [genres, setGenres] = useState('');
  const [language, setLanguage] = useState('Hindi Dubbed');
  const [rating, setRating] = useState('8.5/10');
  const [releaseYear, setReleaseYear] = useState('2024');
  const [releaseDate, setReleaseDate] = useState('');
  const [duration, setDuration] = useState('1h 45m');
  const [status, setStatus] = useState('Ongoing');
  const [dubbedBy, setDubbedBy] = useState('ZK Dubbing Studio');
  const [featured, setFeatured] = useState(false);
  const [trending, setTrending] = useState(false);

  // Season Assets State (Requirements 1, 2, 3, 4, 5, 6)
  const [seasonAssets, setSeasonAssets] = useState<{
    id?: string;
    seasonNumber: number;
    title: string;
    posterUrl: string;
    bannerUrl: string;
    isEditingDetails?: boolean;
  }[]>([
    {
      seasonNumber: 1,
      title: 'Season 1',
      posterUrl: '',
      bannerUrl: '',
      isEditingDetails: false,
    }
  ]);
  const [seasonSyncingId, setSeasonSyncingId] = useState<string | number | null>(null);

  // Movie Streaming Server Endpoints (One streaming server configuration: Server 1, Server 2, Server 3)
  const [server1Url, setServer1Url] = useState('');
  const [server2Url, setServer2Url] = useState('');
  const [server3Url, setServer3Url] = useState('');

  const fetchAnimeData = async () => {
    try {
      setError(null);
      detectActualTableNames().then(setSchemaInfo).catch(() => {});
      const list = await getAllAnime();
      setAnimeList(list || []);
    } catch (err: any) {
      const exactMsg = err?.message || String(err);
      setError(`Failed to load anime catalog: ${exactMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnimeData();
  }, []);

  const handleRunMigration = async () => {
    setMigrating(true);
    setError(null);
    try {
      const res = await triggerAutoMigration(dbPasswordInput ? { dbPassword: dbPasswordInput } : undefined);
      if (res.success) {
        setSuccessMsg(res.message);
        setShowMigrationPrompt(false);
        const info = await detectActualTableNames(true);
        setSchemaInfo(info);
        const refreshed = await getAllAnime();
        setAnimeList(refreshed);
      } else {
        if (res.dashboardUrl) {
          setShowMigrationPrompt(true);
        }
        setError(`Migration Notice: ${res.message}`);
      }
    } catch (err: any) {
      setError(`Migration Error: ${err?.message || String(err)}`);
    } finally {
      setMigrating(false);
    }
  };

  const handleRefreshCache = async () => {
    try {
      const res = await refreshSupabaseSchemaCache();
      const info = await detectActualTableNames(true);
      setSchemaInfo(info);
      setSuccessMsg(res.message || 'Schema cache reloaded!');
      setTimeout(() => setSuccessMsg(null), 3000);
      const refreshed = await getAllAnime();
      setAnimeList(refreshed);
    } catch (err: any) {
      setError(`Failed to refresh schema cache: ${err?.message || String(err)}`);
    }
  };

  const handleCopySql = () => {
    const fullSql = `-- ZK Voice Hub Schema Migration
CREATE TABLE IF NOT EXISTS anime (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    synopsis TEXT,
    poster_url TEXT,
    banner_url TEXT,
    genres TEXT[] DEFAULT '{}',
    language TEXT DEFAULT 'Hindi Dub',
    status TEXT DEFAULT 'Ongoing',
    rating TEXT DEFAULT '9.5',
    release_year TEXT,
    type TEXT DEFAULT 'TV Series',
    content_type TEXT DEFAULT 'TV Series',
    is_movie BOOLEAN DEFAULT false,
    duration TEXT,
    release_date TEXT,
    server1_url TEXT,
    server2_url TEXT,
    server3_url TEXT,
    dubbed_by TEXT DEFAULT 'ZK Dubbing Studio',
    dub_credits JSONB,
    featured BOOLEAN DEFAULT false,
    trending BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL,
    season_number INTEGER NOT NULL DEFAULT 1,
    title TEXT,
    description TEXT,
    banner_url TEXT,
    poster_url TEXT,
    "order" INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Published',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL,
    season_id TEXT,
    season_number INTEGER DEFAULT 1,
    episode_number INTEGER NOT NULL DEFAULT 1,
    episode_title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    duration TEXT,
    release_date TEXT,
    server1_url TEXT,
    server2_url TEXT,
    server3_url TEXT,
    views INTEGER DEFAULT 0,
    published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anime public select" ON anime FOR SELECT USING (true);
CREATE POLICY "Anime public all" ON anime USING (true) WITH CHECK (true);
CREATE POLICY "Seasons public select" ON seasons FOR SELECT USING (true);
CREATE POLICY "Seasons public all" ON seasons USING (true) WITH CHECK (true);
CREATE POLICY "Episodes public select" ON episodes FOR SELECT USING (true);
CREATE POLICY "Episodes public all" ON episodes USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`;
    navigator.clipboard.writeText(fullSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Season Assets Handlers (Requirements 2, 3, 4, 5, 6)
  const handleAddSeason = () => {
    setSeasonAssets(prev => {
      const nextNum = prev.length > 0 
        ? Math.max(...prev.map(s => Number(s.seasonNumber) || 1)) + 1 
        : 1;
      return [
        ...prev,
        {
          seasonNumber: nextNum,
          title: `Season ${nextNum}`,
          posterUrl: '',
          bannerUrl: '',
          isEditingDetails: false,
        }
      ];
    });
  };

  const handleToggleEditSeason = (index: number) => {
    setSeasonAssets(prev => prev.map((s, idx) => 
      idx === index ? { ...s, isEditingDetails: !s.isEditingDetails } : s
    ));
  };

  const handleUpdateSeasonField = (index: number, field: 'seasonNumber' | 'title', value: any) => {
    setSeasonAssets(prev => prev.map((s, idx) => 
      idx === index ? { ...s, [field]: value } : s
    ));
  };

  // Requirement 5: When Admin edits a season, only that season's poster and banner should be changed.
  // Requirement 6: Store season poster_url and banner_url in the seasons table.
  const handleSeasonImageChange = async (index: number, type: 'poster' | 'banner', url: string) => {
    setSeasonAssets(prev => prev.map((s, idx) => {
      if (idx === index) {
        return type === 'poster' ? { ...s, posterUrl: url } : { ...s, bannerUrl: url };
      }
      return s;
    }));

    // If editing an existing anime and season has an ID in database, immediately persist changes to seasons table
    const targetSeason = seasonAssets[index];
    if (editingId && targetSeason?.id) {
      try {
        setSeasonSyncingId(targetSeason.id);
        const seasonPayload = {
          id: targetSeason.id,
          animeId: editingId,
          seasonNumber: Number(targetSeason.seasonNumber) || 1,
          title: targetSeason.title?.trim() || `Season ${targetSeason.seasonNumber || 1}`,
          posterUrl: type === 'poster' ? url : targetSeason.posterUrl,
          poster_url: type === 'poster' ? url : targetSeason.posterUrl,
          bannerUrl: type === 'banner' ? url : targetSeason.bannerUrl,
          banner_url: type === 'banner' ? url : targetSeason.bannerUrl,
          order: Number(targetSeason.seasonNumber) || 1,
          status: 'Published',
        };
        await saveSeasonBoth(seasonPayload, targetSeason.id);
      } catch (err: any) {
        console.warn("Auto-sync season asset notice:", err);
      } finally {
        setSeasonSyncingId(null);
      }
    }
  };

  const handleDeleteSeason = async (index: number) => {
    const target = seasonAssets[index];
    const seasonLabel = target?.title || `Season ${target?.seasonNumber || index + 1}`;

    if (window.confirm(`Are you sure you want to delete ${seasonLabel}?`)) {
      if (target?.id && editingId) {
        try {
          await deleteSeasonBoth(target.id);
          logAdminActivity('Deleted Season', 'season', `Deleted ${seasonLabel} from ${title || 'Anime'}`);
        } catch (err: any) {
          setError(`Failed to delete season from database: ${err?.message || String(err)}`);
          return;
        }
      }
      setSeasonAssets(prev => prev.filter((_, idx) => idx !== index));
      setSuccessMsg(`${seasonLabel} deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const cleanS1 = extractAbyssUrl(server1Url);
      const cleanS2 = extractFileMoonUrl(server2Url);
      const cleanS3 = extractVDOHideUrl(server3Url);

      // Primary poster & banner synced from Season 1 / first season asset
      const primaryPoster = seasonAssets[0]?.posterUrl || posterUrl || '';
      const primaryBanner = seasonAssets[0]?.bannerUrl || bannerUrl || primaryPoster || '';

      const animePayload = {
        title: title.trim(),
        type: contentType,
        contentType,
        isMovie: contentType === 'Movie',
        description: description.trim(),
        posterUrl: primaryPoster,
        poster_url: primaryPoster,
        bannerUrl: primaryBanner,
        banner_url: primaryBanner,
        genres: genres.split(',').map(g => g.trim()).filter(Boolean),
        language: language.trim(),
        rating: rating.trim(),
        releaseYear: releaseYear.trim(),
        release_year: releaseYear.trim(),
        releaseDate: releaseDate.trim(),
        release_date: releaseDate.trim(),
        duration: duration.trim(),
        status,
        dubbedBy: dubbedBy.trim(),
        featured,
        trending,
        server1Url: cleanS1,
        server1_url: cleanS1,
        abyssUrl: cleanS1,
        abyss_url: cleanS1,
        server2Url: cleanS2,
        server2_url: cleanS2,
        filemoonUrl: cleanS2,
        filemoon_url: cleanS2,
        server3Url: cleanS3,
        server3_url: cleanS3,
        vdohideUrl: cleanS3,
        vdohide_url: cleanS3,
        videoUrl: cleanS1 || cleanS2 || cleanS3 || '',
      };

      const savedAnimeId = await saveAnimeBoth(animePayload, editingId || undefined);

      // Save each season into the seasons table (Requirement 6)
      for (const season of seasonAssets) {
        const seasonPayload = {
          id: season.id || undefined,
          animeId: savedAnimeId,
          seasonNumber: Number(season.seasonNumber) || 1,
          title: season.title?.trim() || `Season ${season.seasonNumber || 1}`,
          posterUrl: season.posterUrl || '',
          poster_url: season.posterUrl || '',
          bannerUrl: season.bannerUrl || '',
          banner_url: season.bannerUrl || '',
          order: Number(season.seasonNumber) || 1,
          status: 'Published',
        };
        await saveSeasonBoth(seasonPayload, season.id || undefined);
      }

      logAdminActivity(editingId ? 'Updated Title' : 'Created Title', 'anime', `${contentType}: ${title.trim()} (${seasonAssets.length} seasons)`);

      setSuccessMsg(editingId ? `${contentType} and Season Assets saved successfully!` : `${contentType} created with Season Assets successfully!`);
      setTimeout(() => setSuccessMsg(null), 3500);

      setShowForm(false);
      resetForm();
      const refreshed = await getAllAnime();
      setAnimeList(refreshed);
    } catch (err: any) {
      console.error("Error saving anime:", err);
      // Requirement 8: Show the exact database error if saving fails
      const exactMsg = err?.message || String(err);
      setError(`Database Error: ${exactMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, animeTitle: string) => {
    if (window.confirm(`Are you sure you want to delete "${animeTitle}" from Firestore and Supabase?`)) {
      try {
        await deleteAnimeBoth(id);
        setAnimeList(prev => prev.filter(a => a.id !== id));
        logAdminActivity('Deleted Anime', 'anime', `Deleted: ${animeTitle}`);
        setSuccessMsg('Anime deleted successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        console.error("Error deleting anime:", err);
        // Requirement 8: Show the exact database error if saving/deleting fails
        const exactMsg = err?.message || String(err);
        setError(`Database Error: ${exactMsg}`);
      }
    }
  };

  // Quick In-Line Toggles
  const handleToggleFeatured = async (anime: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextFeatured = !anime.featured;
      const updated = { ...anime, featured: nextFeatured };
      setAnimeList(prev => prev.map(a => a.id === anime.id ? updated : a));
      await saveAnimeBoth({ ...anime, featured: nextFeatured }, anime.id);
      logAdminActivity('Toggled Featured', 'anime', `${anime.title} -> ${nextFeatured ? 'Featured' : 'Standard'}`);
    } catch {
      setError("Failed to toggle featured status");
    }
  };

  const handleToggleTrending = async (anime: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextTrending = !anime.trending;
      const updated = { ...anime, trending: nextTrending };
      setAnimeList(prev => prev.map(a => a.id === anime.id ? updated : a));
      await saveAnimeBoth({ ...anime, trending: nextTrending }, anime.id);
      logAdminActivity('Toggled Trending', 'anime', `${anime.title} -> ${nextTrending ? 'Trending' : 'Standard'}`);
    } catch {
      setError("Failed to toggle trending status");
    }
  };

  const openEdit = async (anime: any) => {
    const isMovieType = anime.type === 'Movie' || anime.contentType === 'Movie' || anime.isMovie;
    setTitle(anime.title || '');
    setContentType(isMovieType ? 'Movie' : 'TV Series');
    setDescription(anime.description || anime.synopsis || '');
    setPosterUrl(anime.posterUrl || anime.poster_url || '');
    setBannerUrl(anime.bannerUrl || anime.banner_url || '');
    setGenres(Array.isArray(anime.genres) ? anime.genres.join(', ') : (anime.genres || ''));
    setLanguage(anime.language || 'Hindi Dubbed');
    setRating(String(anime.rating || '8.5/10'));
    setReleaseYear(String(anime.releaseYear || anime.release_year || '2024'));
    setReleaseDate(anime.releaseDate || anime.release_date || '');
    setDuration(anime.duration || (isMovieType ? '1h 45m' : '24m'));
    setStatus(anime.status || 'Ongoing');
    setDubbedBy(anime.dubbedBy || anime.dubbed_by || 'ZK Dubbing Studio');
    setFeatured(Boolean(anime.featured));
    setTrending(Boolean(anime.trending));
    setServer1Url(anime.server1Url || anime.server1_url || anime.abyssUrl || anime.abyss_url || '');
    setServer2Url(anime.server2Url || anime.server2_url || anime.filemoonUrl || anime.filemoon_url || '');
    setServer3Url(anime.server3Url || anime.server3_url || anime.vdohideUrl || anime.vdohide_url || '');
    setEditingId(anime.id);

    try {
      const existingSeasons = await getSeasonsByAnimeId(anime.id);
      if (existingSeasons && existingSeasons.length > 0) {
        setSeasonAssets(existingSeasons.map((s: any) => ({
          id: s.id,
          seasonNumber: Number(s.seasonNumber || s.season_number || 1),
          title: s.title || `Season ${s.seasonNumber || s.season_number || 1}`,
          posterUrl: s.posterUrl || s.poster_url || '',
          bannerUrl: s.bannerUrl || s.banner_url || '',
          isEditingDetails: false,
        })));
      } else {
        setSeasonAssets([{
          seasonNumber: 1,
          title: 'Season 1',
          posterUrl: anime.posterUrl || anime.poster_url || '',
          bannerUrl: anime.bannerUrl || anime.banner_url || '',
          isEditingDetails: false,
        }]);
      }
    } catch {
      setSeasonAssets([{
        seasonNumber: 1,
        title: 'Season 1',
        posterUrl: anime.posterUrl || anime.poster_url || '',
        bannerUrl: anime.bannerUrl || anime.banner_url || '',
        isEditingDetails: false,
      }]);
    }

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setTitle('');
    setContentType('TV Series');
    setDescription('');
    setPosterUrl('');
    setBannerUrl('');
    setGenres('');
    setLanguage('Hindi Dubbed');
    setRating('8.5/10');
    setReleaseYear('2024');
    setReleaseDate('');
    setDuration('1h 45m');
    setStatus('Ongoing');
    setDubbedBy('ZK Dubbing Studio');
    setFeatured(false);
    setTrending(false);
    setServer1Url('');
    setServer2Url('');
    setServer3Url('');
    setEditingId(null);
    setSeasonAssets([
      {
        seasonNumber: 1,
        title: 'Season 1',
        posterUrl: '',
        bannerUrl: '',
        isEditingDetails: false,
      }
    ]);
  };

  // Drag & drop card sorting
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...animeList];
    const draggedItem = reordered[draggedIndex];
    reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setAnimeList(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setSuccessMsg('Card display order updated.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Filter & Search Logic
  const filteredAnime = animeList.filter(anime => {
    const isMovieItem = anime.type === 'Movie' || anime.contentType === 'Movie' || anime.isMovie;
    const matchesSearch = 
      anime.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anime.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(anime.genres) && anime.genres.some((g: string) => g.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesGenre = 
      selectedGenre === 'All' || 
      (Array.isArray(anime.genres) && anime.genres.includes(selectedGenre)) ||
      (typeof anime.genres === 'string' && anime.genres.includes(selectedGenre));

    const matchesStatus = 
      selectedStatus === 'All' || 
      (anime.status || 'Ongoing').toLowerCase() === selectedStatus.toLowerCase();

    const matchesLanguage = 
      selectedLanguage === 'All' || 
      (anime.language || 'Hindi Dubbed').toLowerCase().includes(selectedLanguage.toLowerCase()) ||
      (anime.dubbedBy && anime.dubbedBy.toLowerCase().includes(selectedLanguage.toLowerCase()));

    const matchesType = 
      selectedContentType === 'All' || 
      (selectedContentType === 'Movie' ? isMovieItem : !isMovieItem);

    return matchesSearch && matchesGenre && matchesStatus && matchesLanguage && matchesType;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="w-12 h-12 border-4 border-white/10 border-t-brand rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]"></div>
        <p className="text-sm font-bold">Loading Anime Catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-[0_0_15px_rgba(0,229,255,0.25)]">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Anime Manager</h1>
              <p className="text-xs text-white/50">
                {animeList.length} total titles • Active Supabase table: <span className="text-cyan-400 font-mono font-semibold">{schemaInfo?.anime || 'anime'}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-brand text-black' : 'text-white/60 hover:text-white'}`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-brand text-black' : 'text-white/60 hover:text-white'}`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover shadow-[0_0_20px_rgba(0,229,255,0.35)] transition-all cursor-pointer"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
            {showForm ? 'Cancel' : 'Add Anime'}
          </button>
        </div>
      </div>

      {/* Supabase Schema Cache & Migration Status Bar (Requirement 1, 2, 3, 4) */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Supabase Schema Status:</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${schemaInfo?.animeExists ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                {schemaInfo?.animeExists ? 'TABLES ACTIVE' : 'SCHEMA CACHE PENDING'}
              </span>
            </div>
            <p className="text-[11px] text-white/50 font-mono mt-0.5">
              Detected Tables: anime: <span className="text-cyan-300">{schemaInfo?.anime || 'anime'}</span> | episodes: <span className="text-cyan-300">{schemaInfo?.episodes || 'episodes'}</span> | seasons: <span className="text-cyan-300">{schemaInfo?.seasons || 'seasons'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunMigration}
            disabled={migrating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Execute database migration"
          >
            <Play className={`w-3.5 h-3.5 ${migrating ? 'animate-spin' : ''}`} />
            <span>{migrating ? 'Migrating...' : 'Run Auto-Migration'}</span>
          </button>

          <button
            onClick={handleRefreshCache}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Refresh Schema Cache"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Cache</span>
          </button>

          <button
            onClick={handleCopySql}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Copy SQL for Supabase SQL Editor"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL'}</span>
          </button>

          <a
            href="https://supabase.com/dashboard/project/rwioavitlgzyrbgivwzi/sql/new"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-xl text-xs font-medium transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>SQL Editor</span>
          </a>
        </div>
      </div>

      {showMigrationPrompt && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-cyan-300">Execute Migration with DB Password:</h4>
            <button onClick={() => setShowMigrationPrompt(false)} className="text-white/40 hover:text-white text-xs">✕ Close</button>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Enter Supabase Database Password"
              value={dbPasswordInput}
              onChange={(e) => setDbPasswordInput(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleRunMigration}
              disabled={migrating || !dbPasswordInput}
              className="px-4 py-2 bg-cyan-500 text-black font-extrabold text-xs rounded-xl hover:bg-cyan-400 transition-all cursor-pointer disabled:opacity-50"
            >
              {migrating ? 'Applying...' : 'Apply Migration'}
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Drawer / Card */}
      {showForm && (
        <div className="bg-[#0e121d]/90 border border-brand/40 rounded-3xl p-6 md:p-8 shadow-[0_0_40px_rgba(0,229,255,0.2)] backdrop-blur-2xl animate-fade-in">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Edit Anime Title' : 'Register New Anime'}
              </h2>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-brand mb-1.5">
                  Anime Title *
                </label>
                <input 
                  required 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g. Solo Leveling, Demon Slayer, Naruto"
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-brand mb-1.5">
                  Language / Dub
                </label>
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="Hindi Dubbed">Hindi Dubbed</option>
                  <option value="Japanese (Sub)">Japanese (Sub)</option>
                  <option value="English Dubbed">English Dubbed</option>
                  <option value="Tamil Dubbed">Tamil Dubbed</option>
                  <option value="Telugu Dubbed">Telugu Dubbed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Genres (comma separated)
                </label>
                <input 
                  type="text" 
                  value={genres} 
                  onChange={e => setGenres(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                  placeholder="Action, Fantasy, Adventure" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Status
                </label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                  <option value="Upcoming">Upcoming</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Release Year
                </label>
                <input 
                  type="text" 
                  value={releaseYear} 
                  onChange={e => setReleaseYear(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                  placeholder="2024" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Rating
                </label>
                <input 
                  type="text" 
                  value={rating} 
                  onChange={e => setRating(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                  placeholder="8.8/10" 
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Dubbed By
                </label>
                <input 
                  type="text" 
                  value={dubbedBy} 
                  onChange={e => setDubbedBy(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                  placeholder="ZK Dubbing Studio" 
                />
              </div>
            </div>

            {/* Season Assets Section (Requirements 1, 2, 3, 4, 5, 6) */}
            <div className="p-5 md:p-6 rounded-2xl bg-black/50 border border-brand/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">Season Assets</h3>
                    <span className="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/30 text-[10px] font-black text-brand">
                      {seasonAssets.length} {seasonAssets.length === 1 ? 'Season' : 'Seasons'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">
                    Upload season-specific posters and banners. Admin can create unlimited seasons.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddSeason}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add Season</span>
                </button>
              </div>

              {seasonAssets.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-white/15 bg-white/5">
                  <p className="text-xs text-white/50 mb-3">No seasons created yet for this anime.</p>
                  <button
                    type="button"
                    onClick={handleAddSeason}
                    className="px-4 py-2 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover transition-all"
                  >
                    + Create Season 1
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {seasonAssets.map((season, idx) => (
                    <div 
                      key={season.id || `season_${idx}_${season.seasonNumber}`}
                      className="p-4 md:p-5 rounded-2xl bg-[#111726]/80 border border-white/10 hover:border-brand/30 transition-all space-y-4 shadow-lg"
                    >
                      {/* Season Header Bar */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="px-2.5 py-1 rounded-lg bg-brand/15 border border-brand/30 text-brand text-xs font-black tracking-wider uppercase">
                            Season {season.seasonNumber}
                          </span>
                          {!season.isEditingDetails ? (
                            <span className="text-sm font-bold text-white truncate">
                              {season.title || `Season ${season.seasonNumber}`}
                            </span>
                          ) : null}
                          {seasonSyncingId === season.id && (
                            <span className="text-[10px] text-cyan-400 font-bold animate-pulse">
                              Syncing...
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleEditSeason(idx)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                              season.isEditingDetails 
                                ? 'bg-brand text-black' 
                                : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10'
                            }`}
                            title={season.isEditingDetails ? 'Done editing details' : 'Edit Season Number & Title'}
                          >
                            {season.isEditingDetails ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Done</span>
                              </>
                            ) : (
                              <>
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSeason(idx)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold border border-red-500/20 transition-colors cursor-pointer"
                            title="Delete this season"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional Inline Edit for Season Number and Title */}
                      {season.isEditingDetails && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/60 border border-brand/30 animate-fade-in">
                          <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-brand mb-1">
                              Season Number
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={season.seasonNumber}
                              onChange={e => handleUpdateSeasonField(idx, 'seasonNumber', Number(e.target.value) || 1)}
                              className="w-full bg-black/70 border border-white/15 focus:border-brand rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-brand mb-1">
                              Season Title / Arc Name
                            </label>
                            <input
                              type="text"
                              value={season.title}
                              onChange={e => handleUpdateSeasonField(idx, 'title', e.target.value)}
                              placeholder={`Season ${season.seasonNumber}`}
                              className="w-full bg-black/70 border border-white/15 focus:border-brand rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Poster & Banner Upload Grid: Example layout requested */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                              Season {season.seasonNumber} Poster Image
                            </span>
                            {season.posterUrl && (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            )}
                          </div>
                          <ImageUpload
                            label={`Upload Season ${season.seasonNumber} Poster`}
                            value={season.posterUrl}
                            onChange={(url) => handleSeasonImageChange(idx, 'poster', url)}
                            folder="seasons/posters"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                              Season {season.seasonNumber} Banner Image
                            </span>
                            {season.bannerUrl && (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            )}
                          </div>
                          <ImageUpload
                            label={`Upload Season ${season.seasonNumber} Banner`}
                            value={season.bannerUrl}
                            onChange={(url) => handleSeasonImageChange(idx, 'banner', url)}
                            folder="seasons/banners"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleAddSeason}
                      className="w-full py-2.5 rounded-xl border border-dashed border-white/20 hover:border-brand/50 bg-white/5 hover:bg-brand/10 text-white/70 hover:text-brand font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Another Season (Unlimited)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                Synopsis / Description
              </label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={3} 
                className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none resize-none" 
                placeholder="Enter storyline, arc overview and key character details..."
              />
            </div>

            {/* Featured & Trending Toggles */}
            <div className="flex flex-wrap items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/10">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={featured} 
                  onChange={e => setFeatured(e.target.checked)} 
                  className="w-4 h-4 rounded border-white/20 bg-black/50 text-brand focus:ring-brand" 
                />
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span>Featured Hero Showcase</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={trending} 
                  onChange={e => setTrending(e.target.checked)} 
                  className="w-4 h-4 rounded border-white/20 bg-black/50 text-brand focus:ring-brand" 
                />
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>Trending on Home Page</span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className="px-6 py-2.5 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] disabled:opacity-50"
              >
                {saving ? 'Synchronizing Databases...' : (editingId ? 'Save Changes' : 'Publish Anime')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Multi-Filter Controls */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search anime title or genre..."
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none"
            />
          </div>

          {/* Genre Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedGenre}
              onChange={e => setSelectedGenre(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="All">All Genres</option>
              {COMMON_GENRES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Upcoming">Upcoming</option>
            </select>
          </div>

          {/* Language Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedLanguage}
              onChange={e => setSelectedLanguage(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{lang === 'All' ? 'All Languages' : lang}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Active Filter Counters */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-white/50 pt-2 border-t border-white/5">
          <span>Showing {filteredAnime.length} of {animeList.length} titles</span>
          {(searchQuery || selectedGenre !== 'All' || selectedStatus !== 'All' || selectedLanguage !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGenre('All');
                setSelectedStatus('All');
                setSelectedLanguage('All');
              }}
              className="text-brand hover:underline font-bold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid View with Drag & Drop Sorting */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAnime.map((anime, index) => {
            const poster = anime.posterUrl || anime.poster_url || "";
            return (
              <div
                key={anime.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-black/50 border border-white/10 hover:border-brand/50 rounded-3xl overflow-hidden backdrop-blur-md transition-all duration-200 group relative flex flex-col justify-between cursor-grab active:cursor-grabbing ${
                  draggedIndex === index ? 'opacity-40 border-dashed border-brand scale-95' : 'hover:-translate-y-1'
                }`}
              >
                {/* Poster & Badges */}
                <div className="relative h-48 w-full overflow-hidden bg-white/5">
                  <img
                    src={poster}
                    alt={anime.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-transparent to-black/60 pointer-events-none"></div>

                  {/* Drag Handle */}
                  <div className="absolute top-3 left-3 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/60 hover:text-white" title="Drag to reorder card">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                      anime.status === 'Ongoing' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                      anime.status === 'Completed' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' :
                      'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    }`}>
                      {anime.status || 'Ongoing'}
                    </span>
                  </div>

                  {/* Bottom Badges on Image */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px]">
                    <span className="text-white/80 font-bold bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-md">
                      {anime.releaseYear || anime.release_year || '2024'}
                    </span>
                    <span className="text-brand font-bold bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-md">
                      {anime.rating || '8.5/10'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-brand transition-colors line-clamp-1">
                      {anime.title}
                    </h3>
                    <p className="text-[11px] text-white/50 line-clamp-2 mt-1">
                      {anime.description || anime.synopsis || 'No description provided.'}
                    </p>
                    
                    {/* Genres */}
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {(Array.isArray(anime.genres) ? anime.genres : (anime.genres ? [anime.genres] : ['Anime'])).slice(0, 3).map((g: string, i: number) => (
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-md bg-white/5 text-white/60 border border-white/5">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quick Inline Toggles: Featured & Trending */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Featured Quick Button */}
                      <button
                        onClick={(e) => handleToggleFeatured(anime, e)}
                        className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          anime.featured 
                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-[0_0_10px_rgba(250,204,21,0.2)]' 
                            : 'bg-white/5 text-white/40 hover:text-white'
                        }`}
                        title={anime.featured ? 'Featured active' : 'Click to set featured'}
                      >
                        <Star className={`w-3.5 h-3.5 ${anime.featured ? 'fill-yellow-300' : ''}`} />
                      </button>

                      {/* Trending Quick Button */}
                      <button
                        onClick={(e) => handleToggleTrending(anime, e)}
                        className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          anime.trending 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]' 
                            : 'bg-white/5 text-white/40 hover:text-white'
                        }`}
                        title={anime.trending ? 'Trending active' : 'Click to set trending'}
                      >
                        <Flame className={`w-3.5 h-3.5 ${anime.trending ? 'fill-rose-300' : ''}`} />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(anime)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                        title="Edit Anime"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(anime.id, anime.title)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                        title="Delete Anime"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAnime.length === 0 && (
            <div className="col-span-full py-16 text-center text-white/40">
              <Film className="w-8 h-8 mx-auto mb-2 opacity-40 text-brand" />
              <p className="text-sm font-bold">No anime matching your filter criteria.</p>
              <p className="text-xs mt-1">Try resetting the search bar or genre filter.</p>
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-black/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                  <th className="p-4">Anime</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Language</th>
                  <th className="p-4">Rating</th>
                  <th className="p-4">Tags</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAnime.map(anime => (
                  <tr key={anime.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={anime.posterUrl || anime.poster_url || ""}
                          alt={anime.title}
                          className="w-10 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10"
                        />
                        <div>
                          <p className="font-bold text-white text-sm">{anime.title}</p>
                          <p className="text-[11px] text-white/40">
                            {Array.isArray(anime.genres) ? anime.genres.join(', ') : (anime.genres || 'Action')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        anime.status === 'Ongoing' ? 'bg-emerald-500/20 text-emerald-400' :
                        anime.status === 'Completed' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {anime.status || 'Ongoing'}
                      </span>
                    </td>
                    <td className="p-4 text-white/70">
                      {anime.language || 'Hindi Dubbed'}
                    </td>
                    <td className="p-4 text-brand font-bold">
                      {anime.rating || '8.5/10'}
                    </td>
                    <td className="p-4 space-x-1.5">
                      <button
                        onClick={(e) => handleToggleFeatured(anime, e)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          anime.featured ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/5 text-white/30'
                        }`}
                      >
                        Featured
                      </button>
                      <button
                        onClick={(e) => handleToggleTrending(anime, e)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          anime.trending ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5 text-white/30'
                        }`}
                      >
                        Trending
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button 
                        onClick={() => openEdit(anime)} 
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors" 
                        title="Edit Anime"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(anime.id, anime.title)} 
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-colors" 
                        title="Delete Anime"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
