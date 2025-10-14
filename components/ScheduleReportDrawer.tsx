import React, { useState, useEffect } from 'react';
import { Station, ReportConfig, ReportSchedule } from '../types.ts';

interface ScheduleReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scheduleData: Omit<ReportSchedule, 'id'>) => void;
  stations: Station[];
  sensorTypes: string[];
}

const ScheduleReportDrawer: React.FC<ScheduleReportDrawerProps> = ({ isOpen, onClose, onSave, stations, sensorTypes }) => {
    const [name, setName] = useState('');
    const [recipient, setRecipient] = useState('');
    const [frequency, setFrequency] = useState<'daily'|'weekly'|'monthly'>('daily');
    const [time, setTime] = useState('09:00');
    const [isEnabled, setIsEnabled] = useState(true);
    // Simplified report config for this example
    const [reportConfig, setReportConfig] = useState<Partial<ReportConfig>>({
        reportName: '',
        selectedStations: [],
        selectedSensorTypes: [],
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (name) {
            setReportConfig(prev => ({...prev, reportName: name}));
        }
    }, [name]);

    const handleSave = () => {
        if (!name.trim() || !recipient.trim()) {
            setError('Plan Adı ve Alıcı E-posta alanları zorunludur.');
            return;
        }
        onSave({
            name,
            frequency,
            time,
            recipient,
            reportConfig: reportConfig as ReportConfig,
            isEnabled,
        });
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className={`absolute inset-y-0 right-0 bg-secondary w-full max-w-lg transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary"><h2 className="text-xl font-bold text-gray-900">Rapor Planı Oluştur</h2><button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></header>
                <main className="flex-1 overflow-y-auto p-6 space-y-4">
                     {error && <div className="bg-danger/10 text-danger p-3 rounded-md">{error}</div>}
                     <div className="bg-primary p-4 rounded-lg border space-y-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Plan Adı" className="w-full input"/>
                        <input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Alıcı E-posta Adresi" className="w-full input"/>
                        <div className="grid grid-cols-2 gap-4">
                            <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full input">
                                <option value="daily">Günlük</option>
                                <option value="weekly">Haftalık</option>
                                <option value="monthly">Aylık</option>
                            </select>
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full input"/>
                        </div>
                        <label className="flex items-center"><input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} className="mr-2"/>Plan Aktif</label>
                     </div>
                </main>
                 <footer className="p-4 bg-primary border-t flex justify-end gap-2"><button onClick={onClose}>İptal</button><button onClick={handleSave} className="bg-accent text-white px-4 py-2 rounded-md">Kaydet</button></footer>
                 <style>{`.input { background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; padding: 0.5rem 0.75rem; }`}</style>
            </div>
        </div>
    );
};

export default ScheduleReportDrawer;