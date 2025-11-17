import React, { useState, useMemo, useEffect } from 'react';
import { Station, Sensor, Camera } from '../types.ts';
import Card from '../components/common/Card.tsx';
import { AddIcon, SearchIcon, LocationPinIcon, SensorIcon, CameraIcon, SettingsIcon, ExclamationIcon, DeleteIcon } from '../components/icons/Icons.tsx';
import AddStationDrawer from '../components/AddStationModal.tsx';
import { getUnassignedSensors, getUnassignedCameras, addStation, deleteStation, updateStation } from '../services/apiService.ts';
import LocationPickerMap from '../components/common/LocationPickerMap.tsx';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal.tsx';

const EditStationDrawer: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (stationData: Station) => void;
    station: Station | null;
}> = ({ isOpen, onClose, onSave, station }) => {
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
    const [status, setStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
    const [error, setError] = useState('');

    useEffect(() => {
        if (station && isOpen) {
            setName(station.name);
            setLocation(station.location);
            setCoords(station.locationCoords);
            setStatus(station.status);
            setError('');
        }
    }, [station, isOpen]);

    if (!isOpen || !station) return null;

    const handleSave = () => {
        if (!name.trim() || !location.trim()) {
            setError('İstasyon Adı ve Konum Açıklaması alanları zorunludur.');
            return;
        }
        onSave({ ...station, name, location, locationCoords: coords, status });
        onClose();
    };

    return (
     <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      <div className={`absolute inset-y-0 right-0 bg-secondary w-full max-w-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary"><h2 className="text-xl font-bold text-gray-900">İstasyon Düzenle</h2><button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></header>
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="bg-danger/10 text-danger text-sm font-medium p-3 rounded-md">{error}</div>}
          <div className="space-y-4 bg-primary p-4 rounded-lg border">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full input-base" />
            <input value={location} onChange={e => setLocation(e.target.value)} className="w-full input-base" />
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full input-base">
                <option value="active">Aktif</option>
                <option value="maintenance">Bakımda</option>
                <option value="inactive">Pasif</option>
            </select>
          </div>
          <div className="space-y-3 bg-primary p-4 rounded-lg border">
            <h3 className="text-base font-semibold text-gray-800">Konumu Güncelle</h3>
            <LocationPickerMap onLocationChange={setCoords} initialCenter={station.locationCoords} />
          </div>
        </main>
        <footer className="px-6 py-4 bg-primary border-t flex justify-end gap-3"><button onClick={onClose} className="btn-secondary">İptal</button><button onClick={handleSave} className="btn-primary">Kaydet</button></footer>
        <style>{`
            .input-base { background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; padding: 0.5rem 0.75rem; width: 100%; }
            .dark .input-base { background-color: #374151; border-color: #4B5563; color: #F3F4F6; }
            .btn-primary { background-color: #F97316; color: white; padding: 0.625rem 1rem; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; }
            .btn-primary:hover { background-color: #EA580C; }
            .btn-secondary { background-color: #E5E7EB; color: #1F2937; padding: 0.625rem 1rem; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; }
            .btn-secondary:hover { background-color: #D1D5DB; }
            .dark .btn-secondary { background-color: #4B5563; color: white; }
            .dark .btn-secondary:hover { background-color: #6B7281; }
        `}</style>
      </div>
    </div>
    );
};

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
    active: { text: 'Aktif', className: 'bg-white/90 text-gray-900' },
    inactive: { text: 'Pasif', className: 'bg-white/20 backdrop-blur-sm text-white/80' },
    maintenance: { text: 'Bakımda', className: 'bg-warning/80 text-white' },
};

const StationCard: React.FC<{ station: Station, onViewDetails: (id: string) => void, onEdit: (station: Station) => void, onDelete: (station: Station) => void }> = ({ station, onViewDetails, onEdit, onDelete }) => {
    const status = statusInfo[station.status] || statusInfo.inactive;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(station);
    };

    return (
        <div className="bg-gradient-to-br from-ubuntu-purple to-ubuntu-orange text-white rounded-xl shadow-lg p-5 flex flex-col space-y-4 h-full">
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg flex-shrink-0">
                        <LocationPinIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white shadow-black/50 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">{station.name}</h3>
                        <p className="text-sm text-white/80 shadow-black/50 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">{station.locationCoords ? `${station.locationCoords.lat.toFixed(2)}° K, ${station.locationCoords.lng.toFixed(2)}° D` : station.location}</p>
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
                <span>{formatTimeAgo(station.lastUpdate)}</span>
            </div>

            <hr className="border-white/20" />

            <div className="flex justify-between items-center space-x-2">
                <button onClick={() => onViewDetails(station.id)} className="w-full text-center bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors">
                    Detaylar
                </button>
                 <button onClick={() => onEdit(station)} className="p-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg">
                    <SettingsIcon className="w-5 h-5 text-white" />
                </button>
                <button onClick={handleDelete} className="p-2.5 bg-white/20 backdrop-blur-sm hover:bg-red-500/50 rounded-lg">
                    <DeleteIcon className="w-5 h-5 text-white" />
                </button>
            </div>
        </div>
    );
};

interface StationsProps {
  stations: Station[];
  onViewDetails: (stationId: string) => void;
  onDataChange: () => void;
}

const Stations: React.FC<StationsProps> = ({ stations, onViewDetails, onDataChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [unassignedSensors, setUnassignedSensors] = useState<Sensor[]>([]);
  const [unassignedCameras, setUnassignedCameras] = useState<Camera[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [stationToDelete, setStationToDelete] = useState<Station | null>(null);

  useEffect(() => {
    if (isAddDrawerOpen || isEditDrawerOpen) {
        const fetchDrawerData = async () => {
             try {
                const [uSensors, uCameras] = await Promise.all([
                    getUnassignedSensors(),
                    getUnassignedCameras()
                ]);
                setUnassignedSensors(uSensors);
                setUnassignedCameras(uCameras);
            } catch (err) {
                console.error("Error fetching data for drawers:", err);
            }
        };
        fetchDrawerData();
    }
  }, [isAddDrawerOpen, isEditDrawerOpen]);

  const filteredStations = useMemo(() => {
    if (!stations) return [];
    return stations.filter(station => 
      station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (station.location && station.location.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [stations, searchTerm]);
  
  const handleSaveStation = async (newStationData: any) => {
    try {
        await addStation(newStationData);
        onDataChange();
    } catch(error) {
        console.error("Failed to save station:", error);
        alert("İstasyon kaydedilirken bir hata oluştu.");
    }
  };

  const handleUpdateStation = async (stationData: Station) => {
    try {
        await updateStation(stationData.id, stationData);
        onDataChange();
        setIsEditDrawerOpen(false);
    } catch (error) {
        console.error("Failed to update station:", error);
        alert("İstasyon güncellenirken bir hata oluştu.");
    }
  };

  const handleDeleteStation = (station: Station) => {
    setStationToDelete(station);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
      if (!stationToDelete) return;
      try {
          await deleteStation(stationToDelete.id);
          onDataChange();
          setIsDeleteModalOpen(false);
      } catch (error) {
          console.error("Failed to delete station:", error);
          alert("İstasyon silinirken bir hata oluştu.");
      }
  };
  
  const handleOpenEdit = (station: Station) => {
    setEditingStation(station);
    setIsEditDrawerOpen(true);
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
            onClick={() => setIsAddDrawerOpen(true)}
            className="flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors w-full md:w-auto">
            <AddIcon className="w-5 h-5"/>
            <span className="font-semibold">Yeni İstasyon Ekle</span>
          </button>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStations.map(station => (
              <StationCard key={station.id} station={station} onViewDetails={onViewDetails} onEdit={handleOpenEdit} onDelete={handleDeleteStation}/>
          ))}
      </div>

       {filteredStations.length === 0 && (
            <Card>
                <div className="text-center py-8 text-muted">
                    <p>Arama kriterlerinize uygun istasyon bulunamadı.</p>
                </div>
            </Card>
        )}
        <AddStationDrawer 
            isOpen={isAddDrawerOpen} 
            onClose={() => setIsAddDrawerOpen(false)} 
            onSave={handleSaveStation} 
            unassignedSensors={unassignedSensors}
            unassignedCameras={unassignedCameras}
        />
        <EditStationDrawer
            isOpen={isEditDrawerOpen}
            onClose={() => setIsEditDrawerOpen(false)}
            onSave={handleUpdateStation}
            station={editingStation}
        />
        <DeleteConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={executeDelete}
            title="İstasyonu Sil"
            message={
                <>
                    <strong>{stationToDelete?.name}</strong> adlı istasyonu silmek üzeresiniz. Bu işlem geri alınamaz.
                </>
            }
        />
    </div>
  );
};

export default Stations;