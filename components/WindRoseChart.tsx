import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import { useTheme } from './ThemeContext';
import { MOCK_SENSORS } from '../pages/Sensors';
import { Station } from '../types';

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SPEED_BINS = [
  { range: [0, 5], label: '0-5 km/h', color: '#a7f3d0' },
  { range: [5, 10], label: '5-10 km/h', color: '#6ee7b7' },
  { range: [10, 20], label: '10-20 km/h', color: '#34d399' },
  { range: [20, 30], label: '20-30 km/h', color: '#10b981' },
  { range: [30, Infinity], label: '>30 km/h', color: '#059669' },
];

// Generate mock data for the wind rose chart based on selected stations
const generateMockWindData = (stations: Station[]) => {
    const stationIds = stations.map(s => s.id);
    const windSpeedSensors = MOCK_SENSORS.filter(s => s.type === 'Rüzgar Hızı' && stationIds.includes(s.stationId));
    const windDirSensors = MOCK_SENSORS.filter(s => s.type === 'Rüzgar Yönü' && stationIds.includes(s.stationId));
    
    if (windSpeedSensors.length === 0 || windDirSensors.length === 0) {
        return [];
    }

    // Use average values as a base for more representative mock data
    const avgSpeed = windSpeedSensors.reduce((acc, s) => acc + s.value, 0) / windSpeedSensors.length;
    const avgDir = windDirSensors.reduce((acc, s) => acc + s.value, 0) / windDirSensors.length;

    return Array.from({ length: 200 }, () => ({
        speed: Math.max(0, avgSpeed + (Math.random() - 0.5) * 30),
        direction: (avgDir + (Math.random() - 0.5) * 90 + 360) % 360,
    }));
};

const processWindData = (data: { speed: number, direction: number }[]) => {
    if (data.length === 0) return [];
    
    const directionBins = Array.from({ length: 16 }, () => 
        Array.from({ length: SPEED_BINS.length }, () => 0)
    );

    data.forEach(({ speed, direction }) => {
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
}

const WindRoseChart: React.FC<WindRoseChartProps> = ({ stations }) => {
  const { theme } = useTheme();
  const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';

  const chartData = useMemo(() => {
    const mockData = generateMockWindData(stations);
    return processWindData(mockData);
  }, [stations]);

  if (stations.length === 0) {
      return (
          <div className="h-full w-full p-4 flex flex-col items-center justify-center text-muted dark:text-gray-400">
              <p>Rüzgar Gülü için veri gösterecek istasyon seçilmedi.</p>
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
                            stackId="a"
                        />
                    ))}
                </RadarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
};

export default WindRoseChart;