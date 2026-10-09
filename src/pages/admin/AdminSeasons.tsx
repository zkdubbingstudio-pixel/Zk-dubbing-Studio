import React, { useState, useEffect } from "react";
import { 
  Layers, Plus, Trash2, Edit2, X, Image as ImageIcon, 
  CheckCircle2, AlertCircle, Sparkles, ArrowUp, ArrowDown, 
  Search, Film, Activity, ChevronRight 
} from 'lucide-react';
import { getAllAnime, getAllSeasons, saveSeasonBoth, deleteSeasonBoth } from '../../lib/dataService';
import ImageUpload from '../../components/admin/ImageUpload';
import { logAdminActivity } from '../../lib/activityLogger';

const SEASON_STATUSES = ['Active', 'Ongoing', 'Completed', 'Archived'];

export default function AdminSeasons() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeFilter, setSelectedAnimeFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Form state
  const [animeId, setAnimeId] = useState('');
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [order, setOrder] = useState(0);
  const [status, setStatus] = useState('Active');

  const fetchData = async () => {
    try {
      setError(null);
      const [animes, list] = await Promise.all([
        getAllAnime().catch(() => []),
        getAllSeasons().catch(() => [])
      ]);
      setAnimeList(animes || []);
      setSeasons(list || []);
    } catch {
      setError("Failed to load seasons data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animeId) {
      alert('Please select an anime');
      return;
    }

    setSaving(true);
    setError(null);

    const seasonPayload = {
      animeId,
      seasonNumber: Number(seasonNumber) || 1,
      title: title.trim() || `Season ${seasonNumber}`,
      description: description.trim(),
      posterUrl: posterUrl.trim(),
      bannerUrl: bannerUrl.trim() || posterUrl.trim(),
      order: Number(order) || Number(seasonNumber) || 0,
      status: status || 'Active',
    };

    try {
      await saveSeasonBoth(seasonPayload, editingId || undefined);
      logAdminActivity(editingId ? 'Updated Season' : 'Created Season', 'season', `Arc: ${title || `Season ${seasonNumber}`}`);

      setSuccessMsg(editingId ? 'Season updated in Firestore & Supabase!' : 'Season registered in Firestore & Supabase!');
      setTimeout(() => setSuccessMsg(null), 3500);

      setShowForm(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      console.error("Error saving season:", err);
      // Requirement 8: Show exact database error if saving fails
      setError(`Database Error: ${err?.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, seasonName: string) => {
    if (window.confirm(`Are you sure you want to delete ${seasonName} from Firestore and Supabase?`)) {
      try {
        await deleteSeasonBoth(id);
        setSeasons(prev => prev.filter(s => s.id !== id));
        logAdminActivity('Deleted Season', 'season', `Deleted: ${seasonName}`);
        setSuccessMsg('Season deleted successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        console.error("Error deleting season:", err);
        setError(`Database Error: ${err?.message || String(err)}`);
      }
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= seasons.length) return;

    const updated = [...seasons];
    const currentItem = updated[index];
    const targetItem = updated[targetIndex];

    const currentOrder = currentItem.order ?? index;
    const targetOrder = targetItem.order ?? targetIndex;

    currentItem.order = targetOrder;
    targetItem.order = currentOrder;

    updated[index] = targetItem;
    updated[targetIndex] = currentItem;

    setSeasons(updated);

    try {
      await Promise.all([
        saveSeasonBoth({ ...currentItem, order: targetOrder }, currentItem.id),
        saveSeasonBoth({ ...targetItem, order: currentOrder }, targetItem.id),
      ]);
      setSuccessMsg('Season order updated in both databases.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch {
      setError('Failed to persist new season order.');
    }
  };

  const handleQuickStatusChange = async (s: any, newStatus: string) => {
    try {
      const updated = { ...s, status: newStatus };
      setSeasons(prev => prev.map(item => item.id === s.id ? updated : item));
      await saveSeasonBoth({ ...s, status: newStatus }, s.id);
      logAdminActivity('Season Status Changed', 'season', `${s.title || `Season ${s.seasonNumber}`} -> ${newStatus}`);
    } catch {
      setError('Failed to update season status.');
    }
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setAnimeId(s.animeId || s.anime_id || '');
    setSeasonNumber(s.seasonNumber || s.season_number || 1);
    setTitle(s.title || '');
    setDescription(s.description || '');
    setPosterUrl(s.posterUrl || s.poster_url || '');
    setBannerUrl(s.bannerUrl || s.banner_url || '');
    setOrder(s.order || 0);
    setStatus(s.status || 'Active');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setAnimeId('');
    setSeasonNumber(1);
    setTitle('');
    setDescription('');
    setPosterUrl('');
    setBannerUrl('');
    setOrder(0);
    setStatus('Active');
    setEditingId(null);
  };

  const filteredSeasons = seasons.filter(s => {
    const anime = animeList.find(a => a.id === (s.animeId || s.anime_id));
    const titleMatch = (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                       (anime?.title || '').toLowerCase().includes(searchQuery.toLowerCase());

    const animeMatch = selectedAnimeFilter === 'All' || (s.animeId || s.anime_id) === selectedAnimeFilter;
    const statusMatch = selectedStatusFilter === 'All' || (s.status || 'Active') === selectedStatusFilter;

    return titleMatch && animeMatch && statusMatch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="w-12 h-12 border-4 border-white/10 border-t-brand rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]"></div>
        <p className="text-sm font-bold">Synchronizing Seasons Data...</p>
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
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Seasons Manager</h1>
              <p className="text-xs text-white/50">
                {seasons.length} total seasons • Arc organization with instant reordering
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-black font-extrabold text-xs rounded-xl hover:bg-brand-hover shadow-[0_0_20px_rgba(0,229,255,0.35)] transition-all cursor-pointer"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
          {showForm ? 'Cancel' : 'Add Season'}
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

      {/* Season Add / Edit Drawer */}
      {showForm && (
        <div className="bg-[#0e121d]/90 border border-brand/40 rounded-3xl p-6 md:p-8 shadow-[0_0_40px_rgba(0,229,255,0.2)] backdrop-blur-2xl animate-fade-in">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Edit Season Arc' : 'Register New Season Arc'}
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
                  Parent Anime *
                </label>
                <select 
                  required 
                  value={animeId} 
                  onChange={e => setAnimeId(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="">Select Anime Catalog...</option>
                  {animeList.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-brand mb-1.5">
                  Season Number *
                </label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={seasonNumber} 
                  onChange={e => setSeasonNumber(Number(e.target.value))} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-brand mb-1.5">
                  Season Status
                </label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                >
                  {SEASON_STATUSES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Arc Title / Subtitle
                </label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g. Mugen Train Arc, Shibuya Incident, Season 1" 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                  Sort Order
                </label>
                <input 
                  type="number" 
                  value={order} 
                  onChange={e => setOrder(Number(e.target.value))} 
                  className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" 
                />
              </div>

              <div>
                <ImageUpload label="Season Poster" value={posterUrl} onChange={setPosterUrl} folder="seasons" />
              </div>

              <div className="md:col-span-2">
                <ImageUpload label="Season Banner" value={bannerUrl} onChange={setBannerUrl} folder="seasons" />
              </div>
            </div>
            
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">
                Season Arc Description
              </label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={3} 
                className="w-full bg-black/60 border border-white/15 focus:border-brand rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none resize-none" 
                placeholder="Overview of this specific season arc..."
              />
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
                {saving ? 'Synchronizing...' : (editingId ? 'Save Changes' : 'Publish Season')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search season title or anime..."
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedAnimeFilter}
              onChange={e => setSelectedAnimeFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="All">All Anime Series</option>
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
              <option value="All">All Statuses</option>
              {SEASON_STATUSES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Seasons Table with Reorder Controls */}
      <div className="bg-black/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                <th className="p-4 w-12 text-center">Order</th>
                <th className="p-4">Season Arc</th>
                <th className="p-4">Anime Series</th>
                <th className="p-4">Season Status</th>
                <th className="p-4 text-center">Reorder</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSeasons.map((s, index) => {
                const anime = animeList.find(a => a.id === (s.animeId || s.anime_id));
                const currentStatus = s.status || 'Active';
                return (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-center font-mono text-white/50">
                      {s.order ?? index + 1}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 bg-black/60 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center">
                          {s.posterUrl || s.poster_url ? (
                            <img src={s.posterUrl || s.poster_url} alt={s.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-brand">S{s.seasonNumber}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">Season {s.seasonNumber}</p>
                          <p className="text-[11px] text-brand">
                            {s.title || anime?.title || 'Main Arc'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-white/70 font-semibold">
                      {anime?.title || 'Unknown Anime'}
                    </td>
                    <td className="p-4">
                      <select
                        value={currentStatus}
                        onChange={(e) => handleQuickStatusChange(s, e.target.value)}
                        className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg border bg-black/60 cursor-pointer ${
                          currentStatus === 'Active' ? 'text-emerald-400 border-emerald-500/40' :
                          currentStatus === 'Ongoing' ? 'text-cyan-400 border-cyan-500/40' :
                          currentStatus === 'Completed' ? 'text-purple-400 border-purple-500/40' :
                          'text-white/40 border-white/20'
                        }`}
                      >
                        {SEASON_STATUSES.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
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
                          disabled={index === filteredSeasons.length - 1}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button 
                        onClick={() => openEdit(s)} 
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors" 
                        title="Edit Season"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id, `Season ${s.seasonNumber} (${s.title || anime?.title})`)} 
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-colors" 
                        title="Delete Season"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredSeasons.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-white/40">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-40 text-brand" />
                    <p className="text-sm font-bold">No seasons found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
