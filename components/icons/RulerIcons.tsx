import React from 'react';

type IconProps = React.HTMLAttributes<SVGElement>;

const rulerNumbers = Array.from({ length: 24 }, (_, i) => (24 - i) * 10);

export const SnowRulerDayIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 60 250" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="5" y="5" width="50" height="240" rx="5" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
    <path d="M 30 15 L 15 245" stroke="#EF4444" strokeWidth="1" fill="none" />
    <path d="M 30 15 L 45 245" stroke="#EF4444" strokeWidth="1" fill="none" />
    
    <g fontSize="10" fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">
      {rulerNumbers.map((num, i) => {
        const y = 20 + i * 10;
        return (
          <g key={num}>
            <line x1="18" y1={y} x2="42" y2={y} stroke="#374151" strokeWidth="1.5" />
            { (i < 23) && <line x1="24" y1={y + 5} x2="36" y2={y + 5} stroke="#6B7281" strokeWidth="1" /> }
            <text x="30" y={y - 3} fill="#EF4444">{num}</text>
          </g>
        );
      })}
    </g>
  </svg>
);

export const SnowRulerNightIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 60 250" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="5" y="5" width="50" height="240" rx="5" fill="#374151" stroke="#4B5563" strokeWidth="1" />
    <path d="M 30 15 L 15 245" stroke="#F87171" strokeWidth="1" fill="none" />
    <path d="M 30 15 L 45 245" stroke="#F87171" strokeWidth="1" fill="none" />
    
    <g fontSize="10" fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">
      {rulerNumbers.map((num, i) => {
        const y = 20 + i * 10;
        return (
          <g key={num}>
            <line x1="18" y1={y} x2="42" y2={y} stroke="#E5E7EB" strokeWidth="1.5" />
            { (i < 23) && <line x1="24" y1={y + 5} x2="36" y2={y + 5} stroke="#9CA3AF" strokeWidth="1" /> }
            <text x="30" y={y - 3} fill="#FFFFFF">{num}</text>
          </g>
        );
      })}
    </g>
  </svg>
);