import React, { useMemo, useState, useEffect } from 'react';
import { Camera, CameraStatus, Station } from '../types';
import { getCameras } from '../services/apiService';
import { getStations } from '../services/apiService';
import Card from '../components/common/Card';
import Skeleton from '../components/common/Skeleton';
import { ArrowLeftIcon, CameraIcon as VideoIcon, PlayIcon, FullscreenIcon, PhotographIcon, ExclamationIcon } from '../components/icons/Icons';

interface CameraDetailProps {
  cameraId: string;
  onBack: () => void;
}

const CameraDetail: React.FC<CameraDetailProps> = ({ cameraId, onBack }) => {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const [camerasData, stationsData] = await Promise.all([getCameras(), getStations()]);
            const currentCamera = camerasData.find(c => c.id === cameraId);
            if (currentCamera) {
                const currentStation = stationsData.find(s => s.id === currentCamera.stationId);
                setCamera(currentCamera);
                setStation(currentStation || null);
            } else {
                 throw new Error("Kamera bulunamadı");
            }
        } catch (err) {
            setError('Kamera detayları yüklenirken bir hata oluştu.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [cameraId]);


  if (isLoading) {
      return (
          <div className="max-w-5xl mx-auto space-y-4">
              <Skeleton className="h-8 w-24" />
              <Card className="p-0 overflow-hidden shadow-2xl">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="aspect-video w-full" />
                  <Skeleton className="h-20 w-full" />
              </Card>
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
    <div className="max-w-5xl mx-auto space-y-4">
       <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-gray-900 transition-colors">
            <ArrowLeftIcon />
            <span>Geri Dön</span>
        </button>

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
            <div className="relative bg-gray-800 aspect-video w-full flex items-center justify-center">
                {camera.status !== CameraStatus.Offline ? (
                    <video
                        key={camera.streamUrl}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
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
                 <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                    <FullscreenIcon className="w-5 h-5" />
                    <span>Tam Ekran</span>
                </button>
                <button className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-accent border border-accent rounded-lg hover:bg-orange-600 transition-colors shadow-sm">
                    <PhotographIcon className="w-5 h-5" />
                    <span>Fotoğraf Çek</span>
                </button>
            </div>
        </Card>
    </div>
  );
};

export default CameraDetail;
