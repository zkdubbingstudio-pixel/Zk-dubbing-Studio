/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useAuthStore } from './store/authStore';

import RootLayout from './layouts/RootLayout';
import AdminLayout from './layouts/AdminLayout';

// Eager load Home for instant First Contentful Paint
import Home from './pages/Home';

// Lazy loaded client pages for optimal performance & code splitting
const AnimeDetails = lazy(() => import('./pages/AnimeDetails'));
const SeasonDetails = lazy(() => import('./pages/SeasonDetails'));
const WatchPage = lazy(() => import('./pages/WatchPage'));
const Search = lazy(() => import('./pages/Search'));
const Profile = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// Lazy loaded admin pages (Recharts, S3/AWS SDK, Image compression)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminAnime = lazy(() => import('./pages/admin/AdminAnime'));
const AdminSeasons = lazy(() => import('./pages/admin/AdminSeasons'));
const AdminEpisodes = lazy(() => import('./pages/admin/AdminEpisodes'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminMedia = lazy(() => import('./pages/admin/AdminMedia'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminSecurity = lazy(() => import('./pages/admin/AdminSecurity'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-9 h-9 border-3 border-white/10 border-t-brand rounded-full animate-spin"></div>
    </div>
  );
}

export default function App() {
  const { setFirebaseUser, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        setFirebaseUser(firebaseUser);
        
        try {
          const { data: userSnap } = await supabase
            .from('users')
            .select('*')
            .eq('id', firebaseUser.uid)
            .single();
            
          if (userSnap) {
            setUser({
              uid: userSnap.id,
              email: userSnap.email,
              displayName: userSnap.username,
              photoURL: firebaseUser.photoURL || '',
              role: userSnap.role,
              createdAt: userSnap.created_at ? new Date(userSnap.created_at).getTime() : Date.now(),
              settings: userSnap.settings
            });
          } else {
            const newUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || 'Anime Fan',
              role: firebaseUser.email === 'zkdubbingstudio@gmail.com' ? 'admin' : 'user',
              created_at: new Date().toISOString()
            };
            
            await supabase.from('users').insert([newUser]);
            setUser({ 
              uid: newUser.id, 
              email: newUser.email, 
              displayName: newUser.username, 
              photoURL: firebaseUser.photoURL || '', 
              role: newUser.role as 'user' | 'admin',
              createdAt: Date.now() 
            });
          }
        } catch {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Anime Fan',
            photoURL: firebaseUser.photoURL || '',
            role: firebaseUser.email === 'zkdubbingstudio@gmail.com' ? 'admin' : 'user',
            createdAt: Date.now(),
          });
        }
        setLoading(false);
      } else {
        setFirebaseUser(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setFirebaseUser, setUser, setLoading]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Main User Routes (Consolidated into single RootLayout) */}
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Home />} />
            <Route path="search" element={<Search />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="anime/:id" element={<AnimeDetails />} />
            <Route path="anime/:id/season/:seasonId" element={<SeasonDetails />} />
            <Route path="watch/:id" element={<WatchPage />} />
            <Route path="watch/:animeId/:seasonId" element={<WatchPage />} />
            <Route path="watch/:animeId/:seasonId/:id" element={<WatchPage />} />
          </Route>

          {/* Admin Management Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="anime" element={<AdminAnime />} />
            <Route path="seasons" element={<AdminSeasons />} />
            <Route path="episodes" element={<AdminEpisodes />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="security" element={<AdminSecurity />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
