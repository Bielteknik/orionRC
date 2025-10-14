import React, { useState, useEffect } from 'react';
import { Station, Sensor, SensorStatus } from '../types.ts';
import { SerialPortIcon, CpuChipIcon, HttpIcon, RegexIcon, JsonIcon, CsvIcon } from './icons/Icons.tsx';

interface AddSensorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sensorData: Partial<Sensor> & { id?: string; isActive?: boolean }) => void;
  stations: Station[];
  sensorToEdit?: Sensor | null;
}

const interfaceIcons: { [key: string]: React.ReactNode } = {
    'Seri Port': <SerialPortIcon className="w-5 h-5 text-muted" />,
    'I2C': <CpuChipIcon className="w-5 h-5 text-muted" />,
    'SPI': <CpuChipIcon className="w-5 h-5 text-muted" />,
    'HTTP': <HttpIcon className="w-5 h-5 text-muted" />,
};

const parserIcons: { [key: string]: React.ReactNode } = {
    'Regex': <RegexIcon className="w-5 h-5 text-muted" />,
    'JSON': <JsonIcon className="w-5 h-5 text-muted" />,
    'CSV': <CsvIcon className="w-5 h-5 text-muted" />,
};

const SENSOR_TYPES = ['Sıcaklık', 'Nem', 'Rüzgar Hızı', 'Basınç', 'Yağış', 'UV İndeksi', 'Rüzgar Yönü'];


const AddSensorDrawer: React.FC<AddSensorDrawerProps> = ({ isOpen, onClose, onSave, stations, sensorToEdit }) => {
    const [name, setName] = useState('');
    const [stationId, setStationId] = useState('');
    const [interfaceType, setInterfaceType] = useState('Seri Port');
    const [parserType, setParserType] = useState('Regex');
    const [interfaceConfig, setInterfaceConfig] = useState('{"address": "0x44"}');
    const [parserConfig, setParserConfig] = useState('{"rule": "T:(\\\\d+)", "output_mapping": {"group_1": "temperature"}}');
    const [sensorType, setSensorType] = useState(SENSOR_TYPES[0]);
    const [readFrequency, setReadFrequency] = useState('60');
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState('');
    
    const [interfaceConfigError, setInterfaceConfigError] = useState<string | null>(null);
    const [parserConfigError, setParserConfigError] = useState<string | null>(null);

    const title = sensorToEdit ? 'Sensör Ayarlarını Düzenle' : 'Yeni Sensör Ekle';

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
        setInterfaceType('Seri Port');
        setParserType('Regex');
        setInterfaceConfig('{"address": "0x44"}');
        setParserConfig('{"rule": "T:(\\\\d+)", "output_mapping": {"group_1": "temperature"}}');
        setSensorType(SENSOR_TYPES[0]);
        setReadFrequency('60');
        setIsActive(true);
        setError('');
        setInterfaceConfigError(null);
        setParserConfigError(null);
    };

    useEffect(() => {
        if (isOpen) {
            if (sensorToEdit) {
                setName(sensorToEdit.name);
                setStationId(sensorToEdit.stationId);
                setSensorType(sensorToEdit.type);
                setIsActive(sensorToEdit.status === SensorStatus.Active);
                // In a real app, these would be populated from the sensor object too
                // setInterfaceType(sensorToEdit.interfaceType);
                // setParserType(sensorToEdit.parserType);
                // setInterfaceConfig(sensorToEdit.interfaceConfig);
                // setParserConfig(sensorToEdit.parserConfig);
                // setReadFrequency(String(sensorToEdit.readFrequency));
            } else {
                resetState();
            }
        }
    }, [isOpen, sensorToEdit]);


    useEffect(() => {
        try {
            JSON.parse(interfaceConfig);
            setInterfaceConfigError(null);
        } catch (e) {
            setInterfaceConfigError('Geçersiz JSON formatı.');
        }
    }, [interfaceConfig]);

    useEffect(() => {
        try {
            JSON.parse(parserConfig);
            setParserConfigError(null);
        } catch (e) {
            setParserConfigError('Geçersiz JSON formatı.');
        }
    }, [parserConfig]);

    const isFormInvalid = !name.trim() || !stationId || !!interfaceConfigError || !!parserConfigError;

    const handleClose = () => {
        onClose();
    };

    const handleSave = () => {
        if (!name.trim() || !stationId) {
            setError('Sensör Adı ve Bağlı Olduğu İstasyon alanları zorunludur.');
            return;
        }
        if (isFormInvalid) return;

        setError('');
        onSave({
            id: sensorToEdit?.id,
            name,
            stationId,
            // interfaceType,
            // parserType,
            // interfaceConfig,
            // parserConfig,
            type: sensorType,
            // readFrequency: parseInt(readFrequency, 10) || 60,
            status: isActive ? SensorStatus.Active : SensorStatus.Inactive,
            isActive, // Keep this for easier mapping in parent
        });
        handleClose();
    };

    return (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60" onClick={handleClose}></div>
            <div className={`absolute inset-y-0 right-0 bg-primary w-full max-w-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                    <button onClick={handleClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-secondary">
                    <div className="bg-primary p-6 rounded-lg border border-gray-200 space-y-5">
                         {error && <div className="bg-danger/10 text-danger text-sm font-medium p-3 rounded-md -mt-1 mb-4">{error}</div>}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            <div>
                                <label htmlFor="sensor-name" className="block text-sm font-medium text-gray-700 mb-1.5">Sensör Adı *</label>
                                <input type="text" id="sensor-name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
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
                                <label htmlFor="interface-type" className="block text-sm font-medium text-gray-700 mb-1.5">Arayüz Tipi</label>
                                <div className="relative">
                                     <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        {interfaceIcons[interfaceType]}
                                    </div>
                                    <select id="interface-type" value={interfaceType} onChange={e => setInterfaceType(e.target.value)} className="w-full appearance-none bg-secondary border border-gray-300 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                        <option>Seri Port</option>
                                        <option>I2C</option>
                                        <option>SPI</option>
                                        <option>HTTP</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="parser-type" className="block text-sm font-medium text-gray-700 mb-1.5">Ayrıştırıcı Tipi</label>
                                 <div className="relative">
                                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        {parserIcons[parserType]}
                                    </div>
                                    <select id="parser-type" value={parserType} onChange={e => setParserType(e.target.value)} className="w-full appearance-none bg-secondary border border-gray-300 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                        <option>Regex</option>
                                        <option>JSON</option>
                                        <option>CSV</option>
                                    </select>
                                 </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="interface-config" className="block text-sm font-medium text-gray-700 mb-1.5">Arayüz Yapılandırması (JSON)</label>
                            <textarea id="interface-config" value={interfaceConfig} onChange={e => setInterfaceConfig(e.target.value)} rows={3} className={`w-full bg-secondary border rounded-md px-3 py-2 focus:outline-none focus:ring-2 font-mono text-sm ${interfaceConfigError ? 'border-danger focus:ring-danger' : 'border-gray-300 focus:ring-accent'}`}></textarea>
                            {interfaceConfigError && <p className="text-xs text-danger mt-1.5">{interfaceConfigError}</p>}
                        </div>
                        <div>
                            <label htmlFor="parser-config" className="block text-sm font-medium text-gray-700 mb-1.5">Ayrıştırıcı Yapılandırması (JSON)</label>
                            <textarea id="parser-config" value={parserConfig} onChange={e => setParserConfig(e.target.value)} rows={3} className={`w-full bg-secondary border rounded-md px-3 py-2 focus:outline-none focus:ring-2 font-mono text-sm ${parserConfigError ? 'border-danger focus:ring-danger' : 'border-gray-300 focus:ring-accent'}`}></textarea>
                            {parserConfigError && <p className="text-xs text-danger mt-1.5">{parserConfigError}</p>}
                        </div>

                        <div>
                            <label htmlFor="sensor-type" className="block text-sm font-medium text-gray-700 mb-1.5">Sensör Tipi</label>
                            <select id="sensor-type" value={sensorType} onChange={e => setSensorType(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                {SENSOR_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-end">
                            <div>
                                <label htmlFor="read-frequency" className="block text-sm font-medium text-gray-700 mb-1.5">Okuma Sıklığı (Saniye)</label>
                                <input type="number" id="read-frequency" value={readFrequency} onChange={e => setReadFrequency(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
                            </div>
                            <div className="flex items-center">
                                <label htmlFor="is-active" className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" id="is-active" className="sr-only peer" checked={isActive} onChange={() => setIsActive(!isActive)} />
                                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                    </div>
                                    <span className="ml-3 text-sm font-medium text-gray-700">Sensör Aktif</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="px-6 py-4 bg-primary border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
                    <button type="button" onClick={handleClose} className="px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-semibold text-sm">İptal</button>
                    <button 
                        type="button" 
                        onClick={handleSave} 
                        disabled={isFormInvalid}
                        className="px-5 py-2.5 bg-accent text-white rounded-md hover:bg-orange-600 font-semibold text-sm disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        Kaydet
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default AddSensorDrawer;