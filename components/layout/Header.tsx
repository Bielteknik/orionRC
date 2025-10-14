import React, { useState, useEffect, useRef } from 'react';
import { Page, Notification, Severity } from '../../types.ts';
import { BellIcon, ExclamationIcon } from '../icons/Icons.tsx';


interface NotificationPopoverProps {
  notifications: Notification[];
  onMarkAllAsRead: () => void;
  onViewAll: () => void;
  onClose: () => void;
}

const severityStyles: Record<Severity, { iconClass: string, bgClass: string }> = {
    'Kritik': { iconClass: 'text-danger', bgClass: 'bg-danger/10' },
    'Uyarı': { iconClass: 'text-warning', bgClass: 'bg-warning/10' },
    'Bilgi': { iconClass: 'text-blue-500', bgClass: 'bg-blue-500/10' },
};

const NotificationPopover: React.FC<NotificationPopoverProps> = ({ notifications, onMarkAllAsRead, onViewAll, onClose }) => {
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="absolute top-16 right-0 w-80 md:w-96 bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
            <header className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Bildirimler ({unreadCount})</h3>
                <button onClick={onMarkAllAsRead} className="text-sm font-medium text-accent hover:underline" disabled={unreadCount === 0}>
                    Tümünü okundu işaretle
                </button>
            </header>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                    notifications.map(notification => (
                        <div key={notification.id} className={`flex items-start gap-3 p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-secondary dark:hover:bg-gray-700 ${!notification.isRead ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                            <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${severityStyles[notification.severity].bgClass}`}>
                                <ExclamationIcon className={`w-5 h-5 ${severityStyles[notification.severity].iconClass}`} />
                            </div>
                            <div className="flex-1">
                                <p className={`text-sm text-gray-800 dark:text-gray-200 ${!notification.isRead ? 'font-bold' : ''}`}>{notification.message}</p>
                                <p className="text-xs text-muted dark:text-gray-400 mt-0.5">
                                    {notification.stationName} - {notification.sensorName} ({notification.triggeredValue})
                                </p>
                                <p className="text-xs text-muted dark:text-gray-400 mt-1">{notification.timestamp}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-10 text-center">
                        <p className="text-muted dark:text-gray-400">Okunmamış bildiriminiz yok.</p>
                    </div>
                )}
            </div>
            <footer className="p-2 bg-gray-50 dark:bg-gray-700/50 text-center border-t border-gray-200 dark:border-gray-700">
                <button onClick={onViewAll} className="text-sm font-semibold text-accent hover:underline w-full">Tüm Bildirimleri Görüntüle</button>
            </footer>
        </div>
    );
};


interface HeaderProps {
  currentPage: Page;
  notifications: Notification[];
  onMarkAllNotificationsAsRead: () => void;
  onViewAllNotifications: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentPage, notifications, onMarkAllNotificationsAsRead, onViewAllNotifications }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const pageTitles: { [key in Page]: string } = {
    [Page.Dashboard]: 'Ana Sayfa',
    [Page.Stations]: 'İstasyon Yönetimi',
    [Page.Sensors]: 'Sensör Yönetimi',
    [Page.Cameras]: 'Kamera İzleme',
    [Page.Definitions]: 'Sistem Tanımları',
    [Page.Reports]: 'Raporlar',
    [Page.Notifications]: 'Bildirimler',
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewAll = () => {
    setIsNotificationsOpen(false);
    onViewAllNotifications();
  }

  return (
    <header className="flex-shrink-0 bg-primary dark:bg-gray-800 h-20 flex items-center justify-between px-8 border-b border-gray-200 dark:border-gray-700">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{pageTitles[currentPage]}</h1>
      <div className="flex items-center space-x-4">
         <div className="flex items-center space-x-2">
           <div className="relative">
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
              </span>
           </div>
           <span className="text-sm font-medium text-success">Sistem Durumu: Normal</span>
         </div>

         <div className="relative" ref={notificationsRef}>
            <button
                onClick={() => setIsNotificationsOpen(prev => !prev)}
                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                aria-label="Bildirimleri Görüntüle"
            >
                <BellIcon className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white text-xs font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            {isNotificationsOpen && (
                <NotificationPopover
                    notifications={notifications}
                    onMarkAllAsRead={() => {
                        onMarkAllNotificationsAsRead();
                    }}
                    onViewAll={handleViewAll}
                    onClose={() => setIsNotificationsOpen(false)}
                />
            )}
         </div>
      </div>
    </header>
  );
};

export default Header;