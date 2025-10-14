import React, { useState, useEffect } from 'react';
import { Station, Camera, CameraStatus } from '../types.ts';

interface AddCameraDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newCameraData: Omit<Camera, 'id' | 'photos' | 'fps' | 'streamUrl'>) => void;
  stations: Station[];
}

const CAMERA_TYPES = ['Sabit Dome Kamera', 'PTZ Kamera', 'Termal Kamera', 'Geniş Açılı Kamera'];

const AddCameraDrawer: React.FC<AddCameraDrawerProps> = ({ isOpen, onClose, onSave, stations }) => {
    const [name, setName] = useState('');
    const [stationId, setStationId] = useState('');
    const [status, setStatus] = useState<CameraStatus>(CameraStatus.Online);
    const [viewDirection, setViewDirection] = useState('');
    const [rtspUrl, setRtspUrl] = useState('');
    const [cameraType, setCameraType] = useState(CAMERA_TYPES[0]);
    const [error, setError] = useState('');

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const resetState = () => {
        setName('');
        setStationId('');
        setStatus(CameraStatus.Online);
        setViewDirection('');
        setRtspUrl('');
        setCameraType(CAMERA_TYPES[0]);
        setError('');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSave = () => {
        if (!name.trim() || !stationId) {
            setError('Kamera Adı ve Bağlı Olduğu İstasyon alanları zorunludur.');
            return;
        }
        setError('');
        onSave({
            name,
            stationId,
            status,
            viewDirection,
            rtspUrl,
            cameraType,
        });
        handleClose();
    };

    return (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60" onClick={handleClose}></div>
            <div className={`absolute inset-y-0 right-0 bg-primary w-full max-w-lg transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-900">Yeni Kamera Ekle</h2>
                    <button onClick={handleClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-secondary">
                    <div className="bg-primary p-6 rounded-lg border border-gray-200 space-y-5">
                         {error && <div className="bg-danger/10 text-danger text-sm font-medium p-3 rounded-md -mt-1 mb-4">{error}</div>}
                        
                        <div className="grid grid-cols-1 gap-y-5">
                            <div>
                                <label htmlFor="camera-name" className="block text-sm font-medium text-gray-700 mb-1.5">Kamera Adı *</label>
                                <input type="text" id="camera-name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
                            </div>
                            <div>
                                <label htmlFor="station-id" className="block text-sm font-medium text-gray-700 mb-1.5">Bağlı Olduğu İstasyon *</label>
                                <select id="station-id" value={stationId} onChange={e => setStationId(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                    <option value="" disabled>İstasyon Seçin...</option>
                                    {stations.map(station => (
                                        <option key={station.id} value={station.id}>{station.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="rtsp-url" className="block text-sm font-medium text-gray-700 mb-1.5">RTSP URL</label>
                                <input type="text" placeholder="rtsp://..." id="rtsp-url" value={rtspUrl} onChange={e => setRtspUrl(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
                            </div>
                             <div>
                                <label htmlFor="view-direction" className="block text-sm font-medium text-gray-700 mb-1.5">Bakış Yönü</label>
                                <input type="text" placeholder="Örn: Kuzey Cephe" id="view-direction" value={viewDirection} onChange={e => setViewDirection(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="camera-type" className="block text-sm font-medium text-gray-700 mb-1.5">Kamera Tipi</label>
                                    <select id="camera-type" value={cameraType} onChange={e => setCameraType(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                        {CAMERA_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1.5">Durum</label>
                                    <select id="status" value={status} onChange={e => setStatus(e.target.value as CameraStatus)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                        {Object.values(CameraStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="px-6 py-4 bg-primary border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
                    <button type="button" onClick={handleClose} className="px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-semibold text-sm">İptal</button>
                    <button 
                        type="button" 
                        onClick={handleSave} 
                        className="px-5 py-2.5 bg-accent text-white rounded-md hover:bg-orange-600 font-semibold text-sm disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        Kaydet
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default AddCameraDrawer;