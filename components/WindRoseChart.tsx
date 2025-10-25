import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import { useTheme } from './ThemeContext.tsx';
import { Station, Sensor } from '../types.ts';
import { getReadingsHistory } from '../services/apiService.ts';

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SPEED_BINS = [
  { range: [0, 5], label: '0-5 km/h', color: '#a7f3d0' },
  { range: [5, 10], label: '5-10 km/h', color: '#6ee7b7' },
  { range: [10, 20], label: '10-20 km/h', color: '#34d399' },
  { range: [20, 30], label: '20-30 km/h', color: '#10b981' },
  { range: [30, Infinity], label: '>30 km/h', color: '#059669' },
];

const processWindData = (speedData: any[], directionData: any[]) => {
    if (speedData.length === 0 || directionData.length === 0) return [];

    // Create a map of timestamps to speed for quick lookup
    const speedMap = new Map(speedData.map(d => [new Date(d.timestamp).getTime(), d.value]));

    const directionBins = Array.from({ length: 16 }, () => 
        Array.from({ length: SPEED_BINS.length }, () => 0)
    );

    directionData.forEach(dirReading => {
        const timestamp = new Date(dirReading.timestamp).getTime();
        const speed = speedMap.get(timestamp);
        const direction = dirReading.value;

        if (speed === undefined) return;

        const dirIndex = Math.floor(((direction + 11.25) % 360) / 22.5);
        const speedIndex = SPEED_BINS.findIndex(bin => speed >= bin.range[0] && speed < bin.range[1]);
        if (dirIndex >= 0 && dirIndex < 16 && speedIndex !== -1) {
            directionBins[dirIndex][speedIndex]++;
        }
    });

    return DIRECTIONS.map((direction, i) => {
        const counts = { direction };
        SPEED_BINS.forEach((bin, j) => {
            (counts as any)[bin.label] = directionBins[i][j];
        });
        return counts;
    });
};

interface WindRoseChartProps {
    stations: Station[];
    sensors: Sensor[]; // Keep for checking if wind sensors exist
}

const WindRoseChart: React.FC<WindRoseChartProps> = ({ stations, sensors }) => {
  const { theme } = useTheme();
  const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchAndProcessData = async () => {
        if (stations.length === 0) {
            setChartData([]);
            return;
        }

        const stationIds = stations.map(s => s.id);
        
        try {
            const [speedHistory, directionHistory] = await Promise.all([
                getReadingsHistory({ stationIds, sensorTypes: ['Rüzgar Hızı'] }),
                getReadingsHistory({ stationIds, sensorTypes: ['Rüzgar Yönü'] })
            ]);

            const processed = processWindData(speedHistory, directionHistory);
            setChartData(processed);
        } catch (error) {
            console.error("Error fetching wind history for rose chart:", error);
            setChartData([]);
        }
    };
    fetchAndProcessData();
  }, [stations]);

  const hasWindSensors = useMemo(() => {
      const stationIds = stations.map(s => s.id);
      const hasSpeed = sensors.some(s => s.type === 'Rüzgar Hızı' && stationIds.includes(s.stationId));
      const hasDirection = sensors.some(s => s.type === 'Rüzgar Yönü' && stationIds.includes(s.stationId));
      return hasSpeed && hasDirection;
  }, [stations, sensors]);


  if (stations.length === 0) {
      return (
          <div className="h-full w-full p-4 flex flex-col items-center justify-center text-muted dark:text-gray-400">
              <p>Rüzgar Gülü için veri gösterecek istasyon seçilmedi.</p>
          </div>
      );
  }
   if (!hasWindSensors) {
      return (
          <div className="h-full w-full p-4 flex flex-col items-center justify-center text-muted dark:text-gray-400">
              <p>Seçili istasyon(lar) için Rüzgar Yönü/Hızı sensörü bulunamadı.</p>
          </div>
      );
  }
  if (chartData.length === 0) {
      return (
          <div className="h-full w-full p-4 flex flex-col items-center justify-center text-muted dark:text-gray-400">
              <p>Rüzgar verileri yükleniyor veya mevcut değil...</p>
          </div>
      );
  }


  return (
    <div className="h-full w-full p-4 flex flex-col">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Rüzgar Gülü</h3>
        <div className="flex-grow h-64">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                    <PolarAngleAxis dataKey="direction" tick={{ fontSize: 10, fill: tickColor }} />
                    <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} tick={{ fontSize: 10, fill: tickColor }}/>
                    <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` }}/>
                    <Legend wrapperStyle={{ fontSize: '12px', color: tickColor }}/>
                    {SPEED_BINS.map((bin, index) => (
                        <Radar 
                            key={bin.label} 
                            name={bin.label} 
                            dataKey={bin.label} 
                            stroke={bin.color} 
                            fill={bin.color} 
                            fillOpacity={0.7} 
                        />
                    ))}
                </RadarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
};

export default WindRoseChart;