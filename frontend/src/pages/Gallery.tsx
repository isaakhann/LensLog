import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  SlidersHorizontal, 
  Heart, 
  Calendar, 
  Camera, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Photo {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  url: string;
  storage_key: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
  capture_date: string | null;
  camera_model: string | null;
  lens_model: string | null;
  iso: number | null;
  aperture: string | null;
  shutter_speed: string | null;
  is_favorite: boolean;
  privacy_level: string;
  mood: string | null;
  tags: string[];
  created_at: string;
}

interface PhotoListResponse {
  photos: Photo[];
  total: number;
  page: number;
  page_size: number;
}

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'favorites'>('newest');
  const [feedType, setFeedType] = useState<'personal' | 'public'>('personal');

  // Fetch photos
  const { data, isLoading, error } = useQuery<PhotoListResponse>({
    queryKey: ['photos', feedType, page],
    queryFn: () => {
      const endpoint = feedType === 'public' ? '/photos/public' : '/photos/';
      return api.get<PhotoListResponse>(`${endpoint}?page=${page}&page_size=12`);
    },
    placeholderData: (previousData) => previousData
  });

  // Favorite toggle mutation
  const favoriteMutation = useMutation({
    mutationFn: (photoId: string) => api.post<Photo>(`/photos/${photoId}/favorite`),
    onSuccess: (updatedPhoto) => {
      // Update cache
      queryClient.setQueryData(['photos', feedType, page], (oldData: PhotoListResponse | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          photos: oldData.photos.map(p => p.id === updatedPhoto.id ? updatedPhoto : p)
        };
      });
    }
  });

  const handleToggleFavorite = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    e.preventDefault();
    favoriteMutation.mutate(photoId);
  };

  // Filter & Sort client side
  const photos = data?.photos || [];
  
  const filteredPhotos = photos.filter(photo => {
    const titleMatch = photo.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = photo.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const tagMatch = photo.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const cameraMatch = photo.camera_model?.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || descMatch || tagMatch || cameraMatch;
  });

  const sortedPhotos = [...filteredPhotos].sort((a, b) => {
    if (sortBy === 'favorites') {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    const timeA = a.capture_date ? new Date(a.capture_date).getTime() : new Date(a.created_at).getTime();
    const timeB = b.capture_date ? new Date(b.capture_date).getTime() : new Date(b.created_at).getTime();
    return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm">Loading your journal feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-red-400">
        <ImageIcon className="w-10 h-10 text-red-500/80 mb-4" />
        <p className="text-sm">Failed to load photos. Please try again.</p>
      </div>
    );
  }

  // Helper to format capture date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Photography Journal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Discover, tag, and search through your personal moments & details.
          </p>
        </div>

        <Link
          to="/upload"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/15 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </Link>
      </div>

      {/* Feed Segment Toggles */}
      <div className="flex gap-2 p-1 bg-slate-950 border border-slate-900 rounded-2xl w-fit self-start">
        <button
          onClick={() => {
            setFeedType('personal');
            setPage(1);
          }}
          className={`px-5 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
            feedType === 'personal'
              ? 'bg-slate-900 border border-slate-800 text-cyan-400 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          My Journal
        </button>
        <button
          onClick={() => {
            setFeedType('public');
            setPage(1);
          }}
          className={`px-5 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
            feedType === 'public'
              ? 'bg-slate-900 border border-slate-800 text-cyan-400 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Explore Feed
        </button>
      </div>

      {/* Toolbar / Search Filters */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title, tags, description, camera..."
            className="w-full bg-slate-950 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex w-full md:w-auto items-center gap-3 justify-end">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Sort by:</span>
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="favorites">Favorites</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {sortedPhotos.length === 0 && (
        <div className="bg-slate-900/20 border border-slate-800/50 rounded-3xl p-16 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl mb-4 text-slate-500">
            <FolderOpen className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">No Journal Entries found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            {searchQuery ? "We couldn't find anything matching your search query. Try another term or reset filters." : "Start documenting your photographic journey today! Upload your first shot."}
          </p>
          {!searchQuery && (
            <Link
              to="/upload"
              className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700/80 transition-colors"
            >
              Upload your first photo
            </Link>
          )}
        </div>
      )}

      {/* Photos Grid */}
      {sortedPhotos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedPhotos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => navigate(`/photo/${photo.id}`)}
              className="group relative bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700 hover:shadow-2xl hover:shadow-cyan-950/20 hover:scale-[1.01] transition-all duration-300 flex flex-col"
            >
              {/* Image Container */}
              <div className="aspect-square relative overflow-hidden bg-slate-950">
                <img
                  src={photo.url.startsWith('/') ? `http://localhost:8000${photo.url}` : photo.url}
                  alt={photo.title || 'Photograph'}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4" />

                {/* Favorite Icon (Overlay) */}
                {user && photo.user_id === user.id && (
                  <button
                    onClick={(e) => handleToggleFavorite(e, photo.id)}
                    className="absolute top-3 right-3 p-2 bg-slate-950/60 hover:bg-slate-900 backdrop-blur-md rounded-xl border border-slate-800/80 transition-all text-slate-300"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        photo.is_favorite ? 'text-red-500 fill-red-500' : 'hover:text-red-400'
                      }`}
                    />
                  </button>
                )}

                {/* Technical stats overlay (Hover) */}
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {photo.camera_model && (
                    <span className="text-[10px] font-medium bg-slate-950/80 backdrop-blur-sm border border-slate-800/60 rounded px-1.5 py-0.5 text-slate-300 flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5" />
                      {photo.camera_model.split(' ').slice(-1)[0]}
                    </span>
                  )}
                  {photo.aperture && (
                    <span className="text-[10px] font-medium bg-slate-950/80 backdrop-blur-sm border border-slate-800/60 rounded px-1.5 py-0.5 text-slate-300">
                      {photo.aperture}
                    </span>
                  )}
                  {photo.shutter_speed && (
                    <span className="text-[10px] font-medium bg-slate-950/80 backdrop-blur-sm border border-slate-800/60 rounded px-1.5 py-0.5 text-slate-300">
                      {photo.shutter_speed}
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Metadata details */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-200 text-sm group-hover:text-cyan-400 transition-colors truncate">
                    {photo.title || 'Untitled'}
                  </h3>
                  {photo.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {photo.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60 pt-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(photo.capture_date)}
                  </span>
                  {photo.privacy_level && (
                    <span className="uppercase tracking-wider font-semibold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {photo.privacy_level}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {data && data.total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-12 pt-6 border-t border-slate-900">
          <button
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="p-2 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-sm font-semibold text-slate-300">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages}
            className="p-2 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
