import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Camera, 
  Clock, 
  MapPin, 
  Tag, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  Loader2, 
  Eye, 
  Lock, 
  Globe,
  Check,
  X,
  Maximize2,
  Star,
  ThumbsUp,
  MessageSquare
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Comment {
  id: string;
  user_id: string;
  photo_id: string;
  text: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    profile_picture_url: string | null;
  };
}

interface Photo {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  personal_notes: string | null;
  privacy_level: string;
  mood: string | null;
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
  tags: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

export const PhotoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPrivacy, setEditPrivacy] = useState('private');
  const [editMood, setEditMood] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  // Fetch photo details
  const { data: photo, isLoading, error } = useQuery<Photo>({
    queryKey: ['photo', id],
    queryFn: async () => {
      const res = await api.get<Photo>(`/photos/${id}`);
      // Sync edit fields on load
      setEditTitle(res.title || '');
      setEditDesc(res.description || '');
      setEditNotes(res.personal_notes || '');
      setEditPrivacy(res.privacy_level);
      setEditMood(res.mood || '');
      setEditTags(res.tags.join(', '));
      setEditLat(res.latitude !== null ? String(res.latitude) : '');
      setEditLng(res.longitude !== null ? String(res.longitude) : '');
      return res;
    },
    enabled: !!id
  });

  const isOwner = user && photo && user.id === photo.user_id;

  // Toggle favorite mutation
  const favoriteMutation = useMutation({
    mutationFn: () => api.post<Photo>(`/photos/${id}/favorite`),
    onSuccess: (updatedPhoto) => {
      queryClient.setQueryData(['photo', id], (old: Photo | undefined) => {
        if (!old) return updatedPhoto;
        return {
          ...updatedPhoto,
          likes_count: old.likes_count,
          comments_count: old.comments_count,
          is_liked: old.is_liked
        };
      });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    }
  });

  // Update photo details mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put<Photo>(`/photos/${id}`, data),
    onSuccess: (updatedPhoto) => {
      queryClient.setQueryData(['photo', id], (old: Photo | undefined) => {
        if (!old) return updatedPhoto;
        return {
          ...updatedPhoto,
          likes_count: old.likes_count,
          comments_count: old.comments_count,
          is_liked: old.is_liked
        };
      });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setIsEditing(false);
    }
  });

  // Delete photo mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/photos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      navigate('/');
    }
  });

  // Fetch comments query
  const { data: comments = [], refetch: refetchComments } = useQuery<Comment[]>({
    queryKey: ['comments', id],
    queryFn: () => api.get<Comment[]>(`/social/photos/${id}/comments`),
    enabled: !!id
  });

  // Toggle social like mutation
  const likeMutation = useMutation({
    mutationFn: () => api.post<any>(`/social/photos/${id}/like`),
    onSuccess: (res) => {
      queryClient.setQueryData(['photo', id], (oldData: Photo | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          likes_count: res.likes_count,
          is_liked: res.is_liked
        };
      });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    }
  });

  // Submit comment mutation
  const [commentText, setCommentText] = useState('');
  const addCommentMutation = useMutation({
    mutationFn: (text: string) => api.post<Comment>(`/social/photos/${id}/comments`, { text }),
    onSuccess: () => {
      setCommentText('');
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['photo', id] });
    }
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addCommentMutation.mutate(commentText);
  };

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.delete(`/social/comments/${commentId}`),
    onSuccess: () => {
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['photo', id] });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm">Loading details...</p>
      </div>
    );
  }

  if (error || !photo) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-red-400">
        <X className="w-10 h-10 text-red-500/80 mb-4" />
        <p className="text-sm">Photograph details could not be found.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-slate-800 rounded-xl text-slate-200">
          Back to Gallery
        </button>
      </div>
    );
  }

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = editTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const latVal = editLat.trim();
    const lngVal = editLng.trim();

    updateMutation.mutate({
      title: editTitle,
      description: editDesc,
      personal_notes: editNotes,
      privacy_level: editPrivacy,
      mood: editMood,
      tags: tagArray,
      latitude: latVal ? parseFloat(latVal) : null,
      longitude: lngVal ? parseFloat(lngVal) : null
    });
  };

  const getPrivacyIcon = (level: string) => {
    if (level === 'public') return <Globe className="w-3.5 h-3.5" />;
    if (level === 'shared') return <Eye className="w-3.5 h-3.5" />;
    return <Lock className="w-3.5 h-3.5" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const imageUrl = photo.url.startsWith('/') ? `http://localhost:8000${photo.url}` : photo.url;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back button and actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-xl transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          {/* Social Like Button */}
          <button
            onClick={() => likeMutation.mutate()}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
              photo.is_liked 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20' 
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${photo.is_liked ? 'fill-cyan-400' : ''}`} />
            <span>{photo.likes_count}</span>
          </button>

          {isOwner && (
            <button
              onClick={() => favoriteMutation.mutate()}
              className={`p-2.5 rounded-xl border transition-all ${
                photo.is_favorite 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Favorite Bookmark"
            >
              <Star className={`w-3.5 h-3.5 ${photo.is_favorite ? 'fill-amber-400' : ''}`} />
            </button>
          )}

          {isOwner && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-200 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
              Edit details
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-2 rounded-xl border border-red-950 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-all"
              title="Delete Photo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main photo container and sidebar grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Photo view */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden aspect-[4/3] flex items-center justify-center group shadow-2xl">
            <img
              src={imageUrl}
              alt={photo.title || 'Photograph'}
              className="max-h-full max-w-full object-contain"
            />
            
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute top-4 right-4 p-2 bg-slate-950/85 hover:bg-slate-900 rounded-xl border border-slate-800/80 text-slate-300 transition-all opacity-0 group-hover:opacity-100"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          
          {/* Vibe and description summary */}
          {!isEditing && (
            <div className="space-y-2 px-2 text-left">
              <h2 className="text-2xl font-bold text-slate-100">{photo.title || 'Untitled Photograph'}</h2>
              {photo.mood && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs font-semibold rounded-full">
                  Vibe: {photo.mood}
                </div>
              )}
              {photo.description && (
                <p className="text-slate-300 text-sm leading-relaxed mt-2 whitespace-pre-wrap">{photo.description}</p>
              )}
              {isOwner && photo.personal_notes && (
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 mt-4 text-left">
                  <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Personal Settings & Notes (Private)
                  </span>
                  <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">{photo.personal_notes}</p>
                </div>
              )}

              {/* Comments Section */}
              <div className="bg-slate-900/20 border border-slate-800/60 rounded-3xl p-6 mt-6 space-y-6 text-left">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2 border-b border-slate-850 pb-3">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Comments ({(comments || []).length})
                </h3>

                {/* Comments List */}
                {(!comments || comments.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-2">No comments yet. Be the first to share your thoughts!</p>
                ) : (
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {(comments || []).map(c => {
                      const canDelete = user && (c.user_id === user.id || photo.user_id === user.id);
                      return (
                        <div key={c.id} className="flex gap-3 items-start bg-slate-950/40 border border-slate-900/60 p-3 rounded-2xl">
                          {c.user?.profile_picture_url ? (
                            <img 
                              src={c.user.profile_picture_url} 
                              alt={c.user.username} 
                              className="w-8 h-8 rounded-full object-cover border border-slate-800 mt-0.5"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold font-mono mt-0.5">
                              {(c.user?.username || 'Anonymous').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-355">{c.user?.username || 'Anonymous'}</span>
                              <span className="text-[10px] text-slate-500">{formatDate(c.created_at)}</span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => deleteCommentMutation.mutate(c.id)}
                              className="p-1 hover:bg-slate-900 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                              title="Delete Comment"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

            {/* Add Comment Form */}
            <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-2 border-t border-slate-850">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 animate-in fade-in"
              />
              <button
                type="submit"
                disabled={addCommentMutation.isPending || !commentText.trim()}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-55 disabled:hover:from-cyan-500 disabled:hover:to-blue-600 text-white text-xs font-bold rounded-xl flex items-center justify-center transition-colors"
              >
                {addCommentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post'}
              </button>
            </form>
          </div>
            </div>
          )}
        </div>

        {/* Info sidebar / Edit Form */}
        <div className="space-y-6">
          {isEditing && isOwner ? (
            <form onSubmit={handleUpdateSubmit} className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 space-y-5 text-left">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-slate-200 text-sm">Edit Photo Metadata</h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Journal/Description
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                {/* Personal Notes */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Personal Notes (Private)
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={2.5}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={e => setEditTags(e.target.value)}
                    placeholder="comma separated values"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Mood */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Mood / Vibe
                  </label>
                  <input
                    type="text"
                    value={editMood}
                    onChange={e => setEditMood(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Privacy */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Privacy Level
                  </label>
                  <select
                    value={editPrivacy}
                    onChange={e => setEditPrivacy(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="private">Private (Only Me)</option>
                    <option value="shared">Shared (Friends)</option>
                    <option value="public">Public (Everyone)</option>
                  </select>
                </div>

                {/* Location coordinates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editLat}
                      onChange={e => setEditLat(e.target.value)}
                      placeholder="e.g. 37.7749"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editLng}
                      onChange={e => setEditLng(e.target.value)}
                      placeholder="e.g. -122.4194"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 text-left">
              {/* Privacy and Date */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-cyan-500" />
                    Captured
                  </span>
                  <span className="text-slate-200 text-[11px] font-semibold">
                    {formatDate(photo.capture_date)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    {getPrivacyIcon(photo.privacy_level)}
                    Visibility
                  </span>
                  <span className="text-slate-200 text-[11px] font-bold uppercase tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                    {photo.privacy_level}
                  </span>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  EXIF Details
                </h3>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Camera Model</span>
                    <span className="font-semibold text-slate-200">{photo.camera_model || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Lens Model</span>
                    <span className="font-semibold text-slate-200 truncate max-w-[180px]">{photo.lens_model || 'Unknown'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-800/40">
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850">
                      <span className="block text-[9px] text-slate-500 uppercase font-semibold">Aperture</span>
                      <span className="text-xs font-bold text-slate-350">{photo.aperture || 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850">
                      <span className="block text-[9px] text-slate-500 uppercase font-semibold">Shutter</span>
                      <span className="text-xs font-bold text-slate-350">{photo.shutter_speed || 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850">
                      <span className="block text-[9px] text-slate-500 uppercase font-semibold">ISO</span>
                      <span className="text-xs font-bold text-slate-350">{photo.iso || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Geolocation Section */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  Location
                </h3>

                {photo.latitude !== null && photo.longitude !== null ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Coordinates</span>
                      <span className="font-semibold text-slate-300 text-[10px]">
                        {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
                      </span>
                    </div>
                    <Link
                      to={`/map?lat=${photo.latitude}&lng=${photo.longitude}`}
                      className="block text-center py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      View on Interactive Map
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No GPS location tagged on this photo.</p>
                )}
              </div>

              {/* Tags Section */}
              {photo.tags && photo.tags.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2">
                    <Tag className="w-4 h-4 text-cyan-400" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(photo.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-semibold bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-355"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Fullscreen Image */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
        >
          <button className="absolute top-6 right-6 p-2 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
          <img
            src={imageUrl}
            alt={photo.title || 'Photograph'}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Delete Journal Entry?</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Are you sure you want to permanently delete "{photo.title || 'Untitled'}"? This action cannot be undone and will delete the file from cloud storage.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300"
              >
                No, Keep it
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 bg-red-650 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
