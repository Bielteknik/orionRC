import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Station, CameraStatus } from '../types';
import { getCameras, getStations } from '../services/apiService';
import Card from '../components/common/Card';
import { AddIcon, SearchIcon, PlayIcon, CameraIcon } from '../components/icons/Icons';
import AddCameraDrawer from '../components/AddCameraDrawer';
import Skeleton from '../components/common/Skeleton';
import Pagination from '../components/common/Pagination';

const ITEMS_PER_PAGE = 6;

const cameraStatusInfo: Record<CameraStatus, { text: string; className: string; isLive: boolean }> = {
    [CameraStatus.Online]: { text: 'CANLI', className: 'bg-red-600', isLive: true },
    [CameraStatus.Recording]: { text: 'KAYITTA', className: 'bg-blue-600', isLive: true },
    [CameraStatus.Offline]: { text: 'Çevrimdışı', className: 'bg-gray-700', isLive: false },
};

const CameraCard: React.FC<{ camera: Camera, stationName: string, onViewDetails: (id: string) => void }> = ({ camera, stationName, onViewDetails }) => {
    const status = cameraStatusInfo[camera.status];
    return (
         <Card className="p-0 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="relative">
                <img src={`https://picsum.photos/seed/${camera.id}/400/300`} alt={camera.name} className={`w-full h-48 object-cover ${!status.isLive ? 'filter grayscale' : ''}`} />
                <div className="absolute top-3 left-3 flex items-center space-x-2">
                    <span className={`flex items-center space-x-1.5 text-xs px-2 py-1 rounded-md font-semibold text-white ${status.className}`}>
                        {status.isLive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                        <span>{status.text}</span>
                    </span>
                </div>
                 {!status.isLive && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <p className="text-white font-semibold">Görüntü Alınamıyor</p>
                  </div>
                )}
            </div>
            <div className="p-4 flex-grow flex flex-col">
                <h3 className="font-bold text-gray-900 dark:text-white">{camera.name}</h3>
                <p className="text-sm text-muted dark:text-gray-400">{stationName}</p>
                <p className="text-xs text-muted dark:text-gray-400 mt-1">{camera.cameraType}</p>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 mt-auto p-3 bg-gray-50 dark:bg-gray-700/50 flex justify-end">
                <button onClick={() => onViewDetails(camera.id)} className="flex items-center justify-center gap-1.5 text-accent font-semibold py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors text-sm">
                    <PlayIcon className="w-4 h-4 text-accent" />
                    <span>İzle</span>
                </button>
            </div>
        </Card>
    );
};


const Cameras: React.FC<{ onViewDetails: (cameraId: string) => void }> = ({ onViewDetails }) => {
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [camerasData, stationsData] = await Promise.all([getCameras(), getStations()]);
                setCameras(camerasData);
                setStations(stationsData);
            } catch (err) {
                setError('Kamera verileri yüklenemedi.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const filteredCameras = useMemo(() => {
        return cameras.filter(camera =>
            camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (stationMap.get(camera.stationId) || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [cameras, searchTerm, stationMap]);
    
    const paginatedCameras = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredCameras.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredCameras, currentPage]);

    const handleSaveCamera = (newCameraData: Omit<Camera, 'id' | 'photos' | 'fps' | 'streamUrl'>) => {
        const newCamera: Camera = {
            id: `CAM${Date.now()}`,
            ...newCameraData,
            streamUrl: '',
            fps: 30,
            photos: [],
        };
        setCameras(prev => [newCamera, ...prev]);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-1/3">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted dark:text-gray-400" />
                    <input
                        type="text"
                        placeholder="Kamera veya istasyon ara..."
                        className="w-full bg-primary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={() => setIsDrawerOpen(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors">
                    <AddIcon className="w-5 h-5" />
                    <span className="font-semibold">Yeni Kamera Ekle</span>
                </button>
            </div>
            
            {isLoading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
                 </div>
            ) : error ? (
                <Card><p className="text-center text-danger">{error}</p></Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedCameras.map(camera => (
                            <CameraCard 
                                key={camera.id} 
                                camera={camera} 
                                stationName={stationMap.get(camera.stationId) || 'Atanmamış'}
                                onViewDetails={onViewDetails} 
                            />
                        ))}
                    </div>
                     {filteredCameras.length === 0 && (
                        <Card>
                            <p className="text-center text-muted dark:text-gray-400 py-8">Kamera bulunamadı.</p>
                        </Card>
                    )}
                    {filteredCameras.length > ITEMS_PER_PAGE && (
                         <Pagination 
                            currentPage={currentPage}
                            totalPages={Math.ceil(filteredCameras.length / ITEMS_PER_PAGE)}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </>
            )}
            
            <AddCameraDrawer 
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSave={handleSaveCamera}
                stations={stations}
            />
        </div>
    );
};

export default Cameras;
