import React, { useState, useEffect, useCallback } from 'react';
import { Page, Notification, Station, Sensor, Camera } from './types';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Stations from './pages/Stations';
import Sensors from './pages/Sensors';
import Cameras from './pages/Cameras';
import Definitions from './pages/Definitions';
import Reports from './pages/Reports';
import StationDetail from './pages/StationDetail';
import CameraDetail from './pages/CameraDetail';
import { ThemeProvider } from './components/ThemeContext';
import Notifications from './pages/Notifications';
import GeminiAssistant from './components/GeminiAssistant';
import { getNotifications, markAllNotificationsAsRead, getAgentStatus, getStations, getSensors, getCameras } from './services/apiService';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [viewingStationId, setViewingStationId] = useState<string | null>(null);
  const [viewingCameraId, setViewingCameraId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [agentStatus, setAgentStatus] = useState<{ status: string; lastUpdate: string | null }>({ status: 'offline', lastUpdate: null });
  const [stations, setStations] = useState<Station[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const refreshAllData = useCallback(async () => {
    try {
      const [notificationsData, agentStatusData, stationsData, sensorsData, camerasData] = await Promise.all([
        getNotifications(),
        getAgentStatus(),
        getStations(),
        getSensors(),
        getCameras()
      ]);
      setNotifications(notificationsData);
      setAgentStatus(agentStatusData);
      setStations(stationsData);
      setSensors(sensorsData);
      setCameras(camerasData);
    } catch (error) {
      console.error("Veri yenileme sırasında hata oluştu:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
    const intervalId = setInterval(refreshAllData, 20000); // Poll every 20 seconds
    return () => clearInterval(intervalId);
  }, [refreshAllData]);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      refreshAllData();
    } catch (error) {
      console.error("Tümünü okundu olarak işaretleme başarısız:", error);
    }
  };

  const handleSetCurrentPage = (page: Page) => {
    setCurrentPage(page);
    setViewingStationId(null); 
    setViewingCameraId(null);
    setIsMobileSidebarOpen(false); // Close mobile sidebar on navigation
  };

  const handleViewStationDetails = (stationId: string) => {
    setCurrentPage(Page.Stations); // Switch to stations page context
    setViewingStationId(stationId);
  };
  
  const handleViewCamera = (cameraId: string) => {
    // Can be called from anywhere, e.g., StationDetail
    setViewingCameraId(cameraId);
  }

  const renderPage = () => {
    if (viewingCameraId) {
      return <CameraDetail cameraId={viewingCameraId} onBack={() => setViewingCameraId(null)} />;
    }
    if (currentPage === Page.Stations && viewingStationId) {
      return <StationDetail stationId={viewingStationId} onBack={() => setViewingStationId(null)} onViewCamera={handleViewCamera} />;
    }
    switch (currentPage) {
      case Page.Dashboard:
        return <Dashboard onViewStationDetails={handleViewStationDetails} stations={stations} sensors={sensors} onRefresh={refreshAllData} />;
      case Page.Analysis:
        return <Analysis stations={stations} sensors={sensors} cameras={cameras} />;
      case Page.Stations:
        return <Stations stations={stations} onViewDetails={handleViewStationDetails} onDataChange={refreshAllData} />;
      case Page.Sensors:
        return <Sensors />;
      case Page.Cameras:
        return <Cameras onViewDetails={handleViewCamera} />;
      case Page.Definitions:
        return <Definitions />;
      case Page.Reports:
        return <Reports />;
      case Page.Notifications:
        return <Notifications notifications={notifications} setNotifications={setNotifications} onRefresh={refreshAllData} />;
      default:
        return <Dashboard onViewStationDetails={handleViewStationDetails} stations={stations} sensors={sensors} onRefresh={refreshAllData} />;
    }
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-secondary dark:bg-dark-secondary font-sans">
        <Sidebar 
          currentPage={currentPage} 
          setCurrentPage={handleSetCurrentPage}
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
              currentPage={viewingStationId ? 'İstasyon Detayı' : viewingCameraId ? 'Kamera Detayı' : currentPage}
              notifications={notifications}
              onMarkAllNotificationsAsRead={handleMarkAllAsRead}
              onViewAllNotifications={() => handleSetCurrentPage(Page.Notifications)}
              agentStatus={agentStatus}
              onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
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