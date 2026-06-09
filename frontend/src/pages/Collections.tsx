import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderHeart, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  FolderOpen, 
  Image as ImageIcon, 
  Lock, 
  Globe, 
  PlusCircle, 
  Loader2,
  FolderMinus,
  X
} from 'lucide-react';
import { api } from '../services/api';

interface Photo {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  photos: Photo[];
}

export const Collections: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Create collection form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch collections
  const { data: collections = [], isLoading, error } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: () => api.get<Collection[]>('/collections/')
  });

  // Create collection mutation
  const createMutation = useMutation({
    mutationFn: (newCol: { name: string; description: string; is_public: boolean }) => 
      api.post<Collection>('/collections/', newCol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setCreateModalOpen(false);
      setName('');
      setDescription('');
      setIsPublic(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.detail || 'Failed to create collection');
    }
  });

  // Delete collection mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/collections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (selectedCollection) setSelectedCollection(null);
    }
  });

  // Remove photo from collection mutation
  const removePhotoMutation = useMutation({
    mutationFn: ({ colId, photoId }: { colId: string; photoId: string }) => 
      api.delete(`/collections/${colId}/photos/${photoId}`),
    onSuccess: (_, variables) => {
      // Invalidate collections to refresh count
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      
      // Update local selectedCollection state
      if (selectedCollection && selectedCollection.id === variables.colId) {
        setSelectedCollection(prev => {
          if (!prev) return null;
          return {
            ...prev,
            photos: prev.photos.filter(p => p.id !== variables.photoId)
          };
        });
      }
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Collection name is required');
      return;
    }
    createMutation.mutate({ name, description, is_public: isPublic });
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this collection? The photos themselves will not be deleted.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    if (selectedCollection) {
      removePhotoMutation.mutate({ colId: selectedCollection.id, photoId });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm">Loading your custom collections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-red-400">
        <FolderOpen className="w-10 h-10 text-red-500/80 mb-4" />
        <p className="text-sm">Failed to load collections.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            {selectedCollection ? selectedCollection.name : 'Collections & Albums'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {selectedCollection 
              ? selectedCollection.description || 'Custom curated photography album.'
              : 'Create custom albums to organize and share your photographic projects.'
            }
          </p>
        </div>

        {selectedCollection ? (
          <button
            onClick={() => setSelectedCollection(null)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold rounded-xl"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Albums
          </button>
        ) : (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-cyan-500/10 transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            New Collection
          </button>
        )}
      </div>

      {/* Selected Collection View */}
      {selectedCollection ? (
        <div className="space-y-6">
          {selectedCollection.photos.length === 0 ? (
            <div className="bg-slate-900/20 border border-slate-800/50 rounded-3xl p-16 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
              <FolderOpen className="w-10 h-10 text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-200">Collection is Empty</h3>
              <p className="text-slate-400 text-sm mt-1">
                Go to the Gallery, click a photo detail page, and edit the entry to add it to this collection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 text-left">
              {selectedCollection.photos.map(photo => {
                const imageUrl = photo.url.startsWith('/') ? `http://localhost:8000${photo.url}` : photo.url;
                return (
                  <div 
                    key={photo.id}
                    className="group relative bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-md flex flex-col"
                  >
                    <div className="aspect-square relative bg-slate-950">
                      <img
                        src={imageUrl}
                        alt={photo.title || 'Shot'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-md transition-colors"
                          title="Remove from Album"
                        >
                          <FolderMinus className="w-4 h-4" />
                        </button>
                        <a
                          href={`/photo/${photo.id}`}
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded-xl border border-slate-755 shadow-md font-semibold text-xs"
                        >
                          View Details
                        </a>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900/10">
                      <h4 className="font-semibold text-xs text-slate-200 truncate">{photo.title || 'Untitled'}</h4>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Collections Grid */
        <div>
          {collections.length === 0 ? (
            <div className="bg-slate-900/20 border border-slate-800/50 rounded-3xl p-16 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
              <FolderHeart className="w-10 h-10 text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-200">No Collections</h3>
              <p className="text-slate-400 text-sm mt-1">
                Organize your photography projects into custom curated albums today.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700/80 transition-colors"
              >
                Create your first collection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-left">
              {collections.map(col => {
                const photosCount = col.photos?.length || 0;
                // Get up to 4 thumbnail previews
                const previews = col.photos?.slice(0, 4) || [];
                
                return (
                  <div
                    key={col.id}
                    onClick={() => setSelectedCollection(col)}
                    className="group bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700 hover:scale-[1.01] transition-all duration-300 flex flex-col shadow-lg"
                  >
                    {/* Folder Preview Grid */}
                    <div className="aspect-[1.6/1] bg-slate-950 p-2.5 grid grid-cols-2 gap-1.5 relative border-b border-slate-850 shrink-0">
                      {photosCount === 0 ? (
                        <div className="col-span-2 flex flex-col items-center justify-center text-slate-600">
                          <ImageIcon className="w-8 h-8" />
                          <span className="text-[10px] mt-1.5 font-medium">Empty Album</span>
                        </div>
                      ) : (
                        // Render up to 4 photos in folder preview
                        <>
                          {previews.map((p, idx) => {
                            const imgUrl = p.url.startsWith('/') ? `http://localhost:8000${p.url}` : p.url;
                            return (
                              <img
                                key={p.id}
                                src={imgUrl}
                                alt="Thumb"
                                className={`w-full h-full object-cover rounded-lg border border-slate-900 ${
                                  previews.length === 1 ? 'col-span-2 row-span-2' : ''
                                } ${
                                  previews.length === 2 ? 'row-span-2' : ''
                                } ${
                                  previews.length === 3 && idx === 0 ? 'row-span-2' : ''
                                }`}
                              />
                            );
                          })}
                          {/* Fill with empty boxes if less than 4 */}
                          {previews.length > 0 && Array.from({ length: Math.max(0, 4 - previews.length) }).map((_, idx) => (
                            <div key={idx} className="bg-slate-900/30 border border-dashed border-slate-850 rounded-lg" />
                          ))}
                        </>
                      )}

                      {/* Photo Badge Count */}
                      <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded text-[10px] font-bold text-slate-300">
                        {photosCount} {photosCount === 1 ? 'photo' : 'photos'}
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-slate-200 text-sm group-hover:text-cyan-400 transition-colors truncate">
                            {col.name}
                          </h3>
                          <span className="text-[10px] text-slate-500">
                            {col.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          </span>
                        </div>
                        {col.description && (
                          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                            {col.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-850 pt-3.5">
                        <span>Created {new Date(col.created_at).toLocaleDateString()}</span>
                        <button
                          onClick={(e) => handleDeleteClick(e, col.id)}
                          className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                          title="Delete Album"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleCreateSubmit}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-left"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100">Create Album / Collection</h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Album Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Travel, Street Photography"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Summarize the theme of this album..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Make Collection Public
                </span>
                <button
                  type="button"
                  onClick={() => setIsPublic(prev => !prev)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                    isPublic ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                      isPublic ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    Create Album
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// Internal dummy components for icons
const AlertCircle: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
  </svg>
);
