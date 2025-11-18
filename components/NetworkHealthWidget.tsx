import React, { useEffect, useState } from 'react';
import Card from './common/Card.tsx';
import { getNetworkStats } from '../services/apiService.ts';
import { NetworkStats } from '../types.ts';
import { CheckCircleIcon, ExclamationCircleIcon, RefreshIcon } from './icons/Icons.tsx';
import Skeleton from './common/Skeleton.tsx';
import { formatTimeAgo } from '../utils/helpers.ts';

// Fallback Server Icon since it might be missing in Icons.tsx
const ServerIconFallback = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
    </svg>
);

const NetworkHealthWidget: React.FC = () => {
    const [stats, setStats] = useState<NetworkStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await getNetworkStats();
            setStats(data);
            setError(null);
        } catch (err) {
            setError('Ağ verileri alınamadı.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading && !stats) return <Card><Skeleton className="h-32 w-full" /></Card>;
    if (error) return <Card><div className="text-danger text-center p-4">{error}</div></Card>;
    if (!stats) return null;

    const healthColor = stats.activePercentage > 80 ? 'text-success' : stats.activePercentage > 50 ? 'text-warning' : 'text-danger';
    const HealthIcon = stats.activePercentage > 80 ? CheckCircleIcon : ExclamationCircleIcon;

    return (
        <Card className="flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <ServerIconFallback className="w-5 h-5 text-muted" />
                    Sistem ve Ağ Sağlığı
                </h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 ${healthColor}`}>
                    % {stats.activePercentage} Aktif
                </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-2">
                {/* Active Stations Circle */}
                <div className="flex flex-col items-center justify-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path
                                className="text-gray-200 dark:text-gray-700"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                            <path
                                className={stats.activePercentage > 80 ? 'text-success' : stats.activePercentage > 50 ? 'text-warning' : 'text-danger'}
                                strokeDasharray={`${stats.activePercentage}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                        </svg>
                        <span className="absolute text-sm font-bold text-gray-700 dark:text-gray-200">{stats.activeStations}/{stats.totalStations}</span>
                    </div>
                    <span className="text-xs text-muted mt-1">İstasyonlar</span>
                </div>

                {/* Data Flow Rate */}
                <div className="flex flex-col justify-between p-2 space-y-2">
                     <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-100 dark:border-blue-800">
                        <p className="text-xs text-muted">Veri Akışı (RPM)</p>
                        <div className="flex items-end gap-1">
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.rpm}</span>
                            <span className="text-[10px] text-blue-400 mb-1">paket/dk</span>
                        </div>
                     </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-100 dark:border-green-800">
                        <p className="text-xs text-muted">Sistem Yükü</p>
                         <span className="text-sm font-bold text-green-600 dark:text-green-400">{stats.systemLoad}</span>
                     </div>
                </div>
            </div>

            <div className="text-[10px] text-muted text-center border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between items-center">
               <span>Son Veri: {formatTimeAgo(stats.lastPacketTime)}</span>
               <button onClick={fetchStats} className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"><RefreshIcon className="w-3 h-3"/></button>
            </div>
        </Card>
    );
};

export default NetworkHealthWidget;