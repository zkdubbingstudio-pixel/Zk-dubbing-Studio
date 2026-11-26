import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { validateVideoUpload } from '../../lib/security';

interface VideoUploadProps {
  label: string;
  onUploadSuccess: (urls: { url480p: string; url720p: string; url1080p: string }) => void;
  animeName: string;
  seasonNumber: string;
}

export default function VideoUpload({ label, onUploadSuccess, animeName, seasonNumber }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateVideoUpload(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid video file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!storage) {
      setError('Firebase Storage is not initialized.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');
    setSuccess(false);

    try {
      const cleanAnime =
        (animeName || 'anime')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'anime';
      const cleanSeason = (seasonNumber || '1').replace(/[^0-9]/g, '') || '1';
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const storagePath = `videos/${cleanAnime}/season-${cleanSeason}/${Date.now()}_${randomSuffix}.${ext}`;
      const storageRef = ref(storage, storagePath);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type || 'video/mp4',
          cacheControl: 'public, max-age=31536000',
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            }
          },
          (uploadErr) => {
            reject(new Error(uploadErr?.message || 'Firebase Storage upload failed.'));
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (urlErr: any) {
              reject(new Error(urlErr?.message || 'Failed to get Firebase Storage download URL.'));
            }
          }
        );
      });

      onUploadSuccess({
        url480p: downloadUrl,
        url720p: downloadUrl,
        url1080p: downloadUrl,
      });

      setSuccess(true);
    } catch (err: any) {
      console.error('Firebase Storage video upload error:', err);
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1">{label}</label>

      {!uploading && !success && (
        <div
          className="w-full bg-black/50 border border-dashed border-white/20 rounded-lg p-6 text-center hover:border-brand hover:bg-brand/5 cursor-pointer transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-white/50" />
          <p className="text-sm font-medium text-white">Click to upload video to Firebase Storage</p>
          <p className="text-xs text-white/40 mt-1">MP4, MKV, WEBM up to 5GB</p>
        </div>
      )}

      {uploading && (
        <div className="w-full bg-black/50 border border-white/10 rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white">Uploading to Firebase Storage...</span>
            <span className="text-brand font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {success && !uploading && (
        <div className="w-full bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-green-400">
            <Check className="w-5 h-5" />
            <span className="text-sm font-medium">Upload Complete to Firebase Storage!</span>
          </div>
          <button onClick={() => setSuccess(false)} className="p-1 hover:bg-green-500/20 rounded text-green-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/webm,video/x-matroska,.mkv"
        className="hidden"
      />
    </div>
  );
}
