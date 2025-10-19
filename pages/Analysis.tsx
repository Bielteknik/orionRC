import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Station, Sensor } from '../types.ts';
import { getStations, getSensors, getReadingsHistory } from '../services/apiService.ts';
import { sendMessageToGemini } from '../services/geminiService.ts';
import Card from '../components/common/Card.tsx';
import { BrainIcon, ExclamationIcon } from '../components/icons/Icons.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../components/ThemeContext.tsx';

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
            // Using a non-streaming version of the Gemini service for a single response
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
        if (stations.length > 0) setSelectedStation(stations[0].id);
    }, [stations]);

    useEffect(() => {
        if (availableSensorTypes.length >= 2) {
            setSensor1(availableSensorTypes[0]);
            setSensor2(availableSensorTypes[1]);
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
            
            const processedData = history.reduce((acc, reading) => {
                const timestamp = new Date(reading.timestamp).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                let entry = acc.find((item: any) => item.timestamp === timestamp);
                if (!entry) {
                    entry = { timestamp };
                    acc.push(entry);
                }
                const value = typeof reading.value === 'object' ? Object.values(reading.value)[0] : reading.value;
                if (reading.sensorType === sensor1) entry[sensor1] = value;
                if (reading.sensorType === sensor2) entry[sensor2] = value;
                return acc;
            }, []);

            setChartData(processedData.reverse());

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

const Analysis: React.FC = () => {
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [stationsData, sensorsData] = await Promise.all([getStations(), getSensors()]);
                setStations(stationsData);
                setSensors(sensorsData);
            } catch (err) {
                console.error("Failed to fetch data for analysis page:", err);
                setError("Veriler yüklenemedi.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);


    return (
        <div className="max-w-6xl mx-auto space-y-6">
             <div className="text-center">
                <BrainIcon className="w-12 h-12 mx-auto text-accent"/>
                <h1 className="text-3xl font-bold mt-2 text-gray-900">Gelişmiş Analiz</h1>
                <p className="text-muted mt-1">Verilerinizi daha derinlemesine inceleyin ve özel hesaplamalar yapın.</p>
            </div>
            {isLoading ? <Skeleton className="h-96"/> : error ? (
                 <Card>
                    <div className="text-center py-8 text-danger flex flex-col items-center justify-center gap-2">
                        <ExclamationIcon className="w-12 h-12"/>
                        <p className="font-semibold">{error}</p>
                    </div>
                </Card>
            ) : (
                <>
                    <SnowWaterEquivalentCalculator />
                    <SensorCorrelationChart stations={stations} sensors={sensors} />
                </>
            )}

            <style>{`
                .input-base { width: 100%; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.5rem; padding: 0.625rem 1rem; }
                .btn-primary { padding: 0.5rem 1rem; background-color: #E95420; color: white; border-radius: 0.5rem; font-weight: 600; transition: background-color 0.2s; }
                .btn-primary:hover { background-color: #c2410c; }
                .btn-primary:disabled { background-color: #9CA3AF; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

export default Analysis;