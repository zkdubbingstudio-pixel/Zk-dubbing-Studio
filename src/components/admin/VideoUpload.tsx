import React, { useState } from 'react';
import { Link as LinkIcon, Check, AlertCircle } from 'lucide-react';
import { sanitizeUrl } from '../../lib/security';

interface VideoUploadProps {
  label: string;
  onUploadSuccess: (urls: { url480p: string; url720p: string; url1080p: string }) => void;
  animeName: string;
  seasonNumber: string;
}

export default function VideoUpload({ label, onUploadSuccess }: VideoUploadProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleApplyUrl = () => {
    const cleanUrl = sanitizeUrl(videoUrl.trim());
    if (!cleanUrl) {
      setError('Please enter a valid video URL (https://...).');
      setSuccess(false);
      return;
    }

    setError('');
    onUploadSuccess({
      url480p: cleanUrl,
      url720p: cleanUrl,
      url1080p: cleanUrl,
    });
    setSuccess(true);
  };

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1">{label}</label>

      <div className="w-full bg-black/50 border border-white/15 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <LinkIcon className="w-4 h-4 text-brand" />
          <span>Enter Video URL (stored in Firestore)</span>
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setSuccess(false);
              setError('');
            }}
            placeholder="https://example.com/episode.mp4"
            className="flex-1 bg-black/60 border border-white/15 focus:border-brand rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-4 py-2 bg-brand text-black font-bold text-xs rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            Save URL
          </button>
        </div>

        {success && (
          <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-xs">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Video URL saved!</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
