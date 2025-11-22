


import React, { useState, useEffect, useMemo, useCallback, HTMLAttributes } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { Station, Sensor, WidgetConfig, WidgetType } from '../types.ts';
import { getReadingsHistory } from '../services/apiService.ts';
import { useTheme } from '../components/ThemeContext.tsx';
import FullMap from '../components/common/FullMap.tsx';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown.tsx';
import AddWidgetModal from '../components/AddWidgetModal.tsx';
import ChartSettingsModal, { ChartStyle } from '../components/ChartSettingsModal.tsx';
import WindRoseChart from '../components/WindRoseChart.tsx';
import NetworkHealthWidget from '../components/NetworkHealthWidget.tsx';
import { ChartBarIcon, MapIcon, AddIcon, PaletteIcon, XIcon, ThermometerIcon, DropletIcon, WindIcon, PressureIcon, CalendarIcon, SensorIcon as GenericSensorIcon, GaugeIcon } from '../components/icons/Icons.tsx';
import { getNumericValue } from '../utils/helpers.ts';
import Skeleton from '../components/common/Skeleton.tsx';

const SENSOR_STYLES: { [key: string]: { icon: React.ReactElement<HTMLAttributes<SVGElement>>, bg: string, text: string } } = {
  'Sıcaklık': { icon: <ThermometerIcon />, bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-600 dark:text-red-400' },
  'Nem': { icon: <DropletIcon />, bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-600 dark:text-blue-400' },
  'Rüzgar Hızı': { icon: <WindIcon />, bg: 'bg-cyan-100 dark:bg-cyan-900/50', text: 'text-cyan-600 dark:text-cyan-400' },
  'Basınç': { icon: <GaugeIcon />, bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-600 dark:text-indigo-400' },
  'Mesafe': { icon: <GenericSensorIcon />, bg: 'bg-teal-100 dark:bg-teal-900/50', text: 'text-teal-600 dark:text-teal-400' },
  'Kar Yüksekliği': { icon: <GenericSensorIcon />, bg: 'bg-sky-100 dark:bg-sky-900/50', text: 'text-sky-600 dark:text-sky-400' },
  'Ağırlık': { icon: <GenericSensorIcon />, bg: 'bg-slate-100 dark:bg-slate-900/50', text: 'text-slate-600 dark:text-slate-400' },
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

    const sensorType = title.replace('Ortalama ', '');
    const styleInfo = SENSOR_STYLES[sensorType] || { icon: <GenericSensorIcon />, bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-600 dark:text-gray-400' };

    return (
        <div className="bg-primary dark:bg-dark-primary p-4 rounded-lg border border-gray-200 dark:border-gray-700 h-full flex items-center gap-4">
             <div className={`flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-full ${styleInfo.bg}`}>
                {React.cloneElement(styleInfo.icon, { className: `w-7 h-7 ${styleInfo.text}` })}
            </div>
            <div>
                <p className="font-semibold text-gray-600 dark:text-gray-400">{title}</p>
                <div>
                    <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{avg !== null ? avg.toFixed(1) : '--'}</span>
                    <span className="text-lg text-muted dark:text-gray-400 ml-1.5">{unit}</span>
                </div>
            </div>
        </div>
    );
};

const SensorChart: React.FC<{ sensorType: string, data: any[], stations: Station[], styles: Record<string, ChartStyle> }> = ({ sensorType, data, stations, styles }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';

    const chartData = useMemo(() => {
        const stationData: { [key: string]: any } = {};
        data.forEach(d => {
            const time = new Date(d.timestamp).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
            if (!stationData[time]) {
                stationData[time] = { name: time };
            }
            const stationName = stations.find(s => s.id === d.stationId)?.name || d.stationId;
            const numericValue = getNumericValue(d.value, d.sensorType, d.interface);
            // Only add valid numeric values
            if (numericValue !== null) {
                stationData[time][stationName] = numericValue;
            }
        });
        return Object.values(stationData).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [data, stations]);
    
    const stationNames = useMemo(() => [...new Set(data.map(d => stations.find(s => s.id === d.stationId)?.name || d.stationId))], [data, stations]);

    return (
        <div className="h-full w-full p-4 flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-center mb-2">{sensorType} Trendi</h3>
            <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: tickColor }} angle={-25} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fill: tickColor }} unit={data?.[0]?.unit || ''} domain={['auto', 'auto']}/>
                        <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` }}/>
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }}/>
                        {stationNames.map((name) => (
                             <defs key={name}>
                                <linearGradient id={`color-${name.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={styles[name]?.stroke || '#8884d8'} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={styles[name]?.stroke || '#8884d8'} stopOpacity={0.05}/>
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
                                connectNulls={true}
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
    { id: 'tempChart', type: 'sensorChart', config: { sensorType: 'Sıcaklık' } },
    { id: 'humChart', type: 'sensorChart', config: { sensorType: 'Nem' } },
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
    
    const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
        try {
            const savedWidgets = localStorage.getItem('dashboardWidgets');
            return savedWidgets ? JSON.parse(savedWidgets) : defaultWidgets;
        } catch {
            return defaultWidgets;
        }
    });

    useEffect(() => {
        localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
    }, [widgets]);

    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    
    const [chartStyles, setChartStyles] = useState<Record<string, ChartStyle>>({});
    
    const allSensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    useEffect(() => {
        if (stations.length > 0 && selectedStationIds.length === 0) {
            setSelectedStationIds(stations.map(s => s.id));
        }
        const defaultSensorTypes = ['Sıcaklık', 'Nem'];
        if (sensors.length > 0 && selectedSensorTypes.length === 0) {
            const availableDefaultTypes = defaultSensorTypes.filter(t => allSensorTypes.includes(t));
            setSelectedSensorTypes(availableDefaultTypes);
        }
        
        // Initialize date range to cover "today" fully, ensuring recent data appears
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        // Set yesterday as start to show a trend
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        setDateRange({ 
            start: yesterdayStr, 
            end: todayStr 
        });

    }, [stations, sensors, allSensorTypes]);

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
            // Ensure the end date covers the entire end day by appending time if just a date string
            let endDateTime = dateRange.end;
            if (endDateTime && endDateTime.length === 10) {
                endDateTime += 'T23:59:59';
            }

            const data = await getReadingsHistory({ 
                stationIds: selectedStationIds, 
                sensorTypes: selectedSensorTypes,
                start: dateRange.start ? new Date(dateRange.start).toISOString() : undefined,
                end: endDateTime ? new Date(endDateTime).toISOString() : undefined,
            });
            setHistoryData(data);
        } catch (error) {
            console.error("Error fetching history data:", error);
            setHistoryData([]);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [selectedStationIds, selectedSensorTypes, dateRange]);
    
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
        
        if (type === 'sensorChart' && !selectedSensorTypes.includes(config.sensorType)) {
            setSelectedSensorTypes(prev => [...prev, config.sensorType]);
        }
         if (type === 'windRose' && (!selectedSensorTypes.includes('Rüzgar Hızı') || !selectedSensorTypes.includes('Rüzgar Yönü'))) {
            const typesToAdd = [];
            if(!selectedSensorTypes.includes('Rüzgar Hızı')) typesToAdd.push('Rüzgar Hızı');
            if(!selectedSensorTypes.includes('Rüzgar Yönü')) typesToAdd.push('Rüzgar Yönü');
            setSelectedSensorTypes(prev => [...prev, ...typesToAdd]);
        }
        setIsWidgetModalOpen(false);
    };
    
    const handleRemoveWidget = (id: string) => {
        setWidgets(prev => prev.filter(w => w.id !== id));
    };

    const renderableWidgets = useMemo(() => {
        return widgets.filter(widget => {
            if (widget.type === 'dataCard' || widget.type === 'sensorChart') {
                return allSensorTypes.includes(widget.config.sensorType);
            }
            if (widget.type === 'windRose') {
                return allSensorTypes.includes('Rüzgar Hızı') && allSensorTypes.includes('Rüzgar Yönü');
            }
            return false;
        });
    }, [widgets, allSensorTypes]);
    
    const cardWidgets = renderableWidgets.filter(w => w.type === 'dataCard');
    const chartWidgets = renderableWidgets.filter(w => w.type !== 'dataCard');

    const renderWidget = (widget: WidgetConfig) => {
        const dataForWidget = historyData.filter(d => d.sensorType === widget.config.sensorType);
        if (!dataForWidget) return null;

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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="border-b border-gray-200 dark:border-gray-700 w-full md:w-auto">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('Analitik')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'Analitik' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}><ChartBarIcon className="w-5 h-5"/>Analitik</button>
                        <button onClick={() => setActiveTab('İstasyon Haritası')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'İstasyon Haritası' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}><MapIcon className="w-5 h-5"/>İstasyon Haritası</button>
                    </nav>
                </div>
                 {activeTab === 'Analitik' && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button onClick={() => setIsWidgetModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold text-sm"><AddIcon className="w-5 h-5"/> Widget Ekle</button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-semibold text-sm"><PaletteIcon className="w-5 h-5"/> Görünüm</button>
                    </div>
                 )}
            </div>

            {activeTab === 'Analitik' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-primary dark:bg-dark-primary rounded-lg border dark:border-gray-700">
                        <MultiSelectDropdown label="İstasyon" options={stationOptions} selected={selectedStationIds} onChange={setSelectedStationIds} />
                        <MultiSelectDropdown label="Sensör Tipi" options={sensorTypeOptions} selected={selectedSensorTypes} onChange={setSelectedSensorTypes} />
                        <div className="relative">
                            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="bg-secondary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-10 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent w-full"/>
                            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
                        </div>
                        <div className="relative">
                            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="bg-secondary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-10 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent w-full"/>
                            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
                        </div>
                    </div>
                    
                    {renderableWidgets.length > 0 ? (
                        <>
                             {/* Added Network Health Widget */}
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                <div className="h-full">
                                    <NetworkHealthWidget />
                                </div>
                                {cardWidgets.map(widget => (
                                    <div key={widget.id} className="relative group h-full">
                                        {isLoadingHistory ? <Skeleton className="h-full rounded-lg"/> : renderWidget(widget)}
                                        <button onClick={() => handleRemoveWidget(widget.id)} className="absolute top-2 right-2 p-1 bg-black/20 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger z-10">
                                            <XIcon className="w-3 h-3"/>
                                        </button>
                                    </div>
                                ))}
                             </div>

                             {chartWidgets.length > 0 && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {chartWidgets.map(widget => (
                                        <div key={widget.id} className="min-h-[350px] relative group">
                                            <div className="bg-primary dark:bg-dark-primary rounded-lg border border-gray-200 dark:border-gray-700 h-full w-full">
                                                {isLoadingHistory ? <Skeleton className="h-full w-full rounded-lg"/> : renderWidget(widget)}
                                            </div>
                                            <button onClick={() => handleRemoveWidget(widget.id)} className="absolute top-2 right-2 p-1.5 bg-gray-500/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger z-10">
                                                <XIcon className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="col-span-12">
                            <div className="text-center py-16 text-muted border border-dashed rounded-lg bg-primary dark:bg-dark-primary">
                                <ChartBarIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2"/>
                                <p className="font-semibold">Dashboard'unuz boş</p>
                                <p className="text-sm">Başlamak için 'Widget Ekle' butonuna tıklayarak veri kartları veya grafikler ekleyebilirsiniz.</p>
                            </div>
                        </div>
                    )}
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
