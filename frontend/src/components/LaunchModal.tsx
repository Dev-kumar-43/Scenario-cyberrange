'use client';

import React from 'react';
import Modal from './Modal';

interface LaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  lab: {
    id: string;
    name: string;
    description: string;
    difficulty?: string;
    category?: string;
    protocol?: string;
    cpuLimit?: string;
    memLimit?: string;
    tasksCount?: number;
  } | null;
}

export default function LaunchModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  lab
}: LaunchModalProps) {
  if (!lab) return null;

  const isVNC = lab.protocol === 'VNC';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ready to put it into practice?"
      icon={isVNC ? '🖥️' : '⚡'}
      maxWidth="520px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--blue)' }}>
          <span>HANDS-ON LAB</span>
          <span>•</span>
          <span>KUBERNETES ISOLATED SANDBOX</span>
        </div>

        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '4px' }}>
            {lab.name}
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            {lab.description}
          </p>
        </div>

        {/* Specs Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span className="pill blue">
            {isVNC ? '🖥️ Kali Linux Desktop GUI' : '💻 Terminal Shell'}
          </span>
          {lab.difficulty && (
            <span className="pill">
              Level: {lab.difficulty}
            </span>
          )}
          {lab.cpuLimit && (
            <span className="pill">
              ⚡ CPU: {lab.cpuLimit}
            </span>
          )}
          {lab.memLimit && (
            <span className="pill">
              💾 RAM: {lab.memLimit}
            </span>
          )}
        </div>

        {/* Objectives / Sandbox info */}
        <div
          style={{
            background: 'var(--sky)',
            border: '1px solid #c9dcf9',
            borderRadius: '10px',
            padding: '14px 16px',
            fontSize: '13px',
            color: 'var(--ink)'
          }}
        >
          <strong style={{ display: 'block', marginBottom: '4px' }}>Dedicated Student Workspace</strong>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-body)' }}>
            This provisions an isolated Kubernetes pod with offensive tools pre-installed. You can connect directly via in-browser noVNC or terminal.
          </p>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button
            onClick={onClose}
            className="btn secondary"
            disabled={loading}
          >
            Not now
          </button>
          <button
            onClick={onConfirm}
            className="btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="live-pulse-dot" />
                <span>Spinning Up Pod Sandbox...</span>
              </>
            ) : (
              <>
                <span>{isVNC ? '🚀 Launch Kali Linux GUI' : '⚡ Spin Up Lab'}</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
