import React from 'react';

type IconProps = React.HTMLAttributes<SVGElement>;

const rulerNumbers = Array.from({ length: 25 }, (_, i) => (24 - i) * 10);

export const SnowRulerDayIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 80 270" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <filter id="ruler-shadow-day" x="-10%" y="-2%" width="120%" height="105%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
        <feOffset dx="1" dy="2" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.3"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#ruler-shadow-day)">
      <rect x="15" y="10" width="50" height="250" rx="8" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
      <path d="M 40 20 L 20 255 L 60 255 Z" fill="#FEE2E2" />
      <path d="M 40 20 L 20 255" stroke="#F87171" strokeWidth="0.5" fill="none" />
      <path d="M 40 20 L 60 255" stroke="#F87171" strokeWidth="0.5" fill="none" />
      
      <g fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600" textAnchor="middle">
        {rulerNumbers.map((num, i) => {
          const y = 25 + i * 10;
          return (
            <g key={num}>
              <line x1="22" y1={y} x2="58" y2={y} stroke="#D1D5DB" strokeWidth="1.5" />
              { (num > 0) && <line x1="30" y1={y + 5} x2="50" y2={y + 5} stroke="#E5E7EB" strokeWidth="1" /> }
              <text x="40" y={y - 4} fill="#B91C1C">{num}</text>
            </g>
          );
        })}
      </g>
    </g>
  </svg>
);

export const SnowRulerNightIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 80 270" xmlns="http://www.w3.org/2000/svg" {...props}>
     <defs>
      <filter id="ruler-shadow-night" x="-10%" y="-2%" width="120%" height="105%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
        <feOffset dx="1" dy="2" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#ruler-shadow-night)">
      <rect x="15" y="10" width="50" height="250" rx="8" fill="#1F2937" stroke="#4B5563" strokeWidth="1" />
      <path d="M 40 20 L 20 255 L 60 255 Z" fill="#450a0a" />
      <path d="M 40 20 L 20 255" stroke="#F87171" strokeWidth="0.5" fill="none" />
      <path d="M 40 20 L 60 255" stroke="#F87171" strokeWidth="0.5" fill="none" />
      
      <g fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600" textAnchor="middle">
        {rulerNumbers.map((num, i) => {
          const y = 25 + i * 10;
          return (
            <g key={num}>
              <line x1="22" y1={y} x2="58" y2={y} stroke="#6B7281" strokeWidth="1.5" />
              { (num > 0) && <line x1="30" y1={y + 5} x2="50" y2={y + 5} stroke="#4B5563" strokeWidth="1" /> }
              <text x="40" y={y - 4} fill="#F9FAFB" className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">{num}</text>
            </g>
          );
        })}
      </g>
    </g>
  </svg>
);