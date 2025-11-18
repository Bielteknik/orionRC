

import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import { useTheme } from './ThemeContext.tsx';
import { getNumericValue } from '../utils/helpers.ts';

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SPEED_BINS = [
  { range: [0, 10], label: '0-10 km/h', color: '#6ee7b7' },
  { range: [10, 20], label: '10-20 km/h', color: '#34d399' },
  { range: [20, 30], label: '20-30 km/h', color: '#10b981' },
  { range: [30, Infinity], label: '>30 km/h', color: '#059669' },
];

const processWindData = (historyData: any[]) => {
    const speedData = historyData.filter(d => d.sensorType === 'Rüzgar Hızı');
    const directionData = historyData.filter(d => d.sensorType === 'Rüzgar Yönü');
    
    if (speedData.length === 0 || directionData.length === 0) return [];

    const speedMap = new Map(speedData.map(d => [new Date(d.timestamp).getTime(), getNumericValue(d.value, d.sensorType, d.interface)]));

    const directionBins = Array.from({ length: 16 }, () => 
        Array.from({ length: SPEED_BINS.length }, () => 0)
    );
    let totalReadings = 0;

    directionData.forEach(dirReading => {
        const timestamp = new Date(dirReading.timestamp).getTime();
        
        // Find closest speed reading in time
        let closestSpeed: number | null = null;
        let minTimeDiff = Infinity;

        speedMap.forEach((speed, speedTs) => {
            const timeDiff = Math.abs(timestamp - speedTs);
            if (timeDiff < minTimeDiff && timeDiff < 60000 * 5) { // 5 minute tolerance
                minTimeDiff = timeDiff;
                closestSpeed = speed;
            }
        });
        
        const direction = getNumericValue(dirReading.value, dirReading.sensorType, dirReading.interface);

        if (closestSpeed === null || direction === null) return;
        
        totalReadings++;
        const dirIndex = Math.floor(((direction + 11.25) % 360) / 22.5);
        const speedIndex = SPEED_BINS.findIndex(bin => closestSpeed! >= bin.range[0] && closestSpeed! < bin.range[1]);
        if (dirIndex >= 0 && dirIndex < 16 && speedIndex !== -1) {
            directionBins[dirIndex][speedIndex]++;
        }
    });
    
    if(totalReadings === 0) return [];

    return DIRECTIONS.map((direction, i) => {
        const counts = { direction };
        let totalForDir = 0;
        SPEED_BINS.forEach((bin, j) => {
            totalForDir += directionBins[i][j];
        });
        
        SPEED_BINS.forEach((bin, j) => {
            // Calculate percentage
            (counts as any)[bin.label] = (directionBins[i][j] / totalReadings) * 100;
        });
        return counts;
    });
};

interface WindRoseChartProps {
    historyData: any[];
}

const WindRoseChart: React.FC<WindRoseChartProps> = ({ historyData }) => {
  const { theme } = useTheme();
  const tickColor = theme === 'dark' ? '#9CA3AF' : '#6B7281';
  
  const chartData = useMemo(() => processWindData(historyData), [historyData]);

  if (chartData.length === 0) {
      return (
          <div className="h-full w-full p-4 flex flex-col items-center justify-center text-muted dark:text-gray-400 text-center">
              <p>Rüzgar Gülü için yeterli Rüzgar Hızı ve Yönü verisi bulunamadı.</p>
          </div>
      );
  }

  return (
    <div className="h-full w-full p-2 flex flex-col">
        <div className="flex-grow h-64">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                    <PolarAngleAxis dataKey="direction" tick={{ fontSize: 10, fill: tickColor }} />
                    <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} tick={{ fontSize: 10, fill: tickColor }} tickFormatter={(value) => `${value.toFixed(1)}%`}/>
                    <Tooltip 
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF', border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` }}
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }}/>
                    {SPEED_BINS.map((bin) => (
                        <Radar 
                            key={bin.label} 
                            name={bin.label} 
                            dataKey={bin.label} 
                            stroke={bin.color} 
                            fill={bin.color} 
                            fillOpacity={0.7}
                            // FIX: The 'stackId' prop is not valid for the <Radar /> component in recharts.
                            // The stacking is implicit when multiple <Radar /> components are used.
                        />
                    ))}
                </RadarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
};

export default WindRoseChart;