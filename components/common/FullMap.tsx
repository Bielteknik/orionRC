import React, { useEffect, useRef } from 'react';
import { Station } from '../../types.ts';

declare const L: any;

interface FullMapProps {
  stations: Station[];
  onViewStationDetails: (stationId: string) => void;
  onStationSelect: (stationId: string) => void;
  selectedStationId: string | null;
}

const statusStyles: Record<string, { color: string; text: string; }> = {
    active: { color: '#22c55e', text: 'Aktif' }, // green-500
    maintenance: { color: '#f59e0b', text: 'Bakımda' }, // amber-500
    inactive: { color: '#ef4444', text: 'Pasif' }, // red-500
};

const FullMap: React.FC<FullMapProps> = ({ stations, onViewStationDetails, onStationSelect, selectedStationId }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersLayerRef = useRef<any>(null);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, { 
                scrollWheelZoom: true,
                attributionControl: false 
            }).setView([39.90, 41.26], 6);
            mapRef.current = map;

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            }).addTo(map);

            markersLayerRef.current = L.layerGroup().addTo(map);

            const resizeObserver = new ResizeObserver(() => {
                setTimeout(() => map.invalidateSize(), 100);
            });
            resizeObserver.observe(mapContainerRef.current);

            return () => {
                resizeObserver.disconnect();
                map.remove();
                mapRef.current = null;
            };
        }
    }, []);

    useEffect(() => {
        if (!mapRef.current || !markersLayerRef.current) return;
        
        // Force map to re-evaluate its size
        setTimeout(() => mapRef.current.invalidateSize(), 100);

        const markersLayer = markersLayerRef.current;
        markersLayer.clearLayers();
        
        if (stations.length === 0) return;

        stations.forEach(station => {
            if (!station.locationCoords) return;

            const status = statusStyles[station.status] || statusStyles.inactive;
            const isSelected = station.id === selectedStationId;

            const iconHtml = `
                <div class="relative flex items-center justify-center">
                    <div 
                        class="absolute w-7 h-7 rounded-full border-2 border-white shadow-lg transition-all duration-300"
                        style="background-color: ${status.color}; transform: scale(${isSelected ? 1.5 : 1}); z-index: ${isSelected ? 10 : 1};"
                    ></div>
                    ${isSelected ? `<div class="absolute w-10 h-10 rounded-full" style="background-color: ${status.color}; opacity: 0.4; animation: pulse 1.5s infinite cubic-bezier(0.66, 0, 0, 1);"></div>` : ''}
                </div>
            `;

            const customIcon = L.divIcon({ 
                className: 'station-marker', 
                html: iconHtml, 
                iconSize: [40, 40], 
                iconAnchor: [20, 20] 
            });

            const marker = L.marker([station.locationCoords.lat, station.locationCoords.lng], { icon: customIcon, zIndexOffset: isSelected ? 1000 : 0 });
            
            marker.on('click', () => {
                onStationSelect(station.id);
            });

            const popupContent = `
                <div class="p-1 font-sans">
                    <h3 class="font-bold text-base text-gray-900 mb-2">${station.name}</h3>
                    <button id="view-details-btn-${station.id}" class="w-full text-center bg-accent text-white font-semibold text-xs py-1.5 px-2 rounded-md hover:bg-orange-600 transition-colors">Detayları Görüntüle</button>
                </div>
            `;

            marker.bindPopup(popupContent, { minWidth: 150, closeButton: false });

            marker.on('popupopen', () => {
                const btn = document.getElementById(`view-details-btn-${station.id}`);
                if (btn) {
                    btn.onclick = () => onViewStationDetails(station.id);
                }
            });

            markersLayer.addLayer(marker);
        });

        if (mapRef.current) {
            const validStations = stations.filter(s => s.locationCoords);
            if (validStations.length > 0) {
                const bounds = L.latLngBounds(validStations.map(s => [s.locationCoords.lat, s.locationCoords.lng]));
                mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            }
        }

    }, [stations, onViewStationDetails, onStationSelect, selectedStationId]);

    return (
        <>
            <style>{`
                .station-marker { cursor: pointer; }
                .leaflet-popup-content-wrapper { background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.1); }
                .leaflet-popup-tip { background: #FFFFFF; }
                .leaflet-popup-content { margin: 0; width: auto !important; }
                .leaflet-popup-content-wrapper .leaflet-popup-content { padding: 8px; }
                @keyframes pulse {
                    0% { transform: scale(0.7); opacity: 0.4; }
                    50% { transform: scale(1.2); opacity: 0.1; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
            `}</style>
            <div ref={mapContainerRef} className="w-full h-full" />
        </>
    );
};

export default FullMap;