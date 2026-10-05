import React from 'react';
import { Sparkles } from 'lucide-react';

interface GenreChipsBarProps {
  genres: string[];
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
}

export default function GenreChipsBar({ genres, selectedGenre, onSelectGenre }: GenreChipsBarProps) {
  return (
    <div className="w-full relative py-2">
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {genres.map((genre) => {
          const isSelected = selectedGenre === genre;
          return (
            <button
              key={genre}
              onClick={() => onSelectGenre(genre)}
              className={`relative px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 transform active:scale-95 cursor-pointer ${
                isSelected
                  ? 'btn-3d-cyan text-black shadow-[0_0_20px_rgba(0,229,255,0.6)]'
                  : 'btn-3d-silver text-silver hover:text-white'
              }`}
            >
              {isSelected && (
                <span className="inline-block mr-1.5 align-middle">
                  <Sparkles className="w-3.5 h-3.5 fill-black" />
                </span>
              )}
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
