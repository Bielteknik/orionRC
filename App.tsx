import React, { useState, useEffect, useCallback } from 'react';
import { Page, Notification } from './types.ts';
import Sidebar from './components/layout/Sidebar.tsx';
import Header from './components/layout/Header.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Stations from './pages/Stations.tsx';
import Sensors from './pages/Sensors.tsx';
import Cameras from './pages/Cameras.tsx';
import Definitions from './pages/Definitions.tsx';
import Reports from './pages/Reports.tsx';
import Analysis from './pages/Analysis.tsx';
import StationDetail from './pages/StationDetail.tsx';
import CameraDetail from './pages/CameraDetail.tsx';
import { ThemeProvider } from './components/ThemeContext.tsx';
import Notifications from './pages/Notifications.tsx';
import GeminiAssistant from './components/GeminiAssistant.tsx';
import { getNotifications, markAllNotificationsAsRead, getAgentStatus } from './services/apiService.ts';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [viewingStationId, setViewingStationId] = useState<string | null>(null);
  const [viewingCameraId, setViewingCameraId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [agentStatus, setAgentStatus] = useState<{ status: string; lastUpdate: string | null }>({ status: 'offline', lastUpdate: null });


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
        // Keep the old status on error to prevent flickering
    }
  }, []);


  useEffect(() => {
    fetchNotifications();
    fetchAgentStatus();
    const notificationInterval = setInterval(fetchNotifications, 20000); 
    const agentStatusInterval = setInterval(fetchAgentStatus, 15000);
    return () => {
      clearInterval(notificationInterval);
      clearInterval(agentStatusInterval);
    }
  }, [fetchNotifications, fetchAgentStatus]);

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
       case Page.Analysis:
        return <Analysis />;
      case Page.Notifications:
        return <Notifications notifications={notifications} setNotifications={setNotifications} onRefresh={fetchNotifications} />;
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
              agentStatus={agentStatus}
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