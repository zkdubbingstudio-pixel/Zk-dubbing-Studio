import { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, Sparkles, Film } from 'lucide-react';
import { supabase, executeSupabaseWithRetry } from '../lib/supabase';
import { normalizeAnime, getGenres } from '../lib/dataService';
import AnimeCard3D from '../components/AnimeCard3D';
import GenreChipsBar from '../components/GenreChipsBar';

export default function Search() {
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [genresList, setGenresList] = useState<string[]>(['All']);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load dynamic genres from Supabase
  useEffect(() => {
    let isMounted = true;
    getGenres().then((list) => {
      if (isMounted && Array.isArray(list) && list.length > 0) {
        setGenresList(list);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Search directly in Supabase
  useEffect(() => {
    let isMounted = true;

    const fetchSearch = async () => {
      setLoading(true);
      try {
        const cleanQuery = query.trim();

        const res = await executeSupabaseWithRetry(async () => {
          let q = supabase.from('anime').select('*');

          if (cleanQuery) {
            q = q.ilike('title', `%${cleanQuery}%`);
          }

          if (selectedGenre !== 'All') {
            q = q.contains('genres', [selectedGenre]);
          }

          return await q.order('created_at', { ascending: false }).limit(60);
        });

        if (isMounted) {
          if (res?.data && res.data.length > 0) {
            setResults(res.data.map((item: any) => normalizeAnime(item, item.id)));
          } else {
            setResults([]);
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setResults([]);
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(() => fetchSearch(), 200);
    const tenSecTimeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 10000);

    return () => {
      isMounted = false;
      clearTimeout(debounce);
      clearTimeout(tenSecTimeout);
    };
  }, [query, selectedGenre]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* 3D Glowing Search Bar */}
      <div className="w-full max-w-3xl mx-auto space-y-3">
        <div className="text-center space-y-2 mb-6">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-widest bg-[#00e5ff]/10 px-3 py-1 rounded-full border border-[#00e5ff]/20">
            <Sparkles className="w-3.5 h-3.5" />
            Neural Anime Index
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-silver-light tracking-tight">
            Discover Hindi Dubbed Anime
          </h1>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#00e5ff] via-[#cbd5e1] to-[#00b4d8] opacity-20 group-focus-within:opacity-60 blur-md transition-opacity duration-500 pointer-events-none" />
          <div className="relative flex items-center bg-[#0a0e17]/95 border border-white/10 group-focus-within:border-[#00e5ff] rounded-2xl overflow-hidden shadow-2xl">
            <div className="pl-5 pr-2 pointer-events-none">
              <SearchIcon className="h-5 w-5 text-brand" />
            </div>
            <input
              type="text"
              className="block w-full py-4 pr-5 bg-transparent text-white placeholder-silver-dark/60 focus:outline-none text-base sm:text-lg font-medium"
              placeholder="Search by title, voice artist, or studio..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="pr-5 text-silver-dark hover:text-white text-xs font-bold cursor-pointer"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Futuristic Genre Filter Chips */}
      <div className="glass-cyber-card p-5 sm:p-6 rounded-3xl border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-silver">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand" />
            <span>Select Category</span>
          </div>
          <span className="text-[11px] text-silver-dark font-mono">
            {selectedGenre === 'All' ? 'All Genres Active' : `Filtered by ${selectedGenre}`}
          </span>
        </div>

        <GenreChipsBar
          genres={genresList}
          selectedGenre={selectedGenre}
          onSelectGenre={setSelectedGenre}
        />
      </div>

      {/* Results Header & 3D Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-silver-light tracking-tight">
            {query.trim()
              ? `Results for "${query.trim()}"`
              : selectedGenre !== 'All'
              ? `${selectedGenre} Anime`
              : 'Featured & Popular Catalog'}
          </h2>
          <span className="text-xs font-bold text-silver-dark bg-white/5 px-3 py-1 rounded-full border border-white/10">
            {results.length} Found
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5 border border-white/10 skeleton-shimmer" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {results.map((anime: any, index: number) => (
              <AnimeCard3D
                key={anime.id ? `search-${anime.id}-${index}` : `search-${index}`}
                anime={anime}
                className="w-full"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 px-4 glass-cyber-card rounded-3xl border border-white/10 max-w-md mx-auto">
            <Film className="w-12 h-12 text-[#00e5ff]/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-silver-light">No matches found</h3>
            <p className="text-xs text-silver-dark mt-1">
              Try a different keyword or switch to another genre.
            </p>
            <button
              onClick={() => {
                setQuery('');
                setSelectedGenre('All');
              }}
              className="btn-3d-cyan mt-5 px-6 py-2.5 text-xs font-bold cursor-pointer"
            >
              RESET FILTERS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
