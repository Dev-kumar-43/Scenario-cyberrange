'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import MissionDrawer from '@/components/MissionDrawer';
import SessionTimer from '@/components/SessionTimer';
import styles from '@/app/page.module.css';

interface CyberQuote {
  quote: string;
  author: string;
}

const CYBER_QUOTES: CyberQuote[] = [
  { quote: "Wrong turns teach Echo where you need help. Don't be afraid to try, fail, and try again.", author: "Cyber Range Echo" },
  { quote: "The quieter you become, the more you are able to hear.", author: "Kali Linux Philosophy" },
  { quote: "Reconnaissance is 90% of tactical operations. Map the perimeter before engaging.", author: "Red Team Manual" },
  { quote: "Every port is an open door until methodically audited, verified, and secured.", author: "Defensive Architecture" },
  { quote: "Root privileges are not given; they are systematically uncovered through persistence.", author: "Offensive Security" }
];

export default function DesktopPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { token, apiUrl, user, logout } = useAuth();
  const toast = useToast();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMissionDrawerOpen, setIsMissionDrawerOpen] = useState(false);

  // VNC Connection Telemetry State
  const [vncStatus, setVncStatus] = useState<'initializing' | 'connecting' | 'connected' | 'disconnected' | 'timeout'>('initializing');
  const [resizeMode, setResizeMode] = useState<'remote' | 'scale'>('remote');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);

  // Bi-directional Clipboard Bridge State
  const [kaliClipboard, setKaliClipboard] = useState<string>('');
  const [isClipboardModalOpen, setIsClipboardModalOpen] = useState(false);
  const [customPasteText, setCustomPasteText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Rotate cybersecurity quotes during loading
  useEffect(() => {
    if (vncStatus === 'connected') return;
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % CYBER_QUOTES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [vncStatus]);

  // Close more actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Session data from API
  useEffect(() => {
    if (!sessionId || !token) return;

    const fetchSession = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/labs/sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const current = (data.sessions || []).find((s: any) => s.id === sessionId);
          if (current) {
            setSession(current);
          } else {
            setErrorMsg('Session not found or already decommissioned.');
          }
        } else {
          setErrorMsg('Failed to load session details.');
        }
      } catch (err) {
        console.error('Failed to fetch session:', err);
        setErrorMsg('Network error connecting to orchestrator.');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [sessionId, token, apiUrl]);

  // Connection timeout watchdog (25s fallback)
  useEffect(() => {
    if (loading || !session || vncStatus === 'connected') return;

    const timeoutTimer = setTimeout(() => {
      setVncStatus((current) => (current === 'connected' ? current : 'timeout'));
    }, 25000);

    return () => clearTimeout(timeoutTimer);
  }, [loading, session, vncStatus, iframeKey]);

  // Listen to fullscreenchange events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Alt + M shortcut to toggle Mission Control drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setIsMissionDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Failed to exit fullscreen:', err);
      });
    }
  };

  const reloadViewport = () => {
    setVncStatus('connecting');
    setIframeKey((prev) => prev + 1);
    toast.info('Re-establishing display pipeline stream...');
  };

  // Fetch latest clipboard from Kali Linux container via direct API
  const fetchKaliClipboard = async (silent = false) => {
    if (!sessionId || !token) return;
    try {
      const res = await fetch(`${apiUrl}/api/labs/sessions/${sessionId}/clipboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim().length > 0 && data.text !== kaliClipboard) {
          setKaliClipboard(data.text);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(data.text).catch(() => {});
          }
          if (!silent) {
            const snippet = data.text.length > 40 ? data.text.slice(0, 40) + '...' : data.text;
            toast.info(`📋 Synced from Kali: "${snippet}"`);
          }
        }
      }
    } catch (_) {}
  };

  // Send clipboard text to Kali Linux (Dual-Channel: Direct K8s Pod Exec + noVNC PostMessage)
  const sendClipboardToKali = async (text: string) => {
    if (!text) return;
    const cleanText = text.replace(/\r\n/g, '\n');

    // 1. Direct Backend X11 Pod Injection (Guaranteed write into Kali X11 server)
    if (sessionId && token) {
      fetch(`${apiUrl}/api/labs/sessions/${sessionId}/clipboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: cleanText })
      }).catch((err) => {
        console.warn('Backend clipboard injection notice:', err);
      });
    }

    // 2. Transmit through noVNC WebSocket iframe bridge
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({
          type: 'KALI_CLIPBOARD_PASTE',
          text: cleanText
        }, '*');
      } catch (_) {}
    }
  };

  // Quick 1-Click Host-to-Kali Paste
  const handleQuickPaste = async () => {
    try {
      const hostText = await navigator.clipboard.readText();
      if (!hostText || hostText.trim().length === 0) {
        toast.warning('Host clipboard is empty. Copy text or commands first.');
        return;
      }
      await sendClipboardToKali(hostText);
      const snippet = hostText.length > 35 ? hostText.slice(0, 35) + '...' : hostText;
      toast.success(`📋 Pasted into Kali clipboard: "${snippet}"`);
    } catch (err) {
      setIsClipboardModalOpen(true);
    }
  };

  // Setup Bi-directional event listeners & Telemetry
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Telemetry from noVNC patch (connecting, connected, disconnected)
      if (event.data && event.data.type === 'VNC_STATUS' && typeof event.data.state === 'string') {
        const state = event.data.state;
        if (state === 'connected') {
          setVncStatus('connected');
        } else if (state === 'connecting' || state === 'reconnecting') {
          if (vncStatus !== 'connected') {
            setVncStatus('connecting');
          }
        } else if (state === 'disconnected') {
          setVncStatus('disconnected');
        }
      }

      // 2. Inbound clipboard from Kali Linux container
      if (event.data && event.data.type === 'KALI_CLIPBOARD_SYNC' && typeof event.data.text === 'string') {
        const incomingText = event.data.text;
        if (incomingText && incomingText.trim().length > 0 && incomingText !== kaliClipboard) {
          setKaliClipboard(incomingText);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(incomingText).catch(() => {});
          }
        }
      }

      // 3. Outbound clipboard from child components (e.g. MissionDrawer)
      if (event.data && (event.data.type === 'KALI_CLIPBOARD_PASTE' || event.data.type === 'VNC_CLIPBOARD_SEND') && typeof event.data.text === 'string') {
        if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) {
          sendClipboardToKali(event.data.text);
        }
      }
    };

    // Auto-sync text copied on host
    const handleHostCopy = () => {
      setTimeout(() => {
        try {
          const selection = window.getSelection()?.toString();
          if (selection && selection.trim().length > 0) {
            sendClipboardToKali(selection.trim());
          }
        } catch (_) {}
      }, 50);
    };

    const handleFocus = () => {
      fetchKaliClipboard(true);
    };

    window.addEventListener('message', handleMessage);
    document.addEventListener('copy', handleHostCopy);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('copy', handleHostCopy);
      window.removeEventListener('focus', handleFocus);
    };
  }, [sessionId, token, apiUrl, vncStatus, kaliClipboard]);

  // Build high-performance, dynamic resolution noVNC URL
  const getScaledVncUrl = (rawUrl: string | undefined, mode: 'remote' | 'scale' = resizeMode) => {
    if (!rawUrl) return '';
    try {
      const url = new URL(rawUrl);
      url.searchParams.set('autoconnect', 'true');
      // 'remote' dynamically negotiates true native 1:1 screen resolution via X11 RANDR
      url.searchParams.set('resize', mode);
      url.searchParams.set('quality', '9');
      url.searchParams.set('reconnect', 'true');
      url.searchParams.set('reconnect_delay', '1500');
      return url.toString();
    } catch {
      return rawUrl;
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050811', color: '#f8fafc' }}>
        <div style={{ width: '56px', height: '56px', border: '3px solid rgba(0, 245, 212, 0.2)', borderTopColor: 'var(--cyber-cyan)', borderRadius: '50%', animation: 'spin 1s infinite linear', marginBottom: '1.5rem' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
          Negotiating Workstation Sandbox
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Connecting to Kubernetes pod orchestrator...
        </p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050811', padding: '2rem' }}>
        <div className="cyber-glass-card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '480px', width: '100%' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: '#ffffff' }}>Session Unavailable</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
            {errorMsg || 'The requested lab instance is not running or has been decommissioned.'}
          </p>
          <button className={styles.button} onClick={() => router.push('/sessions')}>
            ← Return to Active Labs
          </button>
        </div>
      </div>
    );
  }

  const vncUrl = getScaledVncUrl(session.traefikUrl, resizeMode);
  const isRunning = session.status === 'RUNNING';

  return (
    <div 
      ref={containerRef}
      style={{ 
        height: '100vh', 
        width: '100%',
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#050811',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        overflow: 'hidden'
      }}
    >
      {/* Workstation Mission HUD Header - Integrated, Responsive, Non-colliding */}
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '12px',
        padding: '8px 16px',
        backgroundColor: 'rgba(9, 14, 26, 0.98)',
        borderBottom: '1px solid var(--border-card)',
        backdropFilter: 'blur(20px)',
        zIndex: 50,
        flexShrink: 0,
        height: '56px',
        width: '100%'
      }}>
        {/* Left Zone: Navigation, Lab Identity & Status */}
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
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onClick={() => router.push('/sessions')}
            title="Return to Active Sessions"
          >
            <span>←</span>
            <span>Labs</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '1.1rem' }}>🎯</span>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
              {session.lab?.name || 'Kali Linux Workstation'}
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
                backgroundColor: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                border: `1px solid ${isRunning ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                color: isRunning ? 'var(--cyber-emerald)' : '#60a5fa',
                flexShrink: 0
              }}
            >
              {isRunning && <span className="live-pulse-dot" style={{ width: '6px', height: '6px' }} />}
              <span>{session.status}</span>
            </span>
          </div>
        </div>

        {/* Center Zone: Session TTL Timer & Resolution Mode Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {session && (
            <SessionTimer
              sessionId={sessionId}
              expiresAt={session.expiresAt}
              startedAt={session.createdAt}
              onExtendSuccess={(newExp) => setSession((prev: any) => prev ? { ...prev, expiresAt: newExp } : prev)}
            />
          )}

          {/* Dynamic 1:1 Scale Badge */}
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              background: resizeMode === 'remote' ? 'rgba(0, 245, 212, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${resizeMode === 'remote' ? 'rgba(0, 245, 212, 0.3)' : 'var(--border-card)'}`,
              color: resizeMode === 'remote' ? 'var(--cyber-cyan)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
            title={resizeMode === 'remote' ? 'TigerVNC 1:1 Native Resolution Active (Icons/Text stay at 100% Scale)' : 'Bitmap Scaled View'}
          >
            <span>🖥️</span>
            <span>{resizeMode === 'remote' ? '1:1 Native Scale' : 'Scaled View'}</span>
          </span>
        </div>

        {/* Right Zone: Primary Actions + Operator Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Mission Control Button */}
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
            title="Toggle Mission Control Objectives & Cheatsheets (Alt+M)"
          >
            <span>🎯</span>
            <span>Mission Control</span>
          </button>

          {/* Quick Paste to Kali */}
          <button
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.2) 0%, rgba(59, 130, 246, 0.25) 100%)',
              border: '1px solid rgba(0, 245, 212, 0.5)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={handleQuickPaste}
            title="1-Click: Paste host clipboard directly into Kali Linux"
          >
            <span>📋</span>
            <span>Paste to Kali</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: '8px',
              background: isFullscreen ? 'rgba(0, 245, 212, 0.2)' : 'linear-gradient(135deg, #00f5d4 0%, #3b82f6 100%)',
              color: isFullscreen ? 'var(--cyber-cyan)' : '#050811',
              border: isFullscreen ? '1px solid rgba(0, 245, 212, 0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Native Fullscreen'}
          >
            <span>⛶</span>
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          {/* More Tools Dropdown */}
          <div style={{ position: 'relative' }} ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '8px',
                background: isMoreMenuOpen ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="Workstation Tools & Display Settings"
            >
              <span>⚙️</span>
              <span>Tools ▾</span>
            </button>

            {isMoreMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '240px',
                  backgroundColor: 'rgba(9, 14, 26, 0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 245, 212, 0.1)',
                  padding: '8px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <button
                  onClick={() => {
                    reloadViewport();
                    setIsMoreMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>🔄</span>
                  <span>Reload Display Stream</span>
                </button>

                <button
                  onClick={() => {
                    setIsClipboardModalOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>📋</span>
                  <span>Clipboard Bridge Hub</span>
                </button>

                <button
                  onClick={() => {
                    router.push(`/sessions/${sessionId}/terminal`);
                    setIsMoreMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: '#c4b5fd',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>💻</span>
                  <span>Interactive Terminal Shell</span>
                </button>

                <button
                  onClick={() => {
                    if (vncUrl) window.open(vncUrl, '_blank');
                    setIsMoreMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>↗</span>
                  <span>Open in Standalone Tab</span>
                </button>

                <div style={{ height: '1px', background: 'var(--border-card)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setResizeMode((prev) => (prev === 'remote' ? 'scale' : 'remote'));
                    setIframeKey((k) => k + 1);
                    setIsMoreMenuOpen(false);
                    toast.info(`Resolution mode changed to: ${resizeMode === 'remote' ? 'Scaled' : '1:1 Native RANDR'}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--cyber-cyan)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>🖥️</span>
                  <span>Mode: {resizeMode === 'remote' ? 'Switch to Scaled' : 'Switch to 1:1 Native'}</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-card)', margin: '0 4px' }} />

          {/* Integrated Student Profile & Sign Out - Non-colliding */}
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

      {/* Main Viewport Container */}
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        overflow: 'hidden', 
        backgroundColor: '#000000',
        width: '100%',
        height: '100%'
      }}>
        {/* TryHackMe-style High-Tech Loading HUD */}
        {vncStatus !== 'connected' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#050811',
              backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(0, 245, 212, 0.08) 0%, rgba(5, 8, 17, 0.95) 75%)',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            {vncStatus === 'timeout' ? (
              /* Timeout / Disconnected Fallback Card */
              <div className="cyber-glass-card" style={{ maxWidth: '520px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.75rem' }}>
                  Workstation Display Stream Unavailable
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  The remote display server did not complete the initial RFB handshake within the expected window. The pod may still be finishing initialization.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={reloadViewport}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #00f5d4 0%, #3b82f6 100%)',
                      border: 'none',
                      color: '#050811',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Retry Display Stream
                  </button>

                  <button
                    onClick={() => router.push(`/sessions/${sessionId}/terminal`)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      color: '#c4b5fd',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    💻 Switch to Terminal Shell
                  </button>

                  <button
                    onClick={() => router.push('/sessions')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-card)',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Labs
                  </button>
                </div>
              </div>
            ) : (
              /* Active Connecting Experience (Matching Reference Screenshot 2) */
              <div style={{ maxWidth: '580px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Glowing Spinner Ring */}
                <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '2rem' }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '3px solid rgba(0, 245, 212, 0.15)',
                      borderTopColor: 'var(--cyber-cyan)',
                      animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '10px',
                      borderRadius: '50%',
                      border: '2px dashed rgba(139, 92, 246, 0.4)',
                      animation: 'spin 3s linear infinite reverse'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem'
                    }}
                  >
                    ⚡
                  </div>
                </div>

                {/* Tactical Cyber Quote / Tip */}
                <p
                  style={{
                    fontSize: '0.92rem',
                    color: '#e2e8f0',
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                    marginBottom: '0.4rem',
                    minHeight: '44px',
                    transition: 'opacity 0.3s ease'
                  }}
                >
                  &ldquo;{CYBER_QUOTES[quoteIndex].quote}&rdquo;
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--cyber-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.8rem' }}>
                  — {CYBER_QUOTES[quoteIndex].author}
                </span>

                {/* Cyber Progress Indicator Bar */}
                <div style={{ width: '100%', maxWidth: '380px', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.8rem' }}>
                  <div
                    style={{
                      height: '100%',
                      width: '65%',
                      background: 'linear-gradient(90deg, #00f5d4 0%, #3b82f6 50%, #8b5cf6 100%)',
                      borderRadius: '4px',
                      animation: 'pulse-glow 1.5s infinite ease-in-out'
                    }}
                  />
                </div>

                {/* Technical Pipeline Checklist */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    textAlign: 'left',
                    background: 'rgba(13, 20, 36, 0.6)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    width: '100%',
                    maxWidth: '420px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Kubernetes Pod Sandbox:</span>
                    <span style={{ color: 'var(--cyber-emerald)', fontWeight: 700 }}>✓ Verified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>TigerVNC Display Server (RANDR):</span>
                    <span style={{ color: 'var(--cyber-emerald)', fontWeight: 700 }}>✓ Port 5900 Active</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>WebSocket Framebuffer Relay:</span>
                    <span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>● {vncStatus === 'connecting' ? 'Connecting...' : 'Synchronizing'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Native Display Resolution:</span>
                    <span style={{ color: 'var(--text-dim)' }}>100% 1:1 Scale Negotiation</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* The Live noVNC Framebuffer Iframe */}
        {isRunning && vncUrl && (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={vncUrl}
            title="Kali Linux Desktop Viewport"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              backgroundColor: '#000000',
              opacity: vncStatus === 'connected' ? 1 : 0,
              transition: 'opacity 0.4s ease'
            }}
            onLoad={() => {
              // Once iframe content loads, if telemetry doesn't arrive within 3 seconds, assume ready
              setTimeout(() => {
                if (vncStatus !== 'timeout') {
                  setVncStatus('connected');
                }
              }, 3000);
            }}
            allow="fullscreen; clipboard-read; clipboard-write"
          />
        )}
      </div>

      {/* Modal: Bi-directional Clipboard Bridge */}
      <Modal
        isOpen={isClipboardModalOpen}
        onClose={() => setIsClipboardModalOpen(false)}
        title="Bi-directional Clipboard Bridge"
        icon="📋"
        maxWidth="540px"
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cyber-cyan)' }}>
              SEND TEXT TO KALI (HOST → KALI)
            </label>
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) setCustomPasteText(text);
                } catch {}
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Paste from Host System
            </button>
          </div>

          <textarea
            rows={4}
            value={customPasteText}
            onChange={(e) => setCustomPasteText(e.target.value)}
            placeholder="Paste any command, reverse shell payload, script, or target URL here..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(5, 8, 17, 0.85)',
              border: '1px solid var(--border-card)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              lineHeight: 1.4,
              resize: 'vertical'
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => {
                if (customPasteText.trim()) {
                  sendClipboardToKali(customPasteText);
                  setIsClipboardModalOpen(false);
                  toast.success('Dispatched to Kali Linux clipboard!');
                }
              }}
              disabled={!customPasteText.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #00f5d4 0%, #3b82f6 100%)',
                color: '#050811',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: customPasteText.trim() ? 'pointer' : 'not-allowed',
                opacity: customPasteText.trim() ? 1 : 0.5
              }}
            >
              📋 Send to Kali Clipboard
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              RECEIVED FROM KALI (KALI → HOST)
            </span>
            {kaliClipboard && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(kaliClipboard).catch(() => {});
                  toast.success('Copied Kali clipboard to host system!');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cyber-emerald)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                📋 Copy to Host System
              </button>
            )}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              color: kaliClipboard ? '#f8fafc' : 'var(--text-dim)',
              maxHeight: '70px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {kaliClipboard || '(No text copied inside Kali yet)'}
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: '0.76rem', color: '#c4b5fd', lineHeight: 1.5 }}>
          <div>💡 <strong>In Kali Terminal:</strong> Press <code>Ctrl+Shift+V</code> or <em>Right-Click → Paste</em> to paste commands.</div>
          <div>💡 <strong>Copy from Kali Terminal:</strong> Highlight text with mouse and press <code>Ctrl+Shift+C</code> or <em>Right-Click → Copy</em>.</div>
        </div>
      </Modal>

      {/* Modal: Confirm Sign Out Dialog */}
      <ConfirmDialog
        isOpen={isSignOutConfirmOpen}
        title="Sign Out of Cyber Range?"
        message="Your active Kali Linux workstation will continue running safely in its sandbox until its TTL lease expires. Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Stay in Mission"
        type="danger"
        onConfirm={() => {
          setIsSignOutConfirmOpen(false);
          logout();
        }}
        onCancel={() => setIsSignOutConfirmOpen(false)}
      />

      {/* Mission Control In-Lab HUD Drawer (Portaled with Fullscreen Support) */}
      <MissionDrawer
        labId={session.labId || session.lab?.id}
        labName={session.lab?.name}
        sessionId={sessionId}
        expiresAt={session.expiresAt}
        isOpen={isMissionDrawerOpen}
        onToggle={() => setIsMissionDrawerOpen(!isMissionDrawerOpen)}
        onCopyToKali={(cmd) => sendClipboardToKali(cmd)}
        portalContainer={containerRef.current}
      />
    </div>
  );
}
