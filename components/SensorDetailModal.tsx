import React, { useMemo } from 'react';
import { Sensor } from '../types.ts';
import { ThermometerIcon, DropletIcon, WindSockIcon, GaugeIcon, SensorIcon as GenericSensorIcon } from './icons/Icons.tsx';

interface SensorReading {
    id: string;
    value: any;
    unit: string;
    timestamp: string;
    sensorType: string;
    // Fix: Make interface property optional to match the type in the parent component.
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
        case 'Sıcaklık': return <ThermometerIcon className="w-6 h-6 text-muted" />;
        case 'Nem': return <DropletIcon className="w-6 h-6 text-muted" />;
        case 'Rüzgar Hızı': case 'Rüzgar Yönü': return <WindSockIcon className="w-6 h-6 text-muted" />;
        case 'Basınç': return <GaugeIcon className="w-6 h-6 text-muted" />;
        default: return <GenericSensorIcon className="w-5 h-5 text-muted" />;
    }
};

const formatDisplayValue = (reading: SensorReading): string => {
    const { value, sensorType, interface: sensorInterface } = reading;
    if (value === null || value === undefined) return 'N/A';
    if (typeof value !== 'object') return String(value);

    if (sensorInterface === 'openweather') {
        if (sensorType === 'Sıcaklık' && value.temperature !== undefined) {
            return String(value.temperature);
        }
        if (sensorType === 'Nem' && value.humidity !== undefined) {
            return String(value.humidity);
        }
    }
    
    const numericValue = Object.values(value).find(v => typeof v === 'number');
    return numericValue !== undefined ? String(numericValue) : JSON.stringify(value);
};


const SensorDetailModal: React.FC<SensorDetailModalProps> = ({ isOpen, onClose, sensor, readings }) => {
    if (!isOpen || !sensor) return null;

    const latestReadings = useMemo(() => {
        return [...readings]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20); // Show last 20 readings
    }, [readings]);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" 
            role="dialog" 
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                className="bg-primary rounded-lg shadow-xl w-full max-w-2xl transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-start justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-100 p-3 rounded-lg">{getSensorIcon(sensor.type)}</div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{sensor.name}</h2>
                            <p className="text-sm text-muted">{sensor.type}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <main className="p-6">
                    <h3 className="font-semibold text-gray-800 mb-3">Son Okunan Değerler</h3>
                    <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
                        {latestReadings.length > 0 ? (
                            <table className="w-full text-sm text-left text-gray-600">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Zaman Damgası</th>
                                        <th scope="col" className="px-6 py-3 text-right">Değer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {latestReadings.map(reading => (
                                        <tr key={reading.id} className="border-b border-gray-200 hover:bg-gray-50">
                                            <td className="px-6 py-3 font-mono text-gray-800">{new Date(reading.timestamp).toLocaleString('tr-TR')}</td>
                                            <td className="px-6 py-3 text-right font-semibold text-gray-900">{`${formatDisplayValue(reading)} ${reading.unit || ''}`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-10 text-muted">
                                <p>Bu sensör için geçmiş veri bulunamadı.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SensorDetailModal;
