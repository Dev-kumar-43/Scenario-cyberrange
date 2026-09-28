'use client';

import React from 'react';

export const ICONS: Record<string, string> = {
  home: 'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
  book: 'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z M12 6v15',
  path: 'M6 4a2 2 0 1 0 0 .1 M6 6v4h12v8 M18 18a2 2 0 1 0 0 .1',
  lab: 'M8 3h8 M10 3v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3 M7 15h10',
  chart: 'M4 20V10h4v10 M10 20V4h4v16 M16 20v-8h4v8',
  award: 'M12 3l3 2 4 1v5l-2 3-5 2-5-2-2-3V6l4-1z M8 15l-1 7 5-3 5 3-1-7',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M9 12l2 2 4-4',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4',
  arrow: 'M4 12h15 M14 7l5 5-5 5',
  chevron: 'M9 5l7 7-7 7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  flame: 'M13 2c2 6 7 7 7 12a8 8 0 0 1-16 0c0-4 3-7 5-9 0 4 1 5 3 6 2-3 2-6 1-9z',
  bolt: 'M13 2L4 14h7l-1 8 10-13h-7z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
  network: 'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
  terminal: 'M3 4h18v16H3z M7 9l3 3-3 3 M13 16h4',
  check: 'M5 12l4 4L19 6',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',
  close: 'M6 6l12 12 M18 6L6 18',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 21v-3c0-6 16-6 16 0v3',
  monitor: 'M3 3h18v13H3z M12 16v5 M8 21h8',
  flag: 'M5 22V3h13l-3 4 3 4H5',
  cloud: 'M7 18a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 0 1-1 8z',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 11v2',
  file: 'M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h5',
  help: 'M9 8a3 3 0 1 1 4 3c-1 0-1 2-1 3 M12 18h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  play: 'M8 4l12 8-12 8z',
  logout: 'M9 4H3v16h6 M10 12h11 M17 8l4 4-4 4',
  sun: 'M12 3v2 M12 19v2 M5 5l1.5 1.5 M17.5 17.5l1.5 1.5 M3 12h2 M19 12h2 M5 19l1.5-1.5 M17.5 6.5l1.5-1.5 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
};

interface AstraIconProps {
  name: keyof typeof ICONS | string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export default function AstraIcon({
  name,
  size = 20,
  className = 'icon',
  style = {}
}: AstraIconProps) {
  const d = ICONS[name] || ICONS.book;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...style
      }}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
