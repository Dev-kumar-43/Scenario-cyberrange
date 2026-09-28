'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface SessionTimerProps {
  sessionId: string;
  expiresAt?: string | null;
  startedAt?: string | null;
  onExtendSuccess?: (newExpiresAt: string) => void;
}

export default function SessionTimer({
  sessionId,
  expiresAt,
  startedAt,
  onExtendSuccess
}: SessionTimerProps) {
  const { token, apiUrl } = useAuth();

  const [currentExpiresAt, setCurrentExpiresAt] = useState<string | null>(expiresAt || null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [isExtending, setIsExtending] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (expiresAt) {
      setCurrentExpiresAt(expiresAt);
    }
  }, [expiresAt]);

  useEffect(() => {
    if (!currentExpiresAt) return;

    const updateTimer = () => {
      const diffMs = new Date(currentExpiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setSecondsRemaining(secs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentExpiresAt]);

  const handleExtend = async () => {
    if (!sessionId || !token) return;
    setIsExtending(true);
    setMessage(null);

    try {
      const res = await fetch(`${apiUrl}/api/labs/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, minutes: 30 })
      });

      const data = await res.json();
      if (res.ok && data.expiresAt) {
        setCurrentExpiresAt(data.expiresAt);
        setMessage('+30m Added');
        if (onExtendSuccess) onExtendSuccess(data.expiresAt);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(data.error || 'Failed to extend');
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {
      setMessage('Network error');
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsExtending(false);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isLow = secondsRemaining < 600; // < 10m
  const isCritical = secondsRemaining < 300; // < 5m

  const timerColor = isCritical ? '#f43f5e' : isLow ? '#f59e0b' : '#00f5d4';
  const timerBg = isCritical
    ? 'rgba(244, 63, 94, 0.15)'
    : isLow
    ? 'rgba(245, 158, 11, 0.15)'
    : 'rgba(0, 245, 212, 0.12)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 10px',
        borderRadius: '8px',
        background: timerBg,
        border: `1px solid ${timerColor}`,
        boxShadow: isCritical ? '0 0 15px rgba(244, 63, 94, 0.4)' : 'none'
      }}
      title="Allocated Kubernetes pod lifetime. Click +30m to extend."
    >
      <span style={{ fontSize: '0.85rem' }}>⏱️</span>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: timerColor
          }}
        >
          {formattedTime}
        </span>
      </div>

      <button
        onClick={handleExtend}
        disabled={isExtending}
        style={{
          padding: '2px 6px',
          fontSize: '0.68rem',
          fontWeight: 800,
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {isExtending ? '...' : message || '+30m'}
      </button>
    </div>
  );
}
