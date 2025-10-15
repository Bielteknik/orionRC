import React, { useState, useMemo, useCallback } from 'react';
import { Notification, Severity } from '../types.ts';
import Card from '../components/common/Card.tsx';
import { SearchIcon, BellIcon, ExclamationIcon, CheckIcon, DeleteIcon } from '../components/icons/Icons.tsx';
import { markAllNotificationsAsRead, clearAllNotifications } from '../services/apiService.ts';

interface NotificationsProps {
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    onRefresh: () => void;
}

const severityStyles: Record<Severity, { iconClass: string, bgClass: string, textClass: string }> = {
    'Kritik': { iconClass: 'text-danger', bgClass: 'bg-danger/10', textClass: 'text-danger' },
    'Uyarı': { iconClass: 'text-warning', bgClass: 'bg-warning/10', textClass: 'text-warning' },
    'Bilgi': { iconClass: 'text-blue-500', bgClass: 'bg-blue-500/10', textClass: 'text-blue-500' },
};

const Notifications: React.FC<NotificationsProps> = ({ notifications, setNotifications, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'read' | 'unread'>('all');

    const filteredNotifications = useMemo(() => {
        return notifications
            .filter(n => severityFilter === 'all' || n.severity === severityFilter)
            .filter(n => statusFilter === 'all' || (statusFilter === 'read' && n.isRead) || (statusFilter === 'unread' && !n.isRead))
            .filter(n => n.message.toLowerCase().includes(searchTerm.toLowerCase()) || n.stationName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [notifications, searchTerm, severityFilter, statusFilter]);
    
    const handleMarkAsRead = (id: string) => {
        // Mocked until backend endpoint is available
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsAsRead();
            onRefresh();
        } catch(error) {
            console.error("Failed to mark all as read", error);
            alert("Bir hata oluştu.");
        }
    };

    const handleDelete = (id: string) => {
        // Mocked until backend endpoint is available
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const handleClearAll = async () => {
        if (window.confirm('Tüm bildirimleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
            try {
                await clearAllNotifications();
                onRefresh();
            } catch(error) {
                console.error("Failed to clear notifications", error);
                alert("Bir hata oluştu.");
            }
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-1/3">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                        <input 
                            type="text" 
                            placeholder="Bildirimlerde ara..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-secondary border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value as any)} className="w-full md:w-auto input-base">
                            <option value="all">Tüm Önem Düzeyleri</option>
                            {Object.keys(severityStyles).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full md:w-auto input-base">
                            <option value="all">Tüm Durumlar</option>
                            <option value="unread">Okunmamış</option>
                            <option value="read">Okunmuş</option>
                        </select>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">Bildirim Listesi ({filteredNotifications.length})</h3>
                    <div className="flex items-center gap-2">
                         <button onClick={handleMarkAllAsRead} className="text-sm font-medium text-accent hover:underline disabled:text-muted" disabled={notifications.every(n => n.isRead)}>
                            Tümünü okundu say
                        </button>
                        <span className="text-gray-300">|</span>
                         <button onClick={handleClearAll} className="text-sm font-medium text-danger hover:underline disabled:text-muted" disabled={notifications.length === 0}>
                            Tümünü Temizle
                        </button>
                    </div>
                </div>
                 <div className="space-y-2">
                    {filteredNotifications.length > 0 ? filteredNotifications.map(n => (
                        <div key={n.id} className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${n.isRead ? 'bg-secondary/50 border-gray-200' : 'bg-primary border-blue-200'}`}>
                            <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${severityStyles[n.severity].bgClass}`}>
                                <ExclamationIcon className={`w-5 h-5 ${severityStyles[n.severity].iconClass}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className={`text-sm text-gray-800 ${!n.isRead ? 'font-bold' : ''}`}>{n.message}</p>
                                        <p className="text-xs text-muted mt-0.5">
                                            {n.stationName} - {n.sensorName} (<span className={`font-semibold ${severityStyles[n.severity].textClass}`}>{n.triggeredValue}</span>)
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted flex-shrink-0 ml-4">{new Date(n.timestamp).toLocaleString('tr-TR')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!n.isRead && (
                                     <button onClick={() => handleMarkAsRead(n.id)} title="Okundu olarak işaretle" className="p-2 text-muted hover:text-success hover:bg-success/10 rounded-full">
                                        <CheckIcon className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => handleDelete(n.id)} title="Bildirimi sil" className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-full">
                                    <DeleteIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-12">
                            <BellIcon className="w-12 h-12 text-gray-300 mx-auto" />
                            <p className="text-muted mt-2">Filtrelerinizle eşleşen bildirim bulunamadı.</p>
                        </div>
                    )}
                </div>
            </Card>

            <style>{`.input-base { background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.5rem; padding: 0.625rem 1rem; focus:outline-none focus:ring-2 focus:ring-accent; }`}</style>
        </div>
    );
};

export default Notifications;