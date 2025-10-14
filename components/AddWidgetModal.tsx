import React, { useState } from 'react';
import { WidgetType } from '../types.ts';
import { AddIcon, ChartBarIcon, WindSockIcon, TemperatureIcon } from './icons/Icons.tsx';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddWidget: (widget: { type: WidgetType, config: any }) => void;
    sensorTypes: string[];
}

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAddWidget, sensorTypes }) => {
    if (!isOpen) return null;

    const handleAdd = (type: WidgetType, config: any) => {
        onAddWidget({ type, config });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog">
            <div className="bg-primary rounded-lg shadow-xl w-full max-w-2xl">
                <header className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Widget Ekle</h2>
                    <button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <main className="p-6 max-h-[70vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Data Cards */}
                    <div className="p-3 border rounded-lg">
                        <h3 className="font-semibold mb-2">Veri Kartları</h3>
                        <div className="space-y-2">
                           {['Sıcaklık', 'Nem', 'Rüzgar Hızı', 'Basınç'].map(type => (
                             <button key={type} onClick={() => handleAdd('dataCard', { title: type, sensorType: type })} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-100 text-left">
                                <span className="flex items-center gap-2"><TemperatureIcon className="w-5 h-5 text-muted"/> {type} Kartı</span>
                                <AddIcon className="w-5 h-5 text-accent"/>
                            </button>
                           ))}
                        </div>
                    </div>
                     {/* Charts */}
                    <div className="p-3 border rounded-lg">
                        <h3 className="font-semibold mb-2">Grafikler</h3>
                        <div className="space-y-2">
                            {sensorTypes.filter(t => t !== 'Rüzgar Yönü').map(type => (
                                <button key={type} onClick={() => handleAdd('sensorChart', { sensorType: type })} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-100 text-left">
                                    <span className="flex items-center gap-2"><ChartBarIcon className="w-5 h-5 text-muted"/> {type} Grafiği</span>
                                    <AddIcon className="w-5 h-5 text-accent"/>
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Special Charts */}
                    <div className="p-3 border rounded-lg md:col-span-2">
                        <h3 className="font-semibold mb-2">Özel Görselleştirmeler</h3>
                        <div className="space-y-2">
                             <button onClick={() => handleAdd('windRose', {})} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-100 text-left">
                                <span className="flex items-center gap-2"><WindSockIcon className="w-5 h-5 text-muted"/> Rüzgar Gülü Grafiği</span>
                                <AddIcon className="w-5 h-5 text-accent"/>
                            </button>
                        </div>
                    </div>

                </main>
            </div>
        </div>
    );
};

export default AddWidgetModal;