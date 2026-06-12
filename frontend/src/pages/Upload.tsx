import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload as UploadIcon, 
  X, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Tag, 
  Eye,
  Smile,
  Heart
} from 'lucide-react';
// @ts-ignore
import heic2any from 'heic2any';
import { api } from '../services/api';

interface FileUploadState {
  file: File;
  previewUrl: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const Upload: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [tags, setTags] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('private');
  const [mood, setMood] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Files State
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [globalUploadStatus, setGlobalUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const addFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff'];
    const newFiles: FileUploadState[] = [];
    setGlobalError(null);

    let containsHeic = false;
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
      if (isHeic) {
        containsHeic = true;
        break;
      }
    }

    if (containsHeic) {
      setIsConverting(true);
    }

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';

        if (allowedTypes.includes(file.type) || isHeic) {
          if (isHeic) {
            try {
              const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.8
              });
              const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
              const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
              const convertedFile = new File([blob], newFileName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });

              newFiles.push({
                file: convertedFile,
                previewUrl: URL.createObjectURL(convertedFile),
                progress: 0,
                status: 'idle'
              });
            } catch (err: any) {
              console.error("HEIC conversion failed for file:", file.name, err);
              setGlobalError(`Failed to convert HEIC image: ${file.name}. It may be corrupted.`);
            }
          } else {
            newFiles.push({
              file,
              previewUrl: URL.createObjectURL(file),
              progress: 0,
              status: 'idle'
            });
          }
        } else {
          setGlobalError(`File type of ${file.name} is not supported.`);
        }
      }
    } catch (err: any) {
      console.error(err);
      setGlobalError('An error occurred during file processing.');
    } finally {
      setIsConverting(false);
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setGlobalError('Please select at least one photo to upload.');
      return;
    }

    setGlobalUploadStatus('uploading');
    setGlobalError(null);

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const fileState = files[i];
      if (fileState.status === 'success') {
        successCount++;
        continue;
      }

      setFiles(prev => {
        const updated = [...prev];
        updated[i].status = 'uploading';
        return updated;
      });

      const formData = new FormData();
      formData.append('file', fileState.file);
      
      // If uploading multiple, use specified title or fall back to file name
      const photoTitle = files.length === 1 && title ? title : (title ? `${title} (${i + 1})` : fileState.file.name.split('.')[0]);
      formData.append('title', photoTitle);
      formData.append('description', description);
      formData.append('personal_notes', personalNotes);
      formData.append('privacy_level', privacyLevel);
      formData.append('is_favorite', String(isFavorite));
      if (mood) formData.append('mood', mood);
      if (tags) formData.append('tags', tags);

      try {
        // Simple XHR upload simulation or direct api post. Since api doesn't support progress hooks easily in a standard fetch wrapper,
        // we'll run a standard fetch request or simply use the api.post helper.
        await api.post('/photos/', formData);
        
        setFiles(prev => {
          const updated = [...prev];
          updated[i].status = 'success';
          updated[i].progress = 100;
          return updated;
        });
        successCount++;
      } catch (err: any) {
        const errMsg = err?.detail || 'Upload failed';
        setFiles(prev => {
          const updated = [...prev];
          updated[i].status = 'error';
          updated[i].error = errMsg;
          return updated;
        });
      }
    }

    if (successCount === files.length) {
      setGlobalUploadStatus('success');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } else {
      setGlobalUploadStatus('error');
      setGlobalError('Some uploads failed. Please review errors and retry.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Upload Journal Entries
        </h1>
        <p className="text-slate-400 mt-2">
          Add new photographs to your journal. EXIF metadata like aperture, shutter speed, focal length, and GPS coordinates will be parsed automatically.
        </p>
      </div>

      {globalError && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl flex items-start gap-3 text-red-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error</p>
            <p className="text-xs text-red-300/95 mt-0.5">{globalError}</p>
          </div>
        </div>
      )}

      {globalUploadStatus === 'success' && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-start gap-3 text-emerald-200">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Upload Successful!</p>
            <p className="text-xs text-emerald-300/95 mt-0.5">All photos uploaded. Redirecting to gallery...</p>
          </div>
        </div>
      )}

      {isConverting && (
        <div className="p-4 bg-cyan-950/40 border border-cyan-800/60 rounded-2xl flex items-center gap-3 text-cyan-200 animate-pulse">
          <Loader2 className="w-5 h-5 text-cyan-400 shrink-0 animate-spin" />
          <div>
            <p className="font-semibold text-sm">Processing HEIC Photos...</p>
            <p className="text-xs text-cyan-300/95 mt-0.5">Converting High-Efficiency files to standard JPEGs directly in the browser.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleUploadAll} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Zone & Previews */}
        <div className="lg:col-span-2 space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
              isDragging 
                ? 'border-cyan-400 bg-cyan-950/20 scale-[1.01]' 
                : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*"
              className="hidden"
            />
            <div className="p-4 bg-slate-800/60 rounded-2xl mb-4 border border-slate-700/50">
              <UploadIcon className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-base font-semibold text-slate-200">Drag & drop your images here</p>
            <p className="text-xs text-slate-400 mt-1.5">
              Supports JPEG, PNG, WebP, HEIC, TIFF
            </p>
            <button
              type="button"
              className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700/80 transition-colors"
            >
              Browse Files
            </button>
          </div>

          {/* Preview list */}
          {files.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-slate-200 text-sm flex items-center justify-between">
                <span>Selected Files ({files.length})</span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear all
                </button>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {files.map((fileState, idx) => (
                  <div 
                    key={idx}
                    className="relative bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 flex gap-3 items-center group overflow-hidden"
                  >
                    <img
                      src={fileState.previewUrl}
                      alt={fileState.file.name}
                      className="w-14 h-14 object-cover rounded-xl border border-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{fileState.file.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {(fileState.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      {fileState.status === 'uploading' && (
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full animate-pulse" style={{ width: '60%' }}></div>
                        </div>
                      )}
                      {fileState.status === 'success' && (
                        <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 mt-1">
                          <CheckCircle className="w-3 h-3" /> Uploaded
                        </span>
                      )}
                      {fileState.status === 'error' && (
                        <span className="text-[10px] font-medium text-red-400 flex items-center gap-1 mt-1 truncate" title={fileState.error}>
                          <AlertCircle className="w-3 h-3" /> {fileState.error}
                        </span>
                      )}
                    </div>
                    {fileState.status === 'idle' && (
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1.5 text-slate-50 hover:text-red-400 bg-slate-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metadata Form */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              Metadata Details
            </h3>

            <div className="space-y-4 text-left">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={files.length > 1 ? "Shared base title (optional)" : "My Photograph"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Journal/Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Capture the moment, lens choices, location feelings..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>

              {/* Personal Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Personal Notes (Private)
                </label>
                <textarea
                  value={personalNotes}
                  onChange={e => setPersonalNotes(e.target.value)}
                  placeholder="Private notes, camera settings adjustments..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-500" /> Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="landscape, golden hour, street"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <p className="text-[10px] text-slate-500 mt-1">Comma-separated tags</p>
              </div>

              {/* Mood */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Smile className="w-3 h-3 text-slate-500" /> Mood / Vibe
                </label>
                <input
                  type="text"
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  placeholder="Peaceful, Nostalgic, Gritty"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Privacy Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-slate-500" /> Privacy Level
                </label>
                <select
                  value={privacyLevel}
                  onChange={e => setPrivacyLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="private">Private (Only Me)</option>
                  <option value="shared">Shared (Friends Only)</option>
                  <option value="public">Public (Everyone)</option>
                </select>
              </div>

              {/* Is Favorite */}
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Heart className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
                  Mark as Favorite
                </span>
                <button
                  type="button"
                  onClick={() => setIsFavorite(prev => !prev)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                    isFavorite ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                      isFavorite ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={files.length === 0 || globalUploadStatus === 'uploading'}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/15 transition-all duration-300"
            >
              {globalUploadStatus === 'uploading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Publish to Journal'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
