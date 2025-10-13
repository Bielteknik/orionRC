import React, { useState, useMemo, useEffect } from 'react';
import { Sensor, SensorStatus } from '../types';
import Card from '../components/common/Card';
import { AddIcon, SearchIcon, SettingsIcon, StationIcon, SensorIcon as GenericSensorIcon } from '../components/icons/Icons';
import { MOCK_STATIONS } from './Stations';
import AddSensorDrawer from '../components/AddSensorDrawer';
import Skeleton from '../components/common/Skeleton';


// Mock Data
export const MOCK_SENSORS: Sensor[] = [
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


const SENSOR_UNITS: { [key: string]: string } = {
    'Sıcaklık': '°C',
    'Nem': '%',
    'Rüzgar Hızı': 'km/h',
    'Basınç': 'hPa',
    'Yağış': 'mm',
    'UV İndeksi': '',
    'Rüzgar Yönü': '°'
};


const StatCard: React.FC<{ title: string; value: string | number; colorClass?: string }> = ({ title, value, colorClass = 'text-gray-900' }) => (
  <Card className="p-4">
    <p className="text-sm text-muted">{title}</p>
    <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
  </Card>
);

const SensorCard: React.FC<{ sensor: Sensor; onEdit: (sensor: Sensor) => void }> = ({ sensor, onEdit }) => {
    const station = MOCK_STATIONS.find(s => s.id === sensor.stationId);
    const batteryColor = sensor.battery > 20 ? 'bg-green-400' : 'bg-red-500';

    return (
        <div 
            className="relative p-5 flex flex-col rounded-xl shadow-lg overflow-hidden bg-gradient-to-br from-ubuntu-purple to-ubuntu-orange text-white h-[340px]"
        >
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                            <GenericSensorIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white shadow-black/50 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">{sensor.name}</h3>
                            <p className="text-sm text-white/80 shadow-black/50 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">{sensor.type}</p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${sensor.status === SensorStatus.Active ? 'bg-white/90 text-gray-900' : 'bg-white/20 backdrop-blur-sm text-white/80'}`}>
                        {sensor.status}
                    </span>
                </div>

                {/* Value */}
                <div className="flex-grow flex items-center justify-center my-4">
                    <div className="text-center">
                        <p className="text-sm text-white/80 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">Anlık Değer</p>
                        <p className="text-6xl font-bold text-white [text-shadow:0_2px_4px_var(--tw-shadow-color)] shadow-black/50">
                            {sensor.value}
                            <span className="text-3xl text-white/80 ml-1">{sensor.unit}</span>
                        </p>
                    </div>
                </div>

                {/* Footer details */}
                <div className="space-y-3 mt-auto">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center space-x-3">
                        <StationIcon className="w-5 h-5 text-white flex-shrink-0" />
                        <div>
                            <p className="text-xs text-white/80">İstasyon</p>
                            <p className="font-semibold text-sm text-white">{station?.name || sensor.stationId}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-white/80">Batarya</span>
                                <span className="font-bold text-white">{sensor.battery}%</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-1.5">
                                <div className={`${batteryColor} h-1.5 rounded-full`} style={{ width: `${sensor.battery}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                            <p className="text-sm text-white/80">Güncelleme</p>
                            <p className="font-semibold text-sm text-white">{sensor.lastUpdate}</p>
                        </div>
                    </div>

                    <button 
                        onClick={() => onEdit(sensor)}
                        className="w-full flex items-center justify-center space-x-2 border border-white/30 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        <SettingsIcon className="w-5 h-5" />
                        <span>Ayarlar</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

const Sensors: React.FC = () => {
  const [sensors, setSensors] = useState<Sensor[]>(MOCK_SENSORS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SensorStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 750);
    return () => clearTimeout(timer);
  }, []);

  const { total, active, error, avgBattery } = useMemo(() => {
    const activeSensors = sensors.filter(s => s.status === SensorStatus.Active);
    const totalBattery = sensors.reduce((acc, s) => acc + s.battery, 0);
    return {
      total: sensors.length,
      active: activeSensors.length,
      error: sensors.filter(s => s.status === SensorStatus.Error).length,
      avgBattery: sensors.length > 0 ? Math.round(totalBattery / sensors.length) : 0,
    };
  }, [sensors]);
  
  const sensorTypes = useMemo(() => [...new Set(sensors.map(s => s.type))], [sensors]);

  const filteredSensors = useMemo(() => {
    const stationMap = new Map(MOCK_STATIONS.map(s => [s.id, s.name]));
    return sensors
      .filter(sensor => statusFilter === 'all' || sensor.status === statusFilter)
      .filter(sensor => typeFilter === 'all' || sensor.type === typeFilter)
      .filter(sensor => {
        const stationName = stationMap.get(sensor.stationId) || '';
        return sensor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               stationName.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [sensors, searchTerm, statusFilter, typeFilter]);
  
  const handleOpenAddDrawer = () => {
    setEditingSensor(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (sensor: Sensor) => {
    setEditingSensor(sensor);
    setIsDrawerOpen(true);
  };
  
  const handleSaveSensor = (sensorData: Partial<Sensor> & { id?: string }) => {
     if (sensorData.id) { // Update existing sensor
        setSensors(prev => prev.map(s => s.id === sensorData.id ? { ...s, ...sensorData, lastUpdate: 'şimdi' } as Sensor : s));
     } else { // Add new sensor
        const newSensor: Sensor = {
            id: `S${Date.now()}`,
            name: sensorData.name || 'Yeni Sensör',
            stationId: sensorData.stationId || '',
            type: sensorData.type || 'Sıcaklık',
            status: (sensorData as any).isActive ? SensorStatus.Active : SensorStatus.Inactive,
            value: 0,
            unit: SENSOR_UNITS[sensorData.type || 'Sıcaklık'] || '',
            battery: 100,
            lastUpdate: 'şimdi',
        };
        setSensors(prev => [newSensor, ...prev]);
     }
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Sensörler</h2>
                <p className="text-muted">Tüm IOT sensörlerini yönetin</p>
            </div>
            <button 
                onClick={handleOpenAddDrawer}
                className="flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors">
              <AddIcon className="w-5 h-5" />
              <span className="font-semibold">Yeni Sensör</span>
            </button>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24"/>) : <>
            <StatCard title="Toplam Sensör" value={total} />
            <StatCard title="Aktif Sensör" value={active} colorClass="text-success" />
            <StatCard title="Hatalı Sensör" value={error} colorClass="text-danger" />
            <StatCard title="Ortalama Batarya" value={`${avgBattery}%`} />
        </>}
      </div>

      <Card>
        <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-1/3">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                <input 
                type="text" 
                placeholder="Sensör veya istasyon ara..." 
                className="w-full bg-secondary border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <select 
                className="w-full md:w-auto bg-secondary border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as SensorStatus | 'all')}
              >
                <option value="all">Tüm Durumlar</option>
                {Object.values(SensorStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
            </select>
            <select 
                className="w-full md:w-auto bg-secondary border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="all">Tüm Tipler</option>
                {sensorTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
            </select>
        </div>
      </Card>
      
        {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[340px] rounded-xl" />)}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredSensors.map(sensor => (
                <SensorCard key={sensor.id} sensor={sensor} onEdit={handleOpenEditDrawer} />
            ))}
          </div>
        )}

      {filteredSensors.length === 0 && !isLoading && (
          <Card>
              <div className="text-center py-8 text-muted">
                  <p>Arama kriterlerinize uygun sensör bulunamadı.</p>
              </div>
          </Card>
      )}
      <AddSensorDrawer 
        isOpen={isDrawerOpen}
        onClose={() => {
            setIsDrawerOpen(false);
            setEditingSensor(null);
        }}
        onSave={handleSaveSensor}
        stations={MOCK_STATIONS}
        sensorToEdit={editingSensor}
      />
    </div>
  );
};

export default Sensors;