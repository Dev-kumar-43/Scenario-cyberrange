'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => {
        // Keep at most 4 active toasts to prevent viewport cluttering
        const filtered = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
        return [...filtered, newToast];
      });

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const toast = {
    success: (message: string, title?: string, duration?: number) => addToast('success', message, title, duration),
    error: (message: string, title?: string, duration?: number) => addToast('error', message, title, duration),
    warning: (message: string, title?: string, duration?: number) => addToast('warning', message, title, duration),
    info: (message: string, title?: string, duration?: number) => addToast('info', message, title, duration),
    dismiss
  };

  const getToastColors = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          bg: 'rgba(9, 20, 26, 0.95)',
          border: 'rgba(16, 185, 129, 0.45)',
          accent: '#10b981',
          shadow: '0 8px 30px rgba(16, 185, 129, 0.2)',
          icon: '✓'
        };
      case 'error':
        return {
          bg: 'rgba(26, 10, 16, 0.95)',
          border: 'rgba(244, 63, 94, 0.45)',
          accent: '#fb7185',
          shadow: '0 8px 30px rgba(244, 63, 94, 0.2)',
          icon: '⚠️'
        };
      case 'warning':
        return {
          bg: 'rgba(26, 20, 10, 0.95)',
          border: 'rgba(245, 158, 11, 0.45)',
          accent: '#fbbf24',
          shadow: '0 8px 30px rgba(245, 158, 11, 0.2)',
          icon: '⚡'
        };
      case 'info':
      default:
        return {
          bg: 'rgba(9, 14, 26, 0.95)',
          border: 'rgba(0, 245, 212, 0.45)',
          accent: '#00f5d4',
          shadow: '0 8px 30px rgba(0, 245, 212, 0.2)',
          icon: 'ℹ️'
        };
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Floating Non-Intrusive Toast Stack */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          pointerEvents: 'none',
          maxWidth: 'min(420px, calc(100vw - 32px))',
          width: '100%'
        }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          const c = getToastColors(t.type);
          const durationSec = ((t.duration || 4000) / 1000).toFixed(1);

          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: '12px',
                padding: '12px 14px',
                boxShadow: `0 10px 25px -5px rgba(0,0,0,0.7), ${c.shadow}`,
                backdropFilter: 'blur(16px)',
                position: 'relative',
                overflow: 'hidden',
                animation: 'toastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              {/* Progress Bar Animation */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '2px',
                  background: c.accent,
                  width: '100%',
                  animation: `toastProgress ${durationSec}s linear forwards`
                }}
              />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1,
                    padding: '3px 6px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    color: c.accent,
                    fontWeight: 800
                  }}
                >
                  {c.icon}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {t.title && (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        color: '#f8fafc',
                        marginBottom: '2px'
                      }}
                    >
                      {t.title}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.45,
                      wordBreak: 'break-word'
                    }}
                  >
                    {t.message}
                  </div>
                </div>

                <button
                  onClick={() => dismiss(t.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    lineHeight: 1,
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
