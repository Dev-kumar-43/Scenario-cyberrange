'use client';

import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = '500px',
  closeOnBackdropClick = true,
  closeOnEscape = true
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent background body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.25rem',
        animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'min(90vh, 800px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.18), 0 8px 16px -4px rgba(15, 23, 42, 0.08)',
          background: 'var(--bg-card, #F9FAFC)',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          overflow: 'hidden',
          animation: 'modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        {(title || icon) && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-page, #EEF2F7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {title}
              </h3>
            </div>

            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0f172a';
                e.currentTarget.style.background = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.background = '#f1f5f9';
              }}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body Content */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            color: '#334155',
            fontSize: '0.92rem',
            lineHeight: 1.6
          }}
        >
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              background: 'var(--bg-page, #EEF2F7)'
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
