// This file contains mock data to be served by the backend API
// until a database is connected.
import { Station, Sensor, SensorStatus, Camera, CameraStatus } from './types';

export const MOCK_STATIONS_DATA: Station[] = [
  { id: 'STN01', name: 'İstasyon 1 - Merkez', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8550, lng: 41.3250 }, status: 'active', sensorCount: 4, cameraCount: 2, activeAlerts: 0, lastUpdate: '2 dakika önce', systemHealth: 100, avgBattery: 86, dataFlow: 98, activeSensorCount: 4, onlineCameraCount: 2 },
  { id: 'STN02', name: 'İstasyon 2 - Kayak Merkezi', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8600, lng: 41.3300 }, status: 'active', sensorCount: 8, cameraCount: 2, activeAlerts: 1, lastUpdate: '5 dakika önce', systemHealth: 95, avgBattery: 78, dataFlow: 92, activeSensorCount: 7, onlineCameraCount: 1 },
  { id: 'STN03', name: 'İstasyon 3 - Güney Yamaç', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8500, lng: 41.3200 }, status: 'maintenance', sensorCount: 10, cameraCount: 1, activeAlerts: 3, lastUpdate: '1 saat önce', systemHealth: 80, avgBattery: 65, dataFlow: 88, activeSensorCount: 8, onlineCameraCount: 1 },
  { id: 'STN04', name: 'Palandöken Zirve İstasyonu', location: 'Erzurum, Türkiye', locationCoords: { lat: 39.8450, lng: 41.3150 }, status: 'inactive', sensorCount: 4, cameraCount: 1, activeAlerts: 0, lastUpdate: '3 saat önce', systemHealth: 0, avgBattery: 0, dataFlow: 0, activeSensorCount: 0, onlineCameraCount: 0 },
];

export const MOCK_SENSORS_DATA: Sensor[] = [
  // Station 1
  { id: 'S001', name: 'Sıcaklık Sensörü 1', type: 'Sıcaklık', stationId: 'STN01', status: SensorStatus.Active, value: 24.5, unit: '°C', battery: 85, lastUpdate: '1 dakika önce' },
  { id: 'S002', name: 'Nem Sensörü 1', type: 'Nem', stationId: 'STN01', status: SensorStatus.Active, value: 68, unit: '%', battery: 92, lastUpdate: '1 dakika önce' },
  { id: 'S003', name: 'Rüzgar Hızı Sensörü 1', type: 'Rüzgar Hızı', stationId: 'STN01', status: SensorStatus.Active, value: 12, unit: 'km/h', battery: 78, lastUpdate: '2 dakika önce' },
  { id: 'S014', name: 'Rüzgar Yönü Sensörü 1', type: 'Rüzgar Yönü', stationId: 'STN01', status: SensorStatus.Active, value: 210, unit: '°', battery: 78, lastUpdate: '2 dakika önce' },
  { id: 'S004', name: 'Basınç Sensörü 1', type: 'Basınç', stationId: 'STN01', status: SensorStatus.Active, value: 1013, unit: 'hPa', battery: 88, lastUpdate: '1 dakika önce' },
  
  // Station 2
  { id: 'S005', name: 'Yağmur Dedektörü', type: 'Yağış', stationId: 'STN02', status: SensorStatus.Error, value: 0, unit: 'mm', battery: 5, lastUpdate: '1 saat önce' },
  { id: 'S006', name: 'UV Sensörü', type: 'UV İndeksi', stationId: 'STN02', status: SensorStatus.Maintenance, value: 5.6, unit: '', battery: 99, lastUpdate: '3 saat önce' },
  { id: 'S008', name: 'Rüzgar Yönü KM', type: 'Rüzgar Yönü', stationId: 'STN02', status: SensorStatus.Active, value: 270, unit: '°', battery: 81, lastUpdate: '3 dakika önce' },
  { id: 'S009', name: 'Sıcaklık Sensörü KM', type: 'Sıcaklık', stationId: 'STN02', status: SensorStatus.Active, value: 19.8, unit: '°C', battery: 95, lastUpdate: '3 dakika önce' },
  { id: 'S010', name: 'Nem Sensörü KM', type: 'Nem', stationId: 'STN02', status: SensorStatus.Active, value: 75, unit: '%', battery: 91, lastUpdate: '3 dakika önce' },
  { id: 'S011', name: 'Rüzgar Hızı Sensörü KM', type: 'Rüzgar Hızı', stationId: 'STN02', status: SensorStatus.Active, value: 25, unit: 'km/h', battery: 88, lastUpdate: '4 dakika önce' },
  
  // Station 3
  { id: 'S007', name: 'Sıcaklık Sensörü 2', type: 'Sıcaklık', stationId: 'STN03', status: SensorStatus.Active, value: 22.1, unit: '°C', battery: 76, lastUpdate: '5 dakika önce' },

  // Station 4
  { id: 'S012', name: 'Zirve Sıcaklık', type: 'Sıcaklık', stationId: 'STN04', status: SensorStatus.Inactive, value: 15.2, unit: '°C', battery: 0, lastUpdate: '3 saat önce' },
  { id: 'S013', name: 'Zirve Nem', type: 'Nem', stationId: 'STN04', status: SensorStatus.Inactive, value: 80, unit: '%', battery: 0, lastUpdate: '3 saat önce' },
];

export const MOCK_CAMERAS_DATA: Camera[] = [
    { id: 'cam1', name: 'Kuzey Kamera', stationId: 'STN01', status: CameraStatus.Online, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', viewDirection: 'Kuzey Yönü', fps: 30, photos: ['https://picsum.photos/seed/p1/200/150','https://picsum.photos/seed/p2/200/150','https://picsum.photos/seed/p3/200/150'], rtspUrl: 'rtsp://192.168.1.10/stream1', cameraType: 'Sabit Dome Kamera' },
    { id: 'cam2', name: 'Güney Kamera', stationId: 'STN01', status: CameraStatus.Recording, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', viewDirection: 'Güney Yönü', fps: 30, photos: ['https://picsum.photos/seed/p4/200/150','https://picsum.photos/seed/p5/200/150'], rtspUrl: 'rtsp://192.168.1.11/stream1', cameraType: 'PTZ Kamera' },
    { id: 'cam3', name: 'İstasyon C - Çatı', stationId: 'STN03', status: CameraStatus.Online, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', viewDirection: 'Çatı', fps: 25, photos: [], rtspUrl: 'rtsp://192.168.1.12/stream1', cameraType: 'Geniş Açılı Kamera' },
    { id: 'cam4', name: 'İstasyon B - Doğu Cephe', stationId: 'STN02', status: CameraStatus.Offline, streamUrl: 'https://picsum.photos/seed/cam4/800/600', viewDirection: 'Doğu Cephe', fps: 0, photos: [], rtspUrl: 'rtsp://192.168.1.13/stream1', cameraType: 'Termal Kamera' },
    { id: 'cam5', name: 'Depo Alanı', stationId: 'STN02', status: CameraStatus.Online, streamUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', viewDirection: 'İç Mekan', fps: 30, photos: [], rtspUrl: 'rtsp://192.168.1.14/stream1', cameraType: 'Sabit Dome Kamera' },
];
