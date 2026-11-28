import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { getUserProgress, formatDbError } from '../../lib/dataService';
import { 
  Users, Search as SearchIcon, Trash2, Ban, CheckCircle, 
  Edit2, X, Save, History, Clock, Film, Play, UserCheck, 
  Calendar, ShieldAlert, Sparkles 
} from 'lucide-react';
import { User } from '../../types';
import ImageUpload from '../../components/admin/ImageUpload';
import { logAdminActivity } from '../../lib/activityLogger';

interface WatchHistoryItem {
  id: string;
  animeTitle: string;
  episodeNumber: number;
  watchedAt: string;
  progressPercentage: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');

  const [editingUser, setEditingUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Watch History Drawer Modal
  const [viewingHistoryUser, setViewingHistoryUser] = useState<any | null>(null);
  const [userWatchHistory, setUserWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchUsers = async () => {
    try {
      setError(null);
      const userList: User[] = [];

      // Fetch from Cloud Firestore users collection
      if (db) {
        const snapshot = await getDocs(collection(db, 'users'));
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const email = (data.email || '').toLowerCase();
          const isOwner = email === 'zkdubbingstudio@gmail.com' || data.role === 'owner';
          const rawCreated = data.createdAt || data.created_at;
          const createdTs = rawCreated?.toMillis
            ? rawCreated.toMillis()
            : typeof rawCreated === 'number'
            ? rawCreated
            : rawCreated
            ? new Date(rawCreated).getTime()
            : Date.now();
          userList.push({
            uid: docSnap.id,
            id: docSnap.id,
            email: data.email || '',
            displayName: data.full_name || data.displayName || data.name || data.username || 'Anime Fan',
            photoURL: data.photoURL || data.profilePhoto || data.photo_url || data.avatarUrl || '',
            role: isOwner ? 'owner' : 'user',
            isBanned: Boolean(data.isBanned ?? data.is_banned),
            createdAt: isNaN(createdTs) ? Date.now() : createdTs,
            settings: data.settings,
          });
        });
      }

      setUsers(userList);
    } catch (err: any) {
      const formatted = formatDbError(err);
      console.warn('[Firestore Error - AdminUsers]:', formatted);
      setError(formatted);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleBan = async (user: any) => {
    if (user.role === 'owner' || user.role === 'admin' || user.email?.toLowerCase() === 'zkdubbingstudio@gmail.com') {
      alert('Cannot modify studio owner account.');
      return;
    }
    const userId = user.uid || user.id;
    if (!db || !userId) return;
    try {
      const nextBanned = !user.isBanned;
      await updateDoc(doc(db, 'users', userId), {
        isBanned: nextBanned,
        is_banned: nextBanned,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      setUsers(prev => prev.map(u => (u.id === userId || u.uid === userId) ? { ...u, isBanned: nextBanned } : u));
      logAdminActivity('Toggled User Ban', 'user', `${user.email} -> ${nextBanned ? 'Banned' : 'Active'}`);
      setSuccessMsg(`User status updated to ${nextBanned ? 'Banned' : 'Active'}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error updating user ban status in Cloud Firestore.');
    }
  };

  const handleDelete = async (user: any) => {
    if (user.role === 'owner' || user.role === 'admin' || user.email?.toLowerCase() === 'zkdubbingstudio@gmail.com') {
      alert('Cannot delete studio owner account.');
      return;
    }
    if (!window.confirm(`Permanently remove user account ${user.email}?`)) return;
    const userId = user.uid || user.id;
    if (!db || !userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId));

      setUsers(prev => prev.filter(u => (u.id || u.uid) !== userId));
      logAdminActivity('Deleted User Account', 'user', `Deleted: ${user.email}`);
      setSuccessMsg('User successfully deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete user.');
    }
  };

  const openWatchHistory = async (user: any) => {
    setViewingHistoryUser(user);
    setLoadingHistory(true);
    const userId = user?.uid || user?.id;

    try {
      const data = userId ? await getUserProgress(userId) : [];

      if (data.length > 0) {
        setUserWatchHistory(
          data.map((item: any) => {
            const watchedSec = Number(item.currentTime ?? item.current_time ?? item.progress_seconds ?? 0);
            const totalSec = Number(item.duration ?? item.duration_seconds ?? 0);
            const pct = Number(item.percentage) || (totalSec > 0 ? Math.min(100, Math.round((watchedSec / totalSec) * 100)) : 0);
            const updatedVal = item.updatedAt || item.updated_at;
            return {
              id: item.id || item.episodeId || item.episode_id,
              animeTitle: item.animeTitle || item.anime_title || 'Anime Series',
              episodeNumber: item.episodeNumber || item.episode_number || 1,
              watchedAt: updatedVal ? new Date(updatedVal).toLocaleDateString() : 'Recently',
              progressPercentage: pct,
            };
          })
        );
      } else {
        setUserWatchHistory([]);
      }
    } catch {
      setUserWatchHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setAvatarUrl(user.photoURL || user.avatar_url || '');
  };

  const handleSaveUser = async () => {
    if (!editingUser || !db) return;
    setSaving(true);
    const userId = editingUser.id || editingUser.uid;
    try {
      await updateDoc(doc(db, 'users', userId), {
        photoURL: avatarUrl,
        profilePhoto: avatarUrl,
        photo_url: avatarUrl,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      setUsers(prev => prev.map(u => (u.id === userId || u.uid === userId) ? { ...u, photoURL: avatarUrl } : u));
      setEditingUser(null);
      setSuccessMsg('User profile updated.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error saving avatar.');
    } finally {
      setSaving(false);
    }
  };

  // Recently joined calculation
  const totalRegistered = users.length;
  const recentlyJoined = users.filter(u => {
    const time = typeof u.createdAt === 'number' ? u.createdAt : new Date(u.createdAt || 0).getTime();
    return Date.now() - time < 1000 * 60 * 60 * 24 * 7; // joined within 7 days
  }).length;

  const sortedUsers = [...users].sort((a, b) => {
    if (sortBy === 'recent') {
      const timeA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt || 0).getTime();
      const timeB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    }
    return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
  });

  const filteredUsers = sortedUsers.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="w-12 h-12 border-4 border-white/10 border-t-brand rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]"></div>
        <p className="text-sm font-bold">Synchronizing User Accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-[0_0_15px_rgba(0,229,255,0.25)]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">User Administration</h1>
            <p className="text-xs text-white/50">
              Manage registered accounts, inspect watch history, and monitor audience growth
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>{totalRegistered} Registered</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-brand/10 border border-brand/30 text-xs font-bold text-brand flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>{recentlyJoined} Joined This Week</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Sort Controls */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-md">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="w-4 h-4 absolute left-3 top-3 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search users by username or email..."
            className="w-full bg-white/5 border border-white/10 focus:border-brand rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setSortBy('recent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sortBy === 'recent' 
                ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]' 
                : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            Recently Joined
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sortBy === 'name' 
                ? 'bg-brand text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]' 
                : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            Alphabetical
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-black/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Watch History</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map(user => {
                const isOwner = user.role === 'owner' || user.email === 'zkdubbingstudio@gmail.com';
                const joinDate = user.createdAt 
                  ? new Date(typeof user.createdAt === 'number' ? user.createdAt : user.createdAt).toLocaleDateString()
                  : 'Recent';

                return (
                  <tr key={user.id || user.uid} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-purple-500 p-0.5 flex-shrink-0">
                          <div className="w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center text-xs font-bold text-white">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                            ) : (
                              (user.displayName || user.email || 'U').slice(0, 2).toUpperCase()
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{user.displayName || 'Anime Fan'}</p>
                          <p className="text-[11px] text-white/40 font-mono">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isOwner ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_8px_rgba(0,229,255,0.3)]' : 'bg-white/10 text-white/70'
                      }`}>
                        {isOwner ? 'Owner' : 'User'}
                      </span>
                    </td>
                    <td className="p-4 text-white/50">
                      {joinDate}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (user as any).isBanned 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {(user as any).isBanned ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => openWatchHistory(user)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand/10 text-white hover:text-brand border border-white/10 hover:border-brand/30 transition-all font-bold text-xs inline-flex items-center gap-1.5"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Inspect History</span>
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-1.5">
                      {!isOwner && (
                        <>
                          <button
                            onClick={() => handleToggleBan(user)}
                            className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-colors"
                            title={(user as any).isBanned ? 'Unban User' : 'Suspend User'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-white/40">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-brand" />
                    <p className="text-sm font-bold">No user accounts found matching query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Watch History Drawer / Modal */}
      {viewingHistoryUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0e121d] border border-brand/40 rounded-3xl max-w-xl w-full p-6 shadow-[0_0_50px_rgba(0,229,255,0.3)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-white">
                  Watch History: {viewingHistoryUser.displayName || viewingHistoryUser.email}
                </h3>
              </div>
              <button
                onClick={() => setViewingHistoryUser(null)}
                className="p-1 rounded-full bg-white/5 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/50">
              Logged watch sessions, episode completion percentage, and timeline
            </p>

            {loadingHistory ? (
              <div className="py-12 text-center text-white/40">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs font-bold">Loading player telemetry...</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {userWatchHistory.map(item => (
                  <div 
                    key={item.id}
                    className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                        <Play className="w-4 h-4 fill-brand" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item.animeTitle}</p>
                        <p className="text-[10px] text-white/40">Episode {item.episodeNumber} • {item.watchedAt}</p>
                        <div className="w-28 bg-white/10 rounded-full h-1 mt-1.5 overflow-hidden">
                          <div 
                            className="bg-brand h-full rounded-full" 
                            style={{ width: `${item.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-brand flex-shrink-0">
                      {item.progressPercentage}% completed
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewingHistoryUser(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
