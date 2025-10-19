import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Station, Sensor, Trend } from '../types.ts';
import { getStations, getSensors, getReadingsHistory } from '../services/apiService.ts';
import { sendMessageToGemini } from '../services/geminiService.ts';
import Card from '../components/common/Card.tsx';
import FullMap from '../components/common/FullMap.tsx';
import WindRoseChart from '../components/WindRoseChart.tsx';
import { StationIcon, SensorIcon, CameraIcon, ExclamationIcon, TrendUpIcon, TrendDownIcon, TrendStableIcon, BrainIcon, DashboardIcon } from '../components/icons/Icons.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../components/ThemeContext.tsx';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown.tsx';


// --- Analysis Components (moved from Analysis.tsx) ---

const SnowWaterEquivalentCalculator: React.FC = () => {
    const [snowHeight, setSnowHeight] = useState('');
    const [snowDensity, setSnowDensity] = useState('150'); // Avg density kg/m³
    const [swe, setSwe] = useState<number | null>(null);
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);

    useEffect(() => {
        if (snowHeight && snowDensity) {
            const heightInMeters = parseFloat(snowHeight) / 100;
            const density = parseFloat(snowDensity);
            if (!isNaN(heightInMeters) && !isNaN(density)) {
                // SWE (mm) = Snow Depth (m) * Snow Density (kg/m³)
                setSwe(heightInMeters * density);
            }
        } else {
            setSwe(null);
        }
    }, [snowHeight, snowDensity]);
    
    const handleExplain = async () => {
        if (swe === null) return;
        setIsExplaining(true);
        setExplanation('');
        try {
            const prompt = `Bir meteoroloji uzmanı gibi, ${snowHeight} cm kar yüksekliği ve ${snowDensity} kg/m³ yoğunluk ile hesaplanan ${swe.toFixed(2)} mm Kar Su Eşdeğeri'nin (SWE) ne anlama geldiğini, tarım ve su kaynakları için önemini basit ve anlaşılır bir dille açıkla.`;
            const stream = await sendMessageToGemini(prompt);
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
            }
            setExplanation(fullText);
        } catch (error) {
            console.error("Failed to get explanation from Gemini:", error);
            setExplanation("Açıklama alınırken bir hata oluştu.");
        } finally {
            setIsExplaining(false);
        }
    };

    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kar Su Eşdeğeri (SWE) Hesaplayıcı</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Kar Yüksekliği (cm)</label>
                    <input type="number" value={snowHeight} onChange={e => setSnowHeight(e.target.value)} className="mt-1 w-full input-base" placeholder="Örn: 85" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Kar Yoğunluğu (kg/m³)</label>
                    <input type="number" value={snowDensity} onChange={e => setSnowDensity(e.target.value)} className="mt-1 w-full input-base" />
                </div>
                <div className="p-4 rounded-lg bg-secondary text-center">
                    <p className="text-sm text-muted">Hesaplanan SWE</p>
                    <p className="text-3xl font-bold text-gray-800">{swe !== null ? `${swe.toFixed(2)}` : '--'}<span className="text-lg ml-1">mm</span></p>
                </div>
            </div>
            {swe !== null && (
                 <div className="mt-4">
                    <button onClick={handleExplain} disabled={isExplaining} className="btn-primary flex items-center gap-2">
                        <BrainIcon className="w-5 h-5"/>
                        {isExplaining ? 'Açıklanıyor...' : 'Yapay Zeka ile Açıkla'}
                    </button>
                    {explanation && (
                        <div className="mt-3 p-3 bg-secondary rounded-md border text-sm text-gray-700 whitespace-pre-wrap">{explanation}</div>
                    )}
                </div>
            )}
        </Card>
    );
};

const SensorCorrelationChart: React.FC<{ stations: Station[], sensors: Sensor[] }> = ({ stations, sensors }) => {
    const { theme } = useTheme();
    const [selectedStation, setSelectedStation] = useState<string>('');
    const [sensor1, setSensor1] = useState<string>('');
    const [sensor2, setSensor2] = useState<string>('');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const availableSensorTypes = useMemo(() => {
        if (!selectedStation) return [];
        const stationSensors = sensors.filter(s => s.stationId === selectedStation);
        return [...new Set(stationSensors.map(s => s.type))];
    }, [selectedStation, sensors]);

    useEffect(() => {
        if (stations.length > 0 && !selectedStation) setSelectedStation(stations[0].id);
    }, [stations, selectedStation]);

    useEffect(() => {
        if (availableSensorTypes.length >= 2) {
            setSensor1(availableSensorTypes[0]);
            setSensor2(availableSensorTypes[1]);
        } else {
            setSensor1('');
            setSensor2('');
        }
    }, [availableSensorTypes]);

    const fetchData = useCallback(async () => {
        if (!selectedStation || !sensor1 || !sensor2) {
            setChartData([]);
            return;
        };
        setIsLoading(true);
        try {
            const history = await getReadingsHistory({ stationIds: [selectedStation], sensorTypes: [sensor1, sensor2]});
            
            const dataMap = new Map<string, any>();

            history.forEach(reading => {
                const timestamp = new Date(reading.timestamp).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                
                if (!dataMap.has(timestamp)) {
                    dataMap.set(timestamp, { timestamp });
                }

                const entry = dataMap.get(timestamp);
                const value = (typeof reading.value === 'object' && reading.value !== null) 
                    ? Object.values(reading.value)[0] 
                    : reading.value;

                if (reading.sensorType === sensor1) {
                    entry[sensor1] = value;
                }
                if (reading.sensorType === sensor2) {
                    entry[sensor2] = value;
                }
            });

            const processedData = Array.from(dataMap.values())
              .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            setChartData(processedData);

        } catch (error) {
            console.error("Failed to fetch correlation data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedStation, sensor1, sensor2]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);


    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sensör Korelasyon Grafiği</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-secondary rounded-md border">
                <select value={selectedStation} onChange={e => setSelectedStation(e.target.value)} className="input-base"><option value="">İstasyon Seç</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={sensor1} onChange={e => setSensor1(e.target.value)} className="input-base" disabled={!selectedStation}><option value="">Sensör 1</option>{availableSensorTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <select value={sensor2} onChange={e => setSensor2(e.target.value)} className="input-base" disabled={!selectedStation}><option value="">Sensör 2</option>{availableSensorTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div className="h-96">
                {isLoading ? <Skeleton className="w-full h-full"/> : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                            <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="left" stroke="#8884d8" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }}/>
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey={sensor1} stroke="#8884d8" activeDot={{ r: 8 }} />
                            <Line yAxisId="right" type="monotone" dataKey={sensor2} stroke="#82ca9d" />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    )
}

// --- Original Dashboard Components ---

interface DashboardProps {
  onViewStationDetails: (stationId: string) => void;
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


const Dashboard: React.FC<DashboardProps> = ({ onViewStationDetails }) => {
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Analitik');
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (stations.length === 0) setIsLoading(true);
                const [stationsData, sensorsData] = await Promise.all([getStations(), getSensors()]);
                setStations(stationsData);
                setSensors(sensorsData);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Initially select all stations when data first loads
        if (stations.length > 0 && selectedStationIds.length === 0) {
            setSelectedStationIds(stations.map(s => s.id));
        }
    }, [stations]);


    const filteredStations = useMemo(() => {
        if (selectedStationIds.length === 0) return stations;
        return stations.filter(s => selectedStationIds.includes(s.id));
    }, [stations, selectedStationIds]);

    const filteredSensors = useMemo(() => {
        const selectedIds = new Set(selectedStationIds.length > 0 ? selectedStationIds : stations.map(s => s.id));
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
        ['Sıcaklık', 'Nem', 'Rüzgar Hızı', 'Basınç'].forEach(type => {
            const relevantSensors = filteredSensors.filter(s => s.type === type && s.lastUpdate && s.value !== null);
            if (relevantSensors.length > 0) {
                const latestSensor = relevantSensors.reduce((latest, current) =>
                    new Date(latest.lastUpdate) > new Date(current.lastUpdate) ? latest : current
                );

                let displayValue: any = '--';
                if (latestSensor.value !== null && latestSensor.value !== undefined) {
                    if (typeof latestSensor.value === 'object') {
                        if (latestSensor.interface === 'openweather') {
                            if (type === 'Sıcaklık' && latestSensor.value.temperature !== undefined) {
                                displayValue = latestSensor.value.temperature;
                            } else if (type === 'Nem' && latestSensor.value.humidity !== undefined) {
                                displayValue = latestSensor.value.humidity;
                            }
                        } else {
                            // Fallback for other complex objects (like snow depth)
                            const numericValue = Object.values(latestSensor.value).find(v => typeof v === 'number');
                            displayValue = numericValue !== undefined ? numericValue : '--';
                        }
                    } else {
                        displayValue = latestSensor.value;
                    }
                }

                data[type] = { value: displayValue, unit: latestSensor.unit };
            }
        });
        return data;
    }, [filteredSensors]);

    const availableSensorTypes = useMemo(() => {
        return new Set(filteredSensors.map(sensor => sensor.type));
    }, [filteredSensors]);

    const hasWindSensors = useMemo(() => {
        return availableSensorTypes.has('Rüzgar Hızı') && availableSensorTypes.has('Rüzgar Yönü');
    }, [availableSensorTypes]);


    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="space-y-6 mt-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Skeleton className="h-24" /> <Skeleton className="h-24" />
                        <Skeleton className="h-24" /> <Skeleton className="h-24" />
                    </div>
                    <Skeleton className="h-[480px]" />
                </div>
            );
        }

        if (activeTab === 'Analitik') {
            return (
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
                               {availableSensorTypes.has('Sıcaklık') && <DataCard type="Sıcaklık" value={latestSensorData['Sıcaklık']?.value ?? '--'} unit={latestSensorData['Sıcaklık']?.unit ?? '°C'} trend={Trend.Stable} />}
                               {availableSensorTypes.has('Nem') && <DataCard type="Nem" value={latestSensorData['Nem']?.value ?? '--'} unit={latestSensorData['Nem']?.unit ?? '%'} trend={Trend.Up} />}
                               {availableSensorTypes.has('Rüzgar Hızı') && <DataCard type="Rüzgar" value={latestSensorData['Rüzgar Hızı']?.value ?? '--'} unit={latestSensorData['Rüzgar Hızı']?.unit ?? 'km/h'} trend={Trend.Down} />}
                               {availableSensorTypes.has('Basınç') && <DataCard type="Basınç" value={latestSensorData['Basınç']?.value ?? '--'} unit={latestSensorData['Basınç']?.unit ?? 'hPa'} trend={Trend.Stable} />}
                            </div>
                            {hasWindSensors ? (
                                <Card className="h-64">
                                    <WindRoseChart stations={filteredStations} sensors={filteredSensors} />
                                </Card>
                            ) : (
                                <Card className="h-64 flex items-center justify-center">
                                    <p className="text-center text-sm text-muted">Rüzgar Gülü için gerekli Rüzgar Yönü/Hızı sensörleri seçili istasyonlarda bulunamadı.</p>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        
        if (activeTab === 'Analiz') {
            return (
                 <div className="space-y-6 mt-4">
                    <SnowWaterEquivalentCalculator />
                    <SensorCorrelationChart stations={filteredStations} sensors={filteredSensors} />
                     <style>{`
                        .input-base { width: 100%; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.5rem; padding: 0.625rem 1rem; }
                        .btn-primary { padding: 0.5rem 1rem; background-color: #E95420; color: white; border-radius: 0.5rem; font-weight: 600; transition: background-color 0.2s; }
                        .btn-primary:hover { background-color: #c2410c; }
                        .btn-primary:disabled { background-color: #9CA3AF; cursor: not-allowed; }
                    `}</style>
                </div>
            );
        }

        return null;
    }
    
    return (
        <div className="space-y-4">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="w-full md:w-auto">
                    <nav className="-mb-[2px] flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('Analitik')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'Analitik' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 hover:border-gray-300'}`}>
                            <DashboardIcon className="w-5 h-5"/>
                            <span>Analitik</span>
                        </button>
                        <button onClick={() => setActiveTab('Analiz')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'Analiz' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 hover:border-gray-300'}`}>
                            <BrainIcon className="w-5 h-5"/>
                            <span>Analiz</span>
                        </button>
                    </nav>
                </div>
                <div className="w-full md:w-72">
                    <MultiSelectDropdown
                        label="İstasyon"
                        options={stations.map(s => ({ value: s.id, label: s.name }))}
                        selected={selectedStationIds}
                        onChange={setSelectedStationIds}
                    />
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default Dashboard;