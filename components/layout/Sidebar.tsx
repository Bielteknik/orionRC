import React from 'react';
import { Page } from '../../types.ts';
import { DashboardIcon, StationIcon, SensorIcon, CameraIcon, DefinitionsIcon, ReportsIcon, CloudIcon } from '../icons/Icons.tsx';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage }) => {
  const menuItems = [
    { page: Page.Dashboard, label: 'Ana Sayfa', icon: <DashboardIcon /> },
    { page: Page.Stations, label: 'İstasyon', icon: <StationIcon /> },
    { page: Page.Sensors, label: 'Sensör', icon: <SensorIcon /> },
    { page: Page.Cameras, label: 'Kamera', icon: <CameraIcon /> },
    { page: Page.Definitions, label: 'Tanımlar', icon: <DefinitionsIcon /> },
    { page: Page.Reports, label: 'Raporlar', icon: <ReportsIcon /> },
  ];

  return (
    <div className="w-64 bg-primary dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
        <CloudIcon className="h-8 w-8 text-accent" />
        <h1 className="text-xl font-bold ml-2 text-gray-900 dark:text-gray-100">ORION</h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.page}
            onClick={() => setCurrentPage(item.page)}
            className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 ${
              currentPage === item.page
                ? 'bg-accent text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-accent'
            }`}
          >
            <span className="h-5 w-5 mr-3">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-muted dark:text-gray-400 text-center">© 2024 ORION Platformu</p>
      </div>
    </div>
  );
};

export default Sidebar;