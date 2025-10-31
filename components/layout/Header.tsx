import React, { useState, useRef, useEffect } from 'react';
import { Page, Notification } from '../../types';
import { useTheme } from '../ThemeContext';
import { BellIcon, SunIcon, MoonIcon, CheckIcon, MenuIcon } from '../icons/Icons';

interface HeaderProps {
  currentPage: Page | string;
  notifications: Notification[];
  onMarkAllNotificationsAsRead: () => void;
  onViewAllNotifications: () => void;
  agentStatus: { status: string; lastUpdate: string | null };
  onToggleMobileSidebar: () => void;
}

const formatTimeAgo = (isoString: string | null): string => {
    if (!isoString) return 'hiçbir zaman';
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 10) return "şimdi";
    if (seconds < 60) return `${seconds} sn önce`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
};

const Header: React.FC<HeaderProps> = ({ currentPage, notifications, onMarkAllNotificationsAsRead, onViewAllNotifications, agentStatus, onToggleMobileSidebar }) => {
    const { theme, toggleTheme } = useTheme();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isOnline = agentStatus.status === 'online';
    
    return (
        <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-primary dark:bg-dark-primary border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
                <button onClick={onToggleMobileSidebar} className="lg:hidden p-2 text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{currentPage}</h1>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="flex items-center space-x-2" title={`Son sinyal: ${formatTimeAgo(agentStatus.lastUpdate)}`}>
                    <div className={`relative w-3 h-3 rounded-sm ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
                        {isOnline && <div className="absolute inset-0 w-full h-full bg-green-500 rounded-sm animate-ping"></div>}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">
                        Agent: {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </span>
                </div>

                <button onClick={toggleTheme} className="p-2 text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" aria-label="Toggle theme">
                    {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                </button>

                <div className="relative" ref={notificationRef}>
                    <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2 text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full relative" aria-label="Notifications">
                        <BellIcon className="w-6 h-6" />
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-danger ring-2 ring-primary dark:ring-dark-primary"></span>
                        )}
                    </button>
                    {isNotificationsOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-primary dark:bg-dark-primary border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20">
                            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Bildirimler</h4>
                                {unreadCount > 0 && <span className="text-xs bg-accent text-white font-semibold rounded-full px-2 py-0.5">{unreadCount} yeni</span>}
                            </div>
                            <ul className="max-h-80 overflow-y-auto">
                                {notifications.length > 0 ? (
                                    notifications.slice(0, 5).map(notification => (
                                        <li key={notification.id} className={`p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 ${!notification.isRead ? 'font-semibold' : ''}`}>
                                            <p className="text-sm text-gray-800 dark:text-gray-200">{notification.message}</p>
                                            <p className="text-xs text-muted dark:text-gray-400 mt-1">{notification.stationName}</p>
                                        </li>
                                    ))
                                ) : (
                                    <li className="p-4 text-center text-sm text-muted dark:text-gray-400">Yeni bildirim yok.</li>
                                )}
                            </ul>
                            <div className="p-2 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center text-sm">
                                <button onClick={onMarkAllNotificationsAsRead} className="flex items-center gap-1 font-semibold text-accent hover:underline disabled:text-muted disabled:cursor-not-allowed" disabled={unreadCount === 0}>
                                    <CheckIcon className="w-4 h-4" />
                                    Tümünü Oku
                                </button>
                                <button onClick={onViewAllNotifications} className="font-semibold text-accent hover:underline">
                                    Tümünü Gör
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;