import React from 'react';
import { WidgetType } from '../types.ts';
import { AddIcon, ChartBarIcon, WindSockIcon, ThermometerIcon, SensorIcon } from './icons/Icons.tsx';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddWidget: (type: WidgetType, config: any) => void;
    sensorTypes: string[];
}

// Helper to get an appropriate icon for a sensor type
const getWidgetIcon = (type: string) => {
    switch(type) {
        case 'Sıcaklık':
        case 'Nem':
        case 'Rüzgar Hızı':
        case 'Basınç':
            return <ThermometerIcon className="w-5 h-5 text-muted"/>;
        default:
            return <SensorIcon className="w-5 h-5 text-muted"/>;
    }
}


const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAddWidget, sensorTypes }) => {
    if (!isOpen) return null;
    
    // Dynamically create lists from available sensor types
    const dataCardTypes = sensorTypes;
    // A line chart for direction is not very useful, so we filter it out.
    const chartTypes = sensorTypes.filter(type => type !== 'Rüzgar Yönü'); 
    const canShowWindRose = sensorTypes.includes('Rüzgar Hızı') && sensorTypes.includes('Rüzgar Yönü');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" onClick={onClose}>
            <div className="bg-primary dark:bg-dark-primary rounded-lg shadow-xl w-full max-w-2xl transform" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Widget Ekle</h2>
                    <button onClick={onClose} className="p-2 text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <main className="p-6 max-h-[70vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Data Cards */}
                    <div>
                        <h3 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Veri Kartları</h3>
                        <div className="space-y-2">
                           {dataCardTypes.length > 0 ? dataCardTypes.map(type => (
                             <button key={`card-${type}`} onClick={() => onAddWidget('dataCard', { sensorType: type })} className="w-full flex items-center justify-between p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-left border dark:border-gray-700">
                                <span className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-300">{getWidgetIcon(type)} {type} Kartı</span>
                                <AddIcon className="w-5 h-5 text-accent"/>
                            </button>
                           )) : <p className="text-sm text-muted">Ekleyecek veri kartı yok.</p>}
                        </div>
                    </div>
                     {/* Charts */}
                    <div>
                        <h3 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Grafikler</h3>
                        <div className="space-y-2">
                            {chartTypes.length > 0 ? chartTypes.map(type => (
                                <button key={`chart-${type}`} onClick={() => onAddWidget('sensorChart', { sensorType: type })} className="w-full flex items-center justify-between p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-left border dark:border-gray-700">
                                    <span className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-300"><ChartBarIcon className="w-5 h-5 text-muted"/> {type} Grafiği</span>
                                    <AddIcon className="w-5 h-5 text-accent"/>
                                </button>
                            )) : <p className="text-sm text-muted">Ekleyecek grafik yok.</p>}
                        </div>
                    </div>
                    {/* Special Charts */}
                     {canShowWindRose && (
                        <div className="md:col-span-2 space-y-2 pt-2">
                            <h3 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Özel Görselleştirmeler</h3>
                            <div className="space-y-2">
                                <button onClick={() => onAddWidget('windRose', {})} className="w-full flex items-center justify-between p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-left border dark:border-gray-700">
                                    <span className="flex items-center gap-3 font-medium text-gray-700 dark:text-gray-300"><WindSockIcon className="w-5 h-5 text-muted"/> Rüzgar Gülü Grafiği</span>
                                    <AddIcon className="w-5 h-5 text-accent"/>
                                </button>
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
};

export default AddWidgetModal;