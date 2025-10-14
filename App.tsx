import React, { useState, useEffect } from 'react';
import { Page, Notification } from './types.ts';
import Sidebar from './components/layout/Sidebar.tsx';
import Header from './components/layout/Header.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Stations from './pages/Stations.tsx';
import Sensors from './pages/Sensors.tsx';
import Cameras from './pages/Cameras.tsx';
import Definitions from './pages/Definitions.tsx';
import Reports from './pages/Reports.tsx';
import StationDetail from './pages/StationDetail.tsx';
import CameraDetail from './pages/CameraDetail.tsx';
import { ThemeProvider } from './components/ThemeContext.tsx';
import Notifications from './pages/Notifications.tsx';
import GeminiAssistant from './components/GeminiAssistant.tsx';

const MOCK_NOTIFICATIONS_INITIAL: Notification[] = [
    {
        id: 'N1',
        ruleId: 'RULE002',
        message: 'İstasyon 2 batarya seviyesi kritik!',
        stationName: 'İstasyon 2 - Kayak Merkezi',
        sensorName: 'Nem Sensörü 1',
        triggeredValue: '5%',
        timestamp: '2 saat önce',
        severity: 'Uyarı',
        isRead: true,
    }
];


const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [viewingStationId, setViewingStationId] = useState<string | null>(null);
  const [viewingCameraId, setViewingCameraId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS_INITIAL);

  // Simulate new notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const newNotification: Notification = {
        id: `N${Date.now()}`,
        ruleId: 'RULE001',
        message: 'Sıcaklık eşik değeri aşıldı!',
        stationName: 'İstasyon 1 - Merkez',
        sensorName: 'Sıcaklık Sensörü 1',
        triggeredValue: `${(35 + Math.random() * 5).toFixed(1)}°C`,
        timestamp: new Date().toLocaleTimeString('tr-TR'),
        severity: 'Kritik',
        isRead: false,
      };
      setNotifications(prev => [newNotification, ...prev].slice(0, 20)); // Keep max 20 notifications
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, []);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleViewAllNotifications = () => {
    setCurrentPage(Page.Notifications);
  };

  const handleSetCurrentPage = (page: Page) => {
    setCurrentPage(page);
    setViewingStationId(null); 
    setViewingCameraId(null);
  };

  const handleViewStationDetails = (stationId: string) => {
    setCurrentPage(Page.Stations);
    setViewingStationId(stationId);
  };

  const renderPage = () => {
    if (viewingCameraId) {
      return <CameraDetail cameraId={viewingCameraId} onBack={() => setViewingCameraId(null)} />;
    }
    if (currentPage === Page.Stations && viewingStationId) {
      return <StationDetail stationId={viewingStationId} onBack={() => setViewingStationId(null)} onViewCamera={setViewingCameraId} />;
    }
    switch (currentPage) {
      case Page.Dashboard:
        return <Dashboard onViewStationDetails={handleViewStationDetails} />;
      case Page.Stations:
        return <Stations onViewDetails={setViewingStationId} />;
      case Page.Sensors:
        return <Sensors />;
      case Page.Cameras:
        return <Cameras onViewDetails={setViewingCameraId} />;
      case Page.Definitions:
        return <Definitions />;
      case Page.Reports:
        return <Reports />;
      case Page.Notifications:
        return <Notifications notifications={notifications} setNotifications={setNotifications} />;
      default:
        return <Dashboard onViewStationDetails={handleViewStationDetails} />;
    }
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen font-sans">
        <Sidebar currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
              currentPage={currentPage}
              notifications={notifications}
              onMarkAllNotificationsAsRead={handleMarkAllAsRead}
              onViewAllNotifications={handleViewAllNotifications}
          />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
            {renderPage()}
          </main>
        </div>
        <GeminiAssistant />
      </div>
    </ThemeProvider>
  );
};

export default App;