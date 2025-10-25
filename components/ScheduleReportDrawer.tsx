import React, { useState, useEffect } from 'react';
import { Station, ReportConfig, ReportSchedule } from '../types.ts';
import { CalendarIcon } from './icons/Icons.tsx';

interface ScheduleReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scheduleData: Omit<ReportSchedule, 'id' | 'lastRun'>) => void;
  stations: Station[];
  sensorTypes: string[];
  scheduleToEdit?: ReportSchedule | null;
}

const today = new Date().toISOString().split('T')[0];

const ScheduleReportDrawer: React.FC<ScheduleReportDrawerProps> = ({ isOpen, onClose, onSave, stations, sensorTypes, scheduleToEdit }) => {
    const [name, setName] = useState('');
    const [recipient, setRecipient] = useState('');
    const [frequency, setFrequency] = useState<'daily'|'weekly'|'monthly'>('daily');
    const [time, setTime] = useState('09:00');
    const [isEnabled, setIsEnabled] = useState(true);
    
    // --- Report Config State ---
    const [reportConfig, setReportConfig] = useState<ReportConfig>({
        reportName: '',
        reportType: 'Günlük',
        fileFormat: 'XLSX',
        dateRangePreset: 'last24h',
        customDateRange: { start: today, end: today },
        selectedStations: [],
        selectedSensorTypes: [],
        dataRules: { includeMinMaxAvg: true, includeAlerts: true, includeUptime: false, groupByStation: false, groupBySensorType: false },
    });
    
    const [error, setError] = useState('');

    useEffect(() => {
        // When the plan name changes, also update the report name inside the config
        setReportConfig(prev => ({ ...prev, reportName: name }));
    }, [name]);
    
    const handleSelectAllStations = (e: React.ChangeEvent<HTMLInputElement>) => {
        setReportConfig(prev => ({...prev, selectedStations: e.target.checked ? stations.map(s => s.id) : []}));
    };
    
    const handleSelectAllSensorTypes = (e: React.ChangeEvent<HTMLInputElement>) => {
        setReportConfig(prev => ({...prev, selectedSensorTypes: e.target.checked ? sensorTypes : []}));
    };

    const resetState = () => {
        setName('');
        setRecipient('');
        setFrequency('daily');
        setTime('09:00');
        setIsEnabled(true);
        setReportConfig({
            reportName: '', reportType: 'Günlük', fileFormat: 'XLSX', dateRangePreset: 'last24h',
            customDateRange: { start: today, end: today }, selectedStations: [], selectedSensorTypes: [],
            dataRules: { includeMinMaxAvg: true, includeAlerts: true, includeUptime: false, groupByStation: false, groupBySensorType: false },
        });
        setError('');
    };

    useEffect(() => {
        if (!isOpen) {
            resetState();
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!name.trim() || !recipient.trim()) {
            setError('Plan Adı ve Alıcı E-posta alanları zorunludur.');
            return;
        }
        if (!recipient.includes('@')) {
            setError('Geçerli bir e-posta adresi girin.');
            return;
        }

        onSave({
            name,
            frequency,
            time,
            recipient,
            reportConfig,
            isEnabled,
        });
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className={`absolute inset-y-0 right-0 bg-secondary w-full max-w-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">Rapor Planı Oluştur</h2>
                    <button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </header>
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && <div className="bg-danger/10 text-danger text-sm font-medium p-3 rounded-md">{error}</div>}
                    
                    <div className="bg-primary p-5 rounded-lg border border-gray-200 space-y-5">
                        <h3 className="font-semibold text-lg text-gray-800 border-b border-gray-200 pb-2">Plan Detayları</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan Adı *</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full input-base" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alıcı E-posta Adresi *</label>
                            <input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="rapor@ornek.com" className="w-full input-base" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sıklık</label>
                                <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full input-base">
                                    <option value="daily">Her Gün</option>
                                    <option value="weekly">Her Hafta</option>
                                    <option value="monthly">Her Ay</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Gönderim Saati</label>
                                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full input-base"/>
                            </div>
                        </div>
                         <label className="flex items-center space-x-3 cursor-pointer pt-2">
                            <input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                            <span className="text-sm text-gray-700">Bu plan aktif ve çalışır durumda</span>
                        </label>
                    </div>

                    <div className="bg-primary p-5 rounded-lg border border-gray-200 space-y-5">
                        <h3 className="font-semibold text-lg text-gray-800 border-b border-gray-200 pb-2 flex items-center gap-2"><CalendarIcon className="w-5 h-5" /> Rapor İçeriği</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">İstasyonlar ({reportConfig.selectedStations.length}/{stations.length})</h4>
                                <div className="bg-secondary p-3 rounded-md border border-gray-200 space-y-2 max-h-40 overflow-y-auto">
                                    <label className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm font-semibold">
                                        <input type="checkbox" onChange={handleSelectAllStations} checked={stations.length > 0 && reportConfig.selectedStations.length === stations.length} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                        <span>Tüm İstasyonlar</span>
                                    </label>
                                    <hr/>
                                    {stations.map(station => (
                                        <label key={station.id} className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm">
                                            <input type="checkbox" checked={reportConfig.selectedStations.includes(station.id)} onChange={() => setReportConfig(p => ({...p, selectedStations: p.selectedStations.includes(station.id) ? p.selectedStations.filter(id => id !== station.id) : [...p.selectedStations, station.id]}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                            <span>{station.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Sensör Tipleri ({reportConfig.selectedSensorTypes.length}/{sensorTypes.length})</h4>
                                <div className="bg-secondary p-3 rounded-md border border-gray-200 space-y-2 max-h-40 overflow-y-auto">
                                     <label className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm font-semibold">
                                        <input type="checkbox" onChange={handleSelectAllSensorTypes} checked={sensorTypes.length > 0 && reportConfig.selectedSensorTypes.length === sensorTypes.length} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                        <span>Tüm Tipler</span>
                                    </label>
                                    <hr/>
                                    {sensorTypes.map(type => (
                                        <label key={type} className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer text-sm">
                                            <input type="checkbox" checked={reportConfig.selectedSensorTypes.includes(type)} onChange={() => setReportConfig(p => ({...p, selectedSensorTypes: p.selectedSensorTypes.includes(type) ? p.selectedSensorTypes.filter(t => t !== type) : [...p.selectedSensorTypes, type]}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
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
                                <input type="checkbox" checked={reportConfig.dataRules.includeMinMaxAvg} onChange={e => setReportConfig(p => ({...p, dataRules: {...p.dataRules, includeMinMaxAvg: e.target.checked}}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                <span className="text-sm text-gray-700">Min/Maks/Ortalama Değerleri Ekle</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={reportConfig.dataRules.includeAlerts} onChange={e => setReportConfig(p => ({...p, dataRules: {...p.dataRules, includeAlerts: e.target.checked}}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                <span className="text-sm text-gray-700">Aktif Uyarıları Ekle</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={reportConfig.dataRules.includeUptime} onChange={e => setReportConfig(p => ({...p, dataRules: {...p.dataRules, includeUptime: e.target.checked}}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                <span className="text-sm text-gray-700">Cihaz Çalışma Sürelerini (Uptime) Ekle</span>
                            </label>
                             <div className="pt-2 mt-2 border-t">
                                <label className="flex items-center space-x-3 cursor-pointer mt-3">
                                    <input type="checkbox" checked={reportConfig.dataRules.groupByStation} onChange={e => setReportConfig(p => ({...p, dataRules: {...p.dataRules, groupByStation: e.target.checked}}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                    <span className="text-sm text-gray-700 font-medium">İstasyona Göre Grupla (Sırala)</span>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer mt-3">
                                    <input type="checkbox" checked={reportConfig.dataRules.groupBySensorType} onChange={e => setReportConfig(p => ({...p, dataRules: {...p.dataRules, groupBySensorType: e.target.checked}}))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                    <span className="text-sm text-gray-700 font-medium">Sensör Tipine Göre Grupla (Sırala)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </main>
                <footer className="px-6 py-4 bg-primary border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-semibold text-sm">İptal</button>
                    <button type="button" onClick={handleSave} disabled={!name || !recipient} className="px-5 py-2.5 bg-accent text-white rounded-md hover:bg-orange-600 font-semibold text-sm disabled:bg-gray-400 disabled:cursor-not-allowed">
                        Planı Kaydet
                    </button>
                </footer>
                <style>{`.input-base { background-color: #FFFFFF; border: 1px solid #D1D5DB; border-radius: 0.5rem; padding: 0.625rem 1rem; }`}</style>
            </div>
        </div>
    );
};

export default ScheduleReportDrawer;