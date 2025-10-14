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
import { getNotifications } from './services/apiService.ts';


const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [viewingStationId, setViewingStationId] = useState<string | null>(null);
  const [viewingCameraId, setViewingCameraId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Backend'den başlangıç bildirimlerini çek
    const fetchNotifications = async () => {
      try {
        const fetchedNotifications = await getNotifications();
        setNotifications(fetchedNotifications);
      } catch (error) {
        console.error("Bildirimler çekilemedi:", error);
        // Burada bir hata bildirimi gösterilebilir
      }
    };

    fetchNotifications();
  }, []);


  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    // TODO: Backend'e de bu bilgiyi gönder
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