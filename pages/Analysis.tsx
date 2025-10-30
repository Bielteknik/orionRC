import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Station, Sensor, Camera } from '../types.ts';
import { getReadingsHistory, analyzeSnowDepth } from '../services/apiService.ts';
import { sendMessageToGemini } from '../services/geminiService.ts';
import Card from '../components/common/Card.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { BrainIcon, DownloadIcon, RefreshIcon, InfoIcon, CalculatorIcon, ChartBarIcon } from '../components/icons/Icons.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../components/ThemeContext.tsx';
import MultiSelectDropdown from '../components/common/MultiSelectDropdown.tsx';

// Use global XLSX from window
declare const XLSX: any;

const formatTimeAgo = (isoString: string | undefined): string => {
    if (!isoString) return 'Veri Yok';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Veri Yok';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 10) return "az önce";
    if (seconds < 60) return `${seconds} sn önce`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    return `${hours} sa önce`;
};

const getNumericValue = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'object') {
        const numeric = Object.values(value).find(v => typeof v === 'number');
        return typeof numeric === 'number' ? numeric : null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

const ComparativeSnowDepthAnalysis: React.FC<{ stations: Station[], sensors: Sensor[], cameras: Camera[] }> = ({ stations, sensors, cameras }) => {
    const [selectedStationId, setSelectedStationId] = useState<string>('');
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<'gemini' | 'opencv' | false>(false);
    const [interpretation, setInterpretation] = useState('');
    const [isLoadingInterpretation, setIsLoadingInterpretation] = useState(false);
    const [analysisMessage, setAnalysisMessage] = useState('');
    
    const [selectedGeminiSensorId, setSelectedGeminiSensorId] = useState<string>('');
    const [selectedOpenCVSensorId, setSelectedOpenCVSensorId] = useState<string>('');


    const virtualSensors = useMemo(() => 
        sensors.filter(s => s.stationId === selectedStationId && s.type === 'Kar Yüksekliği' && s.interface === 'virtual'),
        [sensors, selectedStationId]
    );

    useEffect(() => {
        if(stations.length > 0 && !selectedStationId) {
            setSelectedStationId(stations[0]?.id || '');
        }
        if (virtualSensors.length > 0) {
            if (!selectedGeminiSensorId) setSelectedGeminiSensorId(virtualSensors[0].id);
            if (!selectedOpenCVSensorId) setSelectedOpenCVSensorId(virtualSensors[0].id);
        }
    }, [stations, selectedStationId, virtualSensors, selectedGeminiSensorId, selectedOpenCVSensorId]);

    const { ultrasonicSensor, geminiSensor, openCVSensor, geminiSourceCamera } = useMemo(() => {
        if (!selectedStationId) return { ultrasonicSensor: null, geminiSensor: null, openCVSensor: null, geminiSourceCamera: null };
        
        const uSensor = sensors.find(s => s.stationId === selectedStationId && s.type === 'Mesafe' && s.interface !== 'virtual');
        const gSensor = sensors.find(s => s.id === selectedGeminiSensorId);
        const oSensor = sensors.find(s => s.id === selectedOpenCVSensorId);

        const findCamera = (sensor: Sensor | undefined) => {
            if(sensor && sensor.config && sensor.config.source_camera_id) {
                return cameras.find(c => c.id === sensor.config.source_camera_id);
            }
            return null;
        }

        return { 
            ultrasonicSensor: uSensor || null, 
            geminiSensor: gSensor || null, 
            openCVSensor: oSensor || null,
            geminiSourceCamera: findCamera(gSensor) || findCamera(oSensor), // Use any available camera image as placeholder
        };
    }, [selectedStationId, sensors, cameras, selectedGeminiSensorId, selectedOpenCVSensorId]);

    const handleTriggerAnalysis = async (type: 'gemini' | 'opencv') => {
        const sensor = type === 'gemini' ? geminiSensor : openCVSensor;
        const camera = geminiSourceCamera;

        if (!sensor || !camera) {
            setAnalysisMessage(`${type.toUpperCase()} analizi için sensör veya kamera yapılandırılmamış.`);
            return;
        }
        setIsLoadingAnalysis(type);
        setInterpretation('');
        setAnalysisMessage('');
        try {
            await analyzeSnowDepth(camera.id, sensor.id, type);
            setAnalysisMessage(`${type.toUpperCase()} analizi başlatıldı. Sonuçlar birkaç saniye içinde yansıyacaktır.`);
            setTimeout(() => setAnalysisMessage(''), 10000);
        } catch (error) {
            console.error(error);
            setAnalysisMessage(`${type.toUpperCase()} analizi tetiklenirken bir hata oluştu.`);
        } finally {
            setIsLoadingAnalysis(false);
        }
    };
    
    const ultrasonicValue = getNumericValue(ultrasonicSensor?.value);
    const geminiValue = getNumericValue(geminiSensor?.value);
    const openCVValue = getNumericValue(openCVSensor?.value);

    const handleInterpret = async () => {
        setIsLoadingInterpretation(true);
        setInterpretation('');
        const diff_gemini = (ultrasonicValue !== null && geminiValue !== null) ? Math.abs(ultrasonicValue - geminiValue).toFixed(1) : "hesaplanamadı";
        const diff_opencv = (ultrasonicValue !== null && openCVValue !== null) ? Math.abs(ultrasonicValue - openCVValue).toFixed(1) : "hesaplanamadı";

        try {
            const prompt = `Sen bir meteoroloji ve sensör veri analistisin. Bir istasyonda kar yüksekliği üç farklı yöntemle ölçülüyor:
1.  **Ultrasonik Sensör:** ${ultrasonicValue ?? 'Veri Yok'} cm
2.  **Yapay Zeka (Gemini):** ${geminiValue ?? 'Veri Yok'} cm
3.  **Görüntü İşleme (OpenCV):** ${openCVValue ?? 'Veri Yok'} cm

Hesaplanan farklar:
- Ultrasonik ve Gemini arası fark: ${diff_gemini} cm
- Ultrasonik ve OpenCV arası fark: ${diff_opencv} cm

Bu üç ölçüm arasındaki tutarlılığı ve farkların olası nedenlerini (örn: sensör kalibrasyonu, kar yüzeyinin pürüzlü olması, görüş koşulları, algoritma hassasiyeti vb.) analiz et. Hangi ölçümün daha güvenilir olabileceğine dair kısa, maddeler halinde bir uzman yorumu yap.`;
            
            const stream = await sendMessageToGemini(prompt);
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
                setInterpretation(fullText);
            }
        } catch (error) {
            setInterpretation("Yorumlama sırasında bir hata oluştu.");
        } finally {
            setIsLoadingInterpretation(false);
        }
    };
    
    const diffGemini = (ultrasonicValue !== null && geminiValue !== null) ? Math.abs(ultrasonicValue - geminiValue) : null;
    const diffOpenCV = (ultrasonicValue !== null && openCVValue !== null) ? Math.abs(ultrasonicValue - openCVValue) : null;
    
    const getDiffColor = (diff: number | null) => {
        if (diff === null) return 'text-gray-800 dark:text-gray-200';
        if (diff > 10) return 'text-danger';
        if (diff > 5) return 'text-warning';
        return 'text-success';
    }

    const LoadingSpinner: React.FC<{className?: string}> = ({className}) => (
        <RefreshIcon className={`animate-spin h-5 w-5 ${className || ''}`} />
    );

    return (
        <Card className="p-0 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Karşılaştırmalı Kar Yüksekliği Analizi</h3>
                <p className="text-sm text-muted">Fiziksel sensör verilerini, iki farklı görüntü işleme tekniğinin sonuçlarıyla karşılaştırın.</p>
                <div className="mt-4 max-w-sm">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">İstasyon Seçin</label>
                    <select value={selectedStationId} onChange={e => setSelectedStationId(e.target.value)} className="input-base">
                         {stations.length > 0 ? stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>) : <option>Yükleniyor...</option>}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-11">
                {/* Ultrasonic */}
                <div className="lg:col-span-3 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
                     <div className="flex items-center gap-2"><RefreshIcon className="w-5 h-5 text-muted" /><h4 className="font-semibold text-gray-800 dark:text-gray-200">Ultrasonik Sensör</h4></div>
                    {ultrasonicSensor ? (
                        <>
                            <div className="text-center my-8"><p className="text-7xl font-bold text-gray-900 dark:text-gray-100">{ultrasonicValue?.toFixed(1) ?? '--'}<span className="text-3xl text-muted ml-1">cm</span></p></div>
                            <p className="text-xs text-center text-muted">Son Güncelleme: {formatTimeAgo(ultrasonicSensor.lastUpdate)}</p>
                        </>
                    ) : <div className="text-center py-10 text-muted my-auto">Mesafe sensörü bulunamadı.</div>}
                </div>

                {/* Image Analyses */}
                <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-center mb-4">Görüntü İşleme Analizleri</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Gemini */}
                        <div className="p-4 rounded-lg bg-secondary dark:bg-gray-900/40 border dark:border-gray-700 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2"><BrainIcon className="w-5 h-5 text-accent" /><h5 className="font-semibold text-gray-800 dark:text-gray-200">Gemini</h5></div>
                                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{geminiValue?.toFixed(1) ?? '--'}<span className="text-xl text-muted ml-1">cm</span></p>
                            </div>
                            <select value={selectedGeminiSensorId} onChange={e => setSelectedGeminiSensorId(e.target.value)} className="w-full text-xs p-1 input-base" disabled={virtualSensors.length === 0}><option value="" disabled>Sanal Sensör Seç</option>{virtualSensors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                            <img src={geminiSourceCamera?.photos?.[0] || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} alt="kamera görüntüsü" className="w-full h-24 object-cover rounded-md border dark:border-gray-700 bg-gray-300 dark:bg-gray-700"/>
                            <button onClick={() => handleTriggerAnalysis('gemini')} disabled={isLoadingAnalysis === 'gemini'} className="btn-secondary w-full text-sm flex items-center justify-center gap-2"> {isLoadingAnalysis === 'gemini' ? <LoadingSpinner/> : <BrainIcon className="w-4 h-4"/>} Analiz Et</button>
                        </div>
                        {/* OpenCV */}
                        <div className="p-4 rounded-lg bg-secondary dark:bg-gray-900/40 border dark:border-gray-700 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2"><BrainIcon className="w-5 h-5 text-blue-500" /><h5 className="font-semibold text-gray-800 dark:text-gray-200">OpenCV</h5></div>
                                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{openCVValue?.toFixed(1) ?? '--'}<span className="text-xl text-muted ml-1">cm</span></p>
                            </div>
                            <select value={selectedOpenCVSensorId} onChange={e => setSelectedOpenCVSensorId(e.target.value)} className="w-full text-xs p-1 input-base" disabled={virtualSensors.length === 0}><option value="" disabled>Sanal Sensör Seç</option>{virtualSensors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                            <div className="w-full h-24 rounded-md border dark:border-gray-700 bg-gray-300 dark:bg-gray-700 flex items-center justify-center"><p className="text-xs text-muted">Görüntü yok</p></div>
                            <button onClick={() => handleTriggerAnalysis('opencv')} disabled={isLoadingAnalysis === 'opencv'} className="btn-secondary w-full text-sm flex items-center justify-center gap-2">{isLoadingAnalysis === 'opencv' ? <LoadingSpinner/> : <BrainIcon className="w-4 h-4"/>} Analiz Et</button>
                        </div>
                    </div>
                </div>

                {/* Difference & Interpretation */}
                <div className="lg:col-span-3 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col">
                    <h4 className="font-semibold text-center text-gray-800 dark:text-gray-200 mb-4">Fark Analizi</h4>
                    <div className="space-y-4 flex-grow">
                        <div className="text-center bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                            <p className="text-xs text-muted">Ultrasonik vs Gemini Farkı</p>
                            <p className={`text-3xl font-bold ${getDiffColor(diffGemini)}`}>{diffGemini?.toFixed(1) ?? '--'} <span className="text-lg">cm</span></p>
                        </div>
                        <div className="text-center bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                            <p className="text-xs text-muted">Ultrasonik vs OpenCV Farkı</p>
                            <p className={`text-3xl font-bold ${getDiffColor(diffOpenCV)}`}>{diffOpenCV?.toFixed(1) ?? '--'} <span className="text-lg">cm</span></p>
                        </div>
                    </div>
                     <button onClick={handleInterpret} disabled={isLoadingInterpretation} className="btn-primary w-full mt-4 flex items-center justify-center gap-2"> {isLoadingInterpretation ? <LoadingSpinner className="text-white"/> : <BrainIcon className="w-5 h-5"/>} Farkları Yorumla</button>
                     {analysisMessage && <p className="text-xs text-center text-accent pt-2">{analysisMessage}</p>}
                     {interpretation && (
                        <div className="text-xs text-muted p-3 bg-primary dark:bg-gray-800 rounded-md border dark:border-gray-600 max-h-40 overflow-y-auto mt-3 prose prose-sm dark:prose-invert">
                            <p dangerouslySetInnerHTML={{ __html: interpretation.replace(/\n/g, '<br />') }} />
                        </div>
                     )}
                </div>
            </div>
            <style>{`.input-base { background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; padding: 0.5rem 0.75rem; width: 100%; } .dark .input-base { background-color: #374151; border-color: #4B5563; color: #F3F4F6; } .btn-primary { background-color: #F97316; color: white; padding: 0.625rem 1rem; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; } .btn-primary:hover { background-color: #EA580C; } .btn-primary:disabled { background-color: #9CA3AF; cursor: not-allowed; } .btn-secondary { background-color: #E5E7EB; color: #1F2937; padding: 0.625rem 1rem; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; } .btn-secondary:hover:not(:disabled) { background-color: #D1D5DB; } .dark .btn-secondary { background-color: #4B5563; color: white; } .dark .btn-secondary:hover:not(:disabled) { background-color: #6B7281; } .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }`}</style>
        </Card>
    )
};

const SWE_Calculator: React.FC = () => {
    const [snowDepth, setSnowDepth] = useState('');
    const [snowDensity, setSnowDensity] = useState('150');
    const [swe, setSwe] = useState<number | null>(null);

    const calculateSWE = () => {
        const depth = parseFloat(snowDepth);
        const density = parseFloat(snowDensity);
        if (!isNaN(depth) && !isNaN(density)) {
            // SWE (mm) = Kar Yüksekliği (cm) * (Kar Yoğunluğu (kg/m³) / Su Yoğunluğu (1000 kg/m³)) * 10
            const calculatedSwe = depth * (density / 1000) * 10;
            setSwe(calculatedSwe);
        } else {
            setSwe(null);
        }
    };
    
    useEffect(calculateSWE, [snowDepth, snowDensity]);

    return (
        <Card className="h-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Kar Su Eşdeğeri (SWE) Hesaplayıcı</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label htmlFor="snow-depth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kar Yüksekliği (cm)</label>
                    <input type="number" id="snow-depth" value={snowDepth} onChange={e => setSnowDepth(e.target.value)} placeholder="Örn: 85" className="mt-1 input-base" />
                </div>
                <div>
                    <label htmlFor="snow-density" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kar Yoğunluğu (kg/m³)</label>
                    <input type="number" id="snow-density" value={snowDensity} onChange={e => setSnowDensity(e.target.value)} className="mt-1 input-base" />
                </div>
                <div className="p-4 bg-secondary dark:bg-gray-700/50 rounded-lg text-center">
                    <p className="text-sm text-muted">Hesaplanan SWE</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{swe !== null ? swe.toFixed(2) : '--'} <span className="text-lg">mm</span></p>
                </div>
            </div>
             <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-900/30 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>Bu hesaplayıcı, girilen kar yüksekliği ve yoğunluk değerlerine göre tahmini Kar Su Eşdeğeri (SWE) değerini anında hesaplar.</p>
            </div>
        </Card>
    );
};

const CorrelationGraph: React.FC<{ stations: Station[], sensors: Sensor[] }> = ({ stations, sensors }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';
    
    const allSensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);
    
    const [selectedStations, setSelectedStations] = useState<string[]>([]);
    const [selectedSensorTypes, setSelectedSensorTypes] = useState<string[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        if(stations.length > 0 && selectedStations.length === 0) {
            setSelectedStations([stations[0].id]);
        }
        if(allSensorTypes.length > 0 && selectedSensorTypes.length === 0) {
            setSelectedSensorTypes(allSensorTypes.slice(0,2));
        }
    }, [stations, allSensorTypes]);

    const handleFetchHistory = useCallback(async () => {
        if (selectedStations.length === 0 || selectedSensorTypes.length === 0) {
            setHistory([]);
            return;
        }
        setIsLoading(true);
        try {
            const data = await getReadingsHistory({ stationIds: selectedStations, sensorTypes: selectedSensorTypes });
            setHistory(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedStations, selectedSensorTypes]);
    
    const stationOptions = useMemo(() => stations.map(s => ({ value: s.id, label: s.name })), [stations]);
    const sensorTypeOptions = useMemo(() => allSensorTypes.map(t => ({ value: t, label: t })), [allSensorTypes]);

    const chartData = useMemo(() => {
        const timeMap = new Map<string, any>();
        history.forEach(reading => {
            const timestamp = new Date(reading.timestamp).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            if (!timeMap.has(timestamp)) {
                timeMap.set(timestamp, { name: timestamp });
            }
            const entry = timeMap.get(timestamp);
            
            const numericValue = getNumericValue(reading.value);
            // FIX: Use getNumericValue to safely extract and format the numeric value.
            if (numericValue !== null) {
                entry[reading.sensorType] = Number(numericValue.toFixed(2));
            } else {
                entry[reading.sensorType] = null;
            }
        });
        return Array.from(timeMap.values()).reverse();
    }, [history]);

    const chartColors = ['#F97316', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'];
    
    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Sensör Korelasyon Grafiği</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-center">
                <MultiSelectDropdown label="İstasyon" options={stationOptions} selected={selectedStations} onChange={setSelectedStations} />
                <MultiSelectDropdown label="Sensör Tipi" options={sensorTypeOptions} selected={selectedSensorTypes} onChange={setSelectedSensorTypes} />
                <button onClick={handleFetchHistory} disabled={isLoading} className="btn-primary md:col-span-2">
                    {isLoading ? 'Yükleniyor...' : 'Grafiği Oluştur'}
                </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} />
                        <YAxis tick={{ fontSize: 10, fill: tickColor }} />
                        <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` }}/>
                        <Legend />
                        {selectedSensorTypes.map((type, index) => (
                             <Line key={type} type="monotone" dataKey={type} stroke={chartColors[index % chartColors.length]} strokeWidth={2} dot={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

const DataExplorer: React.FC<{ stations: Station[], sensors: Sensor[] }> = ({ stations, sensors }) => {
    const [selectedStations, setSelectedStations] = useState<string[]>([]);
    const [selectedSensorTypes, setSelectedSensorTypes] = useState<string[]>([]);
    const [timeRange, setTimeRange] = useState('last7d');
    const [readings, setReadings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const allSensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);
    const stationOptions = useMemo(() => stations.map(s => ({ value: s.id, label: s.name })), [stations]);
    const sensorTypeOptions = useMemo(() => allSensorTypes.map(t => ({ value: t, label: t })), [allSensorTypes]);
    
    useEffect(() => {
        if(stations.length > 0 && selectedStations.length === 0) setSelectedStations(stations.map(s => s.id));
        if(allSensorTypes.length > 0 && selectedSensorTypes.length === 0) setSelectedSensorTypes(allSensorTypes);
    }, [stations, allSensorTypes]);
    
    const handleFetchData = useCallback(async () => {
        if (selectedStations.length === 0 || selectedSensorTypes.length === 0) {
            setReadings([]);
            return;
        }
        setIsLoading(true);
        try {
            const data = await getReadingsHistory({ stationIds: selectedStations, sensorTypes: selectedSensorTypes });
            setReadings(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedStations, selectedSensorTypes]);

    const formatReadingValue = (reading: any): string => {
        const { value } = reading;
        if (value === null || value === undefined) return 'N/A';
        const numValue = getNumericValue(value);
        
        // FIX: A non-null return from getNumericValue is always a number, so the inner type check is redundant.
        // This also resolves the TS error under strict settings.
        if (numValue !== null) {
            return `${numValue.toFixed(2)}`;
        }
        
        return JSON.stringify(value);
    };

    const handleExport = () => {
        if (readings.length === 0) {
            alert("Dışa aktarılacak veri bulunmuyor.");
            return;
        }
        const dataToExport = readings.map(reading => {
            const station = stations.find(s => s.id === reading.stationId);
            return {
                'Zaman Damgası': new Date(reading.timestamp).toLocaleString('tr-TR'),
                'İstasyon': station?.name || 'Bilinmiyor',
                'Sensör Adı': reading.sensorName,
                'Sensör Tipi': reading.sensorType,
                'Değer': formatReadingValue(reading),
                'Birim': reading.unit || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Veri Geçmişi");
        XLSX.writeFile(wb, `orion_veri_gezgini_${new Date().toISOString().split('T')[0]}.xlsx`);
    };


    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Geçmiş Veri Gezgini ve Dışa Aktarma</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="md:col-span-2"><MultiSelectDropdown label="İstasyon" options={stationOptions} selected={selectedStations} onChange={setSelectedStations} /></div>
                <div className="md:col-span-2"><MultiSelectDropdown label="Sensör Tipi" options={sensorTypeOptions} selected={selectedSensorTypes} onChange={setSelectedSensorTypes} /></div>
                <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="input-base">
                    <option value="last24h">Son 24 Saat</option>
                    <option value="last7d">Son 7 Gün</option>
                    <option value="last30d">Son 30 Gün</option>
                </select>
            </div>
             <div className="flex justify-end gap-2 mb-4">
                <button onClick={handleFetchData} disabled={isLoading} className="btn-primary">
                    {isLoading ? 'Veriler Getiriliyor...' : 'Verileri Getir'}
                </button>
                 <button onClick={handleExport} title="Verileri Excel olarak indir" className="p-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400" disabled={readings.length === 0}>
                    <DownloadIcon className="w-5 h-5"/>
                </button>
            </div>
             <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-96">
              <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th scope="col" className="px-6 py-3">Zaman Damgası</th>
                    <th scope="col" className="px-6 py-3">İstasyon</th>
                    <th scope="col" className="px-6 py-3">Sensör Adı</th>
                    <th scope="col" className="px-6 py-3">Sensör Tipi</th>
                    <th scope="col" className="px-6 py-3 text-right">Değer</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((reading) => {
                    const date = new Date(reading.timestamp);
                    const displayTimestamp = !isNaN(date.getTime())
                        ? date.toLocaleString('tr-TR')
                        : reading.timestamp;
                    return (
                      <tr key={reading.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-6 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{displayTimestamp}</td>
                        <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">{stations.find(s => s.id === reading.stationId)?.name || 'N/A'}</td>
                        <td className="px-6 py-3">{reading.sensorName}</td>
                        <td className="px-6 py-3">{reading.sensorType}</td>
                        <td className="px-6 py-3 font-semibold text-gray-900 dark:text-gray-100 text-right whitespace-nowrap">
                            {formatReadingValue(reading)} {reading.unit || ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {readings.length === 0 && !isLoading && (
                  <div className="text-center py-10 text-muted">
                    <p>Görüntülenecek veri yok. Lütfen filtreleri seçip "Verileri Getir"e tıklayın.</p>
                  </div>
              )}
            </div>
        </Card>
    );
};


const AnomalyDetection: React.FC<{ stations: Station[], sensors: Sensor[] }> = ({ stations, sensors }) => {
    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Yapay Zeka Destekli Anomali Tespiti</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                 <select className="input-base">
                     {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="input-base">
                    {sensors.filter(s => s.stationId === stations[0]?.id).map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
                <button className="btn-primary flex items-center justify-center gap-2">
                    <BrainIcon className="w-5 h-5" />
                    Anomalileri Tespit Et
                </button>
            </div>
             <p className="text-xs text-center text-muted mt-4 p-4 border border-dashed rounded-lg">Bu özellik geliştirme aşamasındadır.</p>
        </Card>
    );
}


const Analysis: React.FC<{ stations: Station[], sensors: Sensor[], cameras: Camera[] }> = ({ stations, sensors, cameras }) => {
    const [activeTab, setActiveTab] = useState('Karşılaştırmalı Analiz');
    const tabs = [
        { name: 'Karşılaştırmalı Analiz', icon: <BrainIcon className="w-5 h-5"/> },
        { name: 'SWE Hesaplayıcı', icon: <CalculatorIcon className="w-5 h-5"/> },
        { name: 'Korelasyon Grafiği', icon: <ChartBarIcon className="w-5 h-5"/> },
        { name: 'Veri Gezgini', icon: <DownloadIcon className="w-5 h-5"/> },
        { name: 'Anomali Tespiti', icon: <BrainIcon className="w-5 h-5"/> }
    ];

    return (
        <div className="space-y-6">
             <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button 
                            key={tab.name} 
                            onClick={() => setActiveTab(tab.name)}
                            className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                                activeTab === tab.name 
                                ? 'border-accent text-accent' 
                                : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            {tab.icon}
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === 'Karşılaştırmalı Analiz' && <ComparativeSnowDepthAnalysis stations={stations} sensors={sensors} cameras={cameras} />}
            {activeTab === 'SWE Hesaplayıcı' && <SWE_Calculator />}
            {activeTab === 'Korelasyon Grafiği' && <CorrelationGraph stations={stations} sensors={sensors} />}
            {activeTab === 'Veri Gezgini' && <DataExplorer stations={stations} sensors={sensors} />}
            {activeTab === 'Anomali Tespiti' && <AnomalyDetection stations={stations} sensors={sensors} />}
        </div>
    );
};

export default Analysis;