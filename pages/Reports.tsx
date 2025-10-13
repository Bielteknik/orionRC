import React, { useState, useMemo, useEffect } from 'react';
import { Report, ReportConfig, ReportSchedule, Station, Sensor } from '../types';
import Card from '../components/common/Card';
import AddReportDrawer from '../components/AddReportDrawer';
import ScheduleReportDrawer from '../components/ScheduleReportDrawer';
import { AddIcon, SearchIcon, DownloadIcon, EditIcon, DeleteIcon, CalendarIcon } from '../components/icons/Icons';
// Fix: Removed incorrect mock data imports. Data will be fetched from the API.
import { getStations, getSensors } from '../services/apiService';
import { robotoFontBase64 } from '../services/pdfFonts';

const MOCK_REPORTS: Report[] = [
  { id: 'RPT001', title: 'Günlük Özet Raporu - 20.07.2024', createdAt: '2024-07-20T09:00:00Z', type: 'daily' },
  { id: 'RPT002', title: 'Haftalık Sensör Veri Analizi', createdAt: '2024-07-19T18:00:00Z', type: 'weekly' },
  { id: 'RPT003', title: 'Aylık İstasyon Durum Raporu - Haziran', createdAt: '2024-07-01T10:00:00Z', type: 'monthly' },
  { id: 'RPT004', title: 'Günlük Özet Raporu - 19.07.2024', createdAt: '2024-07-19T09:00:00Z', type: 'daily' },
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

    const generatePdfReport = (report: Report) => {
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF();
        const config = report.config;
        doc.addFileToVFS('Roboto-Regular.ttf', robotoFontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
        doc.setFontSize(20); doc.setTextColor(40); doc.text(report.title, 14, 22);
        doc.setFontSize(11); doc.setTextColor(128); doc.text(`Oluşturma Tarihi: ${new Date(report.createdAt).toLocaleString('tr-TR')}`, 14, 30);
        if(config) {
            doc.setFontSize(12); doc.setTextColor(40); doc.text("Uygulanan Filtreler", 14, 45); doc.setLineWidth(0.5); doc.line(14, 46, 200, 46);
            // Fix: Added optional chaining and replaced mock data with fetched state data to prevent type and runtime errors.
            let filterText = `Tarih Aralığı: ${config.dateRangePreset}\n`;
            filterText += `İstasyonlar: ${config.selectedStations?.length > 0 ? stations.filter(s => config.selectedStations.includes(s.id)).map(s => s.name).join(', ') : 'Tümü'}\n`;
            filterText += `Sensör Tipleri: ${config.selectedSensorTypes?.length > 0 ? config.selectedSensorTypes.join(', ') : 'Tümü'}`;
            doc.setFontSize(10); doc.setTextColor(80); doc.text(filterText, 14, 52);
        }
        const reportData = MOCK_SENSOR_READINGS.filter(reading => {
            const stationMatch = config?.selectedStations?.length === 0 || config?.selectedStations?.includes(reading.stationId) !== false;
            const sensorTypeMatch = config?.selectedSensorTypes?.length === 0 || config?.selectedSensorTypes?.includes(reading.sensorType) !== false;
            return stationMatch && sensorTypeMatch;
        });
        const tableData = reportData.map(d => [d.timestamp, d.stationName, d.sensorName, d.sensorType, `${d.value} ${d.unit}`]);
        (doc as any).autoTable({ head: [['Zaman Damgası', 'İstasyon', 'Sensör', 'Sensör Tipi', 'Değer']], body: tableData, startY: 75, theme: 'grid', headStyles: { fillColor: [31, 41, 55], font: 'Roboto' }, styles: { font: 'Roboto' } });
        const safeFileName = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${safeFileName}.pdf`);
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
                {filteredReports.map(report => (<tr key={report.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-6 py-4 font-medium text-gray-900">{report.title}</td><td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${report.type === 'daily' ? 'bg-blue-100 text-blue-800' : report.type === 'weekly' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{report.type}</span></td><td className="px-6 py-4 font-mono text-gray-800">{new Date(report.createdAt).toLocaleString('tr-TR')}</td><td className="px-6 py-4 text-right"><button onClick={() => generatePdfReport(report)} className="flex items-center gap-2 text-accent font-semibold py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors text-sm"><DownloadIcon className="w-4 h-4" /><span>İndir</span></button></td></tr>))}
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