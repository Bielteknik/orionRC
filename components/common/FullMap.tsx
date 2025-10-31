import React, { useEffect, useRef, useMemo } from 'react';
import { Station } from '../../types.ts';
import { useTheme } from '../ThemeContext.tsx';

declare const L: any;

interface FullMapProps {
  stations: Station[];
  onViewStationDetails: (stationId: string) => void;
  onStationSelect: (stationId: string) => void;
  selectedStationId: string | null;
  onRefresh: () => void;
}

const statusStyles: Record<string, { color: string; text: string; }> = {
    active: { color: '#22c55e', text: 'Aktif' }, // green-500
    maintenance: { color: '#f59e0b', text: 'Bakımda' }, // amber-500
    inactive: { color: '#ef4444', text: 'Pasif' }, // red-500
};

const FullMap: React.FC<FullMapProps> = ({ stations, onViewStationDetails, onStationSelect, selectedStationId, onRefresh }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersLayerRef = useRef<any>(null);
    const { theme } = useTheme();

    // Map Initialization Effect (runs once or on theme change)
    useEffect(() => {
        let map: any;
        if (mapContainerRef.current) {
            // If map already exists, remove it before re-creating for theme change
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            map = L.map(mapContainerRef.current, {
                scrollWheelZoom: true,
                attributionControl: false,
            }).setView([39.90, 41.26], 6);
            mapRef.current = map;

            // Define layers
            const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            });
            const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	            attribution: 'Tiles &copy; Esri'
            });
            const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            });
            
            const baseMaps = {
                "Sokak": streetLayer,
                "Uydu": satelliteLayer,
                "Karanlık": darkLayer,
            };

            // Set default layer based on theme
            if (theme === 'dark') {
                darkLayer.addTo(map);
            } else {
                streetLayer.addTo(map);
            }

            // Add layer control
            L.control.layers(baseMaps).addTo(map);

             // Add custom refresh control
            const RefreshControl = L.Control.extend({
                onAdd: function() {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    container.style.backgroundColor = 'white';
                    container.style.width = '34px';
                    container.style.height = '34px';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';
                    container.style.cursor = 'pointer';
                    container.title = 'Haritayı Yenile';
                    container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-gray-700"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.696L7.985 5.985m11.664 0l-3.181 3.183m0 0L7.985 5.985" /></svg>`;
                    
                    L.DomEvent.on(container, 'click', (e: MouseEvent) => {
                        L.DomEvent.stopPropagation(e);
                        onRefresh();
                    });
                    return container;
                },
            });
            new RefreshControl({ position: 'topright' }).addTo(map);

            markersLayerRef.current = L.layerGroup().addTo(map);

            const resizeObserver = new ResizeObserver(() => {
                window.requestAnimationFrame(() => {
                     if (mapRef.current) {
                        mapRef.current.invalidateSize();
                    }
                });
            });
            resizeObserver.observe(mapContainerRef.current);
            
            const timeoutId = setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.invalidateSize();
                }
            }, 200);

            return () => {
                resizeObserver.disconnect();
                clearTimeout(timeoutId);
                if (mapRef.current) {
                    mapRef.current.remove();
                    mapRef.current = null;
                }
            };
        }
    }, [theme, onRefresh]);

    // Effect to fit bounds only when the list of stations changes
    const stationIds = useMemo(() => JSON.stringify(stations.map(s => s.id).sort()), [stations]);
    useEffect(() => {
        if (!mapRef.current || !stations) return;

        const validStations = stations.filter(s => s.locationCoords && s.locationCoords.lat && s.locationCoords.lng);
        if (validStations.length > 0) {
            const bounds = L.latLngBounds(validStations.map(s => [s.locationCoords.lat, s.locationCoords.lng]));
            // Add a small delay to ensure map is ready for fitBounds after init
            setTimeout(() => {
                if(mapRef.current) {
                    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                }
            }, 150);
        }
    }, [stationIds]); // Only depends on the list of station IDs

    // Effect to update markers when stations or selection changes
    useEffect(() => {
        if (!mapRef.current || !markersLayerRef.current) return;
        
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

    }, [stations, onViewStationDetails, onStationSelect, selectedStationId]);

    return (
        <>
            <style>{`
                .station-marker { cursor: pointer; }
                .leaflet-popup-content-wrapper { background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.1); }
                .leaflet-popup-tip { background: #FFFFFF; }
                .leaflet-popup-content { margin: 0; width: auto !important; }
                .leaflet-popup-content-wrapper .leaflet-popup-content { padding: 8px; }
                .dark .leaflet-popup-content-wrapper, .dark .leaflet-popup-tip { background: #1f2937; color: #f3f4f6; border: 1px solid #374151; }
                .dark .leaflet-popup-content-wrapper h3 { color: #f9fafb; }
                .leaflet-control-layers-toggle { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="%23374151"><path d="M26 20v-4l-8-4-8 4v4l8 4zM4 15.5l8-4 8 4-8 4-8-4zM26 12l-8-4-8 4 8 4 8-4z"/></svg>') !important; }
                .dark .leaflet-control-layers-toggle { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="%23d1d5db"><path d="M26 20v-4l-8-4-8 4v4l8 4zM4 15.5l8-4 8 4-8 4-8-4zM26 12l-8-4-8 4 8 4 8-4z"/></svg>') !important; }
                .dark .leaflet-control-layers { background: #1f2937; border: 1px solid #374151; }
                .dark .leaflet-bar { background-color: #1f2937; border: 1px solid #374151; }
                .dark .leaflet-bar a, .dark .leaflet-bar a:hover { background-color: #1f2937; color: #d1d5db; }
                .dark .leaflet-control-custom { background-color: #1f2937 !important; }
                .dark .leaflet-control-custom svg { stroke: #d1d5db; }
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
