'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import TerminalComponent from '@/components/Terminal';
import MissionDrawer from '@/components/MissionDrawer';
import SessionTimer from '@/components/SessionTimer';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { token, apiUrl, user, logout } = useAuth();

  const [session, setSession] = useState<any>(null);
  const [isMissionDrawerOpen, setIsMissionDrawerOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);

  useEffect(() => {
    if (!sessionId || !token) return;

    const fetchSession = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/labs/sessions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const current = (data.sessions || []).find((s: any) => s.id === sessionId);
          if (current) setSession(current);
        }
      } catch (err) {
        console.error('Failed to load session details in terminal:', err);
      }
    };

    fetchSession();
  }, [sessionId, token, apiUrl]);

  if (!sessionId) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        Initializing Interactive Terminal...
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#050811', overflow: 'hidden' }}>
      {/* HUD Control Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: '12px',
          padding: '8px 16px',
          backgroundColor: 'rgba(9, 14, 26, 0.98)',
          borderBottom: '1px solid var(--border-card)',
          backdropFilter: 'blur(20px)',
          height: '56px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexShrink: 0 }}>
          <button
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={() => router.push('/sessions')}
          >
            <span>←</span>
            <span>Labs</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '1.1rem' }}>💻</span>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
              {session?.lab?.name || 'Interactive Sandbox Terminal'}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '16px',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: 'var(--cyber-emerald)',
                flexShrink: 0
              }}
            >
              <span className="live-pulse-dot" style={{ width: '6px', height: '6px' }} />
              <span>{session?.status || 'CONNECTED'}</span>
            </span>
          </div>
        </div>

        {/* Center: Session TTL Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {session && (
            <SessionTimer
              sessionId={sessionId}
              expiresAt={session.expiresAt}
              startedAt={session.createdAt}
              onExtendSuccess={(newExp) => setSession((prev: any) => prev ? { ...prev, expiresAt: newExp } : prev)}
            />
          )}
        </div>

        {/* Right actions: Desktop switch, Mission Control, Operator Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={() => router.push(`/sessions/${sessionId}/desktop`)}
            title="Switch to GUI Kali Linux Desktop"
          >
            <span>🖥️</span>
            <span>GUI Desktop</span>
          </button>

          {/* Mission Control Trigger */}
          <button
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: '8px',
              background: isMissionDrawerOpen
                ? 'rgba(0, 245, 212, 0.25)'
                : 'linear-gradient(135deg, rgba(0, 245, 212, 0.15), rgba(139, 92, 246, 0.25))',
              border: '1px solid rgba(0, 245, 212, 0.4)',
              color: '#ffffff',
              boxShadow: isMissionDrawerOpen ? '0 0 12px rgba(0, 245, 212, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={() => setIsMissionDrawerOpen(!isMissionDrawerOpen)}
            title="Toggle Mission Objectives & Cheatsheets (Alt+M)"
          >
            <span>🎯</span>
            <span>Mission Control</span>
          </button>

          <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-card)', margin: '0 4px' }} />

          {/* Operator Profile */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px 3px 4px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '20px'
                }}
                title={`Operator: ${user.username} (${user.role})`}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--cyber-cyan), var(--cyber-purple))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    color: '#050811',
                    fontSize: '0.75rem'
                  }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                    {user.username}
                  </span>
                  <span
                    style={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      color: user.role === 'ADMIN' ? 'var(--cyber-purple)' : 'var(--cyber-emerald)',
                      textTransform: 'uppercase'
                    }}
                  >
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsSignOutConfirmOpen(true)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.35)',
                  color: '#fb7185',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                title="Sign out of Cyber Range"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Terminal Viewport */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <TerminalComponent sessionId={sessionId} />
      </div>

      {/* Modal: Confirm Sign Out Dialog */}
      <ConfirmDialog
        isOpen={isSignOutConfirmOpen}
        title="Sign Out of Cyber Range?"
        message="Your interactive terminal session will continue running in its sandbox until its lease expires. Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Stay in Mission"
        type="danger"
        onConfirm={() => {
          setIsSignOutConfirmOpen(false);
          logout();
        }}
        onCancel={() => setIsSignOutConfirmOpen(false)}
      />

      {/* Mission Control Drawer (Portaled to document.body) */}
      {session && (
        <MissionDrawer
          labId={session.labId || session.lab?.id}
          labName={session.lab?.name}
          sessionId={sessionId}
          expiresAt={session.expiresAt}
          isOpen={isMissionDrawerOpen}
          onToggle={() => setIsMissionDrawerOpen(!isMissionDrawerOpen)}
        />
      )}
    </div>
  );
}
