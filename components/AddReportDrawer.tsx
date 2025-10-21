import React, { useState, useEffect } from 'react';
import { Station } from '../types.ts';
import { CalendarIcon, SensorIcon, StationIcon } from './icons/Icons.tsx';

interface AddReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reportConfig: any) => void;
  stations: Station[];
  sensorTypes: string[];
}

const today = new Date().toISOString().split('T')[0];

const AddReportDrawer: React.FC<AddReportDrawerProps> = ({ isOpen, onClose, onSave, stations, sensorTypes }) => {
    const [reportName, setReportName] = useState('');
    const [reportType, setReportType] = useState('Günlük');
    const [fileFormat, setFileFormat] = useState('XLSX');
    const [dateRangePreset, setDateRangePreset] = useState('last24h');
    const [customDateRange, setCustomDateRange] = useState({ start: today, end: today });
    const [selectedStations, setSelectedStations] = useState<string[]>([]);
    const [selectedSensorTypes, setSelectedSensorTypes] = useState<string[]>([]);
    const [dataRules, setDataRules] = useState({
        includeMinMaxAvg: true,
        includeAlerts: true,
        includeUptime: false,
        groupByStation: false,
        groupBySensorType: false,
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) resetState();
    }, [isOpen]);
    
    const handleSelectAllStations = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedStations(e.target.checked ? stations.map(s => s.id) : []);
    };
    
    const handleSelectAllSensorTypes = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedSensorTypes(e.target.checked ? sensorTypes : []);
    };

    const resetState = () => {
        setReportName('');
        setReportType('Günlük');
        setFileFormat('XLSX');
        setDateRangePreset('last24h');
        setCustomDateRange({ start: today, end: today });
        setSelectedStations([]);
        setSelectedSensorTypes([]);
        setDataRules({ includeMinMaxAvg: true, includeAlerts: true, includeUptime: false, groupByStation: false, groupBySensorType: false });
        setError('');
    };

    const handleSave = () => {
        if (!reportName.trim()) {
            setError('Rapor Adı zorunlu bir alandır.');
            return;
        }
        onSave({
            reportName,
            reportType,
            fileFormat,
            dateRangePreset,
            customDateRange,
            selectedStations,
            selectedSensorTypes,
            dataRules
        });
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className={`absolute inset-y-0 right-0 bg-secondary w-full max-w-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">Yeni Rapor Oluştur</h2>
                    <button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && <div className="bg-danger/10 text-danger text-sm font-medium p-3 rounded-md">{error}</div>}
                    
                    <div className="bg-primary p-5 rounded-lg border border-gray-200 space-y-5">
                        <h3 className="font-semibold text-lg text-gray-800 border-b border-gray-200 pb-2">Rapor Detayları</h3>
                        <div>
                            <label htmlFor="report-name" className="block text-sm font-medium text-gray-700 mb-1.5">Rapor Adı *</label>
                            <input type="text" id="report-name" value={reportName} onChange={e => setReportName(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="report-type" className="block text-sm font-medium text-gray-700 mb-1.5">Rapor Tipi</label>
                                <select id="report-type" value={reportType} onChange={e => setReportType(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                    <option>Günlük</option>
                                    <option>Haftalık</option>
                                    <option>Aylık</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="file-format" className="block text-sm font-medium text-gray-700 mb-1.5">Dosya Formatı</label>
                                <select id="file-format" value={fileFormat} onChange={e => setFileFormat(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                    <option>XLSX</option>
                                    <option>CSV</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary p-5 rounded-lg border border-gray-200 space-y-5">
                        <h3 className="font-semibold text-lg text-gray-800 border-b border-gray-200 pb-2 flex items-center gap-2"><CalendarIcon className="w-5 h-5" /> Filtreleme Kuralları</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarih Aralığı</label>
                            <select value={dateRangePreset} onChange={e => setDateRangePreset(e.target.value)} className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent">
                                <option value="last24h">Son 24 Saat</option>
                                <option value="last7d">Son 7 Gün</option>
                                <option value="last30d">Son 30 Gün</option>
                                <option value="custom">Özel Aralık</option>
                            </select>
                        </div>

                        {dateRangePreset === 'custom' && (
                            <div className="grid grid-cols-2 gap-4 p-3 bg-secondary rounded-md border border-gray-200">
                                <div>
                                    <label htmlFor="start-date" className="text-xs font-medium text-gray-600 mb-1 block">Başlangıç</label>
                                    <input type="date" id="start-date" value={customDateRange.start} onChange={e => setCustomDateRange(p => ({...p, start: e.target.value}))} className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="end-date" className="text-xs font-medium text-gray-600 mb-1 block">Bitiş</label>
                                    <input type="date" id="end-date" value={customDateRange.end} onChange={e => setCustomDateRange(p => ({...p, end: e.target.value}))} className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent text-sm" />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">İstasyonlar ({selectedStations.length}/{stations.length})</h4>
                                <div className="bg-secondary p-3 rounded-md border border-gray-200 space-y-2 max-h-40 overflow-y-auto">
                                    <label className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm font-semibold">
                                        <input type="checkbox" onChange={handleSelectAllStations} checked={stations.length > 0 && selectedStations.length === stations.length} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                        <span>Tüm İstasyonlar</span>
                                    </label>
                                    <hr/>
                                    {stations.map(station => (
                                        <label key={station.id} className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm">
                                            <input type="checkbox" checked={selectedStations.includes(station.id)} onChange={() => setSelectedStations(p => p.includes(station.id) ? p.filter(id => id !== station.id) : [...p, station.id])} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                            <span>{station.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Sensör Tipleri ({selectedSensorTypes.length}/{sensorTypes.length})</h4>
                                <div className="bg-secondary p-3 rounded-md border border-gray-200 space-y-2 max-h-40 overflow-y-auto">
                                     <label className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm font-semibold">
                                        <input type="checkbox" onChange={handleSelectAllSensorTypes} checked={sensorTypes.length > 0 && selectedSensorTypes.length === sensorTypes.length} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                        <span>Tüm Tipler</span>
                                    </label>
                                    <hr/>
                                    {sensorTypes.map(type => (
                                        <label key={type} className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm">
                                            <input type="checkbox" checked={selectedSensorTypes.includes(type)} onChange={() => setSelectedSensorTypes(p => p.includes(type) ? p.filter(t => t !== type) : [...p, type])} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                            <span>{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary p-5 rounded-lg border border-gray-200">
                         <h3 className="font-semibold text-lg text-gray-800 border-b border-gray-200 pb-2">Veri Kuralları</h3>
                         <div className="pt-4 space-y-3">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={dataRules.includeMinMaxAvg} onChange={e => setDataRules(p => ({...p, includeMinMaxAvg: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                <span className="text-sm text-gray-700">Min/Maks/Ortalama Değerleri Ekle</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={dataRules.includeAlerts} onChange={e => setDataRules(p => ({...p, includeAlerts: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                <span className="text-sm text-gray-700">Aktif Uyarıları Ekle</span>
                            </label>
                             <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={dataRules.includeUptime} onChange={e => setDataRules(p => ({...p, includeUptime: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                <span className="text-sm text-gray-700">Cihaz Çalışma Sürelerini (Uptime) Ekle</span>
                            </label>
                            <div className="pt-2 mt-2 border-t">
                                <label className="flex items-center space-x-3 cursor-pointer mt-3">
                                    <input type="checkbox" checked={dataRules.groupByStation} onChange={e => setDataRules(p => ({...p, groupByStation: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                    <span className="text-sm text-gray-700 font-medium">İstasyona Göre Grupla (Sırala)</span>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer mt-3">
                                    <input type="checkbox" checked={dataRules.groupBySensorType} onChange={e => setDataRules(p => ({...p, groupBySensorType: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                    <span className="text-sm text-gray-700 font-medium">Sensör Tipine Göre Grupla (Sırala)</span>
                                </label>
                            </div>
                         </div>
                    </div>
                </main>
                <footer className="px-6 py-4 bg-primary border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-semibold text-sm">İptal</button>
                    <button type="button" onClick={handleSave} disabled={!reportName} className="px-5 py-2.5 bg-accent text-white rounded-md hover:bg-orange-600 font-semibold text-sm disabled:bg-gray-400 disabled:cursor-not-allowed">
                        Raporu Oluştur
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default AddReportDrawer;