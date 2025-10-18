import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Station, Camera, Sensor } from '../types.ts';
import { getStations, getCameras, getSensors, analyzeSnowDepth } from '../services/apiService.ts';
import Card from '../components/common/Card.tsx';
import { BrainIcon, ExclamationIcon } from '../components/icons/Icons.tsx';
import Skeleton from '../components/common/Skeleton.tsx';
import { SnowRulerDayIcon, SnowRulerNightIcon } from '../components/icons/RulerIcons.tsx';

const Analysis: React.FC = () => {
    const [stations, setStations] = useState<Station[]>([]);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedStationId, setSelectedStationId] = useState<string>('');
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [analysisResult, setAnalysisResult] = useState<number | null>(null);

    const pollingIntervalRef = React.useRef<number | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [stationsData, camerasData, sensorsData] = await Promise.all([getStations(), getCameras(), getSensors()]);
            setStations(stationsData);
            setCameras(camerasData);
            setSensors(sensorsData);
        } catch (err) {
            setError("Gerekli veriler yüklenemedi. Lütfen sayfayı yenileyin.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [fetchData]);

    const availableCameras = useMemo(() => {
        return cameras.filter(c => c.stationId === selectedStationId);
    }, [cameras, selectedStationId]);

    const virtualSnowSensor = useMemo(() => {
        return sensors.find(s => s.stationId === selectedStationId && s.type === 'Kar Yüksekliği');
    }, [sensors, selectedStationId]);

    useEffect(() => {
        // Reset camera selection if station changes
        setSelectedCameraId('');
        setAnalysisResult(null);
    }, [selectedStationId]);
    
    const pollForResults = useCallback(() => {
        if (!virtualSnowSensor) return;

        const checkResult = async () => {
            try {
                const updatedSensors = await getSensors();
                setSensors(updatedSensors); // Update sensor list to get latest values
                const updatedSensor = updatedSensors.find(s => s.id === virtualSnowSensor.id);

                if (updatedSensor && typeof updatedSensor.value === 'number') {
                    setAnalysisResult(updatedSensor.value);
                    setIsAnalyzing(false);
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                    }
                }
            } catch (error) {
                console.error("Polling for results failed:", error);
            }
        };

        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = window.setInterval(checkResult, 3000); // Poll every 3 seconds

        // Timeout to stop polling
        setTimeout(() => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                if (isAnalyzing) {
                    setIsAnalyzing(false);
                    setError("Analiz zaman aşımına uğradı. Agent'ın çevrimiçi olduğundan emin olun.");
                }
            }
        }, 60000); // 1 minute timeout

    }, [virtualSnowSensor, isAnalyzing]);

    const handleAnalyze = async () => {
        if (!selectedCameraId || !virtualSnowSensor) {
            setError("Lütfen bir istasyon, kamera ve bu istasyona atanmış 'Kar Yüksekliği' tipinde bir sanal sensör olduğundan emin olun.");
            return;
        }
        setIsAnalyzing(true);
        setAnalysisResult(null);
        setError(null);
        try {
            await analyzeSnowDepth(selectedCameraId, virtualSnowSensor.id);
            pollForResults();
        } catch (err) {
            setError("Analiz başlatılamadı.");
            setIsAnalyzing(false);
            console.error(err);
        }
    };

    if (isLoading) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (error && !isLoading) {
         return (
             <Card>
                <div className="text-center py-8 text-danger flex flex-col items-center justify-center gap-2">
                    <ExclamationIcon className="w-12 h-12"/>
                    <p className="font-semibold">{error}</p>
                </div>
            </Card>
         )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                 <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <BrainIcon className="w-8 h-8 text-accent" />
                        <h2 className="text-xl font-bold text-gray-800">Kar Yüksekliği Analizi</h2>
                    </div>
                    <p className="text-sm text-muted mb-4">
                        Bu araç, kamera görüntüsündeki ölçüm cetvelini kullanarak kar yüksekliğini yapay zeka ile tahmin eder.
                        Analizi başlatmak için bir istasyon ve kamera seçin.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="station-select" className="block text-sm font-medium text-gray-700 mb-1">İstasyon</label>
                            <select id="station-select" value={selectedStationId} onChange={e => setSelectedStationId(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                <option value="" disabled>İstasyon Seçin...</option>
                                {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-1">Kamera</label>
                            <select id="camera-select" value={selectedCameraId} onChange={e => setSelectedCameraId(e.target.value)} disabled={!selectedStationId || availableCameras.length === 0} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-200">
                                <option value="" disabled>Kamera Seçin...</option>
                                {availableCameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                         {!virtualSnowSensor && selectedStationId && (
                            <div className="bg-warning/10 text-warning text-xs p-3 rounded-md">
                                Bu istasyonda 'Kar Yüksekliği' tipinde bir sanal sensör bulunamadı. Lütfen Sensörler sayfasından ekleyin.
                            </div>
                        )}
                        <button onClick={handleAnalyze} disabled={!selectedCameraId || isAnalyzing || !virtualSnowSensor} className="w-full flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold">
                            {isAnalyzing ? (
                                <>
                                   <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                   Analiz Ediliyor...
                                </>
                            ) : (
                                "Kar Yüksekliğini Analiz Et"
                            )}
                        </button>
                    </div>
                 </Card>

                 {analysisResult !== null && (
                    <Card>
                        <h3 className="font-semibold text-lg text-center mb-2">Analiz Sonucu</h3>
                        <div className="text-center">
                            <p className="text-6xl font-bold text-accent">{analysisResult}</p>
                            <p className="text-muted font-semibold">Santimetre (cm)</p>
                        </div>
                    </Card>
                 )}
            </div>

            <div className="lg:col-span-2 space-y-4">
                <Card>
                    <h3 className="font-semibold text-lg mb-2">Referans Görüntüler</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col items-center">
                            <SnowRulerDayIcon className="w-full h-auto max-w-[200px] mx-auto" />
                            <p className="text-xs text-center text-muted mt-1">Gündüz Görünümü</p>
                        </div>
                        <div className="flex flex-col items-center">
                           <SnowRulerNightIcon className="w-full h-auto max-w-[200px] mx-auto" />
                            <p className="text-xs text-center text-muted mt-1">Gece Görünümü</p>
                        </div>
                    </div>
                     <div className="mt-4 p-3 bg-secondary rounded-md border text-sm text-gray-600 space-y-2">
                        <p>
                            Yukarıdaki referans görüntüler, kar yüksekliğini ölçmek için kullanılan cetveli göstermektedir. Bu cetvel, 0'dan 240 cm'ye kadar 10 cm aralıklarla işaretlenmiştir. Yapay zeka, bu cetvel üzerindeki kar seviyesini analiz ederek kar yüksekliğini cm cinsinden tahmin eder.
                        </p>
                        <p>
                            Yapay zeka analizleri, Google Gemini API kullanılarak yapılır ve bu servis ücrete tabidir. Detaylı ücretlendirme bilgisi için <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:underline">ai.google.dev/gemini-api/docs/billing</a> adresini ziyaret edebilirsiniz.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Analysis;