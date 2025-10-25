import React, { useMemo, useState, useEffect } from 'react';
import { Station, Sensor, Camera, SensorStatus, CameraStatus } from '../types.ts';
import { getStations, getSensors, getCameras, getReadings } from '../services/apiService.ts';
import Card from '../components/common/Card.tsx';
import InteractiveMap from '../components/common/InteractiveMap.tsx';
import Pagination from '../components/common/Pagination.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { ArrowLeftIcon, SensorIcon, CameraIcon, SettingsIcon, ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, OnlineIcon, OfflineIcon, PlayIcon, PhotographIcon, SearchIcon, ExclamationIcon, DownloadIcon, CalendarIcon } from '../components/icons/Icons.tsx';
import SensorDetailModal from '../components/SensorDetailModal.tsx'; // Import the new modal

interface StationDetailProps {
  stationId: string;
  onBack: () => void;
  onViewCamera: (cameraId: string) => void;
}

// Define a more specific type for readings from the API
interface SensorReading {
    id: string;
    sensorId: string;
    sensorName: string;
    sensorType: string;
    value: any; // Can be object or primitive
    unit: string;
    timestamp: string;
    interface?: string; // Sensor interface type, now provided by API
}

const ITEMS_PER_PAGE_DATA = 10;
const ITEMS_PER_PAGE_SENSORS = 6;

const formatTimeAgo = (isoString: string | undefined): string => {
    if (!isoString) return 'bilinmiyor';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'geçersiz tarih';
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

const SensorCard: React.FC<{ sensor: Sensor, onClick: () => void }> = ({ sensor, onClick }) => {
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

    const statusStyles: Record<SensorStatus, string> = {
        [SensorStatus.Active]: 'bg-success/10 text-success',
        [SensorStatus.Inactive]: 'bg-gray-200 text-gray-600',
        [SensorStatus.Error]: 'bg-danger/10 text-danger',
        [SensorStatus.Maintenance]: 'bg-warning/10 text-warning',
    };

    const displayValue = useMemo(() => {
        if (sensor.value === null || sensor.value === undefined) return 'N/A';

        if (typeof sensor.value === 'object') {
             // Handle OpenWeather sensors which return a combined object
            if (sensor.interface === 'openweather') {
                if (sensor.type === 'Sıcaklık' && sensor.value.temperature !== undefined) {
                    return sensor.value.temperature;
                }
                if (sensor.type === 'Nem' && sensor.value.humidity !== undefined) {
                    return sensor.value.humidity;
                }
            }
            // Fallback for other complex objects (like snow depth)
            const numericValue = Object.values(sensor.value).find(v => typeof v === 'number');
            return numericValue !== undefined ? numericValue : 'N/A';
        }

        return sensor.value;
    }, [sensor]);

    return (
        <Card className="p-4 flex flex-col space-y-3 h-full cursor-pointer hover:shadow-md hover:border-accent transition-all" onClick={onClick}>
            <div className="flex justify-between items-start">
                 <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 p-2.5 rounded-lg">{getSensorIcon(sensor.type)}</div>
                    <div>
                        <h3 className="font-semibold text-base text-gray-900">{sensor.name}</h3>
                        <p className="text-sm text-muted">{sensor.type}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[sensor.status]}`}>
                    {sensor.status}
                </span>
            </div>
            <div className="flex-grow text-center !my-4">
                <p className="text-5xl font-bold text-gray-900">{displayValue}<span className="text-2xl text-muted ml-1">{sensor.unit}</span></p>
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

// Helper function to correctly format a sensor reading value for display
const formatReadingValue = (reading: SensorReading): string => {
    const { value, sensorType, interface: sensorInterface } = reading;
    if (value === null || value === undefined) return 'N/A';
    if (typeof value !== 'object') return String(value);

    // Handle OpenWeather based on sensor type
    if (sensorInterface === 'openweather') {
        if (sensorType === 'Sıcaklık' && value.temperature !== undefined) {
            return String(value.temperature);
        }
        if (sensorType === 'Nem' && value.humidity !== undefined) {
            return String(value.humidity);
        }
    }
    
    // Generic fallback for any other object: find the first numeric value
    const numericValue = Object.values(value).find(v => typeof v === 'number');
    return numericValue !== undefined ? String(numericValue) : JSON.stringify(value);
};


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
  
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [photoDateFilter, setPhotoDateFilter] = useState(new Date().toISOString().split('T')[0]);

  // State for Sensor Detail Modal
  const [isSensorModalOpen, setIsSensorModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);

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
  
  useEffect(() => {
      if (activeTab === 'Kameralar' && cameras.length > 0 && !selectedCameraId) {
          setSelectedCameraId(cameras[0].id);
      }
  }, [activeTab, cameras, selectedCameraId]);

  const handleOpenSensorModal = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setIsSensorModalOpen(true);
  };

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
  
  const selectedCamera = useMemo(() => {
      return cameras.find(c => c.id === selectedCameraId);
  }, [cameras, selectedCameraId]);

  const filteredPhotos = useMemo(() => {
    if (!selectedCamera?.photos) return [];
    if (!photoDateFilter) return selectedCamera.photos;
    
    // YYYY-MM-DD formatını baz alarak filtreleme
    const filterDate = new Date(photoDateFilter);
    filterDate.setHours(0, 0, 0, 0);

    return selectedCamera.photos.filter(photoUrl => {
        const filename = photoUrl.split('/').pop() || '';
        // Filename format: 2025-10-16T23-20-15_Ejder_Eshel.png
        const datePart = filename.split('T')[0];
        const photoDate = new Date(datePart);
        photoDate.setHours(0, 0, 0, 0);

        return photoDate.getTime() === filterDate.getTime();
    });
  }, [selectedCamera, photoDateFilter]);
  
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
        
         <div className="p-6">
            {activeTab === 'Veriler' && (
                <>
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
                          {paginatedSensorReadings.map(reading => {
                            const date = new Date(reading.timestamp);
                            const displayTimestamp = !isNaN(date.getTime())
                                ? date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                : reading.timestamp;

                            return (
                                <tr key={reading.id} className="border-b border-gray-200 hover:bg-gray-50">
                                  <td className="px-6 py-4 font-mono text-gray-800">{displayTimestamp}</td>
                                  <td className="px-6 py-4 font-medium text-gray-900">{reading.sensorName}</td>
                                  <td className="px-6 py-4">{reading.sensorType}</td>
                                  <td className="px-6 py-4 text-right font-semibold text-gray-900">{`${formatReadingValue(reading)} ${reading.unit || ''}`}</td>
                                </tr>
                            );
                          })}
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
                </>
            )}
            {activeTab === 'Sensörler' && (
                <>
                    {sensors.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paginatedSensors.map(sensor => <SensorCard key={sensor.id} sensor={sensor} onClick={() => handleOpenSensorModal(sensor)} />)}
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
                </>
            )}
            {activeTab === 'Kameralar' && (
                <>
                    {cameras.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {/* Camera List */}
                            <div className="md:col-span-1 lg:col-span-1">
                                <h3 className="font-semibold text-gray-800 mb-3 px-1">Kameralar ({cameras.length})</h3>
                                <ul className="space-y-2">
                                    {cameras.map(camera => (
                                        <li key={camera.id}>
                                            <div 
                                                onClick={() => setSelectedCameraId(camera.id)}
                                                className={`w-full p-3 rounded-lg flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                                    selectedCameraId === camera.id 
                                                    ? 'bg-accent/10 border border-accent/50' 
                                                    : 'hover:bg-gray-100 border border-transparent'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <CameraIcon className="w-5 h-5 text-muted" />
                                                    <div>
                                                        <p className="font-semibold text-sm">{camera.name}</p>
                                                        <p className="text-xs text-muted">{camera.viewDirection}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onViewCamera(camera.id); }} 
                                                    className="flex items-center gap-1.5 text-accent font-semibold py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors text-sm"
                                                    title="Canlı izle"
                                                >
                                                    <PlayIcon className="w-4 h-4" />
                                                    <span>İzle</span>
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {/* Photo Gallery */}
                            <div className="md:col-span-2 lg:col-span-3">
                                {selectedCamera ? (
                                    <div>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-3">
                                            <h3 className="font-semibold text-gray-800">{selectedCamera.name} için Yakalanan Görüntüler ({filteredPhotos.length})</h3>
                                            <div className="relative flex items-center gap-2 bg-secondary border border-gray-300 rounded-lg px-3 py-1.5">
                                                 <CalendarIcon className="w-5 h-5 text-muted"/>
                                                <input 
                                                    type="date" 
                                                    value={photoDateFilter}
                                                    onChange={e => setPhotoDateFilter(e.target.value)}
                                                    className="bg-transparent text-sm focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                        {filteredPhotos.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                {filteredPhotos.map((photo, index) => (
                                                    <div key={index} className="group relative rounded-lg overflow-hidden border border-gray-200 aspect-w-4 aspect-h-3">
                                                        <img src={photo} alt={`Yakalanan görüntü ${index + 1}`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                                                            <a href={photo} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white text-xs bg-black/60 px-2 py-1 rounded-md hover:bg-black/80">
                                                                <DownloadIcon className="w-4 h-4" />
                                                                <span>İndir</span>
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-16 text-muted border border-dashed rounded-lg">
                                                <PhotographIcon className="w-10 h-10 mx-auto text-gray-300 mb-2"/>
                                                <p>Bu kamera için seçilen tarihte kayıtlı görüntü bulunamadı.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                     <div className="text-center py-16 text-muted border border-dashed rounded-lg h-full flex flex-col justify-center">
                                        <CameraIcon className="w-10 h-10 mx-auto text-gray-300 mb-2"/>
                                        <p>Görüntüleri görmek için bir kamera seçin.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted text-center py-4">Bu istasyona bağlı kamera bulunmamaktadır.</p>
                    )}
                </>
            )}
            {activeTab === 'Konum' && (
                 <>
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
                </>
            )}
         </div>
      </Card>

        {selectedSensor && (
            <SensorDetailModal
                isOpen={isSensorModalOpen}
                onClose={() => setIsSensorModalOpen(false)}
                sensor={selectedSensor}
                readings={readings.filter(r => r.sensorId === selectedSensor.id)}
            />
        )}
    </div>
  );
};

export default StationDetail;