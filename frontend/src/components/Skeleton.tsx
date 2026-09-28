'use client';

import React from 'react';

export function SkeletonBox({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  style
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.8s infinite linear',
        ...style
      }}
    />
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '1.75rem'
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="cyber-glass-card"
          style={{
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minHeight: '280px'
          }}
        >
          {/* Header Badges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <SkeletonBox width="80px" height="22px" borderRadius="12px" />
              <SkeletonBox width="100px" height="22px" borderRadius="12px" />
            </div>
            <SkeletonBox width="60px" height="18px" borderRadius="6px" />
          </div>

          {/* Title & Desc */}
          <SkeletonBox width="75%" height="26px" borderRadius="6px" style={{ marginTop: '6px' }} />
          <SkeletonBox width="100%" height="16px" borderRadius="4px" />
          <SkeletonBox width="90%" height="16px" borderRadius="4px" />

          {/* Resource Strip */}
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', marginBottom: '8px' }}>
            <SkeletonBox width="30%" height="24px" borderRadius="6px" />
            <SkeletonBox width="30%" height="24px" borderRadius="6px" />
            <SkeletonBox width="30%" height="24px" borderRadius="6px" />
          </div>

          {/* Button */}
          <SkeletonBox width="100%" height="44px" borderRadius="10px" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="cyber-glass-card"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBox key={i} width={`${100 / cols}%`} height="20px" borderRadius="4px" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '16px', padding: '10px 0' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBox key={c} width={`${100 / cols}%`} height="18px" borderRadius="4px" />
          ))}
        </div>
      ))}
    </div>
  );
}
