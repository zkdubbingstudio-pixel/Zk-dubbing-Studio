import { useAuthStore } from '../store/authStore';
import { LogOut, Settings, Clock, Heart, Shield } from 'lucide-react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { signOutUser, isAuthorizedAdmin } from '../lib/authService';

export default function Profile() {
  const { user, firebaseUser, loading } = useAuthStore();
  const navigate = useNavigate();

  if (loading) return <div className="p-8 mt-20 text-center text-white/50">Loading profile...</div>;
  if (!user || !firebaseUser) return <Navigate to="/" replace />;

  const handleLogout = async () => {
    await signOutUser();
    navigate('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Profile Sidebar */}
        <div className="w-full md:w-80 shrink-0">
          <div className="glass-panel rounded-lg p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand mb-4">
              <img 
                src={firebaseUser.photoURL || undefined || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-xl font-bold">{firebaseUser.displayName || 'Anime Fan'}</h2>
            <p className="text-sm text-white/50 mb-6">{firebaseUser.email}</p>
            
            <div className="w-full space-y-2 border-t border-white/10 pt-6">
              {isAuthorizedAdmin(user.email) && (
                <Link to="/admin" className="w-full flex items-center justify-between px-4 py-3 bg-brand/10 hover:bg-brand/20 border border-brand/20 rounded transition-colors text-sm text-brand font-bold shadow-[0_0_15px_rgba(0,229,255,0.1)]">
                  <span className="flex items-center gap-2"><Shield className="w-5 h-5" /> Admin Panel</span>
                </Link>
              )}
              <Link to="/settings" className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 rounded transition-colors text-sm">
                <span className="flex items-center gap-2 text-white/80"><Settings className="w-4 h-4" /> Settings</span>
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 rounded transition-colors text-sm text-red-400">
                <span className="flex items-center gap-2"><LogOut className="w-4 h-4" /> Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-8">
          
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-brand" />
              <h2 className="text-xl font-bold">Continue Watching</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Mock History Items */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel p-3 rounded flex gap-3 group relative overflow-hidden cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="w-24 aspect-video rounded bg-white/10 shrink-0 overflow-hidden relative">
                    <img src="https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=200&h=112" className="w-full h-full object-cover opacity-80" alt="" />
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                      <div className="h-full bg-brand" style={{ width: `${i * 30}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    <h3 className="font-semibold text-sm truncate">Jujutsu Kaisen</h3>
                    <p className="text-xs text-brand font-medium">Episode {i * 4}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-brand" />
                <h2 className="text-xl font-bold">My List</h2>
              </div>
              <Link to="/search" className="text-sm text-white/50 hover:text-white">View All</Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
               {/* Mock Favorite Items */}
               {[1, 2, 3, 4, 5].map((i) => (
                <Link key={i} to={`/anime/${i}`} className="aspect-[2/3] rounded overflow-hidden glass-panel relative group">
                  <img src={`https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=300&h=450`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </Link>
               ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
