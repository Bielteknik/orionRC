import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/common/Card';
import { AddIcon, EditIcon, DeleteIcon, StationIcon } from '../components/icons/Icons';
import { AlertRule, Severity, AlertCondition, Station, Sensor } from '../types';
import { getStations, getSensors } from '../services/apiService';
import DefinitionModal from '../components/DefinitionModal';

type DefinitionType = 'stationTypes' | 'sensorTypes' | 'cameraTypes';

interface DefinitionItem {
    id: number;
    name: string;
}

const MOCK_DEFINITIONS: Record<DefinitionType, DefinitionItem[]> = {
    stationTypes: [
        { id: 1, name: 'Kentsel İstasyon' },
        { id: 2, name: 'Kırsal İstasyon' },
        { id: 3, name: 'Kıyı İstasyonu' },
        { id: 4, name: 'Dağ İstasyonu' },
    ],
    sensorTypes: [
        { id: 1, name: 'Termometre' },
        { id: 2, name: 'Higrometre' },
        { id: 3, name: 'Anemometre' },
        { id: 4, name: 'Barometre' },
        { id: 5, name: 'Pluviyometre' },
    ],
    cameraTypes: [
        { id: 1, name: 'Sabit Dome Kamera' },
        { id: 2, name: 'PTZ Kamera' },
        { id: 3, name: 'Termal Kamera' },
        { id: 4, name: 'Geniş Açılı Kamera' },
    ],
};

const MOCK_ALERT_RULES: AlertRule[] = [
    { id: 'RULE001', name: 'Yüksek Sıcaklık Uyarısı', sensorType: 'Sıcaklık', stationIds: [], condition: 'Büyüktür', threshold: 35, severity: 'Kritik', isEnabled: true },
    { id: 'RULE002', name: 'Düşük Nem Uyarısı', sensorType: 'Nem', stationIds: ['STN02'], condition: 'Küçüktür', threshold: 20, severity: 'Uyarı', isEnabled: true },
    { id: 'RULE003', name: 'Yüksek Rüzgar Hızı', sensorType: 'Rüzgar Hızı', stationIds: [], condition: 'Büyüktür', threshold: 50, severity: 'Uyarı', isEnabled: false },
];

const severityStyles: Record<Severity, string> = {
    'Kritik': 'border-danger/80 bg-danger/10 text-danger',
    'Uyarı': 'border-warning/80 bg-warning/10 text-warning',
    'Bilgi': 'border-blue-500/80 bg-blue-500/10 text-blue-600',
};


const DefinitionSection: React.FC<{
    title: string;
    items: DefinitionItem[];
    onAdd: () => void;
    onEdit: (item: DefinitionItem) => void;
    onDelete: (id: number) => void;
}> = ({ title, items, onAdd, onEdit, onDelete }) => {
    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                <button onClick={onAdd} className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-1.5 rounded-md hover:bg-accent/20 text-sm">
                    <AddIcon className="w-4 h-4" />
                    <span>Yeni Ekle</span>
                </button>
            </div>
            <ul className="space-y-2">
                {items.map(item => (
                    <li key={item.id} className="flex justify-between items-center bg-secondary p-3 rounded-md border border-gray-200">
                        <span className="text-gray-700">{item.name}</span>
                        <div className="flex items-center gap-3">
                            <button onClick={() => onEdit(item)} className="text-muted hover:text-accent"><EditIcon /></button>
                            <button onClick={() => onDelete(item.id)} className="text-muted hover:text-danger"><DeleteIcon /></button>
                        </div>
                    </li>
                ))}
            </ul>
        </Card>
    );
};

interface AddAlertRuleDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newRule: Omit<AlertRule, 'id'>) => void;
    stations: Station[];
    sensorTypes: string[];
}

const AddAlertRuleDrawer: React.FC<AddAlertRuleDrawerProps> = ({ isOpen, onClose, onSave, stations, sensorTypes }) => {
    const [name, setName] = useState('');
    const [sensorType, setSensorType] = useState(sensorTypes[0] || '');
    const [condition, setCondition] = useState<AlertCondition>('Büyüktür');
    const [threshold, setThreshold] = useState(0);
    const [severity, setSeverity] = useState<Severity>('Uyarı');
    const [selectedStations, setSelectedStations] = useState<string[]>([]);
    const [isEnabled, setIsEnabled] = useState(true);
    const [error, setError] = useState('');
    
    const handleSave = () => {
        if (!name.trim()) {
            setError('Kural Adı zorunludur.');
            return;
        }
        onSave({
            name,
            sensorType,
            condition,
            threshold,
            severity,
            stationIds: selectedStations,
            isEnabled,
        });
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className={`absolute inset-y-0 right-0 bg-secondary w-full max-w-lg transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary"><h2 className="text-xl font-bold text-gray-900">Yeni Alarm Kuralı Ekle</h2><button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></header>
                <main className="flex-1 overflow-y-auto p-6 space-y-4">
                    {error && <div className="bg-danger/10 text-danger p-3 rounded-md">{error}</div>}
                    <div className="bg-primary p-4 rounded-lg border space-y-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Kural Adı" className="w-full input"/>
                        <select value={sensorType} onChange={e => setSensorType(e.target.value)} className="w-full input"><option disabled value="">Sensör Tipi Seç</option>{sensorTypes.map(st => <option key={st} value={st}>{st}</option>)}</select>
                        <div className="grid grid-cols-2 gap-4">
                            <select value={condition} onChange={e => setCondition(e.target.value as AlertCondition)} className="w-full input"><option>Büyüktür</option><option>Küçüktür</option></select>
                            <input type="number" value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} placeholder="Eşik Değer" className="w-full input"/>
                        </div>
                        <select value={severity} onChange={e => setSeverity(e.target.value as Severity)} className="w-full input"><option>Kritik</option><option>Uyarı</option><option>Bilgi</option></select>
                        <div>
                            <h4>İstasyonlar (Boş bırakılırsa tümü için geçerli)</h4>
                            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                                {stations.map(s => <label key={s.id} className="flex items-center"><input type="checkbox" checked={selectedStations.includes(s.id)} onChange={() => setSelectedStations(p => p.includes(s.id) ? p.filter(id => id !== s.id) : [...p, s.id])} className="mr-2"/>{s.name}</label>)}
                            </div>
                        </div>
                        <label className="flex items-center"><input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} className="mr-2"/>Kural Aktif</label>
                    </div>
                </main>
                <footer className="p-4 bg-primary border-t flex justify-end gap-2"><button onClick={onClose}>İptal</button><button onClick={handleSave} className="bg-accent text-white px-4 py-2 rounded-md">Kaydet</button></footer>
                 <style>{`.input { background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; padding: 0.5rem 0.75rem; }`}</style>
            </div>
        </div>
    );
};


const Definitions: React.FC = () => {
    const [definitions, setDefinitions] = useState(MOCK_DEFINITIONS);
    const [alertRules, setAlertRules] = useState<AlertRule[]>(MOCK_ALERT_RULES);
    const [isRuleDrawerOpen, setIsRuleDrawerOpen] = useState(false);
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isDefModalOpen, setIsDefModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: DefinitionType | null;
        item?: DefinitionItem;
        title: string;
    }>({ type: null, item: undefined, title: '' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [stationsData, sensorsData] = await Promise.all([getStations(), getSensors()]);
                setStations(stationsData);
                setSensors(sensorsData);
            } catch (err) {
                console.error("Error fetching data for definitions:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const sensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    const handleSaveRule = (newRule: Omit<AlertRule, 'id'>) => {
        const ruleToAdd: AlertRule = {
            id: `RULE${Date.now()}`,
            ...newRule,
        };
        setAlertRules(prev => [ruleToAdd, ...prev]);
    };

    const handleOpenModal = (type: DefinitionType, title: string, item?: DefinitionItem) => {
        setModalConfig({ type, item, title });
        setIsDefModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsDefModalOpen(false);
        setModalConfig({ type: null, item: undefined, title: '' });
    };

    const handleSaveDefinition = (name: string) => {
        const { type, item } = modalConfig;
        if (!type) return;

        setDefinitions(prev => {
            const newDefs = { ...prev };
            if (item) { // Editing
                newDefs[type] = newDefs[type].map(d => d.id === item.id ? { ...d, name } : d);
            } else { // Adding
                const newId = Math.max(0, ...newDefs[type].map(d => d.id)) + 1;
                newDefs[type] = [...newDefs[type], { id: newId, name }];
            }
            return newDefs;
        });
        handleCloseModal();
    };

    const handleDeleteDefinition = (type: DefinitionType, id: number) => {
        if (window.confirm('Bu tanımı silmek istediğinizden emin misiniz?')) {
            setDefinitions(prev => ({
                ...prev,
                [type]: prev[type].filter(item => item.id !== id)
            }));
        }
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DefinitionSection 
                title="İstasyon Tipleri" 
                items={definitions.stationTypes} 
                onAdd={() => handleOpenModal('stationTypes', 'Yeni İstasyon Tipi Ekle')}
                onEdit={(item) => handleOpenModal('stationTypes', 'İstasyon Tipini Düzenle', item)}
                onDelete={(id) => handleDeleteDefinition('stationTypes', id)}
            />
            <DefinitionSection 
                title="Sensör Tipleri" 
                items={definitions.sensorTypes} 
                onAdd={() => handleOpenModal('sensorTypes', 'Yeni Sensör Tipi Ekle')}
                onEdit={(item) => handleOpenModal('sensorTypes', 'Sensör Tipini Düzenle', item)}
                onDelete={(id) => handleDeleteDefinition('sensorTypes', id)}
            />
            <DefinitionSection 
                title="Kamera Tipleri" 
                items={definitions.cameraTypes} 
                onAdd={() => handleOpenModal('cameraTypes', 'Yeni Kamera Tipi Ekle')}
                onEdit={(item) => handleOpenModal('cameraTypes', 'Kamera Tipini Düzenle', item)}
                onDelete={(id) => handleDeleteDefinition('cameraTypes', id)}
            />

            <div className="lg:col-span-3">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-900">Alarm Kuralları Yönetimi</h3>
                        <button onClick={() => setIsRuleDrawerOpen(true)} className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-1.5 rounded-md hover:bg-accent/20 text-sm">
                            <AddIcon className="w-4 h-4" />
                            <span>Yeni Kural Ekle</span>
                        </button>
                    </div>
                    <div className="space-y-3">
                        {alertRules.map(rule => (
                            <div key={rule.id} className={`p-4 rounded-lg border ${rule.isEnabled ? 'opacity-100' : 'opacity-60 bg-gray-50'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${severityStyles[rule.severity]}`}>{rule.severity}</span>
                                            <h4 className="font-bold text-gray-800">{rule.name}</h4>
                                        </div>
                                        <p className="text-sm text-muted mt-1">Eğer <span className="font-semibold">{rule.sensorType}</span> değeri <span className="font-semibold">{rule.threshold}</span> değerinden <span className="font-semibold">{rule.condition}</span> ise alarm tetiklenir.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only peer" checked={rule.isEnabled} readOnly/>
                                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                        </div>
                                        <button className="text-muted hover:text-accent"><EditIcon /></button>
                                        <button className="text-muted hover:text-danger"><DeleteIcon /></button>
                                    </div>
                                </div>
                                {rule.stationIds.length > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-muted mt-2 pt-2 border-t border-gray-200">
                                        <StationIcon className="w-4 h-4" />
                                        <span>Sadece şu istasyonlarda geçerli: {stations.filter(s => rule.stationIds.includes(s.id)).map(s => s.name).join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
            <AddAlertRuleDrawer 
                isOpen={isRuleDrawerOpen}
                onClose={() => setIsRuleDrawerOpen(false)}
                onSave={handleSaveRule}
                stations={stations}
                sensorTypes={sensorTypes}
            />
             <DefinitionModal 
                isOpen={isDefModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveDefinition}
                initialValue={modalConfig.item?.name}
                title={modalConfig.title}
            />
        </div>
    );
};

export default Definitions;