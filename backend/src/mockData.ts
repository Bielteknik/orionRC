// This file contains mock data to be served by the backend API
// until a database is connected.
import { Station, Sensor, SensorStatus, Camera, CameraStatus } from './types';

const pastDate = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

export const MOCK_STATIONS_DATA: Station[] = [
    {
        id: 'STN001',
        name: 'Erzurum Merkez',
        location: 'Erzurum, Türkiye',
        locationCoords: { lat: 39.9086, lng: 41.2655 },
        status: 'active',
        sensorCount: 4,
        cameraCount: 2,
        activeAlerts: 1,
        lastUpdate: pastDate(2),
        systemHealth: 98,
        avgBattery: 95,
        dataFlow: 12.5,
        activeSensorCount: 4,
        onlineCameraCount: 2,
    },
    {
        id: 'STN002',
        name: 'Palandöken Kayak Merkezi',
        location: 'Palandöken, Erzurum',
        locationCoords: { lat: 39.8667, lng: 41.2856 },
        status: 'active',
        sensorCount: 5,
        cameraCount: 1,
        activeAlerts: 0,
        lastUpdate: pastDate(5),
        systemHealth: 99,
        avgBattery: 92,
        dataFlow: 15.2,
        activeSensorCount: 5,
        onlineCameraCount: 1,
    },
    {
        id: 'STN003',
        name: 'Tortum Şelalesi Gözlem',
        location: 'Tortum, Erzurum',
        locationCoords: { lat: 40.2981, lng: 41.6508 },
        status: 'maintenance',
        sensorCount: 3,
        cameraCount: 1,
        activeAlerts: 0,
        lastUpdate: pastDate(120),
        systemHealth: 75,
        avgBattery: 60,
        dataFlow: 2.1,
        activeSensorCount: 2,
        onlineCameraCount: 0,
    },
];

export const MOCK_SENSORS_DATA: Sensor[] = [
    // Station 1 Sensors
    { id: 'SEN01', name: 'Sıcaklık Sensörü A', type: 'Sıcaklık', stationId: 'STN001', status: SensorStatus.Active, value: 15.2, unit: '°C', battery: 98, lastUpdate: pastDate(1) },
    { id: 'SEN02', name: 'Nem Ölçer A', type: 'Nem', stationId: 'STN001', status: SensorStatus.Active, value: 55.6, unit: '%', battery: 92, lastUpdate: pastDate(1) },
    { id: 'SEN03', name: 'Rüzgar Hızı Anemometre', type: 'Rüzgar Hızı', stationId: 'STN001', status: SensorStatus.Active, value: 12.5, unit: 'km/h', battery: 99, lastUpdate: pastDate(3) },
    { id: 'SEN04', name: 'Barometre A', type: 'Basınç', stationId: 'STN001', status: SensorStatus.Active, value: 1012.3, unit: 'hPa', battery: 91, lastUpdate: pastDate(4) },

    // Station 2 Sensors
    { id: 'SEN05', name: 'Sıcaklık Sensörü B (Zirve)', type: 'Sıcaklık', stationId: 'STN002', status: SensorStatus.Active, value: -2.3, unit: '°C', battery: 88, lastUpdate: pastDate(2) },
    { id: 'SEN06', name: 'Nem Ölçer B (Zirve)', type: 'Nem', stationId: 'STN002', status: SensorStatus.Active, value: 78.1, unit: '%', battery: 85, lastUpdate: pastDate(2) },
    { id: 'SEN07', name: 'Rüzgar Yönü Sensörü', type: 'Rüzgar Yönü', stationId: 'STN002', status: SensorStatus.Active, value: 275, unit: '°', battery: 94, lastUpdate: pastDate(5) },
    { id: 'SEN08', name: 'UV İndeksi Ölçer', type: 'UV İndeksi', stationId: 'STN002', status: SensorStatus.Active, value: 6.7, unit: '', battery: 93, lastUpdate: pastDate(6) },
    { id: 'SEN12', name: 'Kar Kalınlığı Ölçer', type: 'Mesafe', stationId: 'STN002', status: SensorStatus.Active, value: 124.5, unit: 'cm', battery: 90, lastUpdate: pastDate(3) },


    // Station 3 Sensors
    { id: 'SEN09', name: 'Şelale Sıcaklık', type: 'Sıcaklık', stationId: 'STN003', status: SensorStatus.Maintenance, value: 18.1, unit: '°C', battery: 65, lastUpdate: pastDate(121) },
    { id: 'SEN10', name: 'Şelale Nem', type: 'Nem', stationId: 'STN003', status: SensorStatus.Active, value: 88.9, unit: '%', battery: 72, lastUpdate: pastDate(122) },
    { id: 'SEN11', name: 'Yağış Miktarı', type: 'Yağış', stationId: 'STN003', status: SensorStatus.Error, value: 0, unit: 'mm', battery: 5, lastUpdate: pastDate(150) },
    
    // Unassigned Sensor
    { id: 'SEN99', name: 'Depo Sensörü', type: 'Basınç', stationId: '', status: SensorStatus.Inactive, value: 0, unit: 'hPa', battery: 100, lastUpdate: pastDate(1000) },
];

export const MOCK_CAMERAS_DATA: Camera[] = [
    // Station 1 Cameras
    { id: 'CAM01', name: 'Merkez Ana Kamera', stationId: 'STN001', status: CameraStatus.Online, streamUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', rtspUrl: 'rtsp://...', cameraType: 'Sabit Dome Kamera', viewDirection: 'Meydan', fps: 30, photos: [] },
    { id: 'CAM02', name: 'Merkez PTZ', stationId: 'STN001', status: CameraStatus.Recording, streamUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', rtspUrl: 'rtsp://...', cameraType: 'PTZ Kamera', viewDirection: 'Cadde', fps: 25, photos: [] },

    // Station 2 Cameras
    { id: 'CAM03', name: 'Palandöken Zirve', stationId: 'STN002', status: CameraStatus.Online, streamUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', rtspUrl: 'rtsp://...', cameraType: 'Geniş Açılı Kamera', viewDirection: 'Zirve Batı', fps: 30, photos: [] },

    // Station 3 Cameras
    { id: 'CAM04', name: 'Şelale İzleme', stationId: 'STN003', status: CameraStatus.Offline, streamUrl: '', rtspUrl: 'rtsp://...', cameraType: 'Sabit Dome Kamera', viewDirection: 'Şelale', fps: 0, photos: [] },

    // Unassigned Camera
    { id: 'CAM99', name: 'Depo Kamerası', stationId: '', status: CameraStatus.Offline, streamUrl: '', rtspUrl: 'rtsp://...', cameraType: 'Termal Kamera', viewDirection: 'Depo Girişi', fps: 0, photos: [] },
];
