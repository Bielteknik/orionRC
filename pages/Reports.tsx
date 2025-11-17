import React, { useState, useMemo, useEffect } from 'react';
import { Report, ReportConfig, ReportSchedule, Station, Sensor } from '../types.ts';
import Card from '../components/common/Card.tsx';
import AddReportDrawer from '../components/AddReportDrawer.tsx';
import ScheduleReportDrawer from '../components/ScheduleReportDrawer.tsx';
import { AddIcon, SearchIcon, DownloadIcon, EditIcon, DeleteIcon, CalendarIcon } from '../components/icons/Icons.tsx';
import { getStations, getSensors, getReports, getReportSchedules, getReadings, deleteReport, deleteReportSchedule, addReportSchedule, updateReportSchedule } from '../services/apiService.ts';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal.tsx';
import * as XLSX from 'xlsx';

interface SensorReading {
    id: string;
    sensorId: string;
    stationId: string;
    sensorName: string;
    stationName: string;
    sensorType: string;
    value: any;
    unit: string;
    timestamp: string;
    interface: string;
}

const formatReadingValue = (reading: SensorReading): string => {
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


const Reports: React.FC = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [readings, setReadings] = useState<SensorReading[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('generated');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const [isScheduleDeleteModalOpen, setIsScheduleDeleteModalOpen] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState<ReportSchedule | null>(null);

    const fetchData = async () => {
        // Don't show loader on subsequent refetches
        if (reports.length === 0 && schedules.length === 0) setIsLoading(true);
        try {
            const [stationsData, sensorsData, reportsData, schedulesData, readingsData] = await Promise.all([
                getStations(), 
                getSensors(),
                getReports(),
                getReportSchedules(),
                getReadings()
            ]);
            setStations(stationsData);
            setSensors(sensorsData);
            setReports(reportsData);
            setSchedules(schedulesData);
            setReadings(readingsData);
        } catch (error) {
            console.error("Failed to fetch data for reports:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const sensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

    const filteredReports = reports.filter(report => report.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredSchedules = schedules.filter(schedule => schedule.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSaveReport = (reportConfig: ReportConfig) => {
        // Mocked until backend endpoint is implemented
        const typeMapping = { 'Günlük': 'daily', 'Haftalık': 'weekly', 'Aylık': 'monthly'} as const;
        const newReport: Report = { id: `RPT${Date.now()}`, title: reportConfig.reportName, type: typeMapping[reportConfig.reportType as keyof typeof typeMapping] || 'daily', createdAt: new Date().toISOString(), config: reportConfig };
        setReports(prev => [newReport, ...prev]);
    };

    const handleSaveSchedule = async (scheduleData: Omit<ReportSchedule, 'id' | 'lastRun'>) => {
        try {
            await addReportSchedule(scheduleData);
            fetchData();
        } catch(e) {
            console.error(e);
            alert("Rapor planı kaydedilemedi.");
        }
    };

    const handleToggleSchedule = async (schedule: ReportSchedule) => {
        try {
            await updateReportSchedule(schedule.id, { isEnabled: !schedule.isEnabled });
            fetchData();
        } catch(e) {
            console.error(e);
            alert("Plan durumu güncellenemedi.");
        }
    };

    const generateCsv = (data: any[], fileName: string) => {
        if (!data || data.length === 0) {
            alert('Rapor için veri bulunamadı.');
            return;
        }
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(';'),
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
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library is not loaded.');
            alert('Rapor oluşturma kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapor Verileri");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    const handleDownloadReport = (report: Report) => {
        const { config } = report;
        if (!config) {
            alert('Bu rapor için yapılandırma bulunamadı, indirilemiyor.');
            return;
        }
    
        let reportData = readings.filter(reading => {
            const stationMatch = !config.selectedStations || config.selectedStations.length === 0 || config.selectedStations.includes(reading.stationId);
            const sensorTypeMatch = !config.selectedSensorTypes || config.selectedSensorTypes.length === 0 || config.selectedSensorTypes.includes(reading.sensorType);
            // Date filtering would be added here in a real scenario
            return stationMatch && sensorTypeMatch;
        });
    
        // Apply grouping/sorting
        if (config.dataRules.groupByStation || config.dataRules.groupBySensorType) {
            reportData.sort((a, b) => {
                if (config.dataRules.groupByStation) {
                    const stationCompare = a.stationName.localeCompare(b.stationName, 'tr');
                    if (stationCompare !== 0) return stationCompare;
                }
                if (config.dataRules.groupBySensorType) {
                    const typeCompare = a.sensorType.localeCompare(b.sensorType, 'tr');
                    if (typeCompare !== 0) return typeCompare;
                }
                // Finally sort by date descending
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
        }
    
        const formattedData = reportData.map(d => {
            const date = new Date(d.timestamp);
            return {
                'Tarih': date.toLocaleDateString('tr-TR'),
                'Saat': date.toLocaleTimeString('tr-TR'),
                'İstasyon': d.stationName,
                'Sensör': d.sensorName,
                'Sensör Tipi': d.sensorType,
                'Değer': `${formatReadingValue(d)} ${d.unit || ''}`
            };
        });
    
        if (formattedData.length === 0) {
            alert('Rapor için filtrelenen kriterlerde veri bulunamadı.');
            return;
        }
    
        const safeFileName = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        if (config.fileFormat === 'CSV') {
            generateCsv(formattedData, safeFileName);
        } else { // Default to XLSX
            generateXlsx(formattedData, safeFileName);
        }
    };

    const handleOpenDeleteReportModal = (report: Report) => {
        setReportToDelete(report);
        setIsDeleteModalOpen(true);
    };

    const executeDeleteReport = async () => {
        if (!reportToDelete) return;
        try {
            await deleteReport(reportToDelete.id);
            fetchData();
        } catch (error) {
            console.error("Failed to delete report:", error);
            alert("Rapor silinirken bir hata oluştu.");
        }
    };

    const handleOpenDeleteScheduleModal = (schedule: ReportSchedule) => {
        setScheduleToDelete(schedule);
        setIsScheduleDeleteModalOpen(true);
    };

    const executeDeleteSchedule = async () => {
        if (!scheduleToDelete) return;
        try {
            await deleteReportSchedule(scheduleToDelete.id);
            fetchData();
        } catch (error) {
            console.error("Failed to delete schedule:", error);
            alert("Rapor planı silinirken bir hata oluştu.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div><h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Raporlar</h2></div>
                <button onClick={() => activeTab === 'generated' ? setIsDrawerOpen(true) : setIsScheduleDrawerOpen(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors"><AddIcon className="w-5 h-5" />
                    <span className="font-semibold">{activeTab === 'generated' ? 'Yeni Rapor Oluştur' : 'Yeni Plan Oluştur'}</span>
                </button>
            </div>
            
             <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    <button onClick={() => setActiveTab('generated')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'generated' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}><DownloadIcon className="w-5 h-5"/>Oluşturulan Raporlar</button>
                    <button onClick={() => setActiveTab('scheduled')} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'scheduled' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-gray-700 dark:hover:text-gray-300'}`}><CalendarIcon className="w-5 h-5"/>Zamanlanmış Raporlar</button>
                </nav>
            </div>


            <Card>
                <div className="relative w-full md:w-1/3">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                    <input type="text" placeholder="Rapor veya plan ara..." className="w-full bg-secondary border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </Card>

            {activeTab === 'generated' && (
                <Card className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-600 min-w-[640px]"><thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800"><tr><th scope="col" className="px-6 py-3">Rapor Başlığı</th><th scope="col" className="px-6 py-3">Rapor Tipi</th><th scope="col" className="px-6 py-3">Oluşturulma Tarihi</th><th scope="col" className="px-6 py-3 text-right">İşlemler</th></tr></thead><tbody>
                {filteredReports.map(report => (<tr key={report.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{report.title}</td><td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${report.type === 'daily' ? 'bg-blue-100 text-blue-800' : report.type === 'weekly' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{report.type}</span></td><td className="px-6 py-4 font-mono text-gray-800 dark:text-gray-200">{new Date(report.createdAt).toLocaleString('tr-TR')}</td>
                <td className="px-6 py-4 text-right flex justify-end items-center gap-2">
                    <button onClick={() => handleDownloadReport(report)} className="flex items-center gap-2 text-accent font-semibold py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors text-sm"><DownloadIcon className="w-4 h-4" /><span>İndir</span></button>
                    <button onClick={() => handleOpenDeleteReportModal(report)} className="text-muted hover:text-danger p-2 rounded-lg hover:bg-danger/10 transition-colors"><DeleteIcon className="w-4 h-4"/></button>
                </td>
                </tr>))}
                </tbody></table></div>{filteredReports.length === 0 && (<div className="text-center py-8 text-muted"><p>Rapor bulunamadı.</p></div>)}</Card>
            )}

             {activeTab === 'scheduled' && (
                <Card className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-600 min-w-[720px]"><thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800"><tr><th scope="col" className="px-6 py-3">Plan Adı</th><th scope="col" className="px-6 py-3">Sıklık</th><th scope="col" className="px-6 py-3">Alıcı</th><th scope="col" className="px-6 py-3">Durum</th><th scope="col" className="px-6 py-3">Son Çalışma</th><th scope="col" className="px-6 py-3 text-right">İşlemler</th></tr></thead><tbody>
                {schedules.map(schedule => (<tr key={schedule.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{schedule.name}</td><td className="px-6 py-4 capitalize">{schedule.frequency} @ {schedule.time}</td><td className="px-6 py-4">{schedule.recipient}</td>
                <td className="px-6 py-4">
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input type="checkbox" className="sr-only peer" checked={schedule.isEnabled} onChange={() => handleToggleSchedule(schedule)} />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                        </div>
                    </label>
                </td>
                <td className="px-6 py-4 font-mono text-gray-800 dark:text-gray-200 text-xs">{schedule.lastRun || "Henüz çalışmadı"}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button className="text-muted hover:text-accent p-2 rounded-lg hover:bg-accent/10 transition-colors"><EditIcon className="w-4 h-4"/></button>
                    <button onClick={() => handleOpenDeleteScheduleModal(schedule)} className="text-muted hover:text-danger p-2 rounded-lg hover:bg-danger/10 transition-colors"><DeleteIcon className="w-4 h-4"/></button>
                </td>
                </tr>))}
                </tbody></table></div>{filteredSchedules.length === 0 && (<div className="text-center py-8 text-muted"><p>Zamanlanmış rapor bulunamadı.</p></div>)}</Card>
            )}
            
            <AddReportDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onSave={handleSaveReport} stations={stations} sensorTypes={sensorTypes}/>
            <ScheduleReportDrawer isOpen={isScheduleDrawerOpen} onClose={() => setIsScheduleDrawerOpen(false)} onSave={handleSaveSchedule} stations={stations} sensorTypes={sensorTypes}/>
        
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={executeDeleteReport}
                title="Raporu Sil"
                message={<><strong>{reportToDelete?.title}</strong> adlı raporu silmek üzeresiniz. Bu işlem geri alınamaz. Onaylamak için şifreyi girin.</>}
            />
             <DeleteConfirmationModal
                isOpen={isScheduleDeleteModalOpen}
                onClose={() => setIsScheduleDeleteModalOpen(false)}
                onConfirm={executeDeleteSchedule}
                title="Rapor Planını Sil"
                message={<><strong>{scheduleToDelete?.name}</strong> adlı rapor planını silmek üzeresiniz. Bu işlem geri alınamaz. Onaylamak için şifreyi girin.</>}
            />
        </div>
    );
};

export default Reports;