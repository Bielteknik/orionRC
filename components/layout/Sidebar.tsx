import React from 'react';
import { Page } from '../../types';
import { 
    DashboardIcon, 
    StationIcon, 
    SensorIcon, 
    CameraIcon, 
    DefinitionsIcon, 
    ReportsIcon, 
    CloudIcon,
    BrainIcon,
    XIcon
} from '../icons/Icons';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isMobileOpen: boolean;
  onClose: () => void;
}

interface NavItemProps {
  page: Page;
  icon: React.ReactNode;
  currentPage: Page;
  onClick: (page: Page) => void;
}

const NavItem: React.FC<NavItemProps> = ({ page, icon, currentPage, onClick }) => (
    <li>
        <button
            onClick={() => onClick(page)}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                currentPage === page
                ? 'bg-accent text-white shadow-md'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
        >
            {icon}
            <span>{page}</span>
        </button>
    </li>
);

const SidebarContent: React.FC<Omit<SidebarProps, 'isMobileOpen' | 'onClose'>> = ({ currentPage, setCurrentPage }) => {
    const navItems = [
        { page: Page.Dashboard, icon: <DashboardIcon className="w-5 h-5" /> },
        { page: Page.Analysis, icon: <BrainIcon className="w-5 h-5" /> },
        { page: Page.Stations, icon: <StationIcon className="w-5 h-5" /> },
        { page: Page.Sensors, icon: <SensorIcon className="w-5 h-5" /> },
        { page: Page.Cameras, icon: <CameraIcon className="w-5 h-5" /> },
        { page: Page.Reports, icon: <ReportsIcon className="w-5 h-5" /> },
        { page: Page.Definitions, icon: <DefinitionsIcon className="w-5 h-5" /> },
    ];
    
    return (
        <>
            <nav className="flex-1 p-4">
                <ul className="space-y-2">
                    {navItems.map(item => (
                        <NavItem
                            key={item.page}
                            page={item.page}
                            icon={item.icon}
                            currentPage={currentPage}
                            onClick={setCurrentPage}
                        />
                    ))}
                </ul>
            </nav>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-center text-muted dark:text-gray-500">
                    &copy; {new Date().getFullYear()} ORION Gözlem Platformu
                </p>
            </div>
        </>
    );
};


const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isMobileOpen, onClose }) => {
    return (
        <>
            {/* Mobile Sidebar */}
            <div className={`fixed inset-0 z-50 lg:hidden ${!isMobileOpen && 'pointer-events-none'}`}>
                {/* Overlay */}
                <div 
                    className={`absolute inset-0 bg-black/60 transition-opacity ${isMobileOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={onClose} 
                />
                {/* Drawer */}
                <aside 
                    className={`relative z-10 w-64 h-full bg-primary dark:bg-dark-primary flex flex-col transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                     <div className="flex items-center justify-between h-16 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 px-4">
                        <div className="flex items-center space-x-2">
                            <CloudIcon className="w-8 h-8 text-accent" />
                            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ORION</span>
                        </div>
                        <button onClick={onClose} className="p-1 -mr-2 text-muted dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <SidebarContent currentPage={currentPage} setCurrentPage={setCurrentPage} />
                </aside>
            </div>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 bg-primary dark:bg-dark-primary border-r border-gray-200 dark:border-gray-700 flex-col flex-shrink-0">
                <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center space-x-2">
                        <CloudIcon className="w-8 h-8 text-accent" />
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ORION</span>
                    </div>
                </div>
                <SidebarContent currentPage={currentPage} setCurrentPage={setCurrentPage} />
            </aside>
        </>
    );
};

export default Sidebar;