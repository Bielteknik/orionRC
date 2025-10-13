import React, { useEffect, useRef } from 'react';
import { Station } from '../../types';

declare const L: any;

interface FullMapProps {
  stations: Station[];
  onViewStationDetails: (stationId: string) => void;
}

const statusStyles: Record<string, { color: string; text: string; }> = {
    active: { color: 'success', text: 'Aktif' },
    maintenance: { color: 'warning', text: 'Bakımda' },
    inactive: { color: 'muted', text: 'Pasif' },
};

// Tailwind's JIT compiler needs to see the full class names to include them in the CSS bundle.
// Since we are creating them dynamically, we list them here to prevent them from being purged.
// bg-success bg-warning bg-muted text-success text-warning text-muted
const FullMap: React.FC<FullMapProps> = ({ stations, onViewStationDetails }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, { 
                scrollWheelZoom: true,
                attributionControl: false 
            }).setView([39.90, 41.26], 11);
            mapRef.current = map;

            const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            });

            const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri'
            });

            satelliteLayer.addTo(map);

            const baseMaps = {
                "Sokak": streetLayer,
                "Uydu": satelliteLayer
            };
            L.control.layers(baseMaps).addTo(map);


            stations.forEach(station => {
                const status = statusStyles[station.status] || statusStyles.inactive;
                
                let iconHtml = '';
                switch (station.status) {
                    case 'active':
                        iconHtml = `
                            <div class="relative flex items-center justify-center">
                                <div class="absolute w-8 h-8 bg-success rounded-full opacity-75 animate-ping"></div>
                                <div class="relative w-4 h-4 bg-success rounded-full border-2 border-white shadow-lg"></div>
                            </div>
                        `;
                        break;
                    case 'maintenance':
                        iconHtml = `
                            <div class="relative flex items-center justify-center w-8 h-8 bg-warning rounded-full border-2 border-white shadow-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                        `;
                        break;
                    case 'inactive':
                    default:
                        iconHtml = `
                            <div class="flex items-center justify-center w-8 h-8">
                                 <div class="w-4 h-4 bg-muted rounded-full border-2 border-white shadow-md opacity-70"></div>
                            </div>
                        `;
                        break;
                }

                const customIcon = L.divIcon({
                    className: '', // No extra class needed
                    html: iconHtml,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                });

                const marker = L.marker([station.locationCoords.lat, station.locationCoords.lng], { icon: customIcon }).addTo(map);

                // Create popup content programmatically
                const container = L.DomUtil.create('div', 'space-y-1.5 p-1 text-sm font-sans');

                const infoHtml = `
                    <h3 class="font-bold text-base text-gray-900">${station.name}</h3>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-muted">Durum:</span>
                        <span class="font-semibold text-${status.color}">${status.text}</span>
                    </div>
                     <div class="flex items-center justify-between text-xs border-t border-gray-200 pt-1.5 mt-1.5">
                        <span class="text-muted">Sensörler:</span>
                        <span class="font-semibold text-gray-700">${station.sensorCount}</span>
                    </div>
                `;
                container.innerHTML = infoHtml;

                const btn = L.DomUtil.create('button', 'w-full mt-2 text-center bg-accent text-white font-semibold text-xs py-1.5 px-2 rounded-md hover:bg-orange-600 transition-colors', container);
                btn.innerText = 'Detayları Görüntüle';

                L.DomEvent.on(btn, 'click', (e: Event) => {
                    L.DomEvent.stopPropagation(e); // Stop event from propagating to map
                    
                    // Defer the navigation to allow Leaflet to finish its click handling
                    // before React unmounts the map component. This prevents the race condition.
                    setTimeout(() => {
                        onViewStationDetails(station.id);
                    }, 0);
                });

                marker.bindPopup(container, {
                    minWidth: 200,
                    closeButton: false,
                });
            });

            setTimeout(() => map.invalidateSize(), 100);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [stations, onViewStationDetails]);

    return (
        <>
            <style>{`
                .leaflet-popup-content-wrapper {
                    background-color: #FFFFFF;
                    border: 1px solid #E5E7EB;
                    border-radius: 8px;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.1);
                    padding: 1px;
                }
                .leaflet-popup-tip {
                    background: #FFFFFF;
                    border-top: 1px solid #E5E7EB;
                }
                .leaflet-popup-content {
                    margin: 0;
                    width: auto !important;
                }
                .leaflet-popup-content-wrapper .leaflet-popup-content {
                    padding: 8px;
                }
                 .leaflet-control-layers {
                    background: #FFFFFF;
                    border: 1px solid #E5E7EB;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .leaflet-control-layers-base label {
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .leaflet-control-layers-selector {
                    margin-top: 2px;
                }
            `}</style>
            <div ref={mapContainerRef} className="w-full h-full rounded-md" />
        </>
    );
};

export default FullMap;