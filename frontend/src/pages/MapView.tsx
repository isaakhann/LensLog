import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Map as MapIcon, 
  Loader2, 
  Maximize2,
  FolderOpen,
  X
} from 'lucide-react';
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
  tags: string[];
}

interface PhotoListResponse {
  photos: Photo[];
  total: number;
}

export const MapView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // URL parameters for center mapping
  const paramLat = searchParams.get('lat');
  const paramLng = searchParams.get('lng');

  // Fetch photos
  const { data, isLoading } = useQuery<PhotoListResponse>({
    queryKey: ['photos-map'],
    queryFn: () => api.get<PhotoListResponse>('/photos/?page=1&page_size=100')
  });

  const geoPhotos = data?.photos.filter(p => p.latitude !== null && p.longitude !== null) || [];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = paramLat ? parseFloat(paramLat) : 20;
    const initialLng = paramLng ? parseFloat(paramLng) : 0;
    const initialZoom = paramLat && paramLng ? 12 : 2;

    // Create Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false // Custom placement below
    });

    // Add Zoom Control to Top Right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add Premium Dark Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapRef.current = map;

    // Create a ResizeObserver to handle container size changes (e.g. during flex rendering / animations)
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers when photos load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || geoPhotos.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers
    geoPhotos.forEach(photo => {
      const lat = photo.latitude!;
      const lng = photo.longitude!;

      // Custom HTML Div Icon for Leaflet
      const imgUrl = photo.url.startsWith('/') ? `http://localhost:8000${photo.url}` : photo.url;
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="relative w-10 h-10 flex items-center justify-center group">
            <div class="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping group-hover:bg-cyan-400/30"></div>
            <div class="w-8 h-8 rounded-full border-2 border-cyan-400 bg-slate-900 overflow-hidden shadow-lg shadow-cyan-500/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-white">
              <img src="${imgUrl}" class="w-full h-full object-cover" />
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .on('click', () => {
          setSelectedPhoto(photo);
          map.setView([lat, lng], 13);
        });

      markersRef.current.push(marker);
    });
  }, [geoPhotos]);

  // Fly to specified coordinates if URL query params change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !paramLat || !paramLng) return;

    map.setView([parseFloat(paramLat), parseFloat(paramLng)], 14);
  }, [paramLat, paramLng]);

  const handleFlyTo = (photo: Photo) => {
    if (!mapRef.current || photo.latitude === null || photo.longitude === null) return;
    setSelectedPhoto(photo);
    mapRef.current.setView([photo.latitude, photo.longitude], 13);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm">Initializing geolocation engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-[80vh] flex flex-col animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent text-left">
            Interactive Journey Map
          </h1>
          <p className="text-slate-400 text-sm mt-1 text-left">
            Trace your steps and view your photographs geolocated across the globe.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Map canvas */}
        <div className="flex-1 relative rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-950 min-h-[40vh] lg:min-h-0 z-10">
          <div className="absolute inset-0 w-full h-full">
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>
          
          {/* Pop-up Overlay preview */}
          {selectedPhoto && (
            <div className="absolute bottom-6 left-6 right-6 sm:left-6 sm:right-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex gap-4 items-center max-w-sm shadow-2xl animate-in slide-in-from-bottom duration-300 z-50">
              <img
                src={selectedPhoto.url.startsWith('/') ? `http://localhost:8000${selectedPhoto.url}` : selectedPhoto.url}
                alt={selectedPhoto.title || 'Shot'}
                className="w-16 h-16 object-cover rounded-xl border border-slate-850"
              />
              <div className="flex-1 min-w-0 text-left">
                <h4 className="text-xs font-bold text-slate-100 truncate">{selectedPhoto.title || 'Untitled'}</h4>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{selectedPhoto.city || selectedPhoto.country || 'Coordinates Tagged'}</p>
                <button
                  onClick={() => navigate(`/photo/${selectedPhoto.id}`)}
                  className="text-[10px] text-cyan-400 font-bold hover:underline flex items-center gap-1 mt-2"
                >
                  View journal details
                  <Maximize2 className="w-2.5 h-2.5" />
                </button>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-350 self-start"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar photo list */}
        <div className="w-full lg:w-80 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex flex-col gap-4 overflow-hidden h-[40vh] lg:h-auto">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2 shrink-0">
            <MapIcon className="w-4 h-4 text-cyan-400" />
            <span>Geo-tagged Photos ({geoPhotos.length})</span>
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {geoPhotos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <FolderOpen className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">No photos have GPS coordinates in their metadata.</p>
                <Link to="/upload" className="text-[11px] text-cyan-400 font-bold hover:underline mt-2">
                  Upload a geolocated photo
                </Link>
              </div>
            ) : (
              geoPhotos.map(photo => (
                <div
                  key={photo.id}
                  onClick={() => handleFlyTo(photo)}
                  className={`flex gap-3 p-2.5 rounded-xl border cursor-pointer text-left transition-all ${
                    selectedPhoto?.id === photo.id
                      ? 'bg-slate-800/80 border-cyan-500/40 text-cyan-400'
                      : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <img
                    src={photo.url.startsWith('/') ? `http://localhost:8000${photo.url}` : photo.url}
                    alt={photo.title || 'Shot'}
                    className="w-12 h-12 object-cover rounded-lg border border-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold truncate">{photo.title || 'Untitled'}</h4>
                    <p className="text-[9px] text-slate-505 mt-1 truncate">
                      {photo.city || photo.country || `${photo.latitude?.toFixed(4)}, ${photo.longitude?.toFixed(4)}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
