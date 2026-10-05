import React from "react";
import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { UploadCloud, X, Loader2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  className?: string;
}

export default function ImageUpload({ label, value, onChange, folder, className = "h-40" }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (mode === 'url') return;
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const processFile = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file type. Only JPG, PNG, and WEBP are allowed.');
      return;
    }

    setUploading(true);

    try {
      const options = {
        maxSizeMB: 0.4, // 400KB * 1.33 (Base64) = ~530KB, well under Firestore 1MB limit
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        onChange(base64data);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      
    } catch (error) {
      console.error(error);
      alert('Error compressing image. Try a smaller file or use URL mode.');
      setUploading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
        <button
          type="button"
          onClick={() => setMode(mode === 'upload' ? 'url' : 'upload')}
          className="text-xs text-brand flex items-center gap-1 hover:underline"
        >
          {mode === 'upload' ? <><LinkIcon className="w-3 h-3" /> Use URL</> : <><ImageIcon className="w-3 h-3" /> Upload File</>}
        </button>
      </div>
      
      {mode === 'url' ? (
        <input 
          type="url" 
          value={value} 
          onChange={e => onChange(e.target.value)} 
          placeholder="https://example.com/image.jpg"
          className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand"
        />
      ) : (
        <div 
          onClick={() => !uploading && !value && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors ${className} ${
            isDragging ? 'border-brand bg-brand/5' : 'border-white/20 bg-black/50 hover:border-white/40'
          } ${value ? 'border-transparent' : ''}`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/jpeg,image/png,image/webp" 
            className="hidden" 
          />

          {uploading ? (
            <div className="flex flex-col items-center p-4">
              <Loader2 className="w-8 h-8 text-brand animate-spin mb-2" />
              <p className="text-sm text-white font-medium">Processing...</p>
            </div>
          ) : value ? (
            <div className="relative w-full h-full group" onClick={() => fileInputRef.current?.click()}>
              <img src={value || "https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&q=80"} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                <UploadCloud className="w-6 h-6 text-white mb-2" />
                <p className="text-white text-sm font-medium">Click to replace</p>
              </div>
              <button 
                onClick={handleDelete}
                className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors z-10"
                title="Remove Image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center p-4 text-white/50 text-center">
              <UploadCloud className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-medium text-white mb-1">Click or drag image here</p>
              <p className="text-xs">JPG, PNG, WEBP</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
