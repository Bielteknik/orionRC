import React, { useState, useMemo, useEffect } from 'react';
import { Station } from '../types';
import Card from '../components/common/Card';
import { AddIcon, SearchIcon, LocationPinIcon, SensorIcon, CameraIcon, SettingsIcon, ExclamationIcon } from '../components/icons/Icons';
import AddStationDrawer from '../components/AddStationModal';
import Skeleton from '../components/common/Skeleton';
import { getStations } from '../services/apiService';


export const MOCK_STATIONS: Station[] = [
  { id: 'STN01', name: 'İstasyon 1 - Merkez', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8550, lng: 41.3250 }, status: 'active', sensorCount: 4, cameraCount: 2, activeAlerts: 0, lastUpdate: '2 dakika önce', systemHealth: 100, avgBattery: 86, dataFlow: 98, activeSensorCount: 4, onlineCameraCount: 2 },
  { id: 'STN02', name: 'İstasyon 2 - Kayak Merkezi', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8600, lng: 41.3300 }, status: 'active', sensorCount: 8, cameraCount: 2, activeAlerts: 1, lastUpdate: '5 dakika önce', systemHealth: 95, avgBattery: 78, dataFlow: 92, activeSensorCount: 7, onlineCameraCount: 1 },
  { id: 'STN03', name: 'İstasyon 3 - Güney Yamaç', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8500, lng: 41.3200 }, status: 'maintenance', sensorCount: 10, cameraCount: 1, activeAlerts: 3, lastUpdate: '1 saat önce', systemHealth: 80, avgBattery: 65, dataFlow: 88, activeSensorCount: 8, onlineCameraCount: 1 },
  { id: 'STN04', name: 'Palandöken Zirve İstasyonu', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8450, lng: 41.3150 }, status: 'inactive', sensorCount: 4, cameraCount: 1, activeAlerts: 0, lastUpdate: '3 saat önce', systemHealth: 0, avgBattery: 0, dataFlow: 0, activeSensorCount: 0, onlineCameraCount: 0 },
];

const MOCK_UNASSIGNED_SENSORS_DATA = [
  { id: 'S101', name: 'Sıcaklık Sensörü A', type: 'Sıcaklık' },
  { id: 'S102', name: 'Nem Sensörü B', type: 'Nem' },
  { id: 'S103', name: 'Basınç Sensörü C', type: 'Basınç' },
  { id: 'S104', name: 'Rüzgar Hızı Sensörü D', type: 'Rüzgar Hızı' },
  { id: 'S105', name: 'Yağmur Dedektörü E', type: 'Yağış' },
  { id: 'S106', name: 'UV Sensörü F', type: 'UV İndeksi' },
];

const MOCK_UNASSIGNED_CAMERAS_DATA = [
  { id: 'C201', name: 'Kamera X', cameraType: 'PTZ Kamera' },
  { id: 'C202', name: 'Kamera Y', cameraType: 'Sabit Dome Kamera' },
  { id: 'C203', name: 'Kamera Z', cameraType: 'Termal Kamera' },
  { id: 'C204', name: 'Kamera W', cameraType: 'Geniş Açılı Kamera' },
];

const statusInfo: Record<string, { text: string, className: string }> = {
    active: { text: 'Aktif', className: 'bg-white/90 text-gray-900' },
    inactive: { text: 'Pasif', className: 'bg-white/20 backdrop-blur-sm text-white/80' },
    maintenance: { text: 'Bakımda', className: 'bg-warning/80 text-white' },
};

const StationCard: React.FC<{ station: Station, onViewDetails: (id: string) => void }> = ({ station, onViewDetails }) => {
    const status = statusInfo[station.status];

    return (
        <div className="bg-gradient-to-br from-ubuntu-purple to-ubuntu-orange text-white rounded-xl shadow-lg p-5 flex flex-col space-y-4 h-full">
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg flex-shrink-0">
                        <LocationPinIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white shadow-black/50 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">{station.name}</h3>
                        <p className="text-sm text-white/80 shadow-black/50 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">{`${station.locationCoords.lat}° K, ${station.locationCoords.lng}° D`}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${status.className}`}>
                    {status.text}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center space-x-3">
                    <SensorIcon className="w-6 h-6 text-white" />
                    <div>
                        <p className="text-xs text-white/80">Sensörler</p>
                        <p className="font-bold text-white text-lg">{station.sensorCount}</p>
                    </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center space-x-3">
                    <CameraIcon className="w-6 h-6 text-white" />
                    <div>
                        <p className="text-xs text-white/80">Kameralar</p>
                        <p className="font-bold text-white text-lg">{station.cameraCount}</p>
                    </div>
                </div>
            </div>
            
            {station.activeAlerts > 0 && (
                <div className="bg-red-500/50 border border-red-400/50 p-3 rounded-lg flex items-center space-x-2">
                    <ExclamationIcon className="w-5 h-5 text-white" />
                    <span className="text-sm font-medium text-white">{`${station.activeAlerts} aktif uyarı`}</span>
                </div>
            )}

            <div className="flex-grow"></div>

            <div className="flex justify-between items-center text-xs text-white/80 pt-2">
                <span>Son güncelleme</span>
                <span>{station.lastUpdate}</span>
            </div>

            <hr className="border-white/20" />

            <div className="flex justify-between items-center space-x-2">
                <button onClick={() => onViewDetails(station.id)} className="w-full text-center bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors">
                    Detaylar
                </button>
                <button className="p-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg">
                    <SettingsIcon className="w-5 h-5 text-white" />
                </button>
            </div>
        </div>
    );
};


interface StationsProps {
  onViewDetails: (stationId: string) => void;
}

const Stations: React.FC<StationsProps> = ({ onViewDetails }) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [unassignedSensors, setUnassignedSensors] = useState(MOCK_UNASSIGNED_SENSORS_DATA);
  const [unassignedCameras, setUnassignedCameras] = useState(MOCK_UNASSIGNED_CAMERAS_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStations = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getStations();
            setStations(data);
        } catch (err) {
            setError('İstasyon verileri yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    fetchStations();
  }, []);

  const filteredStations = useMemo(() => {
    return stations.filter(station => 
      station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stations, searchTerm]);
  
  const handleSaveStation = (newStationData: { name: string; location: string; locationCoords: { lat: number; lng: number; }; selectedSensorIds: string[]; selectedCameraIds: string[] }) => {
    // This part remains mock until we have POST endpoints
    const newStation: Station = {
      id: `STN${Date.now()}`,
      name: newStationData.name,
      location: newStationData.location,
      locationCoords: newStationData.locationCoords,
      status: 'active',
      sensorCount: newStationData.selectedSensorIds.length,
      cameraCount: newStationData.selectedCameraIds.length,
      activeAlerts: 0,
      lastUpdate: 'şimdi',
      systemHealth: 100,
      avgBattery: 100,
      dataFlow: 100,
      activeSensorCount: newStationData.selectedSensorIds.length,
      onlineCameraCount: newStationData.selectedCameraIds.length,
    };
    setStations(prevStations => [...prevStations, newStation]);
    setUnassignedSensors(prev => prev.filter(sensor => !newStationData.selectedSensorIds.includes(sensor.id)));
    setUnassignedCameras(prev => prev.filter(camera => !newStationData.selectedCameraIds.includes(camera.id)));
  };


  return (
    <div className="space-y-6">
       <Card>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-1/3">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
            <input 
              type="text" 
              placeholder="İstasyon ara..." 
              className="w-full bg-secondary border border-gray-300 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors w-full md:w-auto">
            <AddIcon className="w-5 h-5"/>
            <span className="font-semibold">Yeni İstasyon Ekle</span>
          </button>
        </div>
      </Card>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[312px] rounded-xl" />)}
        </div>
      ) : error ? (
        <Card>
            <div className="text-center py-8 text-danger">
                <ExclamationIcon className="w-12 h-12 mx-auto mb-2"/>
                <p className="font-semibold">{error}</p>
            </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredStations.map(station => (
                <StationCard key={station.id} station={station} onViewDetails={onViewDetails} />
            ))}
        </div>
      )}

       {filteredStations.length === 0 && !isLoading && !error && (
            <Card>
                <div className="text-center py-8 text-muted">
                    <p>Arama kriterlerinize uygun istasyon bulunamadı.</p>
                </div>
            </Card>
        )}
        <AddStationDrawer 
            isOpen={isDrawerOpen} 
            onClose={() => setIsDrawerOpen(false)} 
            onSave={handleSaveStation} 
            unassignedSensors={unassignedSensors}
            unassignedCameras={unassignedCameras}
        />
    </div>
  );
};

export default Stations;