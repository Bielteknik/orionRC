import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sensor, Station, SensorStatus } from '../types.ts';
import Card from '../components/common/Card.tsx';
import { AddIcon, SearchIcon, EditIcon, DeleteIcon, ExclamationIcon, ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, SensorIcon as GenericSensorIcon, BrainIcon } from '../components/icons/Icons.tsx';
import AddSensorDrawer from '../components/AddSensorDrawer.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { getSensors, getStations, addSensor, updateSensor, deleteSensor, getDefinitions } from '../services/apiService.ts';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal.tsx';

const SensorCard: React.FC<{
    sensor: Sensor;
    stationName: string;
    onEdit: (sensor: Sensor) => void;
    onDelete: (sensor: Sensor) => void;
}> = ({ sensor, stationName, onEdit, onDelete }) => {
    const getSensorIcon = (sensor: Sensor) => {
        if (sensor.interface === 'virtual') {
            return <BrainIcon className="w-6 h-6 text-muted" />;
        }
        switch (sensor.type) {
            case 'Sıcaklık': return <ThermometerIcon className="w-6 h-6 text-muted" />;
            case 'Nem': return <DropletIcon className="w-6 h-6 text-muted" />;
            case 'Rüzgar Hızı': case 'Rüzgar Yönü': return <WindSockIcon className="w-6 h-6 text-muted" />;
            case 'Basınç': return <GaugeIcon className="w-6 h-6 text-muted" />;
            default: return <GenericSensorIcon className="w-5 h-5 text-muted" />;
        }
    };

    const statusStyles: Record<SensorStatus, string> = {
        [SensorStatus.Active]: 'bg-success/10 text-success',
        [SensorStatus.Inactive]: 'bg-gray-200 text-gray-600',
        [SensorStatus.Error]: 'bg-danger/10 text-danger',
        [SensorStatus.Maintenance]: 'bg-warning/10 text-warning',
    };

    const displayValue = typeof sensor.value === 'object' && sensor.value !== null 
        ? Object.values(sensor.value).find(v => typeof v === 'number') ?? 'N/A'
        : sensor.value;

    return (
        <Card className="p-4 flex flex-col h-full">
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 p-2.5 rounded-lg">{getSensorIcon(sensor)}</div>
                    <div>
                        <h3 className="font-semibold text-gray-900">{sensor.name}</h3>
                        <p className="text-sm text-muted">{stationName || 'Atanmamış'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(sensor)} className="p-2 text-muted hover:text-accent rounded-full hover:bg-accent/10 transition-colors"><EditIcon className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(sensor)} className="p-2 text-muted hover:text-danger rounded-full hover:bg-danger/10 transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="flex-grow text-center my-4">
                <p className="text-4xl font-bold text-gray-900">{displayValue}<span className="text-xl text-muted ml-1">{sensor.unit || ''}</span></p>
                <p className="text-sm text-gray-600">{sensor.type}</p>
            </div>
            <div className="flex justify-between items-center text-sm pt-3 border-t border-gray-200">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusStyles[sensor.status]}`}>
                    {sensor.status}
                </span>
                <span className="text-muted text-xs">Son gün.: {new Date(sensor.lastUpdate).toLocaleTimeString('tr-TR')}</span>
            </div>
        </Card>
    );
};

const Sensors: React.FC = () => {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [sensorTypes, setSensorTypes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<SensorStatus | 'all'>('all');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [sensorToEdit, setSensorToEdit] = useState<Sensor | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [sensorToDelete, setSensorToDelete] = useState<Sensor | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const [sensorsData, stationsData, definitionsData] = await Promise.all([getSensors(), getStations(), getDefinitions()]);
            setSensors(sensorsData);
            setStations(stationsData);
            setSensorTypes(definitionsData.sensorTypes.map(st => st.name));
        } catch (err) {
            setError('Sensör verileri yüklenirken bir hata oluştu.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const filteredSensors = useMemo(() => {
        return sensors
            .filter(sensor => statusFilter === 'all' || sensor.status === statusFilter)
            .filter(sensor =>
                sensor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sensor.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (stationMap.get(sensor.stationId) || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [sensors, searchTerm, statusFilter, stationMap]);

    const handleSaveSensor = async (sensorData: Partial<Sensor> & { id?: string; isActive?: boolean }) => {
        try {
            if (sensorToEdit) {
                await updateSensor(sensorToEdit.id, sensorData);
            } else {
                await addSensor(sensorData);
            }
            fetchData();
        } catch (error) {
            console.error("Failed to save sensor", error);
            alert("Sensör kaydedilirken bir hata oluştu.");
        }
    };

    const handleDeleteSensor = (sensor: Sensor) => {
        setSensorToDelete(sensor);
        setIsDeleteModalOpen(true);
    };

    const executeDelete = async () => {
        if (!sensorToDelete) return;
        try {
            await deleteSensor(sensorToDelete.id);
            fetchData();
        } catch (error) {
            console.error("Failed to delete sensor:", error);
            alert("Sensör silinirken bir hata oluştu.");
        }
    };

    const handleOpenEdit = (sensor: Sensor) => {
        setSensorToEdit(sensor);
        setIsDrawerOpen(true);
    };

    const handleOpenAdd = () => {
        setSensorToEdit(null);
        setIsDrawerOpen(true);
    };
    
    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setSensorToEdit(null);
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-1/3">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                        <input
                            type="text"
                            placeholder="Sensör, tip veya istasyon ara..."
                            className="w-full bg-secondary border border-gray-300 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                            className="w-full md:w-auto bg-secondary border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as SensorStatus | 'all')}
                        >
                            <option value="all">Tüm Durumlar</option>
                            {Object.values(SensorStatus).map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleOpenAdd}
                            className="flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors w-full md:w-auto">
                            <AddIcon className="w-5 h-5" />
                            <span className="font-semibold text-sm">Yeni Ekle</span>
                        </button>
                    </div>
                </div>
            </Card>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
                </div>
            ) : error ? (
                <Card>
                    <div className="text-center py-8 text-danger flex flex-col items-center justify-center gap-2">
                        <ExclamationIcon className="w-12 h-12" />
                        <p className="font-semibold">{error}</p>
                    </div>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredSensors.map(sensor => (
                            <SensorCard
                                key={sensor.id}
                                sensor={sensor}
                                stationName={stationMap.get(sensor.stationId) || 'Atanmamış'}
                                onEdit={handleOpenEdit}
                                onDelete={handleDeleteSensor}
                            />
                        ))}
                    </div>
                    {filteredSensors.length === 0 && (
                        <Card>
                            <div className="text-center py-8 text-muted">
                                <p>Arama kriterlerinize uygun sensör bulunamadı.</p>
                            </div>
                        </Card>
                    )}
                </>
            )}

            <AddSensorDrawer
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                onSave={handleSaveSensor}
                stations={stations}
                sensorTypes={sensorTypes}
                sensorToEdit={sensorToEdit}
            />
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={executeDelete}
                title="Sensörü Sil"
                message={
                <>
                    <strong>{sensorToDelete?.name}</strong> adlı sensörü silmek üzeresiniz. Bu işlem geri alınamaz. Onaylamak için şifreyi girin.
                </>
                }
            />
        </div>
    );
};

export default Sensors;