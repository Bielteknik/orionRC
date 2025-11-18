
import React, { useMemo, useState, useEffect } from 'react';
import { Sensor } from '../types.ts';
import { ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, SensorIcon as GenericSensorIcon, XIcon, ExclamationCircleIcon } from './icons/Icons.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter } from 'recharts';
import { useTheme } from './ThemeContext.tsx';
import { getRawReadingsHistory, getReadingsHistory } from '../services/apiService.ts';
import { getNumericValue, toDateTimeLocal } from '../utils/helpers.ts';


interface SensorReading {
    id: string;
    value: any;
    unit: string;
    timestamp: string;
    sensorType: string;
    interface?: string;
    isAnomaly?: boolean;
    anomalyReason?: string;
}

interface RawSensorReading {
    id: number;
    raw_value: any;
    timestamp: string;
    sensorId: string;
}

interface SensorDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    sensor: Sensor | null;
}

const getSensorIcon = (type: string) => {
    switch (type) {
        case 'Sıcaklık': return <ThermometerIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
        case 'Nem': return <DropletIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
        case 'Rüzgar Hızı': case 'Rüzgar Yönü': return <WindSockIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
        case 'Basınç': return <GaugeIcon className="w-6 h-6 text-muted dark:text-gray-400" />;
        default: return <GenericSensorIcon className="w-5 h-5 text-muted dark:text-gray-400" />;
    }
};

const formatDisplayValue = (reading: SensorReading): string => {
    const numericValue = getNumericValue(reading.value, reading.sensorType, reading.interface);
    if (numericValue !== null) {
        return numericValue.toFixed(2);
    }
    // Handle special non-numeric cases like from weight sensor
    if (reading.value && typeof reading.value === 'object' && 'weight_kg' in reading.value && reading.value.weight_kg === 'N/A') {
        return 'N/A';
    }
    return 'N/A';
};


const SensorDetailModal: React.FC<SensorDetailModalProps> = ({ isOpen, onClose, sensor }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';
    const [rawReadings, setRawReadings] = useState<RawSensorReading[]>([]);
    const [processedReadings, setProcessedReadings] = useState<SensorReading[]>([]);
    const [activeTab, setActiveTab] = useState<'processed' | 'raw'>('processed');
    const [dateFilter, setDateFilter] = useState<{ start: string, end: string }>({ start: '', end: '' });
    
    useEffect(() => {
        let isMounted = true;
        if (isOpen && sensor) {
            setRawReadings([]);
            setProcessedReadings([]);
            setActiveTab('processed');
            
            const now = new Date();
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            const initialEndDate = toDateTimeLocal(now);
            const initialStartDate = toDateTimeLocal(yesterday);

            if (isMounted) {
                setDateFilter({ start: initialStartDate, end: initialEndDate });
            }
        }
        return () => {
            isMounted = false;
        };
    }, [isOpen, sensor]);
    
    // Refetch both processed and raw data when date filter changes
    useEffect(() => {
        let isMounted = true;
        if (isOpen && sensor && dateFilter.start && dateFilter.end) {
             const fetchAllData = async () => {
                 try {
                     const [rawHistory, processedHistory] = await Promise.all([
                        getRawReadingsHistory(sensor.id, dateFilter.start, dateFilter.end),
                        getReadingsHistory({
                             stationIds: [sensor.stationId],
                             sensorTypes: [sensor.type],
                             start: dateFilter.start,
                             end: dateFilter.end
                        })
                     ]);

                     if (isMounted) {
                         setRawReadings(rawHistory);
                         setProcessedReadings(processedHistory.filter(r => r.sensorId === sensor.id));
                     }
                 } catch (err) {
                      if (isMounted) {
                         console.error("Could not fetch sensor history on date change:", err);
                      }
                 }
             };
             fetchAllData();
        }
         return () => { isMounted = false; };
    }, [dateFilter, isOpen, sensor]);


    if (!isOpen || !sensor) return null;

    const latestReadings = useMemo(() => {
        return [...processedReadings]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [processedReadings]);
    
    const chartData = useMemo(() => {
        const dataMap = new Map<number, any>();
        const roundToNearestSecond = (iso: string) => Math.round(new Date(iso).getTime() / 1000);
    
        processedReadings.forEach(r => {
            const key = roundToNearestSecond(r.timestamp);
            const entry = dataMap.get(key) || { timestamp: r.timestamp };
            entry['İşlenmiş Değer'] = getNumericValue(r.value, r.sensorType, r.interface);
            entry['isAnomaly'] = r.isAnomaly; // Add anomaly flag for chart
            entry['anomalyReason'] = r.anomalyReason; // Add reason
            dataMap.set(key, entry);
        });
    
        rawReadings.forEach(r => {
            const key = roundToNearestSecond(r.timestamp);
            const entry = dataMap.get(key) || { timestamp: r.timestamp };
            entry['Ham Değer'] = getNumericValue(r.raw_value, sensor.type, sensor.interface);
            dataMap.set(key, entry);
        });
        
        return Array.from(dataMap.values())
            .filter(item => item['İşlenmiş Değer'] !== undefined || item['Ham Değer'] !== undefined)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-500) // Increase data points for better graph detail
            .map(item => ({
                ...item,
                name: new Date(item.timestamp).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            }));
    }, [processedReadings, rawReadings, sensor.type, sensor.interface]);

    const latestValue = latestReadings.length > 0 ? formatDisplayValue(latestReadings[0]) : 'N/A';
    
    // Custom dot for line chart to show anomalies
    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;
        if (payload && payload.isAnomaly) {
            return (
                <g>
                    <circle cx={cx} cy={cy} r={6} fill="#EF4444" fillOpacity={0.3} className="animate-ping" />
                    <circle cx={cx} cy={cy} r={4} fill="#EF4444" stroke="#fff" strokeWidth={1} />
                </g>
            );
        }
        // Default dot style
        return <circle cx={cx} cy={cy} r={3} fill="#F97316" stroke="none" />;
    };

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className={`p-3 rounded-lg border shadow-lg text-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                    <p className="font-semibold mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                             <span>{entry.name}: {entry.value}</span>
                        </div>
                    ))}
                    {data.isAnomaly && (
                        <div className="mt-2 text-danger font-semibold text-xs border-t border-gray-200 dark:border-gray-600 pt-1">
                            ⚠️ {data.anomalyReason || 'Anomali Tespit Edildi'}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };


    return (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className={`absolute inset-y-0 right-0 bg-secondary dark:bg-dark-secondary w-full max-w-xl transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Drawer Header */}
                <header className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-primary dark:bg-dark-primary flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">{getSensorIcon(sensor.type)}</div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{sensor.name}</h2>
                            <p className="text-sm text-muted dark:text-gray-400">{sensor.type}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                
                {/* Main Content */}
                <main className="flex-1 overflow-hidden p-6 flex flex-col gap-6">
                    {/* Current Value */}
                    <div className="text-center flex-shrink-0">
                        <p className="text-sm text-muted dark:text-gray-400">Son İşlenmiş Değer</p>
                        <p className="text-6xl font-bold text-gray-900 dark:text-gray-100">{latestValue}<span className="text-3xl text-muted dark:text-gray-400 ml-2">{sensor.unit}</span></p>
                    </div>

                    {/* Chart */}
                    <div className="space-y-2 flex-shrink-0">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                             <h3 className="font-semibold text-gray-800 dark:text-gray-200">Geçmiş Veriler Grafiği</h3>
                             <div className="flex items-center gap-2">
                                <input
                                    type="datetime-local"
                                    value={dateFilter.start}
                                    onChange={e => setDateFilter(p => ({ ...p, start: e.target.value }))}
                                    className="bg-primary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                                <input
                                    type="datetime-local"
                                    value={dateFilter.end}
                                    onChange={e => setDateFilter(p => ({ ...p, end: e.target.value }))}
                                    className="bg-primary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                             </div>
                        </div>
                        {chartData.length > 1 ? (
                            <div className="h-64 bg-primary dark:bg-dark-primary p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} angle={-20} textAnchor="end" height={40} />
                                        <YAxis tick={{ fontSize: 10, fill: tickColor }} unit={sensor.unit} domain={['dataMin - 1', 'dataMax + 1']} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Line 
                                            type="monotone" 
                                            dataKey="İşlenmiş Değer" 
                                            name="İşlenmiş Değer" 
                                            stroke="#F97316" 
                                            strokeWidth={2} 
                                            dot={<CustomDot />} 
                                            activeDot={{ r: 6 }} 
                                        />
                                        <Line type="monotone" dataKey="Ham Değer" name="Ham Değer" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-center text-muted dark:text-gray-400 bg-primary dark:bg-dark-primary p-4 rounded-lg border border-dashed dark:border-gray-700">
                                Grafik çizmek için yeterli veri yok.
                            </div>
                        )}
                    </div>

                    {/* Readings Table with Tabs */}
                    <div className="space-y-2 flex flex-col flex-1 min-h-0">
                        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                                <button onClick={() => setActiveTab('processed')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm ${activeTab === 'processed' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                    İşlenmiş Değerler
                                </button>
                                <button onClick={() => setActiveTab('raw')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-semibold text-sm ${activeTab === 'raw' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                    Ham Değerler
                                </button>
                            </nav>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto bg-primary dark:bg-dark-primary flex-1">
                            {activeTab === 'processed' && (
                                <>
                                    {latestReadings.length > 0 ? (
                                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                                            <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700 sticky top-0">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3">Zaman Damgası</th>
                                                    <th scope="col" className="px-6 py-3 text-right">Değer</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {latestReadings.map(reading => (
                                                    <tr key={reading.id} className={`border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 ${reading.isAnomaly ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                        <td className="px-6 py-3 font-mono text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                            {reading.isAnomaly && (
                                                                <div className="group relative">
                                                                    <ExclamationCircleIcon className="w-4 h-4 text-danger cursor-help" />
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                                                        {reading.anomalyReason || "Anomali Tespit Edildi"}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {new Date(reading.timestamp).toLocaleString('tr-TR')}
                                                        </td>
                                                        <td className={`px-6 py-3 text-right font-semibold ${reading.isAnomaly ? 'text-danger' : 'text-gray-900 dark:text-gray-100'}`}>{`${formatDisplayValue(reading)} ${reading.unit || ''}`}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-center text-muted dark:text-gray-400">
                                            <p>Bu sensör için seçili aralıkta işlenmiş veri bulunamadı.</p>
                                        </div>
                                    )}
                                </>
                            )}
                            {activeTab === 'raw' && (
                                 <>
                                    {rawReadings.length > 0 ? (
                                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                                            <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700 sticky top-0">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3">Zaman Damgası</th>
                                                    <th scope="col" className="px-6 py-3 text-right">Değer</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rawReadings.map(reading => (
                                                    <tr key={reading.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                                        <td className="px-6 py-3 font-mono text-gray-800 dark:text-gray-200">{new Date(reading.timestamp).toLocaleString('tr-TR')}</td>
                                                        <td className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{`${getNumericValue(reading.raw_value, sensor.type, sensor.interface)?.toFixed(2) ?? 'N/A'} ${sensor.unit || ''}`}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-center text-muted dark:text-gray-400">
                                            <p>Bu sensör için seçili aralıkta ham veri bulunamadı.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SensorDetailModal;
