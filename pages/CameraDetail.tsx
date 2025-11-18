
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Camera, CameraStatus, Station } from '../types.ts';
import { getCameras, getStations, captureCameraImage } from '../services/apiService.ts';
import Card from '../components/common/Card.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { ArrowLeftIcon, CameraIcon as VideoIcon, PlayIcon, FullscreenIcon, PhotographIcon, ExclamationIcon, DownloadIcon, CalendarIcon } from '../components/icons/Icons.tsx';

interface CameraDetailProps {
  cameraId: string;
  onBack: () => void;
}

const CameraDetail: React.FC<CameraDetailProps> = ({ cameraId, onBack }) => {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [photoDateFilter, setPhotoDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const pollingIntervalRef = useRef<number | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = async (isPolling = false) => {
    if (!isPolling) setIsLoading(true);
    try {
        setError(null);
        const [camerasData, stationsData] = await Promise.all([getCameras(), getStations()]);
        const currentCamera = camerasData.find(c => c.id === cameraId);
        if (currentCamera) {
            const currentStation = stationsData.find(s => s.id === currentCamera.stationId);
            setCamera(currentCamera);
            setStation(currentStation || null);

            // If polling, check if a new photo has arrived
            if (isPolling && camera && currentCamera.photos.length > camera.photos.length) {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                setIsCapturing(false);
            }

        } else {
             throw new Error("Kamera bulunamadı");
        }
    } catch (err) {
        setError('Kamera detayları yüklenirken bir hata oluştu.');
        console.error(err);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setIsCapturing(false);
    } finally {
        if (!isPolling) setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
    return () => { // Cleanup on unmount
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [cameraId]);
  
  const filteredPhotos = useMemo(() => {
    if (!camera?.photos) return [];
    if (!photoDateFilter) return camera.photos;
    
    return camera.photos.filter(photoUrl => {
        const filename = photoUrl.split('/').pop() || '';
        // Removed ^ anchor to match date anywhere in filename
        const datePartMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
        if (datePartMatch) {
            return datePartMatch[1] === photoDateFilter;
        }
        return false;
    });
  }, [camera, photoDateFilter]);

  const handleCapture = async () => {
    if (!camera) return;
    setIsCapturing(true);
    try {
        await captureCameraImage(camera.id);
        // Start polling for the new image
        pollingIntervalRef.current = window.setInterval(() => {
            fetchData(true);
        }, 3000); // Poll every 3 seconds
        // Set a timeout to stop polling after a while
        setTimeout(() => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                if (isCapturing) {
                    setIsCapturing(false);
                    alert("Fotoğraf yakalama zaman aşımına uğradı. Lütfen agent'ın çalıştığından ve bağlı olduğundan emin olun.");
                }
            }
        }, 60000); // 1 minute timeout
    } catch (error) {
        console.error("Failed to initiate capture:", error);
        alert("Fotoğraf çekme komutu gönderilemedi.");
        setIsCapturing(false);
    }
  };

  const handleFullscreen = () => {
    const videoElement = videoContainerRef.current;
    if (!videoElement) return;

    if (!document.fullscreenElement) {
        videoElement.requestFullscreen().catch(err => {
            alert(`Tam ekran modu etkinleştirilemedi: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
  };


  if (isLoading) {
      return (
          <div className="max-w-7xl mx-auto space-y-4">
              <Skeleton className="h-8 w-24" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Skeleton className="h-[600px] w-full" />
                </div>
                <div className="lg:col-span-1">
                     <Skeleton className="h-[600px] w-full" />
                </div>
              </div>
          </div>
      )
  }

  if (error || !camera || !station) {
    return (
      <div className="text-center py-10">
        <ExclamationIcon className="w-12 h-12 mx-auto mb-2 text-danger"/>
        <h2 className="text-xl font-semibold text-danger">{error || 'Kamera Bulunamadı'}</h2>
        <p className="text-muted">Seçilen kamera mevcut değil veya bir hata oluştu.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-accent text-white rounded-md">Geri Dön</button>
      </div>
    );
  }
  
  const statusInfo = {
    [CameraStatus.Online]: { text: 'Canlı', className: 'bg-success text-white' },
    [CameraStatus.Offline]: { text: 'Çevrimdışı', className: 'bg-danger text-white' },
    [CameraStatus.Recording]: { text: 'Kaydediyor', className: 'bg-blue-600 text-white' },
  };

  const currentStatus = statusInfo[camera.status] || statusInfo[CameraStatus.Offline];


  return (
    <div className="max-w-7xl mx-auto space-y-4">
       <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-gray-900 transition-colors">
            <ArrowLeftIcon />
            <span>Geri Dön</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
                <Card className="p-0 overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-3 bg-white border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <VideoIcon className="w-6 h-6 text-accent" />
                            <h2 className="text-xl font-bold text-gray-800">{station.name} - {camera.name}</h2>
                        </div>
                        {camera.status !== CameraStatus.Offline && (
                            <span className={`px-3 py-1 text-sm font-semibold rounded-md flex items-center gap-1.5 ${currentStatus.className}`}>
                                <PlayIcon className="w-3 h-3"/>
                                {currentStatus.text}
                            </span>
                        )}
                    </div>

                    {/* Video Player */}
                    <div ref={videoContainerRef} className="relative bg-gray-800 aspect-video w-full flex items-center justify-center">
                        {camera.status !== CameraStatus.Offline ? (
                            <video
                                key={camera.streamUrl}
                                className="w-full h-full object-contain"
                                controls
                                autoPlay
                                muted
                                loop
                                poster={`https://picsum.photos/seed/${camera.id}/800/600`}
                            >
                                <source src={camera.streamUrl} type="video/mp4" />
                                Tarayıcınız video etiketini desteklemiyor.
                            </video>
                        ) : (
                            <>
                                <img src={`https://picsum.photos/seed/${camera.id}/800/600`} alt="Offline Camera" className="w-full h-full object-contain filter grayscale" />
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                                    <p className="text-white text-lg font-semibold">Kamera Çevrimdışı</p>
                                    <p className="text-gray-400">Canlı yayın başlatılamıyor.</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center items-center gap-4 p-4 bg-gray-50 border-t border-gray-200">
                        <button onClick={handleFullscreen} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                            <FullscreenIcon className="w-5 h-5" />
                            <span>Tam Ekran</span>
                        </button>
                        <button 
                            onClick={handleCapture}
                            disabled={isCapturing || camera.status === CameraStatus.Offline}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-accent border border-accent rounded-lg hover:bg-orange-600 transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isCapturing ? (
                                <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Yakalanıyor...</span>
                                </>
                            ) : (
                                <>
                                    <PhotographIcon className="w-5 h-5" />
                                    <span>Fotoğraf Çek</span>
                                </>
                            )}
                        </button>
                    </div>
                </Card>
            </div>
            
            <div className="lg:col-span-1">
                <Card className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold">Yakalanan Görüntüler ({filteredPhotos.length})</h3>
                        <div className="relative flex items-center gap-2 bg-secondary border border-gray-300 rounded-lg px-2 py-1">
                            <CalendarIcon className="w-4 h-4 text-muted"/>
                            <input 
                                type="date" 
                                value={photoDateFilter}
                                onChange={e => setPhotoDateFilter(e.target.value)}
                                className="bg-transparent text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>
                    {filteredPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-1 pr-2">
                            {filteredPhotos.map((photo, index) => (
                                <div key={index} className="group relative rounded-lg overflow-hidden border border-gray-200 aspect-w-4 aspect-h-3">
                                    <img src={photo} alt={`Yakalanan görüntü ${index + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                                        <a href={photo} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white text-xs bg-black/60 px-2 py-1 rounded-md hover:bg-black/80">
                                            <DownloadIcon className="w-4 h-4" />
                                            İndir
                                        </a>
                                        <p className="text-white/80 text-xs text-center mt-2 font-mono break-all">{photo.split('/').pop()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted border border-dashed rounded-lg">
                             <PhotographIcon className="w-10 h-10 text-gray-300 mb-2"/>
                             <p>Bu tarih için kayıtlı görüntü yok.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    </div>
  );
};

export default CameraDetail;
