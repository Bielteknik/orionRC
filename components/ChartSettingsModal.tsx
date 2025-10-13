import React, { useState, useEffect } from 'react';
import { PaletteIcon } from './icons/Icons';

const lineTypes = ['monotone', 'linear', 'step'] as const;
type LineType = typeof lineTypes[number];

export interface ChartStyle {
    stroke: string;
    type: LineType;
}

interface ChartSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sensorTypes: string[];
    initialStyles: Record<string, ChartStyle>;
    onSave: (newStyles: Record<string, ChartStyle>) => void;
}

const ChartSettingsModal: React.FC<ChartSettingsModalProps> = ({ isOpen, onClose, sensorTypes, initialStyles, onSave }) => {
    const [styles, setStyles] = useState(initialStyles);

    useEffect(() => {
        setStyles(initialStyles);
    }, [initialStyles, isOpen]);

    if (!isOpen) return null;

    const handleColorChange = (sensorType: string, color: string) => {
        setStyles(prev => ({
            ...prev,
            [sensorType]: { ...prev[sensorType], stroke: color }
        }));
    };

    const handleTypeChange = (sensorType: string, type: LineType) => {
        setStyles(prev => ({
            ...prev,
            [sensorType]: { ...prev[sensorType], type }
        }));
    };
    
    const handleSave = () => {
        onSave(styles);
    };

    return (
         <div 
            className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className="fixed inset-0 flex items-center justify-center p-4">
                 <div className="relative bg-primary w-full max-w-lg rounded-xl shadow-xl transform transition-all flex flex-col">
                    <header className="flex items-center justify-between p-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <PaletteIcon className="w-6 h-6 text-accent"/>
                            <h2 id="modal-title" className="text-xl font-bold text-gray-900">Grafik Görünüm Ayarları</h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </header>

                    <main className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {sensorTypes.length > 0 ? sensorTypes.map(type => (
                            <div key={type} className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-gray-200">
                                <span className="font-semibold text-gray-800">{type}</span>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <input
                                            type="color"
                                            value={styles[type]?.stroke || '#000000'}
                                            onChange={(e) => handleColorChange(type, e.target.value)}
                                            className="w-8 h-8 p-0 border-none rounded-md cursor-pointer appearance-none bg-transparent"
                                            style={{backgroundColor: 'transparent'}}
                                            title="Renk Seç"
                                        />
                                        <div 
                                            className="absolute inset-0 rounded-md border border-gray-300 pointer-events-none"
                                            style={{backgroundColor: styles[type]?.stroke || '#000000'}}
                                        ></div>
                                    </div>
                                    <select
                                        value={styles[type]?.type || 'monotone'}
                                        onChange={(e) => handleTypeChange(type, e.target.value as LineType)}
                                        className="bg-primary border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                                    >
                                        {lineTypes.map(lineType => (
                                            <option key={lineType} value={lineType} className="capitalize">{lineType}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )) : (
                            <p className="text-muted text-center py-4">Ayarları değiştirmek için en az bir sensör tipi seçin.</p>
                        )}
                    </main>

                    <footer className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-primary border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 font-semibold"
                        >
                            İptal
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-orange-600 font-semibold"
                        >
                            Değişiklikleri Kaydet
                        </button>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default ChartSettingsModal;
