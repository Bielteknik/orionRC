import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sensor, Station, SensorStatus, Camera } from '../types.ts';
import Card from '../components/common/Card.tsx';
import { AddIcon, SearchIcon, EditIcon, DeleteIcon, ExclamationIcon, ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, SensorIcon as GenericSensorIcon, BrainIcon, RefreshIcon } from '../components/icons/Icons.tsx';
import AddSensorDrawer from '../components/AddSensorDrawer.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { getSensors, getStations, addSensor, updateSensor, deleteSensor, getDefinitions, forceReadSensor, getCameras } from '../services/apiService.ts';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal.tsx';

const formatTimeAgo = (isoString: string | undefined): string => {
    if (!isoString) return 'Veri Yok';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) { // Check for invalid date
        return 'Veri Yok';
    }

    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 10) return "az önce";
    if (seconds < 60) return `${seconds} sn önce`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} dk önce`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;

    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
};


const SensorCard: React.FC<{
    sensor: Sensor;
    stationName: string;
    onEdit: (sensor: Sensor) => void;
    onDelete: (sensor: Sensor) => void;
    onForceRead: (sensor: Sensor) => void;
    isReading: boolean;
}> = ({ sensor, stationName, onEdit, onDelete, onForceRead, isReading }) => {
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

    const displayValue = useMemo(() => {
        const { value, type, interface: sensorInterface } = sensor;
        if (value === null || value === undefined) return 'N/A';
    
        if (typeof value === 'object') {
            if (sensorInterface === 'openweather') {
                if (type === 'Sıcaklık' && typeof value.temperature === 'number') {
                    return value.temperature.toFixed(1);
                }
                if (type === 'Nem' && typeof value.humidity === 'number') {
                    return value.humidity.toFixed(1);
                }
            }
            const numericValue = Object.values(value).find(v => typeof v === 'number');
            if (typeof numericValue === 'number') {
                return numericValue.toFixed(1);
            }
            return 'N/A';
        }
    
        // For non-objects, try to format as a number if possible, otherwise just convert to string.
        const numValue = Number(value);
        if (!isNaN(numValue) && isFinite(numValue)) {
            // Format to 1 decimal place, but don't add .0 for integers.
            return String(parseFloat(numValue.toFixed(1)));
        }
    
        // For any other primitive type like a non-numeric string or boolean, convert to string to be safe.
        return String(value);
    }, [sensor]);

    return (
        <Card className="p-3 flex flex-col h-full">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 p-2 rounded-lg">{getSensorIcon(sensor)}</div>
                    <div>
                        <h3 className="font-semibold text-gray-900 text-base">{sensor.name}</h3>
                        <p className="text-xs text-muted">{stationName || 'Atanmamış'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-0">
                    <button 
                        onClick={() => onForceRead(sensor)} 
                        className="p-1.5 text-muted hover:text-accent rounded-full hover:bg-accent/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50" 
                        title={sensor.interface === 'virtual' ? "Sanal sensörler manuel olarak tetiklenemez" : "Şimdi Oku"}
                        disabled={isReading || sensor.interface === 'virtual'}
                    >
                        {isReading ? (
                            <svg className="animate-spin h-4 w-4 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <RefreshIcon className="w-4 h-4" />
                        )}
                    </button>
                    <button onClick={() => onEdit(sensor)} className="p-1.5 text-muted hover:text-accent rounded-full hover:bg-accent/10 transition-colors"><EditIcon className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(sensor)} className="p-1.5 text-muted hover:text-danger rounded-full hover:bg-danger/10 transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="flex-grow text-center my-2">
                <p className="text-3xl font-bold text-gray-900">{displayValue}<span className="text-lg text-muted ml-1">{sensor.unit || ''}</span></p>
                <p className="text-xs text-gray-600">{sensor.type}</p>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-200">
                <span className={`px-2 py-0.5 font-semibold rounded-full ${statusStyles[sensor.status]}`}>
                    {sensor.status}
                </span>
                <span className="text-muted">{formatTimeAgo(sensor.lastUpdate)}</span>
            </div>
        </Card>
    );
};

const Sensors: React.FC = () => {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [sensorTypes, setSensorTypes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<SensorStatus | 'all'>('all');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [sensorToEdit, setSensorToEdit] = useState<Sensor | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [sensorToDelete, setSensorToDelete] = useState<Sensor | null>(null);
    const [isReading, setIsReading] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            // Don't set loading to true on refetch, only on initial load
            if (sensors.length === 0) setIsLoading(true);
            setError(null);
            const [sensorsData, stationsData, definitionsData, camerasData] = await Promise.all([
                getSensors(), 
                getStations(), 
                getDefinitions(),
                getCameras()
            ]);
            setSensors(sensorsData);
            setStations(stationsData);
            setSensorTypes(definitionsData.sensorTypes.map(st => st.name));
            setCameras(camerasData);
        } catch (err) {
            setError('Sensör verileri yüklenirken bir hata oluştu.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [sensors.length]);

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

    const handleForceRead = async (sensor: Sensor) => {
        if (!sensor.stationId) {
            alert("Bu sensör bir istasyona atanmamış, okuma tetiklenemez.");
            return;
        }
        setIsReading(sensor.id);
        try {
            await forceReadSensor(sensor.id);
            setTimeout(() => {
                setIsReading(null);
                fetchData(); 
            }, 3000); 
        } catch (error) {
            console.error("Failed to trigger sensor read:", error);
            alert("Sensör okuma komutu gönderilemedi.");
            setIsReading(null);
        }
    };


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
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredSensors.map(sensor => (
                            <SensorCard
                                key={sensor.id}
                                sensor={sensor}
                                stationName={stationMap.get(sensor.stationId) || 'Atanmamış'}
                                onEdit={handleOpenEdit}
                                onDelete={handleDeleteSensor}
                                onForceRead={handleForceRead}
                                isReading={isReading === sensor.id}
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
                cameras={cameras}
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