
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { Station, Sensor, WidgetConfig, WidgetType } from '../types.ts';
import { getReadingsHistory } from '../services/apiService.ts';
import { useTheme } from '../components/ThemeContext.tsx';
import FullMap from '../components/common/FullMap.tsx';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown.tsx';
import AddWidgetModal from '../components/AddWidgetModal.tsx';
import ChartSettingsModal, { ChartStyle } from '../components/ChartSettingsModal.tsx';
import WindRoseChart from '../components/WindRoseChart.tsx';
import { ChartBarIcon, MapIcon, AddIcon, PaletteIcon, XIcon, ThermometerIcon, DropletIcon, WindIcon, PressureIcon } from '../components/icons/Icons.tsx';
import { getNumericValue } from '../utils/helpers.ts';

const SENSOR_ICONS: { [key: string]: React.ReactNode } = {
  'Sıcaklık': <ThermometerIcon className="w-6 h-6 text-red-500" />,
  'Nem': <DropletIcon className="w-6 h-6 text-blue-500" />,
  'Rüzgar Hızı': <WindIcon className="w-6 h-6 text-gray-500" />,
  'Basınç': <PressureIcon className="w-6 h-6 text-purple-500" />,
};

// --- WIDGET COMPONENTS ---

const DataCard: React.FC<{ title: string, data: any[], unit: string }> = ({ title, data, unit }) => {
    const avg = useMemo(() => {
        if (!data || data.length === 0) return null;
        const validReadings = data.map(curr => getNumericValue(curr.value, curr.sensorType, curr.interface)).filter(v => v !== null) as number[];
        if (validReadings.length === 0) return null;
        const sum = validReadings.reduce((acc, curr) => acc + curr, 0);
        return sum / validReadings.length;
    }, [data]);

    return (
        <div className="bg-primary dark:bg-dark-primary p-4 rounded-lg border border-gray-200 dark:border-gray-700 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted dark:text-gray-400">
                <span className="font-semibold text-sm">{title}</span>
                {SENSOR_ICONS[title.replace('Ortalama ', '')]}
            </div>
            <div className="text-right">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{avg !== null ? avg.toFixed(1) : '--'}<span className="text-lg ml-1">{unit}</span></p>
            </div>
        </div>
    );
};

const SensorChart: React.FC<{ sensorType: string, data: any[], stations: Station[], styles: Record<string, ChartStyle> }> = ({ sensorType, data, stations, styles }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';

    const chartData = useMemo(() => {
        const stationData: { [key: string]: { [key: string]: any } } = {};
        data.forEach(d => {
            const time = new Date(d.timestamp).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
            if (!stationData[time]) {
                stationData[time] = { name: time };
            }
            const stationName = stations.find(s => s.id === d.stationId)?.name || d.stationId;
            const numericValue = getNumericValue(d.value, d.sensorType, d.interface);
            if (numericValue !== null) {
                stationData[time][stationName] = numericValue;
            }
        });
        return Object.values(stationData).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [data, stations]);
    
    const stationNames = useMemo(() => [...new Set(data.map(d => stations.find(s => s.id === d.stationId)?.name || d.stationId))], [data, stations]);

    return (
        <div className="h-full w-full p-2 flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-center mb-2">{sensorType} Trendi</h3>
            <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: tickColor }} angle={-25} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fill: tickColor }} unit={data[0]?.unit || ''}/>
                        <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` }}/>
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }}/>
                        {stationNames.map((name) => (
                             <defs key={name}>
                                <linearGradient id={`color-${name.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={styles[name]?.stroke || '#8884d8'} stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor={styles[name]?.stroke || '#8884d8'} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                        ))}
                        {stationNames.map((name) => (
                            <Area 
                                key={name} 
                                type={styles[name]?.type || 'monotone'} 
                                dataKey={name} 
                                stroke={styles[name]?.stroke || '#8884d8'}
                                fill={`url(#color-${name.replace(/\s/g, '')})`}
                                strokeWidth={2} 
                                activeDot={{ r: 6 }} 
                                dot={false}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};


// --- DASHBOARD PAGE ---

const defaultWidgets: WidgetConfig[] = [
    { id: 'avgTemp', type: 'dataCard', config: { sensorType: 'Sıcaklık', unit: '°C' } },
    { id: 'avgHum', type: 'dataCard', config: { sensorType: 'Nem', unit: '%' } },
    { id: 'avgWind', type: 'dataCard', config: { sensorType: 'Rüzgar Hızı', unit: 'km/h' } },
    { id: 'avgPres', type: 'dataCard', config: { sensorType: 'Basınç', unit: 'hPa' } },
    { id: 'tempChart', type: 'sensorChart', config: { sensorType: 'Sıcaklık' } },
    { id: 'humChart', type: 'sensorChart', config: { sensorType: 'Nem' } },
    { id: 'windChart', type: 'sensorChart', config: { sensorType: 'Rüzgar Hızı' } },
    { id: 'presChart', type: 'sensorChart', config: { sensorType: 'Basınç' } },
];

const DEFAULT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316', '#14b8a6'];

const Dashboard: React.FC<{
  onViewStationDetails: (stationId: string) => void;
  stations: Station[];
  sensors: Sensor[];
  onRefresh: () => void;
}> = ({ onViewStationDetails, stations, sensors, onRefresh }) => {
    const [activeTab, setActiveTab] = useState('Analitik');
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
    const [selectedSensorTypes, setSelectedSensorTypes] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgets);
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    
    const [chartStyles, setChartStyles] = useState<Record<string, ChartStyle>>({});
    
    const allSensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    // Initialize filters on mount
    useEffect(() => {
        if (stations.length > 0 && selectedStationIds.length === 0) {
            setSelectedStationIds(stations.map(s => s.id));
        }
        const defaultSensorTypes = ['Sıcaklık', 'Nem', 'Rüzgar Hızı', 'Basınç'];
        if (sensors.length > 0 && selectedSensorTypes.length === 0) {
            const availableDefaultTypes = defaultSensorTypes.filter(t => allSensorTypes.includes(t));
            setSelectedSensorTypes(availableDefaultTypes);
        }
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        setDateRange({ 
            start: startDate.toISOString().split('T')[0], 
            end: endDate.toISOString().split('T')[0] 
        });

    }, [stations, sensors, allSensorTypes]); // Added allSensorTypes dependency

    // Initialize chart styles
    useEffect(() => {
        const initialStyles: Record<string, ChartStyle> = {};
        stations.forEach((station, index) => {
            initialStyles[station.name] = {
                stroke: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
                type: 'monotone',
            };
        });
        setChartStyles(initialStyles);
    }, [stations]);

    
    const stationOptions = useMemo(() => stations.map(s => ({ value: s.id, label: s.name })), [stations]);
    const sensorTypeOptions = useMemo(() => allSensorTypes.map(t => ({ value: t, label: t })), [allSensorTypes]);
    
    const fetchHistory = useCallback(async () => {
        if (selectedStationIds.length === 0 || selectedSensorTypes.length === 0) {
            setHistoryData([]);
            return;
        }
        setIsLoadingHistory(true);
        try {
            const data = await getReadingsHistory({ 
                stationIds: selectedStationIds, 
                sensorTypes: selectedSensorTypes 
            });
            setHistoryData(data);
        } catch (error) {
            console.error("Error fetching history data:", error);
            setHistoryData([]);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [selectedStationIds, selectedSensorTypes]);
    
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleAddWidget = (type: WidgetType, config: any) => {
        const newWidget: WidgetConfig = {
            id: `${type}-${Date.now()}`,
            type,
            config
        };
        setWidgets(prev => [...prev, newWidget]);
        
        // If a new chart type is added that wasn't selected, add it to filters and refetch
        if (type === 'sensorChart' && !selectedSensorTypes.includes(config.sensorType)) {
            setSelectedSensorTypes(prev => [...prev, config.sensorType]);
        }
         if (type === 'windRose' && (!selectedSensorTypes.includes('Rüzgar Hızı') || !selectedSensorTypes.includes('Rüzgar Yönü'))) {
            const typesToAdd = [];
            if(!selectedSensorTypes.includes('Rüzgar Hızı')) typesToAdd.push('Rüzgar Hızı');
            if(!selectedSensorTypes.includes('Rüzgar Yönü')) typesToAdd.push('Rüzgar Yönü');
            setSelectedSensorTypes(prev => [...prev, ...typesToAdd]);
        }
    };
    
    const handleRemoveWidget = (id: string) => {
        setWidgets(prev => prev.filter(w => w.id !== id));
    };

    const renderWidget = (widget: WidgetConfig) => {
        const dataForWidget = historyData.filter(d => d.sensorType === widget.config.sensorType);

        switch (widget.type) {
            case 'dataCard':
                return <DataCard title={`Ortalama ${widget.config.sensorType}`} data={dataForWidget} unit={widget.config.unit || ''} />;
            case 'sensorChart':
                return <SensorChart sensorType={widget.config.sensorType} data={dataForWidget} stations={stations} styles={chartStyles} />;
            case 'windRose':
                return <WindRoseChart historyData={historyData.filter(d => d.sensorType === 'Rüzgar Hızı' || d.sensorType === 'Rüzgar Yönü')} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('Analitik')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'Analitik' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}><ChartBarIcon className="w-5 h-5"/>Analitik</button>
                        <button onClick={() => setActiveTab('İstasyon Haritası')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'İstasyon Haritası' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}><MapIcon className="w-5 h-5"/>İstasyon Haritası</button>
                    </nav>
                </div>
                 {activeTab === 'Analitik' && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsWidgetModalOpen(true)} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold text-sm"><AddIcon className="w-5 h-5"/> Widget Ekle</button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="flex items-center gap-2 bg-primary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-semibold text-sm"><PaletteIcon className="w-5 h-5"/> Görünüm</button>
                    </div>
                 )}
            </div>

            {activeTab === 'Analitik' ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-primary dark:bg-dark-primary rounded-lg border dark:border-gray-700">
                        <MultiSelectDropdown label="İstasyon" options={stationOptions} selected={selectedStationIds} onChange={setSelectedStationIds} />
                        <MultiSelectDropdown label="Sensör Tipi" options={sensorTypeOptions} selected={selectedSensorTypes} onChange={setSelectedSensorTypes} />
                        <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="bg-secondary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"/>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="bg-secondary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"/>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min">
                        {widgets.map(widget => (
                            <div key={widget.id} className={`
                                ${widget.type === 'dataCard' ? 'h-32' : ''} 
                                ${widget.type === 'sensorChart' ? 'sm:col-span-2 h-80' : ''}
                                ${widget.type === 'windRose' ? 'sm:col-span-2 h-80' : ''}
                                relative group
                            `}>
                                <div className="bg-primary dark:bg-dark-primary rounded-lg border border-gray-200 dark:border-gray-700 h-full w-full">
                                    {isLoadingHistory ? <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-full w-full rounded-lg"></div> : renderWidget(widget)}
                                </div>
                                <button onClick={() => handleRemoveWidget(widget.id)} className="absolute top-2 right-2 p-1.5 bg-gray-500/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger">
                                    <XIcon className="w-4 h-4"/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="h-[75vh] bg-primary dark:bg-dark-primary border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                    <FullMap stations={stations} onViewStationDetails={onViewStationDetails} onStationSelect={() => {}} selectedStationId={null} onRefresh={onRefresh}/>
                </div>
            )}

            <AddWidgetModal isOpen={isWidgetModalOpen} onClose={() => setIsWidgetModalOpen(false)} onAddWidget={handleAddWidget} sensorTypes={allSensorTypes}/>
            <ChartSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} onSave={setChartStyles} initialStyles={chartStyles} sensorTypes={[...new Set(stations.map(s => s.name))]} />
        </div>
    );
};

export default Dashboard;
