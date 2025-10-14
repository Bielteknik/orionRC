import React, { useState, useEffect, useMemo } from 'react';
import { Sensor, Station, SensorStatus } from '../types';
import { getSensors, getStations, deleteSensor as apiDeleteSensor } from '../services/apiService';
import Card from '../components/common/Card';
import { AddIcon, SearchIcon, FilterIcon, EditIcon, DeleteIcon } from '../components/icons/Icons';
import AddSensorDrawer from '../components/AddSensorDrawer';
import Skeleton from '../components/common/Skeleton';
import Pagination from '../components/common/Pagination';

const ITEMS_PER_PAGE = 10;

const statusStyles: Record<SensorStatus, { bg: string; text: string; }> = {
    [SensorStatus.Active]: { bg: 'bg-success/10', text: 'text-success' },
    [SensorStatus.Inactive]: { bg: 'bg-gray-200', text: 'text-muted' },
    [SensorStatus.Error]: { bg: 'bg-danger/10', text: 'text-danger' },
    [SensorStatus.Maintenance]: { bg: 'bg-warning/10', text: 'text-warning' },
};

const Sensors: React.FC = () => {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [sensorToEdit, setSensorToEdit] = useState<Sensor | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [stationFilter, setStationFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [sensorsData, stationsData] = await Promise.all([getSensors(), getStations()]);
                setSensors(sensorsData);
                setStations(stationsData);
            } catch (err) {
                setError('Sensör verileri yüklenemedi.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const sensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    const filteredSensors = useMemo(() => {
        return sensors
            .filter(s => stationFilter === 'all' || s.stationId === stationFilter)
            .filter(s => typeFilter === 'all' || s.type === typeFilter)
            .filter(s => statusFilter === 'all' || s.status === statusFilter)
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [sensors, searchTerm, stationFilter, typeFilter, statusFilter]);

    const paginatedSensors = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredSensors.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredSensors, currentPage]);


    const handleOpenDrawer = (sensor?: Sensor) => {
        setSensorToEdit(sensor || null);
        setIsDrawerOpen(true);
    };

    const handleSaveSensor = (sensorData: Partial<Sensor> & { id?: string; isActive?: boolean }) => {
        if (sensorData.id) { // Editing
            setSensors(prev => prev.map(s => s.id === sensorData.id ? { ...s, ...sensorData, status: sensorData.isActive ? SensorStatus.Active : SensorStatus.Inactive } : s));
        } else { // Adding
            const newSensor: Sensor = {
                id: `SENSOR${Date.now()}`,
                name: sensorData.name || 'Yeni Sensör',
                type: sensorData.type || 'Sıcaklık',
                stationId: sensorData.stationId || '',
                status: sensorData.isActive ? SensorStatus.Active : SensorStatus.Inactive,
                value: 0,
                unit: 'N/A',
                battery: 100,
                lastUpdate: new Date().toISOString(),
            };
            setSensors(prev => [newSensor, ...prev]);
        }
    };
    
    const handleDeleteSensor = async (id: string) => {
        if (window.confirm('Bu sensörü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
            try {
                await apiDeleteSensor(id);
                setSensors(prev => prev.filter(s => s.id !== id));
            } catch (error) {
                console.error("Sensör silinemedi:", error);
                alert("Sensör silinirken bir hata oluştu.");
            }
        }
    }

    const getStationName = (stationId: string) => stations.find(s => s.id === stationId)?.name || 'Atanmamış';

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sensör Yönetimi</h2>
                <button onClick={() => handleOpenDrawer()} className="w-full md:w-auto flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors">
                    <AddIcon className="w-5 h-5" />
                    <span className="font-semibold">Yeni Sensör Ekle</span>
                </button>
            </div>
            
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="relative">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted dark:text-gray-400" />
                        <input type="text" placeholder="Sensör ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full input-base pl-11" />
                    </div>
                    <select value={stationFilter} onChange={e => setStationFilter(e.target.value)} className="w-full input-base">
                        <option value="all">Tüm İstasyonlar</option>
                        {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full input-base">
                        <option value="all">Tüm Tipler</option>
                        {sensorTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full input-base">
                        <option value="all">Tüm Durumlar</option>
                        {Object.values(SensorStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </Card>

            <Card className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Sensör Adı</th>
                                <th scope="col" className="px-6 py-3">Tip</th>
                                <th scope="col" className="px-6 py-3">İstasyon</th>
                                <th scope="col" className="px-6 py-3">Mevcut Değer</th>
                                <th scope="col" className="px-6 py-3">Durum</th>
                                <th scope="col" className="px-6 py-3">Pil</th>
                                <th scope="col" className="px-6 py-3">Son Güncelleme</th>
                                <th scope="col" className="px-6 py-3 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b dark:border-gray-700"><td colSpan={8} className="px-6 py-4"><Skeleton className="h-6 w-full"/></td></tr>
                            )) : paginatedSensors.map(sensor => {
                                const status = statusStyles[sensor.status] || statusStyles[SensorStatus.Inactive];
                                return (
                                <tr key={sensor.id} className="bg-primary dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{sensor.name}</td>
                                    <td className="px-6 py-4">{sensor.type}</td>
                                    <td className="px-6 py-4">{getStationName(sensor.stationId)}</td>
                                    <td className="px-6 py-4 font-mono">{sensor.value}{sensor.unit}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.text}`}>{sensor.status}</span></td>
                                    <td className="px-6 py-4">{sensor.battery}%</td>
                                    <td className="px-6 py-4 text-xs">{new Date(sensor.lastUpdate).toLocaleString('tr-TR')}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handleOpenDrawer(sensor)} className="p-1 text-muted dark:text-gray-400 hover:text-accent"><EditIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteSensor(sensor.id)} className="p-1 text-muted dark:text-gray-400 hover:text-danger"><DeleteIcon className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                {!isLoading && filteredSensors.length === 0 && (
                    <p className="text-center text-muted dark:text-gray-400 py-8">Filtrelerle eşleşen sensör bulunamadı.</p>
                )}
                {filteredSensors.length > ITEMS_PER_PAGE && (
                    <Pagination currentPage={currentPage} totalPages={Math.ceil(filteredSensors.length / ITEMS_PER_PAGE)} onPageChange={setCurrentPage} />
                )}
            </Card>
             <AddSensorDrawer 
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSave={handleSaveSensor}
                stations={stations}
                sensorToEdit={sensorToEdit}
             />
             <style>{`.input-base { background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.5rem; padding: 0.625rem 1rem; focus:outline-none focus:ring-2 focus:ring-accent; } .dark .input-base { background-color: #374151; border-color: #4B5563; color: #F3F4F6; }`}</style>
        </div>
    );
};

export default Sensors;