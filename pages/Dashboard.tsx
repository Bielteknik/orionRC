import React, { useState, useEffect, useMemo } from 'react';
import { Station, Sensor, SensorStatus } from '../types.ts';
import Card from '../components/common/Card.tsx';
import FullMap from '../components/common/FullMap.tsx';
import { StationIcon, SensorIcon, CameraIcon, ExclamationIcon, ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon } from '../components/icons/Icons.tsx';
import Skeleton from '../components/common/Skeleton.tsx';

interface DashboardProps {
  onViewStationDetails: (stationId: string) => void;
  stations: Station[];
  sensors: Sensor[];
  onRefresh: () => void;
}

const StatCard: React.FC<{ 
    icon: React.ReactElement<React.HTMLAttributes<SVGElement>>; 
    label: string; 
    value: string | number; 
    subtitle: string;
    iconColorClass: string;
    gradientFromClass: string;
}> = ({ icon, label, value, subtitle, iconColorClass, gradientFromClass }) => (
    <div className={`relative p-3 overflow-hidden bg-gradient-to-br ${gradientFromClass} to-white dark:from-gray-800 dark:to-dark-secondary bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm`}>
        <div className="flex items-center">
            {React.cloneElement(icon, { className: `w-5 h-5 ${iconColorClass}`})}
            <p className={`ml-2 font-semibold text-sm text-gray-700 dark:text-gray-300`}>{label}</p>
        </div>
        <p className={`mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100`}>{value}</p>
        <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        <div className={`absolute -right-3 -bottom-3 opacity-10 dark:opacity-20`}>
            {React.cloneElement(icon, { className: `w-16 h-16 ${iconColorClass}` })}
        </div>
    </div>
);

const getNumericValue = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'object') {
        const numeric = Object.values(value).find(v => typeof v === 'number');
        return typeof numeric === 'number' ? numeric : null;
    }
    const parsed = parseFloat(String(value));
    return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
};


const SensorDisplayCard: React.FC<{ sensor: Sensor }> = ({ sensor }) => {
    const getSensorIcon = (type: string) => {
        switch (type) {
            case 'Sıcaklık': return <ThermometerIcon className="w-5 h-5 text-muted" />;
            case 'Nem': return <DropletIcon className="w-5 h-5 text-muted" />;
            case 'Rüzgar Hızı': case 'Rüzgar': return <WindSockIcon className="w-5 h-5 text-muted" />;
            case 'Basınç': return <GaugeIcon className="w-5 h-5 text-muted" />;
            default: return <SensorIcon className="w-5 h-5 text-muted" />;
        }
    };
    const statusStyles: Record<SensorStatus, string> = {
        [SensorStatus.Active]: 'bg-success/10 text-success',
        [SensorStatus.Inactive]: 'bg-gray-200 text-gray-600',
        [SensorStatus.Error]: 'bg-danger/10 text-danger',
        [SensorStatus.Maintenance]: 'bg-warning/10 text-warning',
    };
    
    const displayValue = useMemo(() => {
        const numericValue = getNumericValue(sensor.value);
        if (numericValue === null) {
            // Handle cases like "N/A" from weight sensor if value is not numeric
             if (sensor.value && typeof sensor.value === 'object' && 'weight_kg' in sensor.value && sensor.value.weight_kg === 'N/A') {
                return 'N/A';
             }
             return 'N/A';
        }
        // Always format to 2 decimal places.
        return numericValue.toFixed(2);
    }, [sensor.value]);


    return (
        <Card className="p-3 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="bg-gray-100 p-1.5 rounded-md">{getSensorIcon(sensor.type)}</div>
                    <div>
                        <p className="font-semibold text-sm text-gray-800">{sensor.name}</p>
                        <p className="text-xs text-muted">{sensor.type}</p>
                    </div>
                </div>
                <div className={`text-xs font-semibold py-0.5 px-2 rounded-full ${statusStyles[sensor.status] || statusStyles[SensorStatus.Inactive]}`}>
                    {sensor.status}
                </div>
            </div>
            <div className="mt-2 text-right">
                <span className="text-xl font-bold text-gray-900">{displayValue}</span>
                <span className="text-sm text-muted ml-1">{sensor.unit}</span>
            </div>
        </Card>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onViewStationDetails, stations, sensors, onRefresh }) => {
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
    const isLoading = stations.length === 0 && sensors.length === 0;

    useEffect(() => {
        if (!selectedStationId && stations.length > 0) {
            setSelectedStationId(stations[0].id);
        }
    }, [stations, selectedStationId]);

    const stats = useMemo(() => {
        const activeStations = stations.filter(s => s.status === 'active').length;
        const totalSensors = sensors.length;
        const totalCameras = stations.reduce((acc, s) => acc + (s.cameraCount || 0), 0);
        const totalAlerts = stations.reduce((acc, s) => acc + (s.activeAlerts || 0), 0);
        return { activeStations, totalSensors, totalCameras, totalAlerts, totalStations: stations.length };
    }, [stations, sensors]);

    const sensorsForSelectedStation = useMemo(() => {
        if (!selectedStationId) return [];
        return sensors.filter(s => s.stationId === selectedStationId);
    }, [sensors, selectedStationId]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Skeleton className="h-28" /> <Skeleton className="h-28" />
                    <Skeleton className="h-28" /> <Skeleton className="h-28" />
                </div>
                <Skeleton className="h-[400px] lg:h-[450px]" />
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-full gap-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 flex-shrink-0">
                <StatCard icon={<StationIcon />} label="Aktif İstasyon" value={`${stats.activeStations} / ${stats.totalStations}`} subtitle="Sistemdeki online istasyonlar" iconColorClass="text-blue-500" gradientFromClass="from-blue-50" />
                <StatCard icon={<SensorIcon />} label="Toplam Sensör" value={stats.totalSensors} subtitle="Tüm istasyonlardaki sensörler" iconColorClass="text-green-500" gradientFromClass="from-green-50" />
                <StatCard icon={<CameraIcon />} label="Toplam Kamera" value={stats.totalCameras} subtitle="Tüm istasyonlardaki kameralar" iconColorClass="text-purple-500" gradientFromClass="from-purple-50" />
                <StatCard icon={<ExclamationIcon />} label="Aktif Alarmlar" value={stats.totalAlerts} subtitle="Müdahale gerektiren uyarılar" iconColorClass="text-red-500" gradientFromClass="from-red-50" />
            </div>

            {/* Map and Sensor Panel */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Map Section */}
                <div className="w-full lg:w-7/12 bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                    <FullMap 
                        stations={stations} 
                        onViewStationDetails={onViewStationDetails} 
                        onStationSelect={setSelectedStationId}
                        selectedStationId={selectedStationId}
                        onRefresh={onRefresh}
                    />
                </div>

                {/* Sensor Data Section */}
                <div className="w-full lg:w-5/12 flex flex-col gap-4">
                    <Card className="flex-shrink-0 p-4">
                        <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">İstasyon Sensörleri</h2>
                        <select 
                            value={selectedStationId || ''}
                            onChange={e => setSelectedStationId(e.target.value)}
                            className="w-full mt-2 p-2 border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </Card>

                    <div className="flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 min-h-0">
                         {sensorsForSelectedStation.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {sensorsForSelectedStation.map(sensor => (
                                    <SensorDisplayCard key={sensor.id} sensor={sensor} />
                                ))}
                            </div>
                        ) : (
                            <Card className="flex items-center justify-center h-full min-h-[200px]">
                                <p className="text-center text-muted">Bu istasyon için sensör bulunamadı.</p>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;