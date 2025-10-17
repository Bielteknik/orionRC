import React, { useEffect, useRef, useState, useCallback } from 'react';

declare const L: any;

interface LocationPickerMapProps {
  onLocationChange: (coords: { lat: number; lng: number }) => void;
  initialCenter: { lat: number; lng: number };
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ onLocationChange, initialCenter }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const lockControlRef = useRef<HTMLDivElement | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const onLocationChangeRef = useRef(onLocationChange);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const mapClickHandler = useCallback((e: any) => {
    if (markerRef.current) {
        const coords = e.latlng;
        markerRef.current.setLatLng(coords);
        onLocationChangeRef.current({ lat: coords.lat, lng: coords.lng });
    }
  }, []);

  // Effect for map setup (runs once)
  useEffect(() => {
    let map: any;
    if (mapContainerRef.current && !mapRef.current) {
        map = L.map(mapContainerRef.current, {
            scrollWheelZoom: true,
            attributionControl: false,
        }).setView([initialCenter.lat, initialCenter.lng], 13);
        mapRef.current = map;

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        });
        const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
        });

        satelliteLayer.addTo(map);
        L.control.layers({ "Uydu": satelliteLayer, "Sokak": streetLayer }).addTo(map);

        const customMarkerIcon = L.divIcon({
            className: 'location-picker-marker',
            html: `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-accent drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.25a7.5 7.5 0 00-7.5 7.5c0 6.352 7.5 11.25 7.5 11.25s7.5-4.898 7.5-11.25a7.5 7.5 0 00-7.5-7.5zM12 12a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" />
                </svg>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 48],
        });

        const marker = L.marker([initialCenter.lat, initialCenter.lng], {
            draggable: true,
            autoPan: true,
            icon: customMarkerIcon,
        }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', () => {
            const coords = marker.getLatLng();
            onLocationChangeRef.current({ lat: coords.lat, lng: coords.lng });
        });
        
        map.on('click', mapClickHandler);

        const LockControl = L.Control.extend({
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.style.width = '34px';
                container.style.height = '34px';
                container.style.cursor = 'pointer';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                lockControlRef.current = container;
                
                L.DomEvent.on(container, 'click', e => {
                    L.DomEvent.stopPropagation(e);
                    setIsLocked(prev => !prev);
                });

                return container;
            },
        });
        new LockControl({ position: 'topright' }).addTo(map);
        
        setTimeout(() => map.invalidateSize(), 100);
    }

    return () => {
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
    };
  }, [initialCenter, mapClickHandler]);

  // Effect to manage lock state and UI
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const control = lockControlRef.current;

    if (!map || !marker || !control) return;
    
    const lockIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg>`;
    const unlockIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 9a1 1 0 100-2 1 1 0 000 2z" /><path d="M7 7v2h6V7a3 3 0 00-6 0z" /></svg>`;

    if (isLocked) {
        marker.dragging.disable();
        map.off('click', mapClickHandler);
        control.innerHTML = lockIcon;
        control.title = 'Konum Kilidini Aç';
        control.style.backgroundColor = '#F3F4F6';
    } else {
        marker.dragging.enable();
        map.on('click', mapClickHandler);
        control.innerHTML = unlockIcon;
        control.title = 'Konumu Kilitle';
        control.style.backgroundColor = 'white';
    }
  }, [isLocked, mapClickHandler]);

  return (
    <div className="relative w-full h-96">
        <div ref={mapContainerRef} className="w-full h-full rounded-md border border-gray-300 z-0" />
        <style>
        {`
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
             .leaflet-control-attribution {
                font-size: 10px !important;
            }
             .leaflet-control-attribution a {
                color: #6B7180 !important;
            }
        `}
        </style>
    </div>
  );
};

export default LocationPickerMap;