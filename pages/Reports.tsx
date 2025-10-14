import React, { useState, useMemo, useEffect } from 'react';
import { Report, ReportConfig, ReportSchedule, Station, Sensor } from '../types';
import Card from '../components/common/Card';
import AddReportDrawer from '../components/AddReportDrawer';
import ScheduleReportDrawer from '../components/ScheduleReportDrawer';
import { AddIcon, SearchIcon, DownloadIcon, EditIcon, DeleteIcon, CalendarIcon } from '../components/icons/Icons';
import { getStations, getSensors } from '../services/apiService';

// Add XLSX type declaration for the library loaded from CDN
declare const XLSX: any;

const MOCK_REPORTS: Report[] = [
  { id: 'RPT001', title: 'Günlük Özet Raporu - 20.07.2024', createdAt: '2024-07-20T09:00:00Z', type: 'daily', config: { fileFormat: 'XLSX' } as ReportConfig },
  { id: 'RPT002', title: 'Haftalık Sensör Veri Analizi', createdAt: '2024-07-19T18:00:00Z', type: 'weekly', config: { fileFormat: 'CSV' } as ReportConfig },
  { id: 'RPT003', title: 'Aylık İstasyon Durum Raporu - Haziran', createdAt: '2024-07-01T10:00:00Z', type: 'monthly', config: { fileFormat: 'XLSX' } as ReportConfig },
  { id: 'RPT004', title: 'Günlük Özet Raporu - 19.07.2024', createdAt: '2024-07-19T09:00:00Z', type: 'daily', config: { fileFormat: 'XLSX' } as ReportConfig },
];

const MOCK_SCHEDULES: ReportSchedule[] = [
    { id: 'SCH001', name: 'Günlük Yönetim Özeti', frequency: 'daily', time: '09:00', recipient: 'yonetim@meteo.com', reportConfig: { reportName: 'Günlük Yönetim Özeti' } as ReportConfig, isEnabled: true, lastRun: 'Bugün 09:00' },
    { id: 'SCH002', name: 'Haftalık Teknik Rapor', frequency: 'weekly', time: '17:00', recipient: 'teknik@meteo.com', reportConfig: { reportName: 'Haftalık Teknik Rapor' } as ReportConfig, isEnabled: true, lastRun: 'Geçen Cuma 17:00' },
    { id: 'SCH003', name: 'Aylık Veri Arşivi', frequency: 'monthly', time: '01:00', recipient: 'arsiv@meteo.com', reportConfig: { reportName: 'Aylık Veri Arşivi' } as ReportConfig, isEnabled: false, lastRun: 'Hiç çalışmadı' },
];

interface SensorReading {
    id: string; sensorId: string; stationId: string; sensorName: string; stationName: string; sensorType: string; value: number; unit: string; timestamp: string;
}

const Reports: React.FC = () => {
    const [reports, setReports] = useState<Report[]>(MOCK_REPORTS);
    const [schedules, setSchedules] = useState<ReportSchedule[]>(MOCK_SCHEDULES);
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('generated');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [stationsData, sensorsData] = await Promise.all([getStations(), getSensors()]);
                setStations(stationsData);
                setSensors(sensorsData);
            } catch (error) {
                console.error("Failed to fetch data for reports:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const MOCK_SENSOR_READINGS: SensorReading[] = useMemo(() => sensors.flatMap(sensor =>
        Array.from({ length: 20 }, (_, i) => {
            const date = new Date();
            date.setHours(date.getHours() - i);
            const valueFluctuation = (Math.random() - 0.5) * (sensor.value * 0.1);
            const station = stations.find(s => s.id === sensor.stationId);
            return {
                id: `${sensor.id}-reading-${i}`, sensorId: sensor.id, stationId: sensor.stationId, sensorName: sensor.name, stationName: station?.name || 'Bilinmeyen İstasyon', sensorType: sensor.type, value: parseFloat((sensor.value + valueFluctuation).toFixed(1)), unit: sensor.unit, timestamp: date.toLocaleString('tr-TR'),
            };
        })
    ), [sensors, stations]);

    const sensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    const filteredReports = reports.filter(report => report.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredSchedules = schedules.filter(schedule => schedule.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSaveReport = (reportConfig: ReportConfig) => {
        const typeMapping = { 'Günlük': 'daily', 'Haftalık': 'weekly', 'Aylık': 'monthly'} as const;
        const newReport: Report = { id: `RPT${Date.now()}`, title: reportConfig.reportName, type: typeMapping[reportConfig.reportType as keyof typeof typeMapping] || 'daily', createdAt: new Date().toISOString(), config: reportConfig };
        setReports(prev => [newReport, ...prev]);
    };

    const handleSaveSchedule = (scheduleData: Omit<ReportSchedule, 'id'>) => {
        const newSchedule: ReportSchedule = { id: `SCH${Date.now()}`, ...scheduleData };
        setSchedules(prev => [newSchedule, ...prev]);
    };

    const generateCsv = (data: any[], fileName: string) => {
        if (!data || data.length === 0) {
            alert('Rapor için veri bulunamadı.');
            return;
        }
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(';'), // Use semicolon for better Excel compatibility
            ...data.map(row => headers.map(header => `"${String(row[header]).replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateXlsx = (data: any[], fileName: string) => {
        if (!data || data.length === 0) {
            alert('Rapor için veri bulunamadı.');
            return;
        }
        const xlsx = (window as any).XLSX;
        if (typeof xlsx === 'undefined') {
            console.error('XLSX library is not loaded.');
            alert('Rapor oluşturma kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.');
            return;
        }
        const ws = xlsx.utils.json_to_sheet(data);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Rapor Verileri");
        xlsx.writeFile(wb, `${fileName}.xlsx`);
    };

    const handleDownloadReport = (report: Report) => {
        const { config } = report;
        if (!config) {
            alert('Bu rapor için yapılandırma bulunamadı, indirilemiyor.');
            return;
        }

        const reportData = MOCK_SENSOR_READINGS.filter(reading => {
            const stationMatch = !config.selectedStations || config.selectedStations.length === 0 || config.selectedStations.includes(reading.stationId);
            const sensorTypeMatch = !config.selectedSensorTypes || config.selectedSensorTypes.length === 0 || config.selectedSensorTypes.includes(reading.sensorType);
            return stationMatch && sensorTypeMatch;
        });

        const headers = {
            timestamp: 'Zaman Damgası',
            stationName: 'İstasyon',
            sensorName: 'Sensör',
            sensorType: 'Sensör Tipi',
            value: 'Değer'
        };

        const formattedData = reportData.map(d => ({
            [headers.timestamp]: d.timestamp,
            [headers.stationName]: d.stationName,
            [headers.sensorName]: d.sensorName,
            [headers.sensorType]: d.sensorType,
            [headers.value]: `${d.value} ${d.unit}`
        }));

        const safeFileName = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        if (config.fileFormat === 'CSV') {
            generateCsv(formattedData, safeFileName);
        } else { // Default to XLSX
            generateXlsx(formattedData, safeFileName);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-bold text-gray-900">Raporlar</h2></div>
                <button onClick={() => activeTab === 'generated' ? setIsDrawerOpen(true) : setIsScheduleDrawerOpen(true)} className="flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors"><AddIcon className="w-5 h-5" />
                    <span className="font-semibold">{activeTab === 'generated' ? 'Yeni Rapor Oluştur' : 'Yeni Plan Oluştur'}</span>
                </button>
            </div>
            
             <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('generated')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'generated' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700'}`}><DownloadIcon className="w-5 h-5"/>Oluşturulan Raporlar</button>
                    <button onClick={() => setActiveTab('scheduled')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'scheduled' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700'}`}><CalendarIcon className="w-5 h-5"/>Zamanlanmış Raporlar</button>
                </nav>
            </div>


            <Card>
                <div className="relative w-full md:w-1/3">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                    <input type="text" placeholder="Rapor veya plan ara..." className="w-full bg-secondary border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </Card>

            {activeTab === 'generated' && (
                <Card className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-600"><thead className="text-xs text-gray-700 uppercase bg-gray-100"><tr><th scope="col" className="px-6 py-3">Rapor Başlığı</th><th scope="col" className="px-6 py-3">Rapor Tipi</th><th scope="col" className="px-6 py-3">Oluşturulma Tarihi</th><th scope="col" className="px-6 py-3 text-right">İşlemler</th></tr></thead><tbody>
                {filteredReports.map(report => (<tr key={report.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-6 py-4 font-medium text-gray-900">{report.title}</td><td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${report.type === 'daily' ? 'bg-blue-100 text-blue-800' : report.type === 'weekly' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{report.type}</span></td><td className="px-6 py-4 font-mono text-gray-800">{new Date(report.createdAt).toLocaleString('tr-TR')}</td><td className="px-6 py-4 text-right"><button onClick={() => handleDownloadReport(report)} className="flex items-center gap-2 text-accent font-semibold py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors text-sm"><DownloadIcon className="w-4 h-4" /><span>İndir</span></button></td></tr>))}
                </tbody></table></div>{filteredReports.length === 0 && (<div className="text-center py-8 text-muted"><p>Rapor bulunamadı.</p></div>)}</Card>
            )}

             {activeTab === 'scheduled' && (
                <Card className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-600"><thead className="text-xs text-gray-700 uppercase bg-gray-100"><tr><th scope="col" className="px-6 py-3">Plan Adı</th><th scope="col" className="px-6 py-3">Sıklık</th><th scope="col" className="px-6 py-3">Alıcı</th><th scope="col" className="px-6 py-3">Durum</th><th scope="col" className="px-6 py-3">Son Çalışma</th><th scope="col" className="px-6 py-3 text-right">İşlemler</th></tr></thead><tbody>
                {filteredSchedules.map(schedule => (<tr key={schedule.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-6 py-4 font-medium text-gray-900">{schedule.name}</td><td className="px-6 py-4 capitalize">{schedule.frequency} @ {schedule.time}</td><td className="px-6 py-4">{schedule.recipient}</td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${schedule.isEnabled ? 'bg-success/10 text-success' : 'bg-gray-200 text-muted'}`}>{schedule.isEnabled ? 'Aktif' : 'Pasif'}</span></td><td className="px-6 py-4 font-mono text-gray-800 text-xs">{schedule.lastRun}</td><td className="px-6 py-4 text-right flex justify-end gap-2"><button className="text-muted hover:text-accent p-1"><EditIcon className="w-4 h-4"/></button><button className="text-muted hover:text-danger p-1"><DeleteIcon className="w-4 h-4"/></button></td></tr>))}
                </tbody></table></div>{filteredSchedules.length === 0 && (<div className="text-center py-8 text-muted"><p>Zamanlanmış rapor bulunamadı.</p></div>)}</Card>
            )}
            
            <AddReportDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onSave={handleSaveReport} stations={stations} sensorTypes={sensorTypes}/>
            <ScheduleReportDrawer isOpen={isScheduleDrawerOpen} onClose={() => setIsScheduleDrawerOpen(false)} onSave={handleSaveSchedule} stations={stations} sensorTypes={sensorTypes}/>
        </div>
    );
};

export default Reports;