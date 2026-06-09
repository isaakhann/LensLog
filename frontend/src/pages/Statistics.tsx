import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Camera, 
  Image as ImageIcon, 
  MapPin, 
  Heart, 
  Tag, 
  Compass, 
  Smile, 
  Loader2,
  FolderOpen
} from 'lucide-react';
import { api } from '../services/api';

interface Photo {
  id: string;
  is_favorite: boolean;
  latitude: number | null;
  longitude: number | null;
  camera_model: string | null;
  lens_model: string | null;
  iso: number | null;
  aperture: string | null;
  mood: string | null;
  tags: string[];
}

interface PhotoListResponse {
  photos: Photo[];
  total: number;
}

export const Statistics: React.FC = () => {
  // Fetch photos
  const { data, isLoading } = useQuery<PhotoListResponse>({
    queryKey: ['photos-statistics'],
    queryFn: () => api.get<PhotoListResponse>('/photos/?page=1&page_size=100')
  });

  const photos = data?.photos || [];

  // Aggregated stats
  const totalPhotos = photos.length;
  const favoritesCount = photos.filter(p => p.is_favorite).length;
  const geotaggedCount = photos.filter(p => p.latitude !== null && p.longitude !== null).length;

  // Breakdown aggregators
  const cameras: { [key: string]: number } = {};
  const lenses: { [key: string]: number } = {};
  const tags: { [key: string]: number } = {};
  const moods: { [key: string]: number } = {};

  photos.forEach(p => {
    if (p.camera_model) {
      cameras[p.camera_model] = (cameras[p.camera_model] || 0) + 1;
    }
    if (p.lens_model) {
      lenses[p.lens_model] = (lenses[p.lens_model] || 0) + 1;
    }
    if (p.mood) {
      moods[p.mood] = (moods[p.mood] || 0) + 1;
    }
    p.tags.forEach(t => {
      tags[t] = (tags[t] || 0) + 1;
    });
  });

  const topCameras = Object.entries(cameras).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topLenses = Object.entries(lenses).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topMoods = Object.entries(moods).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm">Calculating journal analytics...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Journal Analytics
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Explore visual metadata and equipment statistics aggregated from your photography journal.
        </p>
      </div>

      {totalPhotos === 0 ? (
        <div className="bg-slate-900/20 border border-slate-800/50 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <FolderOpen className="w-10 h-10 text-slate-605 mb-4" />
          <h3 className="text-lg font-bold text-slate-200">No Analytics Yet</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            Once you upload photos, we will show dynamic statistics about your cameras, lenses, tags, and locations.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top Level Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 rounded-xl">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Shots</span>
                <span className="text-2xl font-extrabold text-slate-100">{totalPhotos}</span>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-red-950/40 border border-red-800/40 text-red-400 rounded-xl">
                <Heart className="w-5 h-5 fill-red-500/20" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Favorites</span>
                <span className="text-2xl font-extrabold text-slate-100">{favoritesCount}</span>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Mapped Locations</span>
                <span className="text-2xl font-extrabold text-slate-100">{geotaggedCount}</span>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 text-indigo-400 rounded-xl">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Cameras Used</span>
                <span className="text-2xl font-extrabold text-slate-100">{Object.keys(cameras).length}</span>
              </div>
            </div>
          </div>

          {/* Breakdown sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            {/* Camera breakdown */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-6">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2 border-b border-slate-850 pb-3">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Top Camera Models</span>
              </h3>

              <div className="space-y-4">
                {topCameras.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No camera EXIF data found in photos.</p>
                ) : (
                  topCameras.map(([model, count]) => {
                    const pct = ((count / totalPhotos) * 100).toFixed(0);
                    return (
                      <div key={model} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300">{model}</span>
                          <span className="text-slate-500">{count} shots ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Lens breakdown */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-6">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2 border-b border-slate-850 pb-3">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Top Lenses</span>
              </h3>

              <div className="space-y-4">
                {topLenses.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No lens EXIF data found in photos.</p>
                ) : (
                  topLenses.map(([lens, count]) => {
                    const pct = ((count / totalPhotos) * 100).toFixed(0);
                    return (
                      <div key={lens} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300 truncate max-w-[280px]">{lens}</span>
                          <span className="text-slate-500">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Common Tags Cloud */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2 border-b border-slate-850 pb-3">
                <Tag className="w-4 h-4 text-cyan-400" />
                <span>Popular Tags</span>
              </h3>

              <div className="flex flex-wrap gap-2.5 pt-2">
                {topTags.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Add tags to your photos to build tag analytics.</p>
                ) : (
                  topTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="text-xs font-semibold bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-slate-300 flex items-center gap-1.5"
                    >
                      <span>#{tag}</span>
                      <span className="text-[10px] text-slate-500 font-bold bg-slate-900 px-1.5 py-0.5 rounded-full border border-slate-800">
                        {count}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Mood breakdown */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-6">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2 border-b border-slate-850 pb-3">
                <Smile className="w-4 h-4 text-cyan-400" />
                <span>Journal Moods & Vibes</span>
              </h3>

              <div className="space-y-4">
                {topMoods.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No mood descriptors recorded in journal entries.</p>
                ) : (
                  topMoods.map(([mood, count]) => {
                    const pct = ((count / totalPhotos) * 100).toFixed(0);
                    return (
                      <div key={mood} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300">{mood}</span>
                          <span className="text-slate-500">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
