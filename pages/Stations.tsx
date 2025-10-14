import React, { useState, useEffect, useMemo } from 'react';
import { Station, Sensor, Camera, SensorStatus, CameraStatus } from '../types';
import { getStations, getSensors, getCameras, deleteStation as apiDeleteStation } from '../services/apiService';
import Card from '../components/common/Card';
import { AddIcon, SearchIcon, StationIcon, SensorIcon, CameraIcon, DeleteIcon } from '../components/icons/Icons';
import AddStationDrawer from '../components/AddStationModal'; // Corrected component name based on file
import Skeleton from '../components/common/Skeleton';

const statusStyles: Record<string, { bg: string; text: string; }> = {
    active: { bg: 'bg-success/10', text: 'text-success' },
    maintenance: { bg: 'bg-warning/10', text: 'text-warning' },
    inactive: { bg: 'bg-gray-200', text: 'text-muted' },
};

const StationCard: React.FC<{ station: Station; onViewDetails: (id: string) => void; onDelete: (id: string) => void; }> = ({ station, onViewDetails, onDelete }) => {
    const status = statusStyles[station.status] || statusStyles.inactive;
    return (
        <Card className="p-0 flex flex-col hover:shadow-md transition-shadow">
            <div className="p-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-accent/10 rounded-lg"><StationIcon className="w-6 h-6 text-accent" /></div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{station.name}</h3>
                            <p className="text-sm text-muted dark:text-gray-400">{station.location}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.text}`}>{station.status}</span>
                         <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(station.id); }} 
                            className="p-1.5 text-muted dark:text-gray-400 hover:text-danger hover:bg-danger/10 rounded-full"
                            title="İstasyonu Sil"
                        >
                            <DeleteIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <SensorIcon className="w-5 h-5 text-muted dark:text-gray-400" />
                        <span><span className="font-semibold">{station.sensorCount}</span> Sensör</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CameraIcon className="w-5 h-5 text-muted dark:text-gray-400" />
                        <span><span className="font-semibold">{station.cameraCount}</span> Kamera</span>
                    </div>
                </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 mt-auto p-3 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                 <p className="text-xs text-muted dark:text-gray-400">Son Güncelleme: {new Date(station.lastUpdate).toLocaleTimeString('tr-TR')}</p>
                <button onClick={() => onViewDetails(station.id)} className="font-semibold text-accent text-sm hover:underline">
                    Detayları Gör →
                </button>
            </div>
        </Card>
    );
};


const Stations: React.FC<{ onViewDetails: (stationId: string) => void }> = ({ onViewDetails }) => {
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [stationsData, sensorsData, camerasData] = await Promise.all([getStations(), getSensors(), getCameras()]);
                setStations(stationsData);
                setSensors(sensorsData);
                setCameras(camerasData);
            } catch (err) {
                setError('İstasyon verileri yüklenemedi.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);
    
    const unassignedSensors = useMemo(() => sensors.filter(s => !stations.some(st => st.id === s.stationId)), [sensors, stations]);
    const unassignedCameras = useMemo(() => cameras.filter(c => !stations.some(st => st.id === c.stationId)), [cameras, stations]);

    const filteredStations = useMemo(() => {
        return stations.filter(station =>
            station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            station.location.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [stations, searchTerm]);
    
    const handleSaveStation = (newStationData: { name: string; location: string; locationCoords: { lat: number; lng: number; }; selectedSensorIds: string[]; selectedCameraIds: string[] }) => {
        const newStation: Station = {
            id: `STATION${Date.now()}`,
            name: newStationData.name,
            location: newStationData.location,
            locationCoords: newStationData.locationCoords,
            status: 'active',
            sensorCount: newStationData.selectedSensorIds.length,
            cameraCount: newStationData.selectedCameraIds.length,
            activeAlerts: 0,
            lastUpdate: new Date().toISOString(),
            systemHealth: 100,
            avgBattery: 95,
            dataFlow: 12.5,
            activeSensorCount: newStationData.selectedSensorIds.length,
            onlineCameraCount: newStationData.selectedCameraIds.length,
        };
        setStations(prev => [...prev, newStation]);
        // Update assigned sensors/cameras
        setSensors(prev => prev.map(s => newStationData.selectedSensorIds.includes(s.id) ? {...s, stationId: newStation.id} : s));
        setCameras(prev => prev.map(c => newStationData.selectedCameraIds.includes(c.id) ? {...c, stationId: newStation.id} : c));
    };

    const handleDeleteStation = async (id: string) => {
        if (window.confirm('Bu istasyonu silmek istediğinizden emin misiniz? Bu istasyona bağlı tüm sensörler ve kameralar "atanmamış" duruma gelecektir.')) {
            try {
                await apiDeleteStation(id);
                setStations(prev => prev.filter(s => s.id !== id));
                // Refetch sensors and cameras to update their "unassigned" status
                const [sensorsData, camerasData] = await Promise.all([getSensors(), getCameras()]);
                setSensors(sensorsData);
                setCameras(camerasData);
            } catch (error) {
                console.error("İstasyon silinemedi:", error);
                alert("İstasyon silinirken bir hata oluştu.");
            }
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-1/3">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted dark:text-gray-400" />
                    <input
                        type="text"
                        placeholder="İstasyon ara..."
                        className="w-full bg-primary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setIsDrawerOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors"
                >
                    <AddIcon className="w-5 h-5" />
                    <span className="font-semibold">Yeni İstasyon Ekle</span>
                </button>
            </div>
            
            {isLoading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
                 </div>
            ) : error ? (
                <Card><p className="text-center text-danger">{error}</p></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStations.map(station => (
                        <StationCard key={station.id} station={station} onViewDetails={onViewDetails} onDelete={handleDeleteStation} />
                    ))}
                </div>
            )}
             { !isLoading && filteredStations.length === 0 && (
                <Card>
                    <p className="text-center text-muted dark:text-gray-400 py-8">
                        {stations.length > 0 ? 'Aramanızla eşleşen istasyon bulunamadı.' : 'Henüz istasyon eklenmemiş.'}
                    </p>
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