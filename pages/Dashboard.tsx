import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Station, Sensor } from '../types.ts';
import Card from '../components/common/Card.tsx';
import FullMap from '../components/common/FullMap.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { useTheme } from '../components/ThemeContext.tsx';
import { ChartBarIcon, MapIcon, ExclamationIcon, ReportsIcon, CalendarIcon, BrainIcon } from '../components/icons/Icons.tsx';
import { getStations, getSensors, getReadingsHistory } from '../services/apiService.ts';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown.tsx';
import Reports from './Reports.tsx';
import Analysis from './Analysis.tsx';

// Constants & Defaults
const DEFAULT_COLORS = ['#E95420', '#77216F', '#2dd4bf', '#c084fc', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];

const getPastDateString = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
};

// --- CHART COMPONENTS (NOW 'DUMB' AND RECEIVE DATA AS PROPS) ---

const TemperatureScatterChart: React.FC<{ data: any[], stations: Station[], isLoading: boolean }> = ({ data, stations, isLoading }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';

    return (
        <div className="h-full p-4 flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Sıcaklık Trendleri</h3>
            <p className="text-xs text-muted mb-2 -mt-2">Seçilen periyottaki sıcaklık değişimleri</p>
            {isLoading ? <Skeleton className="w-full h-full"/> : 
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 5, right: 20, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                    <XAxis type="number" dataKey="time" name="zaman" domain={['dataMin', 'dataMax']} tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})} stroke={tickColor} fontSize={10} />
                    <YAxis type="number" dataKey="value" name="sıcaklık" unit="°C" stroke={tickColor} fontSize={10}/>
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }}/>
                    {stations.map((station, index) => (
                        <Scatter key={station.id} name={station.name} data={data.filter(d => d.stationId === station.id)} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                    ))}
                </ScatterChart>
            </ResponsiveContainer>}
        </div>
    );
};

const HumidityAreaChart: React.FC<{ data: any[], stations: Station[], isLoading: boolean }> = ({ data, stations, isLoading }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';

    return (
        <div className="h-full p-4 flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Nem Oranları</h3>
            <p className="text-xs text-muted mb-2 -mt-2">İstasyonlara göre nem seviyeleri</p>
             {isLoading ? <Skeleton className="w-full h-full"/> : 
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                    <XAxis dataKey="time" stroke={tickColor} fontSize={10}/>
                    <YAxis stroke={tickColor} fontSize={10} unit="%"/>
                    <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }}/>
                    {stations.map((station, index) => (
                        <Area key={station.id} type="monotone" dataKey={station.name} stroke={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} fillOpacity={0.6} />
                    ))}
                </AreaChart>
            </ResponsiveContainer>}
        </div>
    );
};

const WindSpeedBarChart: React.FC<{ stations: Station[], sensors: Sensor[] }> = ({ stations, sensors }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';
    
    const data = useMemo(() => {
        return stations.map(station => {
            const windSensor = sensors.find(s => s.stationId === station.id && s.type === 'Rüzgar Hızı');
            return {
                name: station.name,
                'Rüzgar Hızı': windSensor ? (typeof windSensor.value === 'number' ? windSensor.value : 0) : 0
            };
        });
    }, [stations, sensors]);

    return (
        <div className="h-full p-4 flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Rüzgar Hızları</h3>
            <p className="text-xs text-muted mb-2 -mt-2">İstasyonlardaki mevcut rüzgar hızları</p>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                    <XAxis dataKey="name" stroke={tickColor} fontSize={10} interval={0} angle={-25} textAnchor="end"/>
                    <YAxis stroke={tickColor} fontSize={10} unit="km/h"/>
                    <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }}/>
                    <Bar dataKey="Rüzgar Hızı" fill="#334155" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};


const MultiStationComparisonChart: React.FC<{ data: any[], isLoading: boolean }> = ({ data, isLoading }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';

    return (
         <div className="h-full p-4 flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Çoklu İstasyon Karşılaştırma</h3>
            <p className="text-xs text-muted mb-2 -mt-2">Tüm istasyonlardaki sıcaklık karşılaştırması</p>
            {isLoading ? <Skeleton className="w-full h-full"/> : 
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 5, right: 20, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                    <XAxis type="category" dataKey="stationName" name="istasyon" stroke={tickColor} fontSize={10} interval={0} angle={-25} textAnchor="end"/>
                    <YAxis type="number" dataKey="value" name="sıcaklık" unit="°C" stroke={tickColor} fontSize={10}/>
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }}/>
                    <Scatter name="Sıcaklık Okumaları" data={data} fill="#334155" shape="circle" />
                </ScatterChart>
            </ResponsiveContainer>}
        </div>
    );
};



const Dashboard: React.FC<{ onViewStationDetails: (stationId: string) => void; }> = ({ onViewStationDetails }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    
    const [activeTab, setActiveTab] = useState<'analytics' | 'reports' | 'analysis' | 'map'>('analytics');

    // Filter states
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState({ start: getPastDateString(1), end: getPastDateString(0) });
    
    // Chart data states
    const [isChartLoading, setIsChartLoading] = useState(false);
    const [tempData, setTempData] = useState<any[]>([]);
    const [humidityData, setHumidityData] = useState<any[]>([]);
    
    const stationOptions = useMemo(() => stations.map(s => ({ value: s.id, label: s.name })), [stations]);
    const filteredStations = useMemo(() => stations.filter(s => selectedStationIds.length === 0 || selectedStationIds.includes(s.id)), [selectedStationIds, stations]);

    // Initial data fetching for stations and sensors
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const [stationsData, sensorsData] = await Promise.all([getStations(), getSensors()]);
                setStations(stationsData);
                setSensors(sensorsData);
                // Select all stations by default
                setSelectedStationIds(stationsData.map(s => s.id));
            } catch (err) {
                setError('Pano verileri yüklenirken bir hata oluştu.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Effect to fetch and process chart data when filters change
    useEffect(() => {
        if (selectedStationIds.length === 0) {
            setTempData([]);
            setHumidityData([]);
            return;
        }

        const fetchChartData = async () => {
            setIsChartLoading(true);
            try {
                const [tempHistory, humidityHistory] = await Promise.all([
                    getReadingsHistory({ stationIds: selectedStationIds, sensorTypes: ['Sıcaklık'], start: dateRange.start, end: dateRange.end }),
                    getReadingsHistory({ stationIds: selectedStationIds, sensorTypes: ['Nem'], start: dateRange.start, end: dateRange.end })
                ]);

                // Process temperature data for scatter chart
                setTempData(tempHistory.map(d => ({ ...d, time: new Date(d.timestamp).getTime() })));

                // Process humidity data for area chart
                const groupedByTime: { [key: string]: any } = {};
                humidityHistory.forEach(r => {
                    const time = new Date(r.timestamp).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
                    if (!groupedByTime[time]) groupedByTime[time] = { time };
                    groupedByTime[time][r.stationName] = r.value;
                });
                setHumidityData(Object.values(groupedByTime));

            } catch (err) {
                console.error("Failed to fetch chart history:", err);
            } finally {
                setIsChartLoading(false);
            }
        };

        fetchChartData();
    }, [selectedStationIds, dateRange]);
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('analytics')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'analytics' ? 'border-accent text-accent' : 'border-transparent text-muted dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}><ChartBarIcon className="w-5 h-5" /><span>Analitik</span></button>
                    <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'reports' ? 'border-accent text-accent' : 'border-transparent text-muted dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}><ReportsIcon className="w-5 h-5" /><span>Raporlar</span></button>
                    <button onClick={() => setActiveTab('analysis')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'analysis' ? 'border-accent text-accent' : 'border-transparent text-muted dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}><BrainIcon className="w-5 h-5" /><span>Analiz</span></button>
                    <button onClick={() => setActiveTab('map')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'map' ? 'border-accent text-accent' : 'border-transparent text-muted dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}><MapIcon className="w-5 h-5" /><span>İstasyon Haritası</span></button>
                </nav>
            </div>

            {activeTab === 'analytics' && (
                <div className="overflow-y-auto pt-4 space-y-4">
                    <Card>
                         {isLoading ? <Skeleton className="h-12"/> : error ? (
                             <div className="text-center py-4 text-danger flex items-center justify-center gap-2"><ExclamationIcon/><span>{error}</span></div>
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">İstasyonlar</label>
                                    <MultiSelectDropdown options={stationOptions} selected={selectedStationIds} onChange={setSelectedStationIds} label="İstasyon"/>
                                </div>
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zaman Aralığı</label>
                                    <div className="flex items-center gap-2 bg-secondary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5">
                                        <CalendarIcon className="w-5 h-5 text-muted dark:text-gray-400"/>
                                        <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-transparent focus:outline-none text-sm w-full" />
                                        <span className="text-muted dark:text-gray-400">-</span>
                                        <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-transparent focus:outline-none text-sm w-full" />
                                    </div>
                                </div>
                            </div>
                         )}
                    </Card>

                    {isLoading ? (
                        <div className="grid grid-cols-4 gap-6 auto-rows-[300px]">
                            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="col-span-2"/>)}
                        </div>
                    ) : error ? null : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[minmax(300px,_auto)]">
                            <Card className="p-0" style={{ gridArea: '1 / 1 / 2 / 3' }}><TemperatureScatterChart data={tempData} stations={filteredStations} isLoading={isChartLoading} /></Card>
                            <Card className="p-0" style={{ gridArea: '1 / 3 / 2 / 5' }}><HumidityAreaChart data={humidityData} stations={filteredStations} isLoading={isChartLoading} /></Card>
                            <Card className="p-0" style={{ gridArea: '2 / 1 / 3 / 3' }}><WindSpeedBarChart stations={filteredStations} sensors={sensors} /></Card>
                            <Card className="p-0" style={{ gridArea: '2 / 3 / 3 / 5' }}><MultiStationComparisonChart data={tempData} isLoading={isChartLoading} /></Card>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'reports' && (
                 <div className="overflow-y-auto pt-4">
                    <Reports />
                </div>
            )}
            {activeTab === 'analysis' && (
                 <div className="overflow-y-auto pt-4">
                    <Analysis />
                </div>
            )}
            {activeTab === 'map' && (
                <div className="flex-grow pt-4">
                    {isLoading ? <Skeleton className="h-full w-full rounded-lg"/> : error ? (
                        <Card><div className="text-center py-8 text-danger flex items-center justify-center gap-2"><ExclamationIcon/><span>Harita verileri yüklenemedi.</span></div></Card>
                    ) : (
                        <div className="h-full bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                            <FullMap stations={stations} onViewStationDetails={onViewStationDetails} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;