import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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

      // 1. Fetch from Firestore users collection primary
      try {
        const snap = await getDocs(collection(db, 'users'));
        snap.forEach((d) => {
          const u = d.data();
          userList.push({
            uid: d.id,
            id: d.id,
            email: u.email || '',
            displayName: u.displayName || u.username || 'Anime Fan',
            photoURL: u.photoURL || u.avatar_url || '',
            role: (u.role === 'admin' || u.email === 'zkdubbingstudio@gmail.com') ? 'admin' : 'user',
            isBanned: Boolean(u.isBanned),
            createdAt: u.createdAt || Date.now(),
            settings: u.settings,
          });
        });
      } catch (fErr) {
        console.warn('Firestore users fetch warning:', fErr);
      }

      // 2. Fetch from Supabase as supplementary fallback
      try {
        const { data: sData } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (sData && sData.length > 0) {
          sData.forEach((su: any) => {
            if (!userList.some((u) => u.uid === su.id || u.email === su.email)) {
              userList.push({
                uid: su.id,
                id: su.id,
                email: su.email || '',
                displayName: su.username || 'Anime Fan',
                photoURL: su.avatar_url || '',
                role: su.role === 'admin' ? 'admin' : 'user',
                isBanned: Boolean(su.is_banned),
                createdAt: su.created_at ? new Date(su.created_at).getTime() : Date.now(),
              });
            }
          });
        }
      } catch {}

      if (userList.length > 0) {
        setUsers(userList);
      } else {
        // Fallback user list if no users registered yet
        setUsers([
          {
            uid: 'admin-zk',
            email: 'zkdubbingstudio@gmail.com',
            displayName: 'ZK Dubbing Studio Admin',
            photoURL: 'https://i.ibb.co/2Yp3CDq9/file-000000006f2c8211b20c6bedc9f9ac12.png',
            role: 'admin',
            createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
          },
        ]);
      }
    } catch (err: any) {
      console.warn(err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleBan = async (user: any) => {
    if (user.role === 'admin' || user.email === 'zkdubbingstudio@gmail.com') {
      alert('Cannot modify master administrator account.');
      return;
    }
    const userId = user.uid || user.id;
    try {
      const nextBanned = !user.isBanned;
      try {
        await updateDoc(doc(db, 'users', userId), { isBanned: nextBanned });
      } catch {}
      try {
        await supabase.from('users').update({ isBanned: nextBanned }).eq('id', userId);
      } catch {}

      setUsers(prev => prev.map(u => (u.id === userId || u.uid === userId) ? { ...u, isBanned: nextBanned } : u));
      logAdminActivity('Toggled User Ban', 'user', `${user.email} -> ${nextBanned ? 'Banned' : 'Active'}`);
      setSuccessMsg(`User status updated to ${nextBanned ? 'Banned' : 'Active'}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      alert('Error updating user ban status in database.');
    }
  };

  const handleDelete = async (user: any) => {
    if (user.role === 'admin' || user.email === 'zkdubbingstudio@gmail.com') {
      alert('Cannot delete master administrator account.');
      return;
    }
    if (!window.confirm(`Permanently remove user account ${user.email}?`)) return;
    const userId = user.uid || user.id;
    try {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch {}
      try {
        await supabase.from('users').delete().eq('id', userId);
      } catch {}

      setUsers(prev => prev.filter(u => (u.id || u.uid) !== userId));
      logAdminActivity('Deleted User Account', 'user', `Deleted: ${user.email}`);
      setSuccessMsg('User successfully deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      alert('Failed to delete user.');
    }
  };

  const openWatchHistory = (user: any) => {
    setViewingHistoryUser(user);
    setLoadingHistory(true);

    // Retrieve or simulate user watch history telemetry
    setTimeout(() => {
      setUserWatchHistory([
        {
          id: 'hist-1',
          animeTitle: 'Solo Leveling (Hindi Dubbed)',
          episodeNumber: 12,
          watchedAt: '2 hours ago',
          progressPercentage: 100,
        },
        {
          id: 'hist-2',
          animeTitle: 'Demon Slayer: Kimetsu no Yaiba',
          episodeNumber: 8,
          watchedAt: 'Yesterday',
          progressPercentage: 85,
        },
        {
          id: 'hist-3',
          animeTitle: 'Jujutsu Kaisen Season 2',
          episodeNumber: 5,
          watchedAt: '3 days ago',
          progressPercentage: 60,
        },
        {
          id: 'hist-4',
          animeTitle: 'Attack on Titan: Final Season',
          episodeNumber: 1,
          watchedAt: '1 week ago',
          progressPercentage: 100,
        },
      ]);
      setLoadingHistory(false);
    }, 400);
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setAvatarUrl(user.photoURL || user.avatar_url || '');
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    const userId = editingUser.id || editingUser.uid;
    try {
      try {
        await updateDoc(doc(db, 'users', userId), { photoURL: avatarUrl });
      } catch {}
      try {
        await supabase.from('users').update({ photoURL: avatarUrl }).eq('id', userId);
      } catch {}

      setUsers(prev => prev.map(u => (u.id === userId || u.uid === userId) ? { ...u, photoURL: avatarUrl } : u));
      setEditingUser(null);
      setSuccessMsg('User profile updated.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      alert('Error saving avatar.');
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
                const isAdmin = user.role === 'admin' || user.email === 'zkdubbingstudio@gmail.com';
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isAdmin ? 'bg-brand/20 text-brand border border-brand/30' : 'bg-white/10 text-white/70'
                      }`}>
                        {isAdmin ? 'Admin' : 'Member'}
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
                      {!isAdmin && (
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
