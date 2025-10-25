import React, { useState, useEffect, useMemo } from 'react';
import { Station, Sensor, Trend } from '../types.ts';
import { getReadingsHistory } from '../services/apiService.ts';
import Card from '../components/common/Card.tsx';
import FullMap from '../components/common/FullMap.tsx';
import WindRoseChart from '../components/WindRoseChart.tsx';
import { StationIcon, SensorIcon, CameraIcon, ExclamationIcon, TrendUpIcon, TrendDownIcon, TrendStableIcon } from '../components/icons/Icons.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown.tsx';

interface DashboardProps {
  onViewStationDetails: (stationId: string) => void;
  stations: Station[];
  sensors: Sensor[];
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
    <Card className={`p-4 flex items-center space-x-4 border-l-4 ${color}`}>
        {icon}
        <div>
            <p className="text-sm font-medium text-muted dark:text-gray-400">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
    </Card>
);

interface DataCardProps {
    type: string;
    value: number | string;
    unit: string;
    trend: Trend;
}
const DataCard: React.FC<DataCardProps> = ({ type, value, unit, trend }) => {
    const trendInfo = {
        up: { icon: <TrendUpIcon className="w-5 h-5 text-success" />, color: 'text-success' },
        down: { icon: <TrendDownIcon className="w-5 h-5 text-danger" />, color: 'text-danger' },
        stable: { icon: <TrendStableIcon className="w-5 h-5 text-muted" />, color: 'text-muted' },
    };

    return (
        <Card className="p-4">
            <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{type}</p>
                {trendInfo[trend].icon}
            </div>
            <div className="mt-2 text-center">
                <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
                <span className="text-lg text-muted dark:text-gray-400 ml-1">{unit}</span>
            </div>
        </Card>
    );
};

const PRIMARY_SENSOR_TYPES = ['Sıcaklık', 'Nem', 'Rüzgar Hızı', 'Basınç', 'Yağış', 'Kar Yüksekliği', 'UV İndeksi'];


const Dashboard: React.FC<DashboardProps> = ({ onViewStationDetails, stations, sensors }) => {
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
    const isLoading = stations.length === 0 && sensors.length === 0;

    useEffect(() => {
        // Initially select all stations when data first loads
        if (stations.length > 0 && selectedStationIds.length === 0) {
            setSelectedStationIds(stations.map(s => s.id));
        }
    }, [stations]);


    const filteredStations = useMemo(() => {
        if (selectedStationIds.length === stations.length) return stations;
        return stations.filter(s => selectedStationIds.includes(s.id));
    }, [stations, selectedStationIds]);

    const filteredSensors = useMemo(() => {
        const selectedIds = new Set(selectedStationIds.length === stations.length ? stations.map(s => s.id) : selectedStationIds);
        return sensors.filter(s => selectedIds.has(s.stationId));
    }, [sensors, selectedStationIds, stations]);
    
    const stationIdKey = useMemo(() => selectedStationIds.sort().join(','), [selectedStationIds]);

    const stats = useMemo(() => {
        const activeStations = filteredStations.filter(s => s.status === 'active').length;
        const totalSensors = filteredSensors.length;
        const totalCameras = filteredStations.reduce((acc, s) => acc + (s.cameraCount || 0), 0);
        const totalAlerts = filteredStations.reduce((acc, s) => acc + (s.activeAlerts || 0), 0);
        return { activeStations, totalSensors, totalCameras, totalAlerts, totalStations: filteredStations.length };
    }, [filteredStations, filteredSensors]);
    
    const latestSensorData = useMemo(() => {
        const data: { [key: string]: { value: any; unit: string } } = {};
        PRIMARY_SENSOR_TYPES.forEach(type => {
            const relevantSensors = filteredSensors.filter(s => s.type === type && s.lastUpdate && s.value !== null && s.value !== undefined);
            if (relevantSensors.length > 0) {
                const latestSensor = relevantSensors.reduce((latest, current) =>
                    new Date(latest.lastUpdate) > new Date(current.lastUpdate) ? latest : current
                );

                let displayValue: any = '--';
                if (latestSensor.value !== null && latestSensor.value !== undefined) {
                    if (typeof latestSensor.value === 'object') {
                        if (latestSensor.interface === 'openweather') {
                            if (type === 'Sıcaklık' && typeof latestSensor.value.temperature === 'number') {
                                displayValue = latestSensor.value.temperature.toFixed(1);
                            } else if (type === 'Nem' && typeof latestSensor.value.humidity === 'number') {
                                displayValue = latestSensor.value.humidity.toFixed(1);
                            }
                        } else {
                            const numericValue = Object.values(latestSensor.value).find(v => typeof v === 'number');
                            // Fix: Use a type guard (`typeof`) to ensure `numericValue` is a number before calling `toFixed`.
                            if (typeof numericValue === 'number') {
                                displayValue = numericValue.toFixed(1);
                            } else {
                                displayValue = '--';
                            }
                        }
                    } else {
                        // Fix: Ensure value is a number before calling toFixed to prevent type errors and runtime errors with non-numeric values.
                        const numValue = Number(latestSensor.value);
                        if (isFinite(numValue)) {
                            displayValue = numValue.toFixed(1);
                        }
                    }
                }
                
                if (displayValue !== '--') {
                    data[type] = { value: displayValue, unit: latestSensor.unit };
                }
            }
        });
        return data;
    }, [filteredSensors]);

    const hasWindSensors = useMemo(() => {
        const availableSensorTypes = new Set(filteredSensors.map(sensor => sensor.type));
        return availableSensorTypes.has('Rüzgar Hızı') && availableSensorTypes.has('Rüzgar Yönü');
    }, [filteredSensors]);


    if (isLoading) {
        return (
            <div className="space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Skeleton className="h-24" /> <Skeleton className="h-24" />
                    <Skeleton className="h-24" /> <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-[480px]" />
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
             <div className="flex flex-col md:flex-row justify-end items-center gap-4">
                <div className="w-full md:w-72">
                    <MultiSelectDropdown
                        label="İstasyon"
                        options={stations.map(s => ({ value: s.id, label: s.name }))}
                        selected={selectedStationIds}
                        onChange={setSelectedStationIds}
                    />
                </div>
            </div>

            <div className="space-y-6 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={<StationIcon className="w-8 h-8 text-blue-500" />} label="Aktif İstasyon" value={`${stats.activeStations} / ${stats.totalStations}`} color="border-l-blue-500" />
                    <StatCard icon={<SensorIcon className="w-8 h-8 text-green-500" />} label="Toplam Sensör" value={stats.totalSensors} color="border-l-green-500" />
                    <StatCard icon={<CameraIcon className="w-8 h-8 text-purple-500" />} label="Toplam Kamera" value={stats.totalCameras} color="border-l-purple-500" />
                    <StatCard icon={<ExclamationIcon className="w-8 h-8 text-danger" />} label="Aktif Alarmlar" value={stats.totalAlerts} color="border-l-danger" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3">
                        <div className="bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm h-[480px] overflow-hidden">
                            <FullMap stations={filteredStations} onViewStationDetails={onViewStationDetails} stationIdKey={stationIdKey} />
                        </div>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            {Object.keys(latestSensorData).length > 0 ? (
                                Object.entries(latestSensorData).map(([type, data]) => (
                                    <DataCard
                                        key={type}
                                        type={type === 'Rüzgar Hızı' ? 'Rüzgar' : type}
                                        // Fix: Property 'value' and 'unit' does not exist on type 'unknown'. Cast data as any to access properties.
                                        value={(data as any).value}
                                        unit={(data as any).unit}
                                        trend={Trend.Stable}
                                    />
                                ))
                            ) : (
                                <div className="col-span-2 text-center text-muted p-4 bg-primary rounded-lg border">
                                    Seçili istasyonlar için görüntülenecek sensör verisi bulunamadı.
                                </div>
                            )}
                        </div>
                        {hasWindSensors ? (
                            <Card className="h-64">
                                <WindRoseChart stations={filteredStations} sensors={sensors} />
                            </Card>
                        ) : (
                            <Card className="h-64 flex items-center justify-center">
                                <p className="text-center text-sm text-muted">Rüzgar Gülü için gerekli Rüzgar Yönü/Hızı sensörleri seçili istasyonlarda bulunamadı.</p>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;