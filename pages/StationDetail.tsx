import React, { useMemo, useState, useEffect } from 'react';
import { Station, Sensor, Camera, SensorStatus, CameraStatus } from '../types.ts';
import { getStations, getSensors, getCameras, getReadings } from '../services/apiService.ts';
import Card from '../components/common/Card.tsx';
import InteractiveMap from '../components/common/InteractiveMap.tsx';
import Pagination from '../components/common/Pagination.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { ArrowLeftIcon, SensorIcon, CameraIcon, SettingsIcon, ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, OnlineIcon, OfflineIcon, PlayIcon, PhotographIcon, SearchIcon, ExclamationIcon } from '../components/icons/Icons.tsx';

interface StationDetailProps {
  stationId: string;
  onBack: () => void;
  onViewCamera: (cameraId: string) => void;
}

interface SensorReading {
    id: string;
    sensorId: string;
    sensorName: string;
    sensorType: string;
    value: number;
    unit: string;
    timestamp: string;
}

const ITEMS_PER_PAGE_DATA = 10;
const ITEMS_PER_PAGE_SENSORS = 6;
const ITEMS_PER_PAGE_CAMERAS = 4;

const formatTimeAgo = (isoString: string | undefined): string => {
    if (!isoString) return 'bilinmiyor';
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 10) return "az önce";
    if (seconds < 60) return `${seconds} saniye önce`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} dakika önce`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;

    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
};


const statusInfo: Record<string, { text: string, className: string }> = {
    active: { text: 'Aktif', className: 'bg-gray-800 text-white' },
    inactive: { text: 'Pasif', className: 'bg-gray-200 text-gray-700' },
    maintenance: { text: 'Bakımda', className: 'bg-amber-500/20 text-amber-600' },
};

const cameraStatusInfo: Record<CameraStatus, { text: string; className: string; isLive: boolean }> = {
    [CameraStatus.Online]: { text: 'CANLI', className: 'bg-red-600', isLive: true },
    [CameraStatus.Recording]: { text: 'CANLI', className: 'bg-red-600', isLive: true },
    [CameraStatus.Offline]: { text: 'Çevrimdışı', className: 'bg-gray-700', isLive: false },
};

const SensorCard: React.FC<{ sensor: Sensor }> = ({ sensor }) => {
    const getSensorIcon = (type: string) => {
        switch (type) {
            case 'Sıcaklık': return <ThermometerIcon className="w-6 h-6 text-muted" />;
            case 'Nem': return <DropletIcon className="w-6 h-6 text-muted" />;
            case 'Rüzgar Hızı': case 'Rüzgar': return <WindSockIcon className="w-6 h-6 text-muted" />;
            case 'Basınç': return <GaugeIcon className="w-6 h-6 text-muted" />;
            default: return <SensorIcon className="w-5 h-5 text-muted" />;
        }
    };
    const batteryColor = sensor.battery > 20 ? 'text-green-500' : 'text-danger';

    return (
        <Card className="p-4 flex flex-col space-y-3 h-full">
            <div className="flex justify-between items-start">
                 <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 p-2.5 rounded-lg">{getSensorIcon(sensor.type)}</div>
                    <div>
                        <h3 className="font-semibold text-base text-gray-900">{sensor.name}</h3>
                        <p className="text-sm text-muted">{sensor.type}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${sensor.status === SensorStatus.Active ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {sensor.status}
                </span>
            </div>
            <div className="flex-grow text-center !my-4">
                <p className="text-5xl font-bold text-gray-900">{sensor.value}<span className="text-2xl text-muted ml-1">{sensor.unit}</span></p>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                 <div className="flex items-center space-x-1">
                    <span className="font-semibold">{sensor.battery}%</span>
                    <span className={batteryColor}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3.5a1 1 0 00.788 1.84L5 7.11V14.5a1 1 0 001 1h8a1 1 0 001-1V7.11l1.606.414a1 1 0 00.788-1.84l-7-3.5zM3 15.5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>
                    </span>
                 </div>
                <span className="text-muted">{formatTimeAgo(sensor.lastUpdate)}</span>
            </div>
        </Card>
    );
};

const CameraCard: React.FC<{ camera: Camera; onView: (id: string) => void; }> = ({ camera, onView }) => {
    const status = cameraStatusInfo[camera.status];
    return (
         <Card className="p-0 overflow-hidden flex flex-col">
            <div className="relative">
                <img src={`https://picsum.photos/seed/${camera.id}/800/600`} alt={camera.name} className={`w-full h-72 object-cover ${camera.status === CameraStatus.Offline ? 'filter grayscale' : ''}`} />
                <div className="absolute top-3 left-3 flex items-center space-x-2">
                    <span className={`flex items-center space-x-1.5 text-xs px-2 py-1 rounded-md font-semibold text-white ${status.className}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status.isLive ? 'bg-white animate-pulse' : 'bg-white/70'}`}></div>
                        <span>{status.text}</span>
                    </span>
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
                    <h3 className="font-bold text-gray-900">{camera.name}</h3>
                    <p className="text-sm text-muted">{camera.viewDirection}</p>
                </div>
                <button onClick={() => onView(camera.id)} className="flex items-center justify-center gap-1.5 text-accent font-semibold py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors text-sm">
                    <PlayIcon className="w-4 h-4 text-accent" />
                    <span>Canlı İzle</span>
                </button>
            </div>
        </Card>
    );
};

const TabContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="py-6">{children}</div>
);

const StationDetail: React.FC<StationDetailProps> = ({ stationId, onBack, onViewCamera }) => {
  const [station, setStation] = useState<Station | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('Veriler');
  const [dataSearchTerm, setDataSearchTerm] = useState('');
  const [dataPage, setDataPage] = useState(1);
  const [sensorPage, setSensorPage] = useState(1);
  const [cameraPage, setCameraPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const [stationsData, sensorsData, camerasData, readingsData] = await Promise.all([
                getStations(), getSensors(), getCameras(), getReadings()
            ]);
            
            const currentStation = stationsData.find(s => s.id === stationId);
            if (currentStation) {
                setStation(currentStation);
                const stationSensors = sensorsData.filter(s => s.stationId === stationId);
                setSensors(stationSensors);
                setCameras(camerasData.filter(c => c.stationId === stationId));
                setReadings(readingsData.filter(r => r.stationId === stationId));
            } else {
                throw new Error("İstasyon bulunamadı");
            }

        } catch (err) {
            setError('İstasyon detayları yüklenirken bir hata oluştu.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [stationId]);
  
  const filteredSensorReadings = useMemo(() =>
    readings.filter(reading =>
      reading.sensorName.toLowerCase().includes(dataSearchTerm.toLowerCase()) ||
      reading.sensorType.toLowerCase().includes(dataSearchTerm.toLowerCase())
    ), [readings, dataSearchTerm]);

  const paginatedSensorReadings = useMemo(() => {
    const startIndex = (dataPage - 1) * ITEMS_PER_PAGE_DATA;
    return filteredSensorReadings.slice(startIndex, startIndex + ITEMS_PER_PAGE_DATA);
  }, [filteredSensorReadings, dataPage]);

  const paginatedSensors = useMemo(() => {
    const startIndex = (sensorPage - 1) * ITEMS_PER_PAGE_SENSORS;
    return sensors.slice(startIndex, startIndex + ITEMS_PER_PAGE_SENSORS);
  }, [sensors, sensorPage]);

  const paginatedCameras = useMemo(() => {
    const startIndex = (cameraPage - 1) * ITEMS_PER_PAGE_CAMERAS;
    return cameras.slice(startIndex, startIndex + ITEMS_PER_PAGE_CAMERAS);
  }, [cameras, cameraPage]);
  
  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-12 w-1/2" />
            <Card className="p-0"><Skeleton className="h-[600px] w-full" /></Card>
        </div>
    );
  }

  if (error || !station) {
    return (
      <div className="text-center py-10">
        <ExclamationIcon className="w-12 h-12 mx-auto mb-2 text-danger"/>
        <h2 className="text-xl font-semibold text-danger">{error || 'İstasyon Bulunamadı'}</h2>
        <p className="text-muted">Seçilen istasyon mevcut değil veya bir hata oluştu.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-accent text-white rounded-md">Geri Dön</button>
      </div>
    );
  }

  const stationStatus = statusInfo[station.status];
  const TABS = ['Veriler', 'Sensörler', 'Kameralar', 'Konum'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0">
                <ArrowLeftIcon />
            </button>
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{station.name}</h1>
                     <span className={`px-3 py-1 text-xs font-semibold rounded-full ${stationStatus.className}`}>{stationStatus.text}</span>
                </div>
                <p className="text-muted leading-tight mt-1">İstasyon detayları ve cihaz bilgileri</p>
            </div>
        </div>
         <div className="flex items-center space-x-2 self-end sm:self-center">
             <button 
                onClick={() => alert('Ayarlar özelliği yakında eklenecektir!')}
                className="flex items-center justify-center gap-2 bg-primary border border-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                <SettingsIcon className="w-5 h-5" />
                <span>Ayarlar</span>
            </button>
        </div>
      </div>

      {/* Tabs */}
      <Card className="p-0">
         <div className="px-4 border-b border-gray-200">
            <nav className="flex -mb-px space-x-6">
                 {TABS.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
                        activeTab === tab 
                        ? 'border-b-2 border-accent text-accent' 
                        : 'border-b-2 border-transparent text-muted hover:text-accent'
                      }`}
                    >
                      {tab}
                    </button>
                ))}
            </nav>
         </div>
        
         <div className="p-4">
            {activeTab === 'Veriler' && (
                <TabContent>
                    <div className="relative w-full md:w-1/3 mb-4">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                        <input 
                            type="text" 
                            placeholder="Sensör adı veya tipine göre filtrele..." 
                            className="w-full bg-secondary border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                            value={dataSearchTerm}
                            onChange={e => {
                                setDataSearchTerm(e.target.value);
                                setDataPage(1); // Reset page on search
                            }}
                        />
                    </div>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                          <tr>
                            <th scope="col" className="px-6 py-3">Zaman Damgası</th>
                            <th scope="col" className="px-6 py-3">Sensör Adı</th>
                            <th scope="col" className="px-6 py-3">Sensör Tipi</th>
                            <th scope="col" className="px-6 py-3 text-right">Değer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSensorReadings.map(reading => (
                            <tr key={reading.id} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-6 py-4 font-mono text-gray-800">{reading.timestamp}</td>
                              <td className="px-6 py-4 font-medium text-gray-900">{reading.sensorName}</td>
                              <td className="px-6 py-4">{reading.sensorType}</td>
                              <td className="px-6 py-4 text-right font-semibold text-gray-900">{`${reading.value} ${reading.unit || ''}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredSensorReadings.length > 0 ? (
                        <Pagination 
                            currentPage={dataPage}
                            totalPages={Math.ceil(filteredSensorReadings.length / ITEMS_PER_PAGE_DATA)}
                            onPageChange={setDataPage}
                        />
                    ) : (
                        <div className="text-center py-8 text-muted border border-t-0 rounded-b-lg border-gray-200">
                            <p>Bu istasyona ait veri bulunamadı veya filtre ile eşleşmedi.</p>
                        </div>
                    )}
                </TabContent>
            )}
            {activeTab === 'Sensörler' && (
                <TabContent>
                    {sensors.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paginatedSensors.map(sensor => <SensorCard key={sensor.id} sensor={sensor} />)}
                            </div>
                            <Pagination 
                                currentPage={sensorPage}
                                totalPages={Math.ceil(sensors.length / ITEMS_PER_PAGE_SENSORS)}
                                onPageChange={setSensorPage}
                            />
                        </>
                    ) : (
                        <p className="text-muted text-center py-4">Bu istasyona bağlı sensör bulunmamaktadır.</p>
                    )}
                </TabContent>
            )}
            {activeTab === 'Kameralar' && (
                <TabContent>
                    {cameras.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {paginatedCameras.map(camera => <CameraCard key={camera.id} camera={camera} onView={onViewCamera} />)}
                            </div>
                             <Pagination 
                                currentPage={cameraPage}
                                totalPages={Math.ceil(cameras.length / ITEMS_PER_PAGE_CAMERAS)}
                                onPageChange={setCameraPage}
                            />
                        </>
                    ) : (
                        <p className="text-muted text-center py-4">Bu istasyona bağlı kamera bulunmamaktadır.</p>
                    )}
                </TabContent>
            )}
            {activeTab === 'Konum' && (
                 <TabContent>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 text-sm">
                        <div>
                            <p className="text-xs text-muted">Koordinatlar</p>
                            <p className="font-semibold text-gray-800 font-mono">{`${station.locationCoords.lat}° K, ${station.locationCoords.lng}° D`}</p>
                        </div>
                         <div>
                            <p className="text-xs text-muted text-right">Son Güncelleme</p>
                            <p className="font-semibold text-gray-800">{formatTimeAgo(station.lastUpdate)}</p>
                        </div>
                    </div>
                    <div className="h-[500px] rounded-lg overflow-hidden">
                        <InteractiveMap 
                            lat={station.locationCoords.lat}
                            lng={station.locationCoords.lng}
                            zoom={14}
                            stationName={station.name}
                            statusText={stationStatus.text}
                            statusClassName={stationStatus.className}
                            lastUpdate={formatTimeAgo(station.lastUpdate)}
                        />
                    </div>
                </TabContent>
            )}
         </div>
      </Card>
    </div>
  );
};

export default StationDetail;