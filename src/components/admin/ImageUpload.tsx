import React from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import { resolveImageUrl } from '../../lib/imageUtils';
import { sanitizeUrl } from '../../lib/security';

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  className?: string;
}

export default function ImageUpload({
  label,
  value,
  onChange,
  className = 'h-40',
}: ImageUploadProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
        <span className="text-xs text-brand flex items-center gap-1">
          <LinkIcon className="w-3 h-3" /> Image URL
        </span>
      </div>

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(sanitizeUrl(e.target.value))}
        placeholder="https://example.com/image.jpg"
        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand"
      />

      {value && (
        <div
          className={`relative mt-2 flex flex-col items-center justify-center rounded-xl overflow-hidden border border-white/10 bg-black/50 ${className}`}
        >
          <img
            src={resolveImageUrl(value)}
            alt="Preview"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <button
            type="button"
            onClick={handleDelete}
            className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors z-10"
            title="Remove Image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
