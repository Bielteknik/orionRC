import React, { useState, useEffect, useMemo } from 'react';
import { Station, Sensor, SensorStatus, Camera } from '../types.ts';
import { SerialPortIcon, CpuChipIcon, HttpIcon, BrainIcon } from './icons/Icons.tsx';
import { SnowRulerDayIcon, SnowRulerNightIcon } from './icons/RulerIcons.tsx';
import { useTheme } from './ThemeContext.tsx';


interface AddSensorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sensorData: any) => void;
  stations: Station[];
  sensorTypes: string[];
  cameras: Camera[];
  sensorToEdit?: Sensor | null;
}

const interfaceIcons: { [key: string]: React.ReactNode } = {
    'serial': <SerialPortIcon className="w-5 h-5 text-muted" />,
    'i2c': <CpuChipIcon className="w-5 h-5 text-muted" />,
    'http': <HttpIcon className="w-5 h-5 text-muted" />,
    'virtual': <BrainIcon className="w-5 h-5 text-muted" />,
    'openweather': <HttpIcon className="w-5 h-5 text-muted" />,
};

const AddSensorDrawer: React.FC<AddSensorDrawerProps> = ({ isOpen, onClose, onSave, stations, sensorTypes, cameras, sensorToEdit }) => {
    const { theme } = useTheme();
    const [name, setName] = useState('');
    const [stationId, setStationId] = useState('');
    const [interfaceType, setInterfaceType] = useState('serial');
    const [interfaceConfig, setInterfaceConfig] = useState('{}');
    const [parserConfig, setParserConfig] = useState('{}');
    const [sensorType, setSensorType] = useState('');
    const [unit, setUnit] = useState('');
    const [readFrequency, setReadFrequency] = useState('600');
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState('');
    
    const [referenceValue, setReferenceValue] = useState('999');
    const [referenceOperation, setReferenceOperation] = useState('none');

    const [interfaceConfigError, setInterfaceConfigError] = useState<string | null>(null);
    const [parserConfigError, setParserConfigError] = useState<string | null>(null);
    
    // State for AI Snow Sensor
    const [sourceCameraId, setSourceCameraId] = useState('');
    const isSnowSensor = useMemo(() => sensorType === 'Kar Yüksekliği' && interfaceType === 'virtual', [sensorType, interfaceType]);
    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const title = sensorToEdit ? 'Sensör Ayarlarını Düzenle' : 'Yeni Sensör Ekle';

    useEffect(() => {
        if (referenceValue === '999' || referenceValue === '') {
            setReferenceOperation('none');
        }
    }, [referenceValue]);

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
        setInterfaceType('serial');
        setInterfaceConfig('{\n  "port": "/dev/ttyMESAFE",\n  "baudrate": 9600\n}');
        setParserConfig('{\n  "driver": "dfrobot_ult"\n}');
        setSensorType(sensorTypes[0] || '');
        setUnit('');
        setReadFrequency('600');
        setIsActive(true);
        setError('');
        setInterfaceConfigError(null);
        setParserConfigError(null);
        setSourceCameraId('');
        setReferenceValue('999');
        setReferenceOperation('none');
    };

    useEffect(() => {
        if (isOpen) {
            if (sensorToEdit) {
                setName(sensorToEdit.name);
                setStationId(sensorToEdit.stationId);
                setSensorType(sensorToEdit.type);
                setUnit(sensorToEdit.unit || '');
                setIsActive(sensorToEdit.status === SensorStatus.Active);
                setInterfaceType(sensorToEdit.interface || 'serial');
                setInterfaceConfig(JSON.stringify(sensorToEdit.config, null, 2) || '{}');
                setParserConfig(JSON.stringify(sensorToEdit.parser_config, null, 2) || '{}');
                setReadFrequency(String(sensorToEdit.read_frequency || 600));
                setReferenceValue(String(sensorToEdit.referenceValue ?? '999'));
                setReferenceOperation(sensorToEdit.referenceOperation || 'none');


                // If editing a snow sensor, parse the source camera ID
                if (sensorToEdit.type === 'Kar Yüksekliği' && sensorToEdit.interface === 'virtual') {
                     try {
                        const configObj = typeof sensorToEdit.config === 'string' ? JSON.parse(sensorToEdit.config) : sensorToEdit.config;
                        setSourceCameraId(configObj.source_camera_id || '');
                    } catch {
                        setSourceCameraId('');
                    }
                } else {
                    setSourceCameraId('');
                }

            } else {
                resetState();
            }
        }
    }, [isOpen, sensorToEdit, sensorTypes]);

    // Automatically set example config when interface type changes for a new sensor
    useEffect(() => {
        if (sensorToEdit || isSnowSensor) return; // Don't override when editing or if it's the special snow sensor case

        if (interfaceType === 'i2c') {
            setInterfaceConfig('{\n  "address": "0x44",\n  "bus": 1\n}');
            setParserConfig('{\n  "driver": "sht3x"\n}');
        } else if (interfaceType === 'serial') {
             setInterfaceConfig('{\n  "port": "/dev/ttyUSB0",\n  "baudrate": 9600\n}');
             setParserConfig('{\n  "driver": "dfrobot_ult"\n}');
        } else if (interfaceType === 'virtual') {
            setInterfaceConfig('{\n  "source_camera_id": "cam_...",\n  "script": "image_analyzer.py"\n}');
            setParserConfig('{\n  "driver": "image_analyzer"\n}');
        } else if (interfaceType === 'openweather') {
            setInterfaceConfig('{} \n// Bu alan sunucu tarafından otomatik olarak doldurulacaktır.');
            setParserConfig('{\n  "driver": "openweather"\n}');
        } else {
            setInterfaceConfig('{}');
            setParserConfig('{}');
        }
    }, [interfaceType, sensorToEdit, isSnowSensor]);

    // Effect to auto-generate JSON for the snow sensor
    useEffect(() => {
        if (isSnowSensor) {
            setInterfaceConfig(JSON.stringify({
                source_camera_id: sourceCameraId,
                script: "image_analyzer.py"
            }, null, 2));
            setParserConfig(JSON.stringify({
                driver: "image_analyzer"
            }, null, 2));
            setInterfaceConfigError(null);
            setParserConfigError(null);
        }
    }, [isSnowSensor, sourceCameraId]);


    useEffect(() => {
        if (isSnowSensor) return; // JSON is handled automatically for snow sensor
        try {
            JSON.parse(interfaceConfig);
            setInterfaceConfigError(null);
        } catch (e) {
            setInterfaceConfigError('Geçersiz JSON formatı.');
        }
    }, [interfaceConfig, isSnowSensor]);

    useEffect(() => {
        if (isSnowSensor) return; // JSON is handled automatically for snow sensor
        try {
            JSON.parse(parserConfig);
            setParserConfigError(null);
        } catch (e) {
            setParserConfigError('Geçersiz JSON formatı.');
        }
    }, [parserConfig, isSnowSensor]);

    const isFormInvalid = !name.trim() || !stationId || (isSnowSensor && !sourceCameraId) || (!isSnowSensor && (!!interfaceConfigError || !!parserConfigError));

    const handleClose = () => {
        onClose();
    };

    const handleSave = () => {
        if (!name.trim() || !stationId) {
            setError('Sensör Adı ve Bağlı Olduğu İstasyon alanları zorunludur.');
            return;
        }
        if (isSnowSensor && !sourceCameraId) {
            setError('Yapay Zeka Kar Sensörü için bir Kaynak Kamera seçmelisiniz.');
            return;
        }
        if (isFormInvalid) return;

        setError('');
        onSave({
            id: sensorToEdit?.id,
            name,
            stationId,
            interfaceType,
            parserConfig,
            interfaceConfig,
            type: sensorType,
            unit,
            readFrequency: parseInt(readFrequency, 10) || 600,
            status: isActive ? SensorStatus.Active : SensorStatus.Inactive,
            isActive,
            referenceValue: parseFloat(referenceValue) || 999,
            referenceOperation: referenceOperation,
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
                            <div className="md:col-span-1 grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="sensor-type" className="block text-sm font-medium text-gray-700 mb-1.5">Sensör Tipi</label>
                                    <select id="sensor-type" value={sensorType} onChange={e => setSensorType(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                        {sensorTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="sensor-unit" className="block text-sm font-medium text-gray-700 mb-1.5">Birim</label>
                                    <input type="text" id="sensor-unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="Örn: °C" className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="interface-type" className="block text-sm font-medium text-gray-700 mb-1.5">Arayüz Tipi</label>
                                <div className="relative">
                                     <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        {interfaceIcons[interfaceType]}
                                    </div>
                                    <select id="interface-type" value={interfaceType} onChange={e => setInterfaceType(e.target.value)} className="w-full appearance-none bg-secondary border border-gray-300 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                        <option value="serial">Seri Port</option>
                                        <option value="i2c">I2C</option>
                                        <option value="http">HTTP</option>
                                        <option value="virtual">Yapay Zeka (Görüntü İşleme)</option>
                                        <option value="openweather">OpenWeather API</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {isSnowSensor ? (
                             <div className="p-4 bg-blue-50 dark:bg-gray-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex gap-6 items-center">
                                    <div className="flex-shrink-0 pt-2 hidden sm:block">
                                        {theme === 'dark' ? <SnowRulerNightIcon className="w-16 h-auto" /> : <SnowRulerDayIcon className="w-16 h-auto" />}
                                    </div>
                                    <div className="flex-grow space-y-3">
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">Yapay Zeka Yapılandırması</h4>
                                        <p className="text-xs text-muted dark:text-gray-400">Bu sensör, seçilen kameradan alınan görüntüleri yapay zeka ile analiz ederek kar yüksekliğini ölçer.</p>
                                        <div>
                                            <label htmlFor="source-camera" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Kaynak Kamera *</label>
                                            <select
                                                id="source-camera"
                                                value={sourceCameraId}
                                                onChange={e => setSourceCameraId(e.target.value)}
                                                className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                                            >
                                                <option value="" disabled>Kamera Seçin...</option>
                                                {cameras.map(camera => (
                                                    <option key={camera.id} value={camera.id}>{camera.name} ({stationMap.get(camera.stationId) || 'Atanmamış'})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="border-t border-gray-200 pt-5 space-y-5">
                                    <h4 className="text-base font-semibold text-gray-800">Kalibrasyon Ayarları (Opsiyonel)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-start">
                                        <div>
                                            <label htmlFor="reference-value" className="block text-sm font-medium text-gray-700 mb-1.5">Referans Değeri</label>
                                            <input type="number" id="reference-value" value={referenceValue} onChange={e => setReferenceValue(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
                                             <p className="text-xs text-muted mt-1">"999" girilirse işlem yapılmaz.</p>
                                        </div>
                                         <div>
                                            <label htmlFor="reference-operation" className="block text-sm font-medium text-gray-700 mb-1.5">Uygulanacak İşlem</label>
                                            <select 
                                                id="reference-operation" 
                                                value={referenceOperation} 
                                                onChange={e => setReferenceOperation(e.target.value)} 
                                                className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                disabled={referenceValue === '999' || referenceValue === ''}
                                            >
                                                <option value="none">İşlem Yok</option>
                                                <option value="subtract">Referanstan Çıkar (Ref - Okunan)</option>
                                                <option value="add">Referansa Ekle (Ref + Okunan)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t border-gray-200 pt-5">
                                    <label htmlFor="interface-config" className="block text-sm font-medium text-gray-700 mb-1.5">Arayüz Yapılandırması (JSON)</label>
                                    <textarea id="interface-config" value={interfaceConfig} onChange={e => setInterfaceConfig(e.target.value)} rows={4} className={`w-full bg-secondary border rounded-md px-3 py-2 focus:outline-none focus:ring-2 font-mono text-sm ${interfaceConfigError ? 'border-danger focus:ring-danger' : 'border-gray-300 focus:ring-accent'}`}></textarea>
                                    {interfaceConfigError && <p className="text-xs text-danger mt-1.5">{interfaceConfigError}</p>}
                                </div>
                                <div>
                                    <label htmlFor="parser-config" className="block text-sm font-medium text-gray-700 mb-1.5">Ayrıştırıcı Yapılandırması (JSON)</label>
                                    <textarea id="parser-config" value={parserConfig} onChange={e => setParserConfig(e.target.value)} rows={4} className={`w-full bg-secondary border rounded-md px-3 py-2 focus:outline-none focus:ring-2 font-mono text-sm ${parserConfigError ? 'border-danger focus:ring-danger' : 'border-gray-300 focus:ring-accent'}`}></textarea>
                                    {parserConfigError && <p className="text-xs text-danger mt-1.5">{parserConfigError}</p>}
                                </div>
                            </>
                        )}


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