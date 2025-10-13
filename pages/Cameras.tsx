import React, { useState, useMemo, useEffect } from 'react';
import { Camera, CameraStatus } from '../types';
import Card from '../components/common/Card';
import { AddIcon, FilterIcon, SearchIcon, PlayIcon, ListIcon, GridIcon } from '../components/icons/Icons';
import AddCameraDrawer from '../components/AddCameraDrawer';
import { MOCK_STATIONS } from './Stations';
import Skeleton from '../components/common/Skeleton';

export const MOCK_CAMERAS: Camera[] = [
    { id: 'cam1', name: 'Kuzey Kamera', stationId: 'STN01', status: CameraStatus.Online, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', viewDirection: 'Kuzey Yönü', fps: 30, photos: ['https://picsum.photos/seed/p1/200/150','https://picsum.photos/seed/p2/200/150','https://picsum.photos/seed/p3/200/150'], rtspUrl: 'rtsp://192.168.1.10/stream1', cameraType: 'Sabit Dome Kamera' },
    { id: 'cam2', name: 'Güney Kamera', stationId: 'STN01', status: CameraStatus.Recording, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', viewDirection: 'Güney Yönü', fps: 30, photos: ['https://picsum.photos/seed/p4/200/150','https://picsum.photos/seed/p5/200/150'], rtspUrl: 'rtsp://192.168.1.11/stream1', cameraType: 'PTZ Kamera' },
    { id: 'cam3', name: 'İstasyon C - Çatı', stationId: 'STN03', status: CameraStatus.Online, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', viewDirection: 'Çatı', fps: 25, photos: [], rtspUrl: 'rtsp://192.168.1.12/stream1', cameraType: 'Geniş Açılı Kamera' },
    { id: 'cam4', name: 'İstasyon B - Doğu Cephe', stationId: 'STN02', status: CameraStatus.Offline, streamUrl: 'https://picsum.photos/seed/cam4/800/600', viewDirection: 'Doğu Cephe', fps: 0, photos: [], rtspUrl: 'rtsp://192.168.1.13/stream1', cameraType: 'Termal Kamera' },
    { id: 'cam5', name: 'Depo Alanı', stationId: 'STN02', status: CameraStatus.Online, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', viewDirection: 'İç Mekan', fps: 30, photos: [], rtspUrl: 'rtsp://192.168.1.14/stream1', cameraType: 'Sabit Dome Kamera' },
];

const MosaicView: React.FC<{ cameras: Camera[], onViewDetails: (id: string) => void }> = ({ cameras, onViewDetails }) => {
    const onlineCameras = cameras.filter(c => c.status !== CameraStatus.Offline);
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {onlineCameras.map(camera => (
                <div key={camera.id} className="bg-black rounded-lg overflow-hidden aspect-video flex flex-col relative group">
                    <video
                        key={camera.streamUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                        poster={`https://picsum.photos/seed/${camera.id}/800/600`}
                    >
                        <source src={camera.streamUrl} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                        <h4 className="font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{camera.name}</h4>
                        <button onClick={() => onViewDetails(camera.id)} className="text-xs text-accent font-semibold hover:underline self-start">Tam Ekran</button>
                    </div>
                </div>
            ))}
        </div>
    );
};


interface CamerasProps {
    onViewDetails: (cameraId: string) => void;
}

const Cameras: React.FC<CamerasProps> = ({ onViewDetails }) => {
    const [cameras, setCameras] = useState<Camera[]>(MOCK_CAMERAS);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<CameraStatus | 'all'>('all');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'mosaic'>('list');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 750);
        return () => clearTimeout(timer);
    }, []);

    const filteredCameras = useMemo(() => {
    return cameras
      .filter(camera => statusFilter === 'all' || camera.status === statusFilter)
      .filter(camera => 
        camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        MOCK_STATIONS.find(s => s.id === camera.stationId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }, [cameras, searchTerm, statusFilter]);

    const handleSaveCamera = (newCameraData: Omit<Camera, 'id' | 'photos' | 'fps' | 'streamUrl'>) => {
        const newCamera: Camera = {
            id: `cam${Date.now()}`,
            ...newCameraData,
            streamUrl: `https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4`,
            photos: [],
            fps: newCameraData.status === CameraStatus.Online ? 30 : 0,
        };
        setCameras(prev => [newCamera, ...prev]);
    };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-1/3">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
            <input 
              type="text" 
              placeholder="Kamera veya istasyon ara..." 
              className="w-full bg-secondary border border-gray-300 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="bg-gray-200 p-1 rounded-lg flex">
                <button onClick={() => setViewMode('list')} className={`px-2.5 py-1 rounded-md text-sm font-semibold flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white shadow-sm text-accent' : 'text-muted'}`}><ListIcon className="w-4 h-4"/> Liste</button>
                <button onClick={() => setViewMode('mosaic')} className={`px-2.5 py-1 rounded-md text-sm font-semibold flex items-center gap-1.5 ${viewMode === 'mosaic' ? 'bg-white shadow-sm text-accent' : 'text-muted'}`}><GridIcon className="w-4 h-4"/> Mozaik</button>
            </div>
            <select 
                className="w-full md:w-auto bg-secondary border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as CameraStatus | 'all')}
              >
                <option value="all">Tüm Durumlar</option>
                {Object.values(CameraStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
            </select>
            <button 
                onClick={() => setIsDrawerOpen(true)}
                className="flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors w-full md:w-auto">
              <AddIcon className="w-5 h-5"/>
              <span className="font-semibold text-sm">Yeni Ekle</span>
            </button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-96 rounded-xl"/>)}
        </div>
      ) : viewMode === 'mosaic' ? (
        <MosaicView cameras={filteredCameras} onViewDetails={onViewDetails} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCameras.map(camera => (
               <div key={camera.id} className="rounded-xl overflow-hidden shadow-lg bg-primary flex flex-col border border-gray-200">
                <div className="relative">
                  <img 
                    src={`https://picsum.photos/seed/${camera.id}/800/600`} 
                    alt={camera.name} 
                    className={`w-full h-72 object-cover ${camera.status === CameraStatus.Offline ? 'filter grayscale' : ''}`} 
                  />
                  <div className="absolute top-3 left-3 flex items-center space-x-2">
                     {camera.status === CameraStatus.Offline ? (
                        <span className="flex items-center space-x-1.5 text-xs px-2 py-1 rounded-md font-semibold text-white bg-gray-700">
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
                            <span>Çevrimdışı</span>
                        </span>
                    ) : (
                        <span className="flex items-center space-x-1.5 text-xs px-2 py-1 rounded-md font-semibold text-white bg-red-600">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                            <span>CANLI</span>
                        </span>
                    )}
                     <span className="text-xs px-2 py-1 rounded-md font-semibold text-white bg-black/50">{camera.fps} FPS</span>
                  </div>
                   {camera.status === CameraStatus.Offline && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <p className="text-white font-semibold">Görüntü Alınamıyor</p>
                      </div>
                    )}
                </div>
                <div className="p-4 flex justify-between items-center border-t border-gray-200">
                  <div>
                    <h4 className="font-bold text-gray-900">{camera.name}</h4>
                    <p className="text-sm text-muted">{camera.viewDirection}</p>
                  </div>
                   <button 
                    onClick={() => onViewDetails(camera.id)}
                    className="flex items-center justify-center gap-1.5 text-accent font-semibold py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors text-sm">
                      <PlayIcon className="w-4 h-4 text-accent" />
                      <span>Canlı İzle</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
      {filteredCameras.length === 0 && !isLoading && (
            <div className="md:col-span-2 lg:col-span-3 text-center py-16">
                 <Card>
                    <p className="text-muted">Arama kriterlerinize uygun kamera bulunamadı.</p>
                </Card>
            </div>
        )}
      <AddCameraDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSaveCamera}
        stations={MOCK_STATIONS}
      />
    </div>
  );
};

export default Cameras;