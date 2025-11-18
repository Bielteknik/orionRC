

import React, { useMemo, useState, useEffect } from 'react';
import { Station, Sensor, Camera, SensorStatus, CameraStatus } from '../types.ts';
import { getStations, getSensors, getCameras, getReadingsHistory, restartAgent, stopAgent } from '../services/apiService.ts';
import Card from '../components/common/Card.tsx';
import InteractiveMap from '../components/common/InteractiveMap.tsx';
import Pagination from '../components/common/Pagination.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { ArrowLeftIcon, SensorIcon, CameraIcon, SettingsIcon, ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, OnlineIcon, OfflineIcon, PlayIcon, PhotographIcon, SearchIcon, ExclamationIcon, DownloadIcon, CalendarIcon, AgentIcon } from '../components/icons/Icons.tsx';
import SensorDetailModal from '../components/SensorDetailModal.tsx'; // Import the new modal
import { LineChart, Line, YAxis, ResponsiveContainer, Area } from 'recharts';
import { getNumericValue, formatTimeAgo, toDateTimeLocal } from '../utils/helpers.ts';


interface StationDetailProps {
  stationId: string;
  onBack: () => void;
  onViewCamera: (cameraId: string) => void;
}

// Define a more specific type for readings from the API
interface SensorReading {
    id: string;
    sensorId: string;
    stationId: string;
    sensorName: string;
    sensorType: string;
    value: any; // Can be object or primitive
    unit: string;
    timestamp: string;
    interface?: string; // Sensor interface type, now provided by API
}

const ITEMS_PER_PAGE_DATA = 10;
const ITEMS_PER_PAGE_SENSORS = 6;

const statusInfo: Record<string, { text: string, className: string }> = {
    active: { text: 'Aktif', className: 'bg-gray-800 text-white' },
    inactive: { text: 'Pasif', className: 'bg-gray-200 text-gray-700' },
    maintenance: { text: 'Bakımda', className: 'bg-amber-500/20 text-amber-600' },
};

const SensorCard: React.FC<{ sensor: Sensor, historyData: SensorReading[], onClick: () => void }> = ({ sensor, historyData, onClick }) => {
    const getSensorIcon = (type: string) => {
        switch (type) {
            case 'Sıcaklık': return <ThermometerIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
            case 'Nem': return <DropletIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
            case 'Rüzgar Hızı': case 'Rüzgar Yönü': return <WindSockIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
            case 'Basınç': return <GaugeIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
            default: return <SensorIcon className="w-5 h-5 text-muted dark:text-gray-400" />;
        }
    };

    const statusStyles: Record<SensorStatus, string> = {
        [SensorStatus.Active]: 'bg-success/10 text-success',
        [SensorStatus.Inactive]: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        [SensorStatus.Error]: 'bg-danger/10 text-danger',
        [SensorStatus.Maintenance]: 'bg-warning/10 text-warning',
    };

    const displayValue = useMemo(() => {
        const numericValue = getNumericValue(sensor.value, sensor.type, sensor.interface);
        if (numericValue === null) {
            if (sensor.value && typeof sensor.value === 'object' && 'weight_kg' in sensor.value && sensor.value.weight_kg === 'N/A') {
                 return 'N/A';
             }
             return 'N/A';
        }
        // Always format to 2 decimal places.
        return numericValue.toFixed(2);
    }, [sensor.value, sensor.type, sensor.interface]);

    const chartData = useMemo(() => {
        if (!historyData || historyData.length < 2) return [];
        const sortedHistory = [...historyData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return sortedHistory.map(reading => ({
            value: getNumericValue(reading.value, reading.sensorType, reading.interface)
        })).filter(item => item.value !== null);
    }, [historyData]);

    return (
        <Card className="p-3 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-start">
                 <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg">{getSensorIcon(sensor.type)}</div>
                    <div>
                        <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">{sensor.name}</h3>
                        <p className="text-sm text-muted dark:text-gray-400">{sensor.type}</p>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[sensor.status] || statusStyles[SensorStatus.Inactive]}`}>
                        {sensor.status || SensorStatus.Inactive}
                    </span>
                    <p className="text-xs text-muted dark:text-gray-500 mt-1">{formatTimeAgo(sensor.lastUpdate)}</p>
                </div>
            </div>
            <div className="flex-grow flex items-center justify-center text-center my-2">
                <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">{displayValue}<span className="text-lg text-muted dark:text-gray-400 ml-1">{sensor.unit}</span></p>
            </div>
            <div className="mt-auto cursor-pointer h-20 -mx-3 -mb-3 rounded-b-lg" onClick={onClick}>
                {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id={`colorGradient-${sensor.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <YAxis hide={true} domain={['dataMin - 1', 'dataMax + 1']} />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#F97316"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 0 }}
                            />
                            <Area type="monotone" dataKey="value" stroke="none" fillOpacity={1} fill={`url(#colorGradient-${sensor.id})`} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-center text-xs text-muted border-t border-gray-200 dark:border-gray-700">
                        Grafik için yeterli veri yok
                    </div>
                )}
            </div>
        </Card>
    );
};


// Helper function to correctly format a sensor reading value for display
const formatReadingValue = (reading: SensorReading): string => {
    const numericValue = getNumericValue(reading.value, reading.sensorType, reading.interface);
    if (numericValue === null) return 'N/A';
    return numericValue.toFixed(2);
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
  const [dateFilter, setDateFilter] = useState<{ start: string, end: string }>({ start: '', end: '' });

  // State for Sensor Detail Modal
  const [isSensorModalOpen, setIsSensorModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);

  useEffect(() => {
    const fetchStationData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const [stationsData, allSensors, allCameras] = await Promise.all([
                getStations(), getSensors(), getCameras()
            ]);
            
            const currentStation = stationsData.find(s => s.id === stationId);
            if (currentStation) {
                setStation(currentStation);
                const stationSensors = allSensors.filter(s => s.stationId === stationId);
                setSensors(stationSensors);
                setCameras(allCameras.filter(c => c.stationId === stationId));
            } else {
                throw new Error("İstasyon bulunamadı");
            }

        } catch (err: any) {
            setError('İstasyon detayları yüklenirken bir hata oluştu: ' + err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchStationData();

    // Set initial date range for the filter inputs
    const now = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(now.getDate() - 2);
    setDateFilter({
        start: toDateTimeLocal(twoDaysAgo),
        end: toDateTimeLocal(now)
    });
  }, [stationId]);

  // Effect to fetch readings when station, sensors, or date filter changes
  useEffect(() => {
      const fetchReadings = async () => {
          if (!stationId || sensors.length === 0 || !dateFilter.start || !dateFilter.end) {
              setReadings([]);
              return;
          }

          // FIX: Use Array.from to correctly create a string array from the Set.
          const sensorTypesForStation: string[] = Array.from(new Set(sensors.map(s => s.type)));
          if (sensorTypesForStation.length === 0) {
              setReadings([]);
              return;
          }
          
          try {
              const readingsData = await getReadingsHistory({
                  stationIds: [stationId],
                  sensorTypes: sensorTypesForStation,
                  start: dateFilter.start,
                  end: dateFilter.end,
              });
              setReadings(readingsData);
          } catch (err) {
              // Don't set a global error for this, just show empty table. Log it.
              console.error('İstasyon verileri yüklenirken bir hata oluştu:', err);
              setReadings([]); // Clear readings on error
          }
      };

      // Only fetch if the tab is active to avoid unnecessary calls
      if (activeTab === 'Veriler' || activeTab === 'Sensörler') {
        fetchReadings();
      }
  }, [stationId, sensors, dateFilter, activeTab]);
  
  useEffect(() => {
      if (activeTab === 'Kameralar' && cameras.length > 0 && !selectedCameraId) {
          setSelectedCameraId(cameras[0].id);
      }
  }, [activeTab, cameras, selectedCameraId]);

  const handleOpenSensorModal = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setIsSensorModalOpen(true);
  };

  const handleCloseSensorModal = () => {
    setIsSensorModalOpen(false);
    setSelectedSensor(null);
  };
  
  const handleAgentCommand = async (command: 'restart' | 'stop') => {
      if (!station) return;
      const actionText = command === 'restart' ? 'yeniden başlatmak' : 'durdurmak';
      const confirmed = window.confirm(`${station.name} istasyonuna bağlı agent'ı ${actionText} istediğinizden emin misiniz?`);
      
      if (confirmed) {
          try {
              if (command === 'restart') {
                  await restartAgent(station.id);
                  alert("Yeniden başlatma komutu başarıyla gönderildi.");
              } else {
                  await stopAgent(station.id);
                  alert("Durdurma komutu başarıyla gönderildi.");
              }
          } catch (error) {
              alert(`Agent'a ${actionText} komutu gönderilirken bir hata oluştu.`);
              console.error(error);
          }
      }
  };

  const filteredSensorReadings = useMemo(() => {
    if (!dataSearchTerm) {
        return readings;
    }
    return readings.filter(reading =>
        reading.sensorName.toLowerCase().includes(dataSearchTerm.toLowerCase()) ||
        reading.sensorType.toLowerCase().includes(dataSearchTerm.toLowerCase())
    );
  }, [readings, dataSearchTerm]);


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
    
    return selectedCamera.photos.filter(photoUrl => {
        const filename = photoUrl.split('/').pop() || '';
        const datePartMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
        if (datePartMatch) {
            return datePartMatch[1] === photoDateFilter;
        }
        return false;
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

  const stationStatus = statusInfo[station.status] || statusInfo.inactive;
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
                onClick={() => handleAgentCommand('restart')}
                className="flex items-center justify-center gap-2 bg-primary border border-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold">
                <AgentIcon className="w-5 h-5" />
                <span>Agent'ı Yeniden Başlat</span>
            </button>
             <button 
                onClick={() => handleAgentCommand('stop')}
                className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-semibold">
                <AgentIcon className="w-5 h-5" />
                <span>Agent'ı Durdur</span>
            </button>
        </div>
      </div>

      {/* Tabs */}
      <Card className="p-0">
         <div className="px-4 border-b border-gray-200">
            <nav className="flex -mb-px space-x-6 overflow-x-auto">
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
        
         <div className="p-4 sm:p-6">
            {activeTab === 'Veriler' && (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                        <div className="relative w-full md:max-w-sm">
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
                         <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                            <label className="text-sm font-medium text-gray-700 flex-shrink-0">Tarih Aralığı:</label>
                             <input 
                                type="datetime-local" 
                                value={dateFilter.start}
                                onChange={e => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-secondary border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-full"
                            />
                            <span className="text-muted hidden sm:block">-</span>
                             <input 
                                type="datetime-local" 
                                value={dateFilter.end}
                                onChange={e => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-secondary border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-full"
                            />
                        </div>
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
                                  <td className="px-6 py-4 font-mono text-gray-800 whitespace-nowrap">{displayTimestamp}</td>
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
                                {paginatedSensors.map(sensor => {
                                     const sensorHistory = readings
                                        .filter(r => r.sensorId === sensor.id)
                                        .slice(-15);
                                    return (
                                        <SensorCard 
                                            key={sensor.id} 
                                            sensor={sensor} 
                                            historyData={sensorHistory}
                                            onClick={() => handleOpenSensorModal(sensor)} />
                                    );
                                })}
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
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Camera List */}
                            <div className="w-full md:w-1/3 lg:w-1/4">
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
                                                    <span className="hidden sm:inline">İzle</span>
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {/* Photo Gallery */}
                            <div className="w-full md:w-2/3 lg:w-3/4">
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
            {activeTab === 'Konum' && station.locationCoords && (
                 <>
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 pb-4 border-b border-gray-200 text-sm gap-4">
                        <div>
                            <p className="text-xs text-muted">Koordinatlar</p>
                            <p className="font-semibold text-gray-800 font-mono">{`${station.locationCoords.lat}° K, ${station.locationCoords.lng}° D`}</p>
                        </div>
                         <div className="self-start sm:self-center">
                            <p className="text-xs text-muted sm:text-right">Son Güncelleme</p>
                            <p className="font-semibold text-gray-800">{formatTimeAgo(station.lastUpdate)}</p>
                        </div>
                    </div>
                    <div className="h-[400px] md:h-[500px] rounded-lg overflow-hidden">
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

        {isSensorModalOpen && selectedSensor && (
            <SensorDetailModal
                isOpen={isSensorModalOpen}
                onClose={handleCloseSensorModal}
                sensor={selectedSensor}
            />
        )}
    </div>
  );
};

export default StationDetail;