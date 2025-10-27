import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Station, Sensor } from '../types.ts';
import { getReadingsHistory } from '../services/apiService.ts';
import { sendMessageToGemini } from '../services/geminiService.ts';
import Card from '../components/common/Card.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { BrainIcon, DownloadIcon } from '../components/icons/Icons.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../components/ThemeContext.tsx';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown.tsx';

// Use global XLSX from window
declare const XLSX: any;


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
                setExplanation(fullText + '...');
            }
            setExplanation(fullText);
        } catch (error: any) {
            console.error("Failed to get explanation from Gemini:", error);
            let errorMessage = "Açıklama alınırken bir hata oluştu.";
            if (error.message && (error.message.includes('API Key') || error.message.includes('API key'))) {
                errorMessage = "Yapay zeka özelliği için API anahtarı yapılandırılmamış.";
            }
            setExplanation(errorMessage);
        } finally {
            setIsExplaining(false);
        }
    };

    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Kar Su Eşdeğeri (SWE) Hesaplayıcı</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kar Yüksekliği (cm)</label>
                    <input type="number" value={snowHeight} onChange={e => setSnowHeight(e.target.value)} className="mt-1 w-full input-base" placeholder="Örn: 85" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kar Yoğunluğu (kg/m³)</label>
                    <input type="number" value={snowDensity} onChange={e => setSnowDensity(e.target.value)} className="mt-1 w-full input-base" />
                </div>
                <div className="p-4 rounded-lg bg-secondary dark:bg-gray-700 text-center">
                    <p className="text-sm text-muted dark:text-gray-400">Hesaplanan SWE</p>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{swe !== null ? `${swe.toFixed(2)}` : '--'}<span className="text-lg ml-1">mm</span></p>
                </div>
            </div>
            {swe !== null && (
                 <div className="mt-4">
                    <button onClick={handleExplain} disabled={isExplaining} className="btn-primary flex items-center gap-2">
                        <BrainIcon className="w-5 h-5"/>
                        {isExplaining ? 'Açıklanıyor...' : 'Yapay Zeka ile Açıkla'}
                    </button>
                    {(explanation || isExplaining) && (
                        <div className="mt-3 p-3 bg-secondary dark:bg-gray-700 rounded-md border dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{explanation}</div>
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
            const history = await getReadingsHistory({ stationIds: [selectedStation], sensorTypes: [sensor1, sensor2] });

            const dataMap = new Map<string, any>();

            history.forEach(reading => {
                const date = new Date(reading.timestamp);
                // Verileri dakika bazında gruplamak için saniyeleri sıfırla
                date.setSeconds(0, 0);
                const groupKey = date.toISOString(); // Sıralanabilir, benzersiz anahtar

                if (!dataMap.has(groupKey)) {
                    dataMap.set(groupKey, {
                        // Grafikte gösterilecek formatlanmış zaman
                        timestamp: date.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    });
                }

                const entry = dataMap.get(groupKey)!;
                const rawValue = (typeof reading.value === 'object' && reading.value !== null)
                    ? Object.values(reading.value).find(v => typeof v === 'number') // Nesne içindeki ilk sayısal değeri bul
                    : reading.value;

                const numericValue = parseFloat(rawValue);

                if (!isNaN(numericValue)) {
                    if (reading.sensorType === sensor1) {
                        entry[sensor1] = numericValue;
                    }
                    if (reading.sensorType === sensor2) {
                        entry[sensor2] = numericValue;
                    }
                }
            });

            // Anahtarları (ISO tarihleri) sıralayarak verilerin doğru kronolojik sırada olmasını sağla
            const sortedKeys = Array.from(dataMap.keys()).sort();
            const processedData = sortedKeys.map(key => dataMap.get(key));

            setChartData(processedData);

        } catch (error) {
            console.error("Korelasyon verisi alınamadı:", error);
            setChartData([]); // Hata durumunda grafiği temizle
        } finally {
            setIsLoading(false);
        }
    }, [selectedStation, sensor1, sensor2]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);


    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Sensör Korelasyon Grafiği</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-secondary dark:bg-gray-700/50 rounded-md border dark:border-gray-700">
                <select value={selectedStation} onChange={e => setSelectedStation(e.target.value)} className="input-base"><option value="">İstasyon Seç</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={sensor1} onChange={e => setSensor1(e.target.value)} className="input-base" disabled={!selectedStation}><option value="">Sensör 1</option>{availableSensorTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <select value={sensor2} onChange={e => setSensor2(e.target.value)} className="input-base" disabled={!selectedStation}><option value="">Sensör 2</option>{availableSensorTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div className="h-96">
                {isLoading ? <Skeleton className="w-full h-full"/> : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                            <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9CA3AF' : '#6B7281' }} />
                            <YAxis yAxisId="left" stroke="#8884d8" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9CA3AF' : '#6B7281' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9CA3AF' : '#6B7281' }} />
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', border: `1px solid ${theme === 'dark' ? '#4B5563' : '#E5E7EB'}` }}/>
                            <Legend wrapperStyle={{fontSize: '12px'}}/>
                            <Line yAxisId="left" type="monotone" dataKey={sensor1} stroke="#8884d8" activeDot={{ r: 8 }} dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey={sensor2} stroke="#82ca9d" dot={false}/>
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    )
};

const HistoricalDataExporter: React.FC<{ stations: Station[], sensors: Sensor[] }> = ({ stations, sensors }) => {
    const [selectedStations, setSelectedStations] = useState<string[]>([]);
    const [selectedSensorTypes, setSelectedSensorTypes] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState('last7d');
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const sensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    useEffect(() => {
        if (stations.length > 0 && selectedStations.length === 0) {
            setSelectedStations(stations.map(s => s.id));
        }
    }, [stations]);

    const handleFetchData = async () => {
        if (selectedStations.length === 0 || selectedSensorTypes.length === 0) {
            alert("Lütfen en az bir istasyon ve sensör tipi seçin.");
            return;
        }
        setIsLoading(true);
        setData([]);
        try {
            const history = await getReadingsHistory({ stationIds: selectedStations, sensorTypes: selectedSensorTypes });
            setData(history);
        } catch (error) {
            console.error("Failed to fetch historical data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        if (data.length === 0) {
            alert("Dışa aktarılacak veri yok.");
            return;
        }
        const formattedData = data.map(d => ({
            'Zaman Damgası': new Date(d.timestamp).toLocaleString('tr-TR'),
            'İstasyon ID': d.stationId,
            'Sensör Tipi': d.sensorType,
            'Değer': (typeof d.value === 'object' && d.value !== null) ? JSON.stringify(d.value) : d.value
        }));
        
        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Veri Geçmişi");
        XLSX.writeFile(wb, "orion_veri_gecmisi.xlsx");
    };
    
    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Geçmiş Veri Gezgini ve Dışa Aktarma</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-3 bg-secondary dark:bg-gray-700/50 rounded-md border dark:border-gray-700">
                <MultiSelectDropdown label="İstasyon" options={stations.map(s => ({ value: s.id, label: s.name }))} selected={selectedStations} onChange={setSelectedStations} />
                <MultiSelectDropdown label="Sensör Tipi" options={sensorTypes.map(t => ({ value: t, label: t }))} selected={selectedSensorTypes} onChange={setSelectedSensorTypes} />
                <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="input-base">
                    <option value="last24h">Son 24 Saat</option>
                    <option value="last7d">Son 7 Gün</option>
                    <option value="last30d">Son 30 Gün</option>
                </select>
                <div className="flex gap-2">
                    <button onClick={handleFetchData} className="btn-primary w-full" disabled={isLoading}>{isLoading ? 'Yükleniyor...' : 'Verileri Getir'}</button>
                    <button onClick={handleExport} className="p-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400" disabled={data.length === 0} title="XLSX Olarak Dışa Aktar"><DownloadIcon className="w-5 h-5"/></button>
                </div>
            </div>
            <div className="h-96 overflow-auto border dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Zaman Damgası</th>
                            <th className="px-4 py-2">Sensör Tipi</th>
                            <th className="px-4 py-2 text-right">Değer</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {isLoading ? (
                            <tr><td colSpan={3} className="text-center p-8 text-muted dark:text-gray-400">Veriler yükleniyor...</td></tr>
                        ) : data.length > 0 ? (
                            data.map((row, i) => (
                                <tr key={i} className="hover:bg-secondary dark:hover:bg-gray-700">
                                    <td className="px-4 py-2 font-mono text-xs text-gray-800 dark:text-gray-300">{new Date(row.timestamp).toLocaleString('tr-TR')}</td>
                                    <td className="px-4 py-2 text-gray-800 dark:text-gray-300">{row.sensorType}</td>
                                    <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{(typeof row.value === 'object' && row.value !== null) ? JSON.stringify(row.value) : row.value}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={3} className="text-center p-8 text-muted dark:text-gray-400">Görüntülenecek veri yok. Lütfen filtreleri seçip "Verileri Getir"e tıklayın.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const AnomalyDetector: React.FC<{ stations: Station[], sensors: Sensor[] }> = ({ stations, sensors }) => {
    const [selectedStation, setSelectedStation] = useState<string>('');
    const [selectedSensorType, setSelectedSensorType] = useState<string>('');
    const [analysis, setAnalysis] = useState('');
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
        if (availableSensorTypes.length > 0) {
            setSelectedSensorType(availableSensorTypes[0]);
        }
    }, [availableSensorTypes]);

    const handleAnalyze = async () => {
        if (!selectedStation || !selectedSensorType) return;
        setIsLoading(true);
        setAnalysis('');
        try {
            const history = await getReadingsHistory({ stationIds: [selectedStation], sensorTypes: [selectedSensorType] });
            if(history.length < 10) {
                setAnalysis("Analiz için yeterli veri bulunamadı (en az 10 kayıt gerekli).");
                return;
            }
            const dataToAnalyze = history.map(h => ({ time: h.timestamp, value: h.value })).slice(0, 100);

            const prompt = `Sen bir meteoroloji veri analisti uzmanısın. Aşağıda bir istasyondaki sensör verileri bulunmaktadır. Bu verilerdeki ani yükselişler, düşüşler, tutarsızlıklar veya dikkate değer trendler gibi anomalileri tespit et. Bulgularını kısa ve anlaşılır maddeler halinde Türkçe olarak açıkla.
            - İstasyon: ${stations.find(s => s.id === selectedStation)?.name}
            - Sensör Tipi: ${selectedSensorType}
            - Veri (son 100 kayıt):
            ${JSON.stringify(dataToAnalyze, null, 2)}
            `;
            
            let fullText = '';
            const stream = await sendMessageToGemini(prompt);
            for await (const chunk of stream) {
                fullText += chunk.text;
                setAnalysis(fullText + "..."); // Add ellipsis for streaming effect
            }
            setAnalysis(fullText); // Set final text
        } catch (error: any) {
            console.error("Failed to get analysis from Gemini:", error);
            let errorMessage = "Analiz sırasında bir hata oluştu.";
            if (error.message && (error.message.includes('API Key') || error.message.includes('API key'))) {
                errorMessage = "Yapay zeka özelliği için API anahtarı yapılandırılmamış.";
            }
            setAnalysis(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Yapay Zeka Destekli Anomali Tespiti</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-secondary dark:bg-gray-700/50 rounded-md border dark:border-gray-700 items-center">
                <select value={selectedStation} onChange={e => setSelectedStation(e.target.value)} className="input-base">
                    <option value="">İstasyon Seç</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                 <select value={selectedSensorType} onChange={e => setSelectedSensorType(e.target.value)} className="input-base" disabled={!selectedStation}>
                    <option value="">Sensör Tipi Seç</option>
                    {availableSensorTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={handleAnalyze} disabled={isLoading || !selectedStation || !selectedSensorType} className="btn-primary flex items-center justify-center gap-2">
                    <BrainIcon className="w-5 h-5"/>
                    {isLoading ? 'Analiz Ediliyor...' : 'Anomalileri Tespit Et'}
                </button>
            </div>
            {(analysis || isLoading) && (
                <div className="p-4 bg-secondary dark:bg-gray-700/50 rounded-md border dark:border-gray-700">
                    <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Analiz Sonuçları:</h4>
                    <p className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{analysis.replace("...", "")}</p>
                </div>
            )}
        </Card>
    );
};


interface AnalysisProps {
    stations: Station[];
    sensors: Sensor[];
}

const Analysis: React.FC<AnalysisProps> = ({ stations, sensors }) => {
    return (
        <div className="space-y-6">
            <style>{`
                .input-base { width: 100%; background-color: #FFFFFF; border: 1px solid #D1D5DB; border-radius: 0.5rem; padding: 0.625rem 1rem; }
                .dark .input-base { background-color: #374151; border-color: #4B5563; color: #F3F4F6; }
                .btn-primary { padding: 0.625rem 1rem; background-color: #E95420; color: white; border-radius: 0.5rem; font-weight: 600; transition: background-color 0.2s; }
                .btn-primary:hover { background-color: #c2410c; }
                .btn-primary:disabled { background-color: #9CA3AF; cursor: not-allowed; }
            `}</style>
            <SnowWaterEquivalentCalculator />
            <SensorCorrelationChart stations={stations} sensors={sensors} />
            <HistoricalDataExporter stations={stations} sensors={sensors} />
            <AnomalyDetector stations={stations} sensors={sensors} />
        </div>
    );
};

export default Analysis;