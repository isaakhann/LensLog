import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Calendar, Camera, MapPin, Loader2, FolderOpen } from 'lucide-react';
import { api } from '../services/api';

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
  is_favorite: boolean;
  privacy_level: string;
  created_at: string;
  tags: string[];
}

interface PhotoListResponse {
  photos: Photo[];
  total: number;
}

export const Timeline: React.FC = () => {
  const navigate = useNavigate();

  // Fetch photos
  const { data, isLoading } = useQuery<PhotoListResponse>({
    queryKey: ['photos-timeline'],
    queryFn: () => api.get<PhotoListResponse>('/photos/?page=1&page_size=100')
  });

  const photos = data?.photos || [];

  // Group photos by Year + Month
  const groupPhotosByMonth = (photosList: Photo[]) => {
    const groups: { [key: string]: Photo[] } = {};

    photosList.forEach(photo => {
      const dateStr = photo.capture_date || photo.created_at;
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.toLocaleString('default', { month: 'long' });
      const groupKey = `${month} ${year}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(photo);
    });

    return Object.entries(groups).sort((a, b) => {
      // Sort months descending
      const dateA = new Date(a[1][0].capture_date || a[1][0].created_at);
      const dateB = new Date(b[1][0].capture_date || b[1][0].created_at);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const groupedMonths = groupPhotosByMonth(photos);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm">Building photo chronology...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Chronological Timeline
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Explore your photography journal structured chronologically by capturing date.
        </p>
      </div>

      {groupedMonths.length === 0 ? (
        <div className="bg-slate-900/20 border border-slate-800/50 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <FolderOpen className="w-10 h-10 text-slate-605 mb-4" />
          <h3 className="text-lg font-bold text-slate-200">Timeline is Empty</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            Once you upload photographs, they will be grouped here automatically by month.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-slate-800/80 ml-4 pl-8 space-y-12 py-4 text-left">
          {groupedMonths.map(([monthYear, monthPhotos]) => (
            <div key={monthYear} className="relative space-y-6">
              {/* Timeline marker */}
              <div className="absolute -left-[41px] top-1 w-6 h-6 rounded-full border-4 border-slate-950 bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <Clock className="w-2.5 h-2.5 text-slate-950" />
              </div>

              {/* Month Header */}
              <div>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  {monthYear}
                  <span className="text-xs font-semibold text-slate-500 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800 ml-2">
                    {monthPhotos.length} {monthPhotos.length === 1 ? 'shot' : 'shots'}
                  </span>
                </h3>
              </div>

              {/* Photos in this month */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {monthPhotos.map(photo => {
                  const dateObj = new Date(photo.capture_date || photo.created_at);
                  const displayDate = dateObj.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={photo.id}
                      onClick={() => navigate(`/photo/${photo.id}`)}
                      className="group bg-slate-900/30 border border-slate-850 hover:border-slate-750 rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-cyan-950/10 hover:scale-[1.01] transition-all duration-300 flex"
                    >
                      <img
                        src={photo.url.startsWith('/') ? `http://localhost:8000${photo.url}` : photo.url}
                        alt={photo.title || 'Shot'}
                        className="w-28 h-28 object-cover border-r border-slate-850 shrink-0"
                      />
                      <div className="p-4 flex flex-col justify-between min-w-0 flex-1">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-200 text-sm truncate group-hover:text-cyan-400 transition-colors">
                            {photo.title || 'Untitled'}
                          </h4>
                          {photo.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-1 truncate">
                              {photo.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[9px] text-slate-500 gap-2 mt-2">
                          <span className="font-semibold text-cyan-500/80">{displayDate}</span>
                          {photo.camera_model && (
                            <span className="flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              {photo.camera_model.split(' ').slice(-1)[0]}
                            </span>
                          )}
                          {(photo.city || photo.country) && (
                            <span className="flex items-center gap-1 max-w-[100px] truncate">
                              <MapPin className="w-3 h-3" />
                              {photo.city || photo.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
