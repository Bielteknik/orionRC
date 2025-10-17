import React, { useState, useEffect } from 'react';
import LocationPickerMap from './common/LocationPickerMap.tsx';
import { SensorIcon, CameraIcon } from './icons/Icons.tsx';
import { Sensor, Camera } from '../types.ts';

interface AddStationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newStationData: { id: string; name: string; location: string; locationCoords: { lat: number; lng: number; }; selectedSensorIds: string[]; selectedCameraIds: string[] }) => void;
  unassignedSensors: Sensor[];
  unassignedCameras: Camera[];
}

const INITIAL_CENTER = { lat: 39.9086, lng: 41.2655 };

const AddStationDrawer: React.FC<AddStationDrawerProps> = ({ 
    isOpen, 
    onClose, 
    onSave,
    unassignedSensors,
    unassignedCameras
}) => {
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(INITIAL_CENTER);
  const [selectedSensorIds, setSelectedSensorIds] = useState<string[]>([]);
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);
  
  const resetState = () => {
    setDeviceId('');
    setName('');
    setLocation('');
    setCoords(INITIAL_CENTER);
    setSelectedSensorIds([]);
    setSelectedCameraIds([]);
    setError('');
  };
  
  const handleClose = () => {
    resetState();
    onClose();
  };
  
  const handleSave = () => {
    if (!deviceId.trim() || !name.trim() || !location.trim()) {
      setError('Cihaz ID, İstasyon Adı ve Konum Açıklaması alanları zorunludur.');
      return;
    }
    setError('');
    onSave({
      id: deviceId,
      name,
      location,
      locationCoords: coords,
      selectedSensorIds,
      selectedCameraIds,
    });
    handleClose();
  };

  const handleSensorToggle = (id: string) => {
    setSelectedSensorIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };
  
  const handleCameraToggle = (id: string) => {
    setSelectedCameraIds(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };
  
  return (
    <div 
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-labelledby="drawer-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose}></div>
      
      {/* Drawer */}
      <div className={`absolute inset-y-0 right-0 bg-secondary w-full max-w-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary flex-shrink-0">
          <h2 id="drawer-title" className="text-xl font-bold text-gray-900">Yeni İstasyon Ekle</h2>
          <button onClick={handleClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="bg-danger/10 text-danger text-sm font-medium p-3 rounded-md">{error}</div>}
          
          <div className="space-y-4 bg-primary p-4 rounded-lg border border-gray-200">
            <div>
              <label htmlFor="station-id" className="block text-sm font-medium text-gray-700 mb-1">Cihaz ID *</label>
              <input
                type="text"
                id="station-id"
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                className="w-full bg-secondary border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                placeholder="Örn: ejder3200-01"
                required
              />
              <p className="text-xs text-muted mt-1.5">Agent'ın `config.json` dosyasındaki ID ile aynı olmalıdır.</p>
            </div>
            <div>
              <label htmlFor="station-name" className="block text-sm font-medium text-gray-700 mb-1">İstasyon Adı *</label>
              <input
                type="text"
                id="station-name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-secondary border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>
            <div>
              <label htmlFor="station-location" className="block text-sm font-medium text-gray-700 mb-1">Konum Açıklaması *</label>
              <input
                type="text"
                id="station-location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-secondary border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Örn: Erzurum, Türkiye"
                required
              />
            </div>
          </div>

          <div className="space-y-3 bg-primary p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-baseline">
                <h3 className="text-base font-semibold text-gray-800">Konum Belirle</h3>
                <p className="text-sm text-muted">Haritayı hareket ettirerek istasyon konumunu seçin.</p>
            </div>
            <LocationPickerMap onLocationChange={setCoords} initialCenter={INITIAL_CENTER} />
            <div className="text-center bg-secondary p-2 rounded-md text-sm font-mono text-gray-600">
              {`Enlem: ${coords.lat.toFixed(6)}, Boylam: ${coords.lng.toFixed(6)}`}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-primary p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Sensörleri Ata ({selectedSensorIds.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {unassignedSensors.length > 0 ? unassignedSensors.map(sensor => (
                         <label key={sensor.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-secondary cursor-pointer border border-transparent has-[:checked]:bg-accent/10 has-[:checked]:border-accent/50">
                            <input 
                                type="checkbox" 
                                checked={selectedSensorIds.includes(sensor.id)}
                                onChange={() => handleSensorToggle(sensor.id)}
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                            />
                            <SensorIcon className="w-5 h-5 text-muted" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{sensor.name}</p>
                                <p className="text-xs text-muted">{sensor.type}</p>
                            </div>
                        </label>
                    )) : <p className="text-sm text-muted p-2">Atanmamış sensör bulunmuyor.</p>}
                </div>
            </div>
            <div className="bg-primary p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Kameraları Ata ({selectedCameraIds.length})</h3>
                 <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {unassignedCameras.length > 0 ? unassignedCameras.map(camera => (
                        <label key={camera.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-secondary cursor-pointer border border-transparent has-[:checked]:bg-accent/10 has-[:checked]:border-accent/50">
                            <input 
                                type="checkbox" 
                                checked={selectedCameraIds.includes(camera.id)}
                                onChange={() => handleCameraToggle(camera.id)}
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                            />
                            <CameraIcon className="w-5 h-5 text-muted" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{camera.name}</p>
                                <p className="text-xs text-muted">{camera.cameraType}</p>
                            </div>
                        </label>
                    )) : <p className="text-sm text-muted p-2">Atanmamış kamera bulunmuyor.</p>}
                </div>
            </div>
          </div>

        </main>
        
        <footer className="px-6 py-4 bg-primary border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-primary border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 font-semibold"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-orange-600 font-semibold"
          >
            İstasyonu Kaydet
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AddStationDrawer;