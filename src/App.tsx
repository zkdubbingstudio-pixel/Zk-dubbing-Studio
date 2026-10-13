/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import { auth, onAuthStateChanged } from './lib/firebase';
import { getActiveAuthUser, loadUserProfileFromSupabase } from './lib/authService';

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
  const { setUser, setFirebaseUser, setLoading } = useAuthStore();

  useEffect(() => {
    // 1. Initial fast user hydration from cached profile
    getActiveAuthUser()
      .then((user) => {
        if (user) {
          setUser(user);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });

    // 2. Firebase real-time auth state listener (keeps user logged in across refresh)
    let unsubscribe: (() => void) | undefined;
    if (auth) {
      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          setFirebaseUser(fbUser);
          try {
            const userProfile = await loadUserProfileFromSupabase(
              fbUser.uid,
              fbUser.email,
              fbUser.displayName
            );
            setUser(userProfile);
          } catch (err) {
            console.warn('Notice loading user profile from Supabase:', err);
          }
        } else {
          setFirebaseUser(null);
          setUser(null);
        }
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setUser, setFirebaseUser, setLoading]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Main User Routes - Open directly to all visitors without signing in */}
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Home />} />
            <Route path="search" element={<Search />} />
            <Route path="browse" element={<Search />} />
            <Route path="trending" element={<Home />} />
            <Route path="new-drops" element={<Home />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="anime/:id" element={<AnimeDetails />} />
            <Route path="anime/:id/season/:seasonId" element={<SeasonDetails />} />
            <Route path="watch/:id" element={<WatchPage />} />
            <Route path="watch/:animeId/:seasonId" element={<WatchPage />} />
            <Route path="watch/:animeId/:seasonId/:id" element={<WatchPage />} />
          </Route>

          {/* Admin Management Routes - Protected with Access Denied gatekeeping for unauthorized visitors */}
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

          {/* Catch-all route (including any /login requests redirected to home) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
