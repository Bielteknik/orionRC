import React, { useMemo } from 'react';
import { Sensor } from '../types.ts';
import { ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, SensorIcon as GenericSensorIcon, XIcon } from './icons/Icons.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from './ThemeContext.tsx';


interface SensorReading {
    id: string;
    value: any;
    unit: string;
    timestamp: string;
    sensorType: string;
    interface?: string;
}

interface SensorDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    sensor: Sensor | null;
    readings: SensorReading[];
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

const formatDisplayValue = (reading: SensorReading): string => {
    const numericValue = getNumericValue(reading.value);
    if (numericValue !== null) {
        return numericValue.toFixed(2);
    }
    // Handle special non-numeric cases like from weight sensor
    if (reading.value && typeof reading.value === 'object' && 'weight_kg' in reading.value && reading.value.weight_kg === 'N/A') {
        return 'N/A';
    }
    return 'N/A';
};


const SensorDetailModal: React.FC<SensorDetailModalProps> = ({ isOpen, onClose, sensor, readings }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';

    if (!isOpen || !sensor) return null;

    const latestReadings = useMemo(() => {
        return [...readings]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [readings]);
    
    const chartData = useMemo(() => {
        return [...readings]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map(r => ({
                name: new Date(r.timestamp).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                value: getNumericValue(r.value),
            }))
            .filter(item => item.value !== null)
            .slice(0, 50) // Limit to last 50 points for performance
            .reverse(); // reverse to show oldest to newest
    }, [readings]);

    const latestValue = latestReadings.length > 0 ? formatDisplayValue(latestReadings[0]) : 'N/A';

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
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Current Value */}
                    <div className="text-center">
                        <p className="text-sm text-muted dark:text-gray-400">Son Değer</p>
                        <p className="text-6xl font-bold text-gray-900 dark:text-gray-100">{latestValue}<span className="text-3xl text-muted dark:text-gray-400 ml-2">{sensor.unit}</span></p>
                    </div>

                    {/* Chart */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Geçmiş Veriler Grafiği</h3>
                        {chartData.length > 1 ? (
                            <div className="h-64 bg-primary dark:bg-dark-primary p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} angle={-20} textAnchor="end" height={40} />
                                        <YAxis tick={{ fontSize: 10, fill: tickColor }} unit={sensor.unit} domain={['dataMin - 1', 'dataMax + 1']} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', 
                                                border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` 
                                            }}
                                            labelStyle={{ color: theme === 'dark' ? '#F3F4F6' : '#111827' }}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="value" name={sensor.type} stroke="#F97316" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-center text-muted dark:text-gray-400 bg-primary dark:bg-dark-primary p-4 rounded-lg border border-dashed dark:border-gray-700">
                                Grafik çizmek için yeterli veri yok.
                            </div>
                        )}
                    </div>

                    {/* Readings Table */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Son Okunan Değerler</h3>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-primary dark:bg-dark-primary">
                            {latestReadings.length > 0 ? (
                                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                                    <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Zaman Damgası</th>
                                            <th scope="col" className="px-6 py-3 text-right">Değer</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {latestReadings.slice(0, 100).map(reading => { // Limit for display
                                            const date = new Date(reading.timestamp);
                                            const displayTimestamp = !isNaN(date.getTime())
                                                ? date.toLocaleString('tr-TR')
                                                : reading.timestamp;
                                            return (
                                                <tr key={reading.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                                    <td className="px-6 py-3 font-mono text-gray-800 dark:text-gray-200">{displayTimestamp}</td>
                                                    <td className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{`${formatDisplayValue(reading)} ${reading.unit || ''}`}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-10 text-muted dark:text-gray-400">
                                    <p>Bu sensör için geçmiş veri bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SensorDetailModal;