import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trend, Station, WidgetConfig, Sensor } from '../types';
import Card from '../components/common/Card';
import FullMap from '../components/common/FullMap';
import AddWidgetModal from '../components/AddWidgetModal';
import WindRoseChart from '../components/WindRoseChart';
import Skeleton from '../components/common/Skeleton';
import ChartSettingsModal, { ChartStyle } from '../components/ChartSettingsModal';
import { useTheme } from '../components/ThemeContext';
import { TemperatureIcon, HumidityIcon, WindSockIcon, GaugeIcon, TrendUpIcon, TrendDownIcon, TrendStableIcon, PaletteIcon, ChartBarIcon, MapIcon, AddIcon, DeleteIcon, CalendarIcon, ExclamationIcon } from '../components/icons/Icons';
import { getStations, getSensors } from '../services/apiService';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown';


// Constants & Defaults
const DEFAULT_COLORS = ['#E95420', '#77216F', '#2dd4bf', '#c084fc', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
const unitMap: {[key: string]: string} = { 'Sıcaklık': '°C', 'Nem': '%', 'Rüzgar Hızı': 'km/h', 'Basınç': 'hPa', 'Yağış': 'mm', 'UV İndeksi': '', 'Rüzgar Yönü': '°' };

const INITIAL_CHART_STYLES: Record<string, ChartStyle> = {};


const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'card-temp', type: 'dataCard', config: { title: 'Ortalama Sıcaklık', sensorType: 'Sıcaklık' }, gridArea: '1 / 1 / 2 / 2' },
    { id: 'card-hum', type: 'dataCard', config: { title: 'Ortalama Nem', sensorType: 'Nem' }, gridArea: '1 / 2 / 2 / 3' },
    { id: 'card-wind', type: 'dataCard', config: { title: 'Ortalama Rüzgar Hızı', sensorType: 'Rüzgar Hızı' }, gridArea: '1 / 3 / 2 / 4' },
    { id: 'card-press', type: 'dataCard', config: { title: 'Ortalama Basınç', sensorType: 'Basınç' }, gridArea: '1 / 4 / 2 / 5' },
    { id: 'chart-temp', type: 'sensorChart', config: { sensorType: 'Sıcaklık' }, gridArea: '2 / 1 / 3 / 3' },
    { id: 'chart-hum', type: 'sensorChart', config: { sensorType: 'Nem' }, gridArea: '2 / 3 / 3 / 5' },
    { id: 'chart-wind', type: 'sensorChart', config: { sensorType: 'Rüzgar Hızı' }, gridArea: '3 / 1 / 4 / 3' },
    { id: 'chart-press', type: 'sensorChart', config: { sensorType: 'Basınç' }, gridArea: '3 / 3 / 4 / 5' },
    { id: 'chart-windrose', type: 'windRose', config: {}, gridArea: '4 / 1 / 5 / 5' },
];

const getPastDateString = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
};


// --- WIDGET COMPONENTS ---

const DataCardWidget: React.FC<{ title: string; sensorType: string; stations: Station[]; sensors: Sensor[] }> = ({ title, sensorType, stations, sensors }) => {
    const [data, setData] = useState({ value: 'N/A', trend: Trend.Stable, change: '0.0%' });
    const prevValueRef = useRef<number | null>(null);

    const getIcon = () => {
        switch (sensorType) {
            case 'Sıcaklık': return <TemperatureIcon />;
            case 'Nem': return <HumidityIcon />;
            case 'Rüzgar Hızı': return <WindSockIcon />;
            case 'Basınç': return <GaugeIcon />;
            default: return <ChartBarIcon />;
        }
    };

    useEffect(() => {
        if (stations.length === 0 || sensors.length === 0) {
            setData({ value: 'N/A', trend: Trend.Stable, change: '0.0%' });
            prevValueRef.current = null;
            return;
        }

        const relevantSensors = sensors.filter(sensor => 
            stations.some(station => station.id === sensor.stationId) && sensor.type === sensorType
        );

        if (relevantSensors.length === 0) {
            setData({ value: 'N/A', trend: Trend.Stable, change: '0.0%' });
            prevValueRef.current = null;
            return;
        }

        const avgBaseValue = relevantSensors.reduce((acc, s) => acc + s.value, 0) / relevantSensors.length;
        const currentValue = parseFloat((avgBaseValue + (Math.random() - 0.5) * (avgBaseValue * 0.05)).toFixed(1));

        let trend = Trend.Stable;
        let change = '0.0%';

        if (prevValueRef.current !== null && prevValueRef.current > 0) {
            const numericChange = ((currentValue - prevValueRef.current) / prevValueRef.current) * 100;
            if (Math.abs(numericChange) > 0.1) {
                trend = numericChange > 0 ? Trend.Up : Trend.Down;
                change = `${numericChange > 0 ? '+' : ''}${numericChange.toFixed(1)}%`;
            }
        }

        setData({
            value: `${currentValue}${unitMap[sensorType] || ''}`,
            trend: trend,
            change: change
        });
        
        const timeoutId = setTimeout(() => {
            prevValueRef.current = currentValue;
        }, 500);

        return () => clearTimeout(timeoutId);

    }, [sensorType, stations, sensors]);

    const trendIcons = { [Trend.Up]: <TrendUpIcon className="text-danger" />, [Trend.Down]: <TrendDownIcon className="text-success" />, [Trend.Stable]: <TrendStableIcon className="text-muted dark:text-gray-400" /> };
    return (
        <div className="bg-primary dark:bg-gray-800 p-3 h-full flex flex-col">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">{getIcon()}</div>
            <div className="flex items-center space-x-1 text-sm"><div className="w-4 h-4">{trendIcons[data.trend]}</div><span>{data.change}</span></div>
          </div>
          <div className="mt-2 flex-grow flex flex-col justify-center">
            <p className="text-muted dark:text-gray-400 text-sm">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.value}</p>
          </div>
        </div>
    );
};

const SensorChartWidget: React.FC<{
  sensorType: string;
  stations: Station[];
  dateRange: { start: string, end: string };
  styles: Record<string, ChartStyle>;
}> = ({ sensorType, stations, dateRange, styles }) => {
    const [chartData, setChartData] = useState<any[]>([]);
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';
    const gridColor = theme === 'dark' ? '#374151' : '#E5E7EB';

    useEffect(() => {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
            setChartData([]);
            return;
        }

        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let numPoints;
        let timeLabel: (i: number) => string;

        if (diffDays <= 2) {
             numPoints = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60))) + 1; // number of hours
             timeLabel = (i: number) => {
                const d = new Date(startDate);
                d.setHours(d.getHours() + i);
                if (i % 2 === 0) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                return '';
            };
        } else {
            numPoints = diffDays + 1;
            timeLabel = (i: number) => {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const step = Math.ceil(numPoints / 10);
                if (i % step === 0 || i === numPoints - 1) {
                     return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                }
                return '';
            };
        }
        
        numPoints = Math.min(numPoints, 100); // Cap points for performance

        const baseValues: Record<string, number> = { 'Sıcaklık': 22, 'Nem': 65, 'Rüzgar Hızı': 15, 'Basınç': 1012, 'Yağış': 2, 'UV İndeksi': 5 };
        const base = baseValues[sensorType] || 10;
        
        const generatedData = Array.from({ length: numPoints }, (_, i) => {
            const dataPoint: { [key: string]: any } = { time: timeLabel(i) };
            if (stations.length > 0) {
                 stations.forEach((station) => {
                    const stationOffset = (station.id.charCodeAt(station.id.length - 1) % 5) * (base * 0.05);
                    dataPoint[station.name] = parseFloat((base + stationOffset + (Math.random() - 0.5) * base * 0.2).toFixed(1));
                });
            }
            return dataPoint;
        });

        setChartData(generatedData);
    }, [sensorType, stations, dateRange]);

    return (
        <div className="h-full p-4 flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{sensorType} Trendi</h3>
             {stations.length > 0 ? (
                <div className="flex-grow h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="time" stroke={tickColor} fontSize={12} tick={{ dy: 5 }}/>
                            <YAxis stroke={tickColor} fontSize={12} unit={unitMap[sensorType]} />
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', border: `1px solid ${gridColor}` }} />
                            <Legend wrapperStyle={{fontSize: "12px"}}/>
                            {stations.map((station, index) => (
                                <Line key={station.id} type={styles[sensorType]?.type || 'monotone'} dataKey={station.name} name={station.name} stroke={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} strokeWidth={2} dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
             ) : (
                <div className="flex-grow flex items-center justify-center h-64 text-muted dark:text-gray-400">
                    <p>Verileri görüntülemek için bir istasyon seçin.</p>
                </div>
            )}
        </div>
    );
};

const WidgetWrapper: React.FC<{
    widget: WidgetConfig;
    onRemove: (id: string) => void;
    children: React.ReactNode;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
}> = ({ widget, onRemove, children, onDragStart, onDrop }) => {
    return (
        <div
            id={widget.id}
            style={{ gridArea: widget.gridArea }}
            className="relative group bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
            draggable="true"
            onDragStart={(e) => onDragStart(e, widget.id)}
            onDrop={(e) => onDrop(e, widget.id)}
            onDragOver={(e) => e.preventDefault()}
        >
            <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onRemove(widget.id)} className="p-1 bg-white/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-900 rounded-full text-muted dark:text-gray-400 hover:text-danger">
                    <DeleteIcon className="w-4 h-4" />
                </button>
            </div>
            {children}
        </div>
    );
};


// --- MAIN COMPONENT ---

const Dashboard: React.FC<{ onViewStationDetails: (stationId: string) => void; }> = ({ onViewStationDetails }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    
    const [activeTab, setActiveTab] = useState<'analytics' | 'map'>('analytics');
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const draggedWidgetId = useRef<string | null>(null);

    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
    const [selectedSensorTypes, setSelectedSensorTypes] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState({ start: getPastDateString(7), end: getPastDateString(0) });
    
    const allSensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    useEffect(() => {
        allSensorTypes.forEach((type, index) => {
            if (!INITIAL_CHART_STYLES[type]) {
                INITIAL_CHART_STYLES[type] = { stroke: DEFAULT_COLORS[index % DEFAULT_COLORS.length], type: 'monotone' };
            }
        });
    }, [allSensorTypes]);
    
    const stationOptions = useMemo(() => stations.map(s => ({ value: s.id, label: s.name })), [stations]);
    const sensorTypeOptions = useMemo(() => allSensorTypes.map(type => ({ value: type, label: type })), [allSensorTypes]);
    
    const filteredStations = useMemo(() => 
        stations.filter(s => selectedStationIds.includes(s.id)),
        [selectedStationIds, stations]
    );

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const [stationsData, sensorsData] = await Promise.all([getStations(), getSensors()]);
                setStations(stationsData);
                setSensors(sensorsData);
                // Select all stations by default on first load
                setSelectedStationIds(stationsData.map(s => s.id));
            } catch (err) {
                setError('Pano verileri yüklenirken bir hata oluştu.');
                console.error(err);
            } finally {
                // Load widgets after data fetching
                try {
                    const savedWidgets = localStorage.getItem('dashboardWidgets');
                    if (savedWidgets) {
                        setWidgets(JSON.parse(savedWidgets));
                    } else {
                        setWidgets(DEFAULT_WIDGETS);
                    }
                } catch (error) {
                    setWidgets(DEFAULT_WIDGETS);
                }
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Automatically update selectable sensor types based on selected stations
    useEffect(() => {
        if (selectedStationIds.length === 0) {
            setSelectedSensorTypes([]);
            return;
        }

        if (selectedStationIds.length === 1) {
            const stationId = selectedStationIds[0];
            const stationSensors = sensors.filter(s => s.stationId === stationId);
            const availableTypes = [...new Set(stationSensors.map(s => s.type))];
            setSelectedSensorTypes(availableTypes);
            return;
        }

        const sensorTypesByStation = selectedStationIds.map(id => 
            new Set(sensors.filter(s => s.stationId === id).map(s => s.type))
        );
        
        if(sensorTypesByStation.length === 0) {
            setSelectedSensorTypes([]);
            return;
        }

        const commonTypes = sensorTypesByStation.reduce((common, currentSet) => {
            return new Set([...common].filter(type => currentSet.has(type)));
        });

        setSelectedSensorTypes(Array.from(commonTypes));

    }, [selectedStationIds, sensors]);

    const filteredWidgets = useMemo(() => {
        return widgets.filter(widget => {
            if (widget.type === 'dataCard' || widget.type === 'sensorChart') {
                return selectedSensorTypes.includes(widget.config.sensorType);
            }
            if (widget.type === 'windRose') {
                return selectedSensorTypes.includes('Rüzgar Yönü') && selectedSensorTypes.includes('Rüzgar Hızı');
            }
            return true;
        });
    }, [widgets, selectedSensorTypes]);

    // Save layout to localStorage
    useEffect(() => {
        if (!isLoading) {
             localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
        }
    }, [widgets, isLoading]);

    const handleAddWidget = (widget: Omit<WidgetConfig, 'id' | 'gridArea'>) => {
        const newWidget: WidgetConfig = {
            ...widget,
            id: `${widget.type}-${Date.now()}`,
            gridArea: 'auto / span 2', // Default size
        };
        setWidgets(prev => [...prev, newWidget]);
    };

    const handleRemoveWidget = (idToRemove: string) => {
        setWidgets(prev => prev.filter(w => w.id !== idToRemove));
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        draggedWidgetId.current = id;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
        e.preventDefault();
        const sourceId = draggedWidgetId.current;
        if (!sourceId || sourceId === targetId) return;

        setWidgets(prev => {
            const sourceIndex = prev.findIndex(w => w.id === sourceId);
            const targetIndex = prev.findIndex(w => w.id === targetId);
            if (sourceIndex === -1 || targetIndex === -1) return prev;
            
            const reordered = [...prev];
            const [removed] = reordered.splice(sourceIndex, 1);
            reordered.splice(targetIndex, 0, removed);
            return reordered;
        });
        draggedWidgetId.current = null;
    };
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('analytics')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'analytics' ? 'border-accent text-accent' : 'border-transparent text-muted dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}><ChartBarIcon className="w-5 h-5" /><span>Analitik</span></button>
                    <button onClick={() => setActiveTab('map')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'map' ? 'border-accent text-accent' : 'border-transparent text-muted dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}><MapIcon className="w-5 h-5" /><span>İstasyon Haritası</span></button>
                </nav>
                 {activeTab === 'analytics' && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsAddWidgetModalOpen(true)} className="flex items-center justify-center gap-2 bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors"><AddIcon className="w-5 h-5" /><span className="font-semibold text-sm">Widget Ekle</span></button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="flex items-center justify-center gap-2 bg-primary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"><PaletteIcon className="w-5 h-5 text-muted dark:text-gray-400" /><span className="font-semibold text-sm">Görünüm</span></button>
                    </div>
                 )}
            </div>

            {activeTab === 'analytics' && (
                <div className="overflow-y-auto pt-4 space-y-4">
                    <Card>
                         {isLoading ? <Skeleton className="h-24"/> : error ? (
                             <div className="text-center py-4 text-danger flex items-center justify-center gap-2"><ExclamationIcon/><span>{error}</span></div>
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">İstasyonlar</label>
                                    <MultiSelectDropdown options={stationOptions} selected={selectedStationIds} onChange={setSelectedStationIds} label="İstasyon"/>
                                </div>
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sensör Tipleri (Otomatik)</label>
                                    <MultiSelectDropdown options={sensorTypeOptions} selected={selectedSensorTypes} onChange={setSelectedSensorTypes} label="Sensör"/>
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
                        <div className="grid grid-cols-4 gap-6 auto-rows-[120px]">
                            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className={i > 3 ? "col-span-2" : "col-span-1"}/>)}
                        </div>
                    ) : error ? null : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[minmax(120px,_auto)]">
                           {filteredWidgets.map(widget => (
                                <WidgetWrapper key={widget.id} widget={widget} onRemove={handleRemoveWidget} onDragStart={handleDragStart} onDrop={handleDrop}>
                                    {widget.type === 'dataCard' && <DataCardWidget title={widget.config.title} sensorType={widget.config.sensorType} stations={filteredStations} sensors={sensors} />}
                                    {widget.type === 'sensorChart' && <SensorChartWidget sensorType={widget.config.sensorType} stations={filteredStations} dateRange={dateRange} styles={INITIAL_CHART_STYLES} />}
                                    {widget.type === 'windRose' && <WindRoseChart stations={filteredStations} sensors={sensors} />}
                                </WidgetWrapper>
                           ))}
                           {filteredWidgets.length === 0 && (
                               <div className="lg:col-span-4 md:col-span-2 text-center py-16">
                                   <Card>
                                       <p className="text-muted dark:text-gray-400">Seçili filtrelere uygun widget bulunamadı.</p>
                                   </Card>
                               </div>
                           )}
                        </div>
                    )}
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

            <ChartSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} sensorTypes={allSensorTypes} initialStyles={INITIAL_CHART_STYLES} onSave={(s) => { console.log(s); setIsSettingsModalOpen(false);}}/>
            <AddWidgetModal isOpen={isAddWidgetModalOpen} onClose={() => setIsAddWidgetModalOpen(false)} onAddWidget={handleAddWidget} sensorTypes={allSensorTypes} />
        </div>
    );
};

export default Dashboard;
