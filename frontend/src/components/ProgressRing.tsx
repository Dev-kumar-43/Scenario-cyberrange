'use client';

import React from 'react';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export default function ProgressRing({
  percentage = 0,
  size = 122,
  strokeWidth = 8,
  label,
  sublabel = 'complete',
  className = ''
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={`progress-ring ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ['--p' as any]: `${clamped}%`,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}
      >
        {/* Background track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--sky, #E2EAF2)"
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--blue)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {/* Inner centered text */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          zIndex: 1
        }}
      >
        <strong style={{ fontSize: size < 100 ? '18px' : '26px', letterSpacing: '-0.5px', lineHeight: 1.1, color: 'var(--ink)' }}>
          {label ?? `${clamped}%`}
        </strong>
        {sublabel && (
          <small style={{ fontSize: size < 100 ? '9px' : '11px', color: 'var(--muted)', marginTop: '2px' }}>
            {sublabel}
          </small>
        )}
      </div>
    </div>
  );
}
