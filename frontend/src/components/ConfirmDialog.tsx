'use client';

import React from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  loading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const getTheme = () => {
    switch (type) {
      case 'danger':
        return {
          icon: '⚠️',
          confirmBg: '#dc2626',
          confirmColor: '#ffffff',
          confirmBorder: 'none',
          confirmShadow: '0 2px 6px -1px rgba(220, 38, 38, 0.4)'
        };
      case 'warning':
        return {
          icon: '⚡',
          confirmBg: '#d97706',
          confirmColor: '#ffffff',
          confirmBorder: 'none',
          confirmShadow: '0 2px 6px -1px rgba(217, 119, 6, 0.4)'
        };
      case 'info':
      default:
        return {
          icon: 'ℹ️',
          confirmBg: 'var(--blue, #2E4C6D)',
          confirmColor: '#ffffff',
          confirmBorder: 'none',
          confirmShadow: '0 2px 6px -1px rgba(46, 76, 109, 0.4)'
        };
    }
  };

  const theme = getTheme();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={theme.icon}
      maxWidth="440px"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: 'var(--bg-card, #F9FAFC)',
              color: '#475569',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-card, #F9FAFC)';
              e.currentTarget.style.color = '#475569';
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: theme.confirmBorder,
              background: theme.confirmBg,
              color: theme.confirmColor,
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: theme.confirmShadow,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            {loading && <span className="live-pulse-dot" />}
            <span>{loading ? 'Processing...' : confirmText}</span>
          </button>
        </>
      }
    >
      <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
        {message}
      </div>
    </Modal>
  );
}
