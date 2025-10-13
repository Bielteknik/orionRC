// This file contains mock data to be served by the backend API
// until a database is connected.

export interface Station {
  id: string;
  name: string;
  location: string;
  locationCoords: { lat: number; lng: number };
  status: 'active' | 'inactive' | 'maintenance';
  sensorCount: number;
  cameraCount: number;
  activeAlerts: number;
  lastUpdate: string;
  systemHealth?: number;
  avgBattery?: number;
  dataFlow?: number;
  activeSensorCount?: number;
  onlineCameraCount?: number;
}


export const MOCK_STATIONS_DATA: Station[] = [
  { id: 'STN01', name: 'İstasyon 1 - Merkez', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8550, lng: 41.3250 }, status: 'active', sensorCount: 4, cameraCount: 2, activeAlerts: 0, lastUpdate: '2 dakika önce', systemHealth: 100, avgBattery: 86, dataFlow: 98, activeSensorCount: 4, onlineCameraCount: 2 },
  { id: 'STN02', name: 'İstasyon 2 - Kayak Merkezi', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8600, lng: 41.3300 }, status: 'active', sensorCount: 8, cameraCount: 2, activeAlerts: 1, lastUpdate: '5 dakika önce', systemHealth: 95, avgBattery: 78, dataFlow: 92, activeSensorCount: 7, onlineCameraCount: 1 },
  { id: 'STN03', name: 'İstasyon 3 - Güney Yamaç', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8500, lng: 41.3200 }, status: 'maintenance', sensorCount: 10, cameraCount: 1, activeAlerts: 3, lastUpdate: '1 saat önce', systemHealth: 80, avgBattery: 65, dataFlow: 88, activeSensorCount: 8, onlineCameraCount: 1 },
  { id: 'STN04', name: 'Palandöken Zirve İstasyonu', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8450, lng: 41.3150 }, status: 'inactive', sensorCount: 4, cameraCount: 1, activeAlerts: 0, lastUpdate: '3 saat önce', systemHealth: 0, avgBattery: 0, dataFlow: 0, activeSensorCount: 0, onlineCameraCount: 0 },
];
