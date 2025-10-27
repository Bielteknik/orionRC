import React, { useEffect, useRef } from 'react';

// Leaflet'in global 'L' değişkenini TypeScript'e tanıtarak hataları önle
declare const L: any;

interface InteractiveMapProps {
  lat: number;
  lng: number;
  zoom: number;
  stationName: string;
  statusText: string;
  statusClassName: string;
  lastUpdate: string;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ lat, lng, zoom, stationName, statusText, statusClassName, lastUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const popupRef = useRef<any>(null);

  // Sadece bileşen yüklendiğinde haritayı bir kez oluştur
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
        zoomControl: true,
        attributionControl: false
      });
      mapRef.current = map;

      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	      attribution: 'Tiles &copy; Esri'
      });
      satelliteLayer.addTo(map);

      const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      });

      const baseMaps = { "Sokak": streetLayer, "Uydu": satelliteLayer };
      L.control.layers(baseMaps).addTo(map);
      
      const customIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="p-1 bg-white border-2 border-accent rounded-full shadow-lg"><div class="w-2 h-2 bg-accent rounded-full animate-pulse"></div></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -15]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      markerRef.current = marker;

      const popup = L.popup({ minWidth: 200, closeButton: true });
      marker.bindPopup(popup);
      popupRef.current = popup;
      
      setTimeout(() => map.invalidateSize(), 100);
    }

    // Bileşen kaldırıldığında haritayı temizle
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Boş bağımlılık dizisi ile bu effect'in sadece bir kez çalışmasını sağla

  // Prop'lar değiştiğinde haritayı güncelle
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !popupRef.current) return;

    mapRef.current.setView([lat, lng], zoom);
    markerRef.current.setLatLng([lat, lng]);
      
    const popupContent = `
        <div class="space-y-2 text-sm">
          <h3 class="font-bold text-base text-gray-900 -mb-1">${stationName}</h3>
          <div class="flex items-center justify-between">
            <span class="text-muted">Durum:</span>
            <span class="px-2 py-0.5 text-xs font-semibold rounded-full ${statusClassName}">${statusText}</span>
          </div>
          <div class="flex items-center justify-between text-xs border-t border-gray-200 pt-2 mt-2">
            <span class="text-muted">Güncelleme:</span>
            <span class="font-mono text-gray-700">${lastUpdate}</span>
          </div>
        </div>
      `;
    popupRef.current.setContent(popupContent);

    // Popup'ın açık olduğundan emin ol
    if (!markerRef.current.isPopupOpen()) {
        markerRef.current.openPopup();
    }
  }, [lat, lng, zoom, stationName, statusText, statusClassName, lastUpdate]);


  return (
    <>
        <style>
        {`
            .leaflet-popup-content-wrapper {
                background: #FFFFFF; /* primary color */
                color: #1F2937; /* text-gray-800 */
                border: 1px solid #E5E7EB; /* border-gray-200 */
                border-radius: 8px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.1);
                padding: 1px; /* To prevent content from touching the edge */
            }
            .leaflet-popup-tip {
                 background: #FFFFFF;
                 border-top: 1px solid #E5E7EB;
            }
            .leaflet-popup-content {
                margin: 0;
                width: 200px !important;
                font-size: 14px;
                line-height: 1.4;
            }
            .leaflet-popup-content-wrapper .leaflet-popup-content {
                 padding: 12px;
            }
            .leaflet-container a.leaflet-popup-close-button {
                color: #9CA3AF;
                padding: 8px 8px 0 0;
            }
            .leaflet-container a.leaflet-popup-close-button:hover {
                color: #1F2937;
            }
            .leaflet-control-attribution {
                font-size: 10px !important;
            }
             .leaflet-control-attribution a {
                color: #6B7281 !important; /* muted */
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
                align-items-center;
                gap: 8px;
            }
            .leaflet-control-layers-selector {
                margin-top: 2px;
            }
        `}
        </style>
        <div ref={mapContainerRef} className="w-full h-full rounded-md" />
    </>
  );
};

export default InteractiveMap;