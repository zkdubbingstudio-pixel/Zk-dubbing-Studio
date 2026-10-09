import { useState, useEffect, FormEvent } from 'react';
import { 
  PlaySquare, Plus, Edit2, Trash2, Copy, CheckSquare, Square, 
  ArrowUp, ArrowDown, Eye, X, Image as ImageIcon, CheckCircle2, 
  AlertCircle, Sparkles, Server, Search, Filter, Play, Check 
} from 'lucide-react';
import { 
  getAllAnime, getAllSeasons, getAllEpisodes, 
  saveEpisodeBoth, deleteEpisodeBoth, extractAbyssUrl, extractFileMoonUrl, extractVDOHideUrl, resolveEpisodeServers 
} from '../../lib/dataService';
import ImageUpload from '../../components/admin/ImageUpload';
import { logAdminActivity } from '../../lib/activityLogger';

export default function AdminEpisodes() {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeFilter, setSelectedAnimeFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All'); // All, Published, Draft

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // Preview Player Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewEpisode, setPreviewEpisode] = useState<any | null>(null);
  const [previewServer, setPreviewServer] = useState<'server1' | 'server2' | 'server3'>('server1');

  // Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [episodeToDelete, setEpisodeToDelete] = useState<{ id: string; title: string; episodeNumber?: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Form state
  const [animeId, setAnimeId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState<number>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [duration, setDuration] = useState('24m');
  const [releaseDate, setReleaseDate] = useState('');
  const [server1Url, setServer1Url] = useState('');
  const [server2Url, setServer2Url] = useState('');
  const [server3Url, setServer3Url] = useState('');
  const [published, setPublished] = useState(true);

  const fetchData = async () => {
    try {
      setError(null);
      const [animes, seasonsList, epList] = await Promise.all([
        getAllAnime().catch(() => []),
        getAllSeasons().catch(() => []),
        getAllEpisodes().catch(() => []),
      ]);
      setAnimeList(animes || []);
      setSeasons(seasonsList || []);
      setEpisodes(epList || []);
    } catch {
      setError("Failed to load episodes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!animeId) {
      alert("Please select an Anime");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const cleanS1 = extractAbyssUrl(server1Url);
      const cleanS2 = extractFileMoonUrl(server2Url);
      const cleanS3 = extractVDOHideUrl(server3Url);

      const matchedSeason = seasons.find(s => s.id === seasonId);
      const computedSeasonNumber = matchedSeason?.seasonNumber != null ? Number(matchedSeason.seasonNumber) : 1;

      const epPayload = {
        animeId,
        seasonId,
        seasonNumber: computedSeasonNumber,
        episodeNumber: Number(episodeNumber) || 1,
        title: title.trim(),
        description: description.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        duration: duration.trim() || '24m',
        releaseDate: releaseDate.trim(),
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
        published,
      };

      await saveEpisodeBoth(epPayload, editingId || undefined);
      logAdminActivity(editingId ? 'Updated Episode' : 'Added Episode', 'episode', `Episode ${episodeNumber}: ${title || 'Untitled'}`);

      setSuccessMsg(editingId ? 'Episode updated in Firestore & Supabase!' : 'Episode published in Firestore & Supabase!');
      setTimeout(() => setSuccessMsg(null), 3500);

      resetForm();
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      console.error("Error saving episode:", err);
      // Requirement 8: Show exact database error if saving fails
      setError(`Database Error: ${err?.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (ep: any) => {
    const epId = ep.id || (ep as any)._id;
    if (!epId) {
      setError("Error: Episode ID is missing or invalid.");
      return;
    }
    const epNum = ep.episodeNumber || ep.episode_number || 1;
    const epTitleText = ep.title ? `Episode ${epNum}: ${ep.title}` : `Episode ${epNum}`;
    setEpisodeToDelete({
      id: epId,
      title: epTitleText,
      episodeNumber: epNum,
    });
    setDeleteDialogError(null);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!episodeToDelete?.id) return;
    setIsDeleting(true);
    setDeleteDialogError(null);
    setError(null);
    setSuccessMsg(null);

    const targetId = episodeToDelete.id;
    const targetTitle = episodeToDelete.title;

    try {
      // 1. Delete from Firestore & Supabase & purge server URLs & invalidate caches
      await deleteEpisodeBoth(targetId);

      // Immediate optimistic UI update
      setEpisodes(prev => prev.filter(e => (e.id || (e as any)._id) !== targetId));
      setSelectedIds(prev => prev.filter(item => item !== targetId));
      if (editingId === targetId) {
        resetForm();
        setShowForm(false);
      }

      // 4. Refresh Episode Manager list immediately
      await fetchData();

      logAdminActivity('Deleted Episode', 'episode', `Deleted: ${targetTitle}`);

      // Close modal
      setDeleteModalOpen(false);
      setEpisodeToDelete(null);

      // 5. Show a success toast: "Episode deleted successfully."
      setSuccessMsg("Episode deleted successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error deleting episode:", err);
      const exactError = err?.message || (typeof err === 'string' ? err : 'Unknown error occurred while deleting episode.');
      setDeleteDialogError(exactError);
      setError(`Failed to delete episode: ${exactError}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Legacy fallback if called directly
  const handleDelete = (id: string, epTitle?: string) => {
    const ep = episodes.find(e => (e.id || (e as any)._id) === id);
    promptDelete(ep || { id, title: epTitle });
  };

  // Duplicate Episode (Quick clone with next episode number)
  const handleDuplicate = async (ep: any) => {
    try {
      const highestNumInAnime = episodes
        .filter(e => (e.animeId || e.anime_id) === (ep.animeId || ep.anime_id))
        .reduce((max, e) => Math.max(max, Number(e.episodeNumber || e.episode_number) || 0), 0);

      const nextNum = highestNumInAnime + 1;

      const { server1, server2, server3 } = resolveEpisodeServers(ep);
      const duplicatedPayload = {
        animeId: ep.animeId || ep.anime_id,
        seasonId: ep.seasonId || ep.season_id || '',
        episodeNumber: nextNum,
        title: `${ep.title || 'Episode'} (Copy)`,
        description: ep.description || '',
        thumbnailUrl: ep.thumbnailUrl || ep.thumbnail_url || '',
        duration: ep.duration || '24m',
        releaseDate: ep.releaseDate || ep.release_date || '',
        server1Url: server1,
        server1_url: server1,
        abyssUrl: server1,
        abyss_url: server1,
        server2Url: server2,
        server2_url: server2,
        filemoonUrl: server2,
        filemoon_url: server2,
        server3Url: server3,
        server3_url: server3,
        vdohideUrl: server3,
        vdohide_url: server3,
        published: false, // Start duplicated as draft
      };

      await saveEpisodeBoth(duplicatedPayload);
      logAdminActivity('Duplicated Episode', 'episode', `Created Episode ${nextNum} from Episode ${ep.episodeNumber}`);
      setSuccessMsg(`Episode ${nextNum} duplicated successfully as draft!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      await fetchData();
    } catch {
      setError("Failed to duplicate episode.");
    }
  };

  // Reorder Episodes
  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= episodes.length) return;

    const updated = [...episodes];
    const currentItem = updated[index];
    const targetItem = updated[targetIndex];

    const currentNum = currentItem.episodeNumber || index + 1;
    const targetNum = targetItem.episodeNumber || targetIndex + 1;

    currentItem.episodeNumber = targetNum;
    targetItem.episodeNumber = currentNum;

    updated[index] = targetItem;
    updated[targetIndex] = currentItem;

    setEpisodes(updated);

    try {
      await Promise.all([
        saveEpisodeBoth({ ...currentItem, episodeNumber: targetNum }, currentItem.id),
        saveEpisodeBoth({ ...targetItem, episodeNumber: currentNum }, targetItem.id),
      ]);
      setSuccessMsg('Episode numbering reordered.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch {
      setError('Failed to persist reordering.');
    }
  };

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredEpisodes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEpisodes.map(e => e.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkPublish = async (newStatus: boolean) => {
    if (selectedIds.length === 0) return;
    setIsBulkOperating(true);
    try {
      const selectedEps = episodes.filter(e => selectedIds.includes(e.id));
      await Promise.all(
        selectedEps.map(e => saveEpisodeBoth({ ...e, published: newStatus }, e.id))
      );
      logAdminActivity('Bulk Status Update', 'episode', `Updated ${selectedIds.length} episodes to ${newStatus ? 'Published' : 'Draft'}`);
      setSuccessMsg(`${selectedIds.length} episodes set to ${newStatus ? 'Published' : 'Draft'}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setSelectedIds([]);
      await fetchData();
    } catch {
      setError("Failed to execute bulk publish update.");
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkOperating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await Promise.all(selectedIds.map(id => deleteEpisodeBoth(id)));
      logAdminActivity('Bulk Deleted Episodes', 'episode', `Deleted ${selectedIds.length} episodes`);
      setEpisodes(prev => prev.filter(e => !selectedIds.includes(e.id || (e as any)._id)));
      setSelectedIds([]);
      await fetchData();
      setBulkDeleteConfirmOpen(false);
      setSuccessMsg("Episode deleted successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error in bulk delete:", err);
      const exactError = err?.message || (typeof err === 'string' ? err : 'Bulk deletion failed');
      setError(`Failed to delete episode: ${exactError}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const openPreview = (ep: any) => {
    setPreviewEpisode(ep);
    setPreviewServer('server1');
    setPreviewModalOpen(true);
  };

  const openEdit = (ep: any) => {
    const { server1, server2, server3 } = resolveEpisodeServers(ep);
    setAnimeId(ep.animeId || ep.anime_id || '');
    setSeasonId(ep.seasonId || ep.season_id || '');
    setEpisodeNumber(ep.episodeNumber || ep.episode_number || 1);
    setTitle(ep.title || ep.episode_title || '');
    setDescription(ep.description || '');
    setThumbnailUrl(ep.thumbnailUrl || ep.thumbnail_url || '');
    setDuration(ep.duration || '24m');
    setReleaseDate(ep.releaseDate || ep.release_date || '');
    setServer1Url(server1);
    setServer2Url(server2);
    setServer3Url(server3);
    setPublished(ep.published !== false);
    setEditingId(ep.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setAnimeId('');
    setSeasonId('');
    setEpisodeNumber(1);
    setTitle('');
    setDescription('');
    setThumbnailUrl('');
    setDuration('24m');
    setReleaseDate('');
    setServer1Url('');
    setServer2Url('');
    setServer3Url('');
    setPublished(true);
    setEditingId(null);
  };

  const filteredSeasons = animeId 
    ? seasons.filter(s => (s.animeId || s.anime_id) === animeId)
    : [];

  const filteredEpisodes = episodes.filter(ep => {
    const anime = animeList.find(a => a.id === (ep.animeId || ep.anime_id));
    const titleMatch = (ep.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                       `episode ${ep.episodeNumber}`.includes(searchQuery.toLowerCase()) ||
                       (anime?.title || '').toLowerCase().includes(searchQuery.toLowerCase());

    const animeMatch = selectedAnimeFilter === 'All' || (ep.animeId || ep.anime_id) === selectedAnimeFilter;
    const statusMatch = selectedStatusFilter === 'All' || 
      (selectedStatusFilter === 'Published' ? ep.published !== false : ep.published === false);

    return titleMatch && animeMatch && statusMatch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="w-12 h-12 border-4 border-white/10 border-t-brand rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]"></div>
        <p className="text-sm font-bold">Synchronizing Live Episode Manifests...</p>
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
              <PlaySquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Episode Manager</h1>
              <p className="text-xs text-white/50">
                {episodes.length} episodes • Server 1 (Abyss), Server 2 (FileMoon), Server 3 (VDOHide)
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover shadow-[0_0_20px_rgba(0,229,255,0.35)] transition-all cursor-pointer"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
          {showForm ? 'Cancel' : 'Add Episode'}
        </button>
      </div>

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

      {/* Add / Edit Episode Drawer Form */}
      {showForm && (
        <div className="bg-[#0e121d]/90 border border-brand/40 rounded-3xl p-6 md:p-8 shadow-[0_0_40px_rgba(0,229,255,0.2)] backdrop-blur-2xl animate-fade-in">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Edit Episode Stream & Metadata' : 'Configure New Episode Stream'}
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
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-brand mb-1.5">
                  Select Anime *
                </label>
                <select 
                  required 
                  value={animeId} 
                  onChange={e => { setAnimeId(e.target.value); setSeasonId(''); }} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="">Select Anime Catalog...</option>
                  {animeList.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Season Arc (Optional)
                </label>
                <select 
                  value={seasonId} 
                  onChange={e => setSeasonId(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="">No Season (Standalone / Default)</option>
                  {filteredSeasons.map(s => (
                    <option key={s.id} value={s.id}>
                      Season {s.seasonNumber} {s.title ? `- ${s.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-brand mb-1.5">
                  Episode Number *
                </label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={episodeNumber} 
                  onChange={e => setEpisodeNumber(Number(e.target.value))} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Episode Title
                </label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g. I'm Used to It, The Awakening, Blood Battle" 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Duration
                </label>
                <input 
                  type="text" 
                  value={duration} 
                  onChange={e => setDuration(e.target.value)} 
                  placeholder="24m" 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Release Date
                </label>
                <input 
                  type="date" 
                  value={releaseDate} 
                  onChange={e => setReleaseDate(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                />
              </div>

              <div className="md:col-span-2">
                <ImageUpload label="Episode Thumbnail" value={thumbnailUrl} onChange={setThumbnailUrl} folder="episodes" />
              </div>
            </div>

            {/* Streaming Server Endpoints: Server 1 (Abyss), Server 2 (FileMoon), Server 3 (VDOHide) */}
            <div className="p-5 rounded-2xl bg-black/50 border border-brand/30 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-brand">
                <Server className="w-4 h-4" />
                <span>Streaming Server Endpoints</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Server 1 (Abyss) */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-cyan-300">Server 1 (Abyss)</span>
                    <span className="text-[10px] uppercase font-bold text-white/40">Primary Stream</span>
                  </div>
                  <input
                    type="text"
                    value={server1Url}
                    onChange={e => setServer1Url(e.target.value)}
                    placeholder="https://short.ink/... OR Abyss embed URL"
                    className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-white/40">Paste embed iframe code or direct Abyss URL.</p>
                </div>

                {/* Server 2 (FileMoon) */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-400">Server 2 (FileMoon)</span>
                    <span className="text-[10px] uppercase font-bold text-white/40">Secondary Stream</span>
                  </div>
                  <input
                    type="text"
                    value={server2Url}
                    onChange={e => setServer2Url(e.target.value)}
                    placeholder="https://filemoon.sx/e/xyz OR <iframe> embed code"
                    className="w-full bg-black/60 border border-white/15 focus:border-blue-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-white/40">Paste embed iframe code or direct FileMoon URL.</p>
                </div>

                {/* Server 3 (VDOHide) */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-400">Server 3 (VDOHide)</span>
                    <span className="text-[10px] uppercase font-bold text-white/40">Backup Stream</span>
                  </div>
                  <input
                    type="text"
                    value={server3Url}
                    onChange={e => setServer3Url(e.target.value)}
                    placeholder="https://vdohide.com/e/abc OR <iframe> embed code"
                    className="w-full bg-black/60 border border-white/15 focus:border-emerald-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-white/40">Paste embed iframe code or direct VDOHide URL.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                Episode Description
              </label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={3} 
                className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none resize-none" 
                placeholder="Episode plot details..."
              />
            </div>

            {/* Published Switch */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Publish Status</p>
                <p className="text-[10px] text-white/50">Draft episodes are hidden from normal public viewers.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={published} 
                  onChange={e => setPublished(e.target.checked)} 
                  className="w-4 h-4 rounded border-white/20 bg-black/50 text-brand focus:ring-brand" 
                />
                <span className={`text-xs font-bold ${published ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {published ? 'Published (Live)' : 'Draft (Hidden)'}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    const ep = episodes.find(e => (e.id || (e as any)._id) === editingId);
                    promptDelete(ep || { id: editingId, title, episodeNumber });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Episode</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-2.5 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Synchronizing Databases...' : (editingId ? 'Save Changes' : 'Publish Episode')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Bulk Actions Bar */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search episode title or anime..."
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedAnimeFilter}
              onChange={e => setSelectedAnimeFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="All">All Anime Catalog</option>
              {animeList.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="All">All Status (Published &amp; Draft)</option>
              <option value="Published">Published Only</option>
              <option value="Draft">Drafts Only</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold"
            >
              {selectedIds.length === filteredEpisodes.length && filteredEpisodes.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-brand" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>Select All ({selectedIds.length})</span>
            </button>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkPublish(true)}
                  disabled={isBulkOperating}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Bulk Publish
                </button>
                <button
                  onClick={() => handleBulkPublish(false)}
                  disabled={isBulkOperating}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold"
                >
                  Bulk Draft
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkOperating}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Bulk Delete
                </button>
              </div>
            )}
          </div>

          <span className="text-xs text-white/50">
            Showing {filteredEpisodes.length} of {episodes.length} episodes
          </span>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-black/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                <th className="p-4 w-10">Select</th>
                <th className="p-4">Episode</th>
                <th className="p-4">Anime Series</th>
                <th className="p-4">Streaming Servers</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Order</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEpisodes.map((ep, index) => {
                const anime = animeList.find(a => a.id === (ep.animeId || ep.anime_id));
                const { server1: s1, server2: s2, server3: s3 } = resolveEpisodeServers(ep);
                const isSelected = selectedIds.includes(ep.id);

                return (
                  <tr key={ep.id} className={`hover:bg-white/5 transition-colors ${isSelected ? 'bg-brand/5' : ''}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(ep.id)}
                        className="w-4 h-4 rounded border-white/20 bg-black/60 text-brand focus:ring-brand cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-10 rounded-xl bg-black/60 overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center relative group">
                          {ep.thumbnailUrl || ep.thumbnail_url ? (
                            <img src={ep.thumbnailUrl || ep.thumbnail_url} alt={ep.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-white/40">Ep {ep.episodeNumber}</span>
                          )}
                          <button
                            onClick={() => openPreview(ep)}
                            className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-brand"
                            title="Quick Preview Player"
                          >
                            <Play className="w-4 h-4 fill-brand" />
                          </button>
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">
                            Episode {ep.episodeNumber}: {ep.title || 'Untitled'}
                          </p>
                          <p className="text-[11px] text-white/40">{ep.duration || '24m'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-white/70 font-semibold">
                      {anime?.title || 'Unknown Anime'}
                    </td>
                    <td className="p-4 space-x-1.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-white/30'
                      }`} title={s1 ? `Server 1 (Abyss): ${s1}` : 'Server 1: Not set'}>
                        Server 1 {s1 ? '✓' : '✗'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s2 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-white/5 text-white/30'
                      }`} title={s2 ? `Server 2 (FileMoon): ${s2}` : 'Server 2: Not set'}>
                        Server 2 {s2 ? '✓' : '✗'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s3 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/30'
                      }`} title={s3 ? `Server 3 (VDOHide): ${s3}` : 'Server 3: Not set'}>
                        Server 3 {s3 ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ep.published !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {ep.published !== false ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleReorder(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReorder(index, 'down')}
                          disabled={index === filteredEpisodes.length - 1}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-1.5">
                      {/* Preview Player Button */}
                      <button
                        onClick={() => openPreview(ep)}
                        className="p-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-xl transition-colors"
                        title="Preview Stream Player"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {/* Duplicate Button */}
                      <button
                        onClick={() => handleDuplicate(ep)}
                        className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-xl transition-colors"
                        title="Duplicate Episode"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {/* Edit Button */}
                      <button 
                        onClick={() => openEdit(ep)} 
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors" 
                        title="Edit Episode"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete Button */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          promptDelete(ep);
                        }} 
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition-colors cursor-pointer" 
                        title="Delete Episode"
                        aria-label={`Delete ${ep.title || 'Episode'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredEpisodes.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-white/40">
                    <PlaySquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-brand" />
                    <p className="text-sm font-bold">No episodes found matching filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Preview Player Modal */}
      {previewModalOpen && previewEpisode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0b0e17] border border-brand/40 rounded-3xl max-w-3xl w-full p-6 shadow-[0_0_50px_rgba(0,229,255,0.3)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-brand fill-brand" />
                <h3 className="text-sm font-bold text-white">
                  Preview Player: Episode {previewEpisode.episodeNumber} - {previewEpisode.title || 'Untitled'}
                </h3>
              </div>
              <button
                onClick={() => { setPreviewModalOpen(false); setPreviewEpisode(null); }}
                className="p-1 rounded-full bg-white/5 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Server Selector inside modal */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewServer('server1')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  previewServer === 'server1'
                    ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                    : 'bg-white/5 text-white/70 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" /> Server 1 (Abyss)
              </button>
              <button
                onClick={() => setPreviewServer('server2')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  previewServer === 'server2'
                    ? 'bg-blue-400 text-black shadow-[0_0_15px_rgba(96,165,250,0.4)]'
                    : 'bg-white/5 text-white/70 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" /> Server 2 (FileMoon)
              </button>
              <button
                onClick={() => setPreviewServer('server3')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  previewServer === 'server3'
                    ? 'bg-emerald-400 text-black shadow-[0_0_15px_rgba(52,211,153,0.4)]'
                    : 'bg-white/5 text-white/70 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" /> Server 3 (VDOHide)
              </button>
            </div>

            {/* Embed Player */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
              {(() => {
                const { server1: s1, server2: s2, server3: s3 } = resolveEpisodeServers(previewEpisode);
                const targetUrl = previewServer === 'server1' ? s1 : previewServer === 'server2' ? s2 : s3;
                const serverName = previewServer === 'server1' ? 'Server 1 (Abyss)' : previewServer === 'server2' ? 'Server 2 (FileMoon)' : 'Server 3 (VDOHide)';

                if (!targetUrl) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/40 p-6 text-center">
                      <Server className="w-8 h-8 mb-2 opacity-50 text-brand" />
                      <p className="text-sm font-bold text-white">No URL configured for {serverName}</p>
                      <p className="text-xs text-white/40 mt-1">Please edit the episode and supply an embed URL for this server.</p>
                    </div>
                  );
                }

                return (
                  <iframe
                    src={targetUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={`Preview Player ${previewServer}`}
                  />
                );
              })()}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-white/40">
              <span>Previewing live player stream iframe</span>
              <button
                onClick={() => { setPreviewModalOpen(false); setPreviewEpisode(null); }}
                className="text-white hover:text-brand font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Episode Delete Confirmation Dialog */}
      {deleteModalOpen && episodeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0e121d] border border-red-500/40 rounded-3xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Are you sure you want to delete this episode?
                </h3>
                <p className="text-xs text-white/60">
                  This action is permanent. The episode will be deleted from both Firestore and Supabase, and its streaming server URLs will be removed.
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/90">
                  {episodeToDelete.title}
                </div>
              </div>
            </div>

            {deleteDialogError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="break-all">{deleteDialogError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteModalOpen(false);
                    setEpisodeToDelete(null);
                    setDeleteDialogError(null);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Episode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0e121d] border border-red-500/40 rounded-3xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Are you sure you want to delete this episode?
                </h3>
                <p className="text-xs text-white/60">
                  You are about to delete <span className="text-white font-bold">{selectedIds.length}</span> selected episodes from both Firestore and Supabase, and remove all related streaming server URLs.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isBulkOperating}
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkOperating}
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBulkOperating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete All Selected</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
