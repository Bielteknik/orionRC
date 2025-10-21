import React, { useState, useEffect, useCallback } from 'react';
import { Page, Notification, Station, Sensor } from './types.ts';
// Fix: Corrected import paths, removing unnecessary extensions.
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
import { getNotifications, markAllNotificationsAsRead, getAgentStatus, getStations, getSensors } from './services/apiService.ts';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [viewingStationId, setViewingStationId] = useState<string | null>(null);
  const [viewingCameraId, setViewingCameraId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [agentStatus, setAgentStatus] = useState<{ status: string; lastUpdate: string | null }>({ status: 'offline', lastUpdate: null });
  const [stations, setStations] = useState<Station[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);


  const fetchNotifications = useCallback(async () => {
    try {
        const freshNotifications = await getNotifications();
        setNotifications(freshNotifications);
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
    }
  }, []);

  const fetchAgentStatus = useCallback(async () => {
    try {
        const status = await getAgentStatus();
        setAgentStatus(status);
    } catch (error) {
        console.error("Failed to fetch agent status:", error);
    }
  }, []);

  const fetchMainData = useCallback(async () => {
    try {
      const [stationsData, sensorsData] = await Promise.all([getStations(), getSensors()]);
      setStations(stationsData);
      setSensors(sensorsData);
    } catch (error) {
      console.error("Failed to fetch main data (stations, sensors):", error);
    }
  }, []);


  useEffect(() => {
    fetchNotifications();
    fetchAgentStatus();
    fetchMainData();
    const notificationInterval = setInterval(fetchNotifications, 20000); 
    const agentStatusInterval = setInterval(fetchAgentStatus, 15000);
    const mainDataInterval = setInterval(fetchMainData, 30000);
    return () => {
      clearInterval(notificationInterval);
      clearInterval(agentStatusInterval);
      clearInterval(mainDataInterval);
    }
  }, [fetchNotifications, fetchAgentStatus, fetchMainData]);

  const handleMarkAllAsRead = async () => {
    try {
        await markAllNotificationsAsRead();
        fetchNotifications(); // Refresh notifications after marking
    } catch (error) {
        console.error("Failed to mark all notifications as read:", error);
    }
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
        return <Dashboard onViewStationDetails={handleViewStationDetails} stations={stations} sensors={sensors} />;
      case Page.Analysis:
        return <Analysis stations={stations} sensors={sensors} />;
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
        return <Notifications notifications={notifications} setNotifications={setNotifications} onRefresh={fetchNotifications} />;
      default:
        return <Dashboard onViewStationDetails={handleViewStationDetails} stations={stations} sensors={sensors} />;
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
              agentStatus={agentStatus}
          />
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
            {renderPage()}
          </main>
        </div>
        <GeminiAssistant />
      </div>
    </ThemeProvider>
  );
};

export default App;