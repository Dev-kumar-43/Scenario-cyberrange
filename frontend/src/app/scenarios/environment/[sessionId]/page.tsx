'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import MissionDrawer from '@/components/MissionDrawer';
import SessionTimer from '@/components/SessionTimer';
import TerminalComponent from '@/components/Terminal';
import styles from './environment.module.css';

interface MachineData {
  id: string;
  name: string;
  role: 'ATTACKER' | 'TARGET';
  roleTitle: string;
  hostname: string;
  phase: string;
  ready: boolean;
  internalIp: string;
  desktopUrl: string;
  terminalMachineId: string;
}

interface CyberQuote {
  quote: string;
  author: string;
}

const CYBER_QUOTES: CyberQuote[] = [
  { quote: "Subnet reconnaissance is the cornerstone of any tactical offensive operation.", author: "Red Team Field Manual" },
  { quote: "An isolated environment guarantees absolute safety while conducting zero-leakage security audits.", author: "Cyber Range Architecture" },
  { quote: "Enumerate before you exploit. Every open port tells a story.", author: "Offensive Security Principles" },
  { quote: "Controlled attack vectors allow deep forensic inspection without operational compromise.", author: "Threat Analysis Guide" },
  { quote: "Persistence and precision turn reconnaissance into actionable intel.", author: "Kali Linux Philosophy" }
];

export default function ScenarioEnvironmentPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { token, apiUrl, user, logout } = useAuth();
  const toast = useToast();

  // Core Scenario Session State
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Machine & View Navigation
  const [activeMachine, setActiveMachine] = useState<'kali' | 'ubuntu'>('kali');
  const [activeViewMode, setActiveViewMode] = useState<'single' | 'split'>('single');

  // BEC 3-Tab Workspace State
  const [becActiveTab, setBecActiveTab] = useState<'desktop' | 'webmail' | 'browser'>('desktop');

  // Display & Telemetry
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [resizeMode, setResizeMode] = useState<'remote' | 'scale'>('remote');
  const [kaliVncStatus, setKaliVncStatus] = useState<'initializing' | 'connecting' | 'connected' | 'disconnected' | 'timeout'>('initializing');
  const [ubuntuVncStatus, setUbuntuVncStatus] = useState<'initializing' | 'connecting' | 'connected' | 'disconnected' | 'timeout'>('initializing');
  const [iframeKeyKali, setIframeKeyKali] = useState<number>(0);
  const [iframeKeyUbuntu, setIframeKeyUbuntu] = useState<number>(0);
  const [iframeKeyWebmail, setIframeKeyWebmail] = useState<number>(0);
  const [iframeKeyBrowser, setIframeKeyBrowser] = useState<number>(0);
  const [quoteIndex, setQuoteIndex] = useState<number>(0);

  // Drawers & Modals
  const [isMissionDrawerOpen, setIsMissionDrawerOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState<boolean>(false);
  const [terminalActiveTab, setTerminalActiveTab] = useState<'kali' | 'ubuntu'>('kali');
  const [isClipboardModalOpen, setIsClipboardModalOpen] = useState<boolean>(false);
  const [customPasteText, setCustomPasteText] = useState<string>('');
  const [machineClipboard, setMachineClipboard] = useState<string>('');
  const [isTerminateConfirmOpen, setIsTerminateConfirmOpen] = useState<boolean>(false);
  const [terminating, setTerminating] = useState<boolean>(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState<boolean>(false);

  // Live Verification Audit State
  const [verifying, setVerifying] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  // DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const kaliIframeRef = useRef<HTMLIFrameElement>(null);
  const ubuntuIframeRef = useRef<HTMLIFrameElement>(null);
  const webmailIframeRef = useRef<HTMLIFrameElement>(null);
  const browserIframeRef = useRef<HTMLIFrameElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);


  // Rotate quotes during initial handshake
  useEffect(() => {
    if (kaliVncStatus === 'connected' && ubuntuVncStatus === 'connected') return;
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % CYBER_QUOTES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [kaliVncStatus, ubuntuVncStatus]);

  // Click outside to close tools menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll scenario status from API
  useEffect(() => {
    if (!sessionId || !token) return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/scenarios/sessions/${sessionId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          setStatusData(data);
          if (data.status === 'STOPPED') {
            toast.info('This scenario environment has been decommissioned.');
            router.push('/scenarios');
          }
        } else if (res.status === 404) {
          setErrorMsg('Scenario session not found or already decommissioned.');
        }
      } catch (err) {
        console.warn('Status poll error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, token, apiUrl, router, toast]);

  // Keyboard Navigation: Alt+M, 1 for Desktop/Kali, 2 for Webmail/Ubuntu, 3 for Browser/Split
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in textarea or input
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      const isBec = statusData?.scenarioId === 'bec-investigation' ||
        statusData?.labName?.includes('Business Email') ||
        statusData?.labName?.includes('BEC');

      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setIsMissionDrawerOpen((prev) => !prev);
      } else if (e.key === '1') {
        if (isBec) {
          setBecActiveTab('desktop');
        } else {
          setActiveViewMode('single');
          setActiveMachine('kali');
        }
      } else if (e.key === '2') {
        if (isBec) {
          setBecActiveTab('webmail');
        } else {
          setActiveViewMode('single');
          setActiveMachine('ubuntu');
        }
      } else if (e.key === '3') {
        if (isBec) {
          setBecActiveTab('browser');
        } else {
          setActiveViewMode('split');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [statusData]);

  // Track Fullscreen status
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

  const reloadActiveViewport = () => {
    const isBec = statusData?.scenarioId === 'bec-investigation' ||
      statusData?.labName?.includes('Business Email') ||
      statusData?.labName?.includes('BEC');

    if (isBec) {
      if (becActiveTab === 'desktop') {
        setKaliVncStatus('connecting');
        setIframeKeyKali((k) => k + 1);
        toast.info('Reloading Analyst Desktop workstation stream...');
      } else if (becActiveTab === 'webmail') {
        setIframeKeyWebmail((k) => k + 1);
        toast.info('Reloading Webmail client...');
      } else if (becActiveTab === 'browser') {
        setIframeKeyBrowser((k) => k + 1);
        toast.info('Reloading Intranet portal...');
      }
      return;
    }

    if (activeMachine === 'kali' || activeViewMode === 'split') {
      setKaliVncStatus('connecting');
      setIframeKeyKali((k) => k + 1);
    }
    if (activeMachine === 'ubuntu' || activeViewMode === 'split') {
      setUbuntuVncStatus('connecting');
      setIframeKeyUbuntu((k) => k + 1);
    }
    toast.info('Reloading workstation display stream...');
  };

  // Dispatch clipboard text to active container
  const sendClipboardToMachine = async (text: string, targetMachine: 'kali' | 'ubuntu' = activeMachine) => {
    if (!text || !sessionId || !token) return;
    const cleanText = text.replace(/\r\n/g, '\n');

    // 1. Backend injection targeting specific pod container
    try {
      fetch(`${apiUrl}/api/labs/sessions/${sessionId}/clipboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: cleanText, machine: targetMachine })
      }).catch(() => {});
    } catch (_) {}

    // 2. Iframe postMessage bridge
    const iframeRef = targetMachine === 'kali' ? kaliIframeRef : ubuntuIframeRef;
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({
          type: 'KALI_CLIPBOARD_PASTE',
          text: cleanText
        }, '*');
      } catch (_) {}
    }
  };

  // Fetch clipboard from active machine
  const fetchMachineClipboard = async (silent = false, targetMachine: 'kali' | 'ubuntu' = activeMachine) => {
    if (!sessionId || !token) return;
    try {
      const res = await fetch(`${apiUrl}/api/labs/sessions/${sessionId}/clipboard?machine=${targetMachine}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim().length > 0) {
          setMachineClipboard(data.text);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(data.text).catch(() => {});
          }
          if (!silent) {
            const snippet = data.text.length > 40 ? data.text.slice(0, 40) + '...' : data.text;
            toast.info(`📋 Synced from ${targetMachine === 'kali' ? 'Kali' : 'Ubuntu'}: "${snippet}"`);
          }
        }
      }
    } catch (_) {}
  };

  // 1-Click Host-to-Machine Quick Paste
  const handleQuickPaste = async () => {
    try {
      const hostText = await navigator.clipboard.readText();
      if (!hostText || hostText.trim().length === 0) {
        toast.warning('Host clipboard is empty. Copy text or command first.');
        return;
      }
      await sendClipboardToMachine(hostText, activeMachine);
      const snippet = hostText.length > 35 ? hostText.slice(0, 35) + '...' : hostText;
      const machineName = activeMachine === 'kali' ? 'Kali Linux (Attacker)' : 'Ubuntu Linux (Target)';
      toast.success(`📋 Pasted into ${machineName}: "${snippet}"`);
    } catch (err) {
      setIsClipboardModalOpen(true);
    }
  };

  // Run Live Network Isolation Verification
  const handleRunVerification = async () => {
    try {
      setVerifying(true);
      setIsAuditModalOpen(true);
      const res = await fetch(`${apiUrl}/api/scenarios/sessions/${sessionId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setAuditResult(data);
        toast.success('Live network isolation audit completed.');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to verify connectivity.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      toast.error('Network verification probe failed.');
    } finally {
      setVerifying(false);
    }
  };

  // Terminate Entire Scenario Environment
  const handleTerminateEnvironment = async () => {
    try {
      setTerminating(true);
      const res = await fetch(`${apiUrl}/api/scenarios/sessions/${sessionId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });

      if (res.ok) {
        toast.success('Scenario environment decommissioned successfully.');
        router.push('/scenarios');
      } else {
        toast.error('Failed to terminate scenario.');
      }
    } catch (err) {
      console.error('Teardown error:', err);
      toast.error('Network error during environment termination.');
    } finally {
      setTerminating(false);
      setIsTerminateConfirmOpen(false);
    }
  };

  // Scenario Type Detection
  const isBecScenario = statusData?.scenarioId === 'bec-investigation' ||
    statusData?.labName?.includes('Business Email') ||
    statusData?.labName?.includes('BEC');

  // Resolve Machines & Access URLs
  const machines: MachineData[] = statusData?.machines || [];
  const kaliMachine = machines.find((m) => m.id === 'kali');
  const ubuntuMachine = machines.find((m) => m.id === 'ubuntu');

  const normalizeServiceUrl = (rawUrl: string, defaultResize?: string) => {
    if (!rawUrl) return '';
    try {
      const u = new URL(rawUrl);
      if (defaultResize) {
        u.searchParams.set('resize', resizeMode === 'scale' ? 'scale' : 'remote');
      }
      return u.toString();
    } catch {
      return rawUrl;
    }
  };

  const rawKaliUrl = kaliMachine?.desktopUrl || '';
  const rawUbuntuUrl = ubuntuMachine?.desktopUrl || '';

  const kaliUrl = useMemo(() => {
    return normalizeServiceUrl(rawKaliUrl, 'remote');
  }, [rawKaliUrl, resizeMode]);

  const ubuntuUrl = useMemo(() => {
    return normalizeServiceUrl(rawUbuntuUrl, 'remote');
  }, [rawUbuntuUrl, resizeMode]);

  const becDesktopUrl = useMemo(() => {
    const raw = statusData?.desktopUrl || kaliMachine?.desktopUrl || '';
    return normalizeServiceUrl(raw, 'remote');
  }, [statusData?.desktopUrl, kaliMachine?.desktopUrl, resizeMode]);

  const becWebmailUrl = useMemo(() => {
    const raw = statusData?.webmailUrl || machines.find((m) => m.id === 'mailpit')?.desktopUrl || '';
    return normalizeServiceUrl(raw);
  }, [statusData?.webmailUrl, machines]);

  const becBrowserUrl = useMemo(() => {
    const raw = statusData?.browserUrl || machines.find((m) => m.id === 'gophish')?.desktopUrl || '';
    return normalizeServiceUrl(raw);
  }, [statusData?.browserUrl, machines]);

  const isRunning = statusData?.status === 'RUNNING' || statusData?.ready;

  return (
    <div className={styles.environmentContainer} ref={containerRef}>
      {/* 54px Production Topbar Matching Single Kali Screenshot */}
      <header className={styles.topBar}>
        {/* Left Zone: Return to Scenarios, Title, Status Badges */}
        <div className={styles.topBarLeft}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/scenarios')}
            title="Return to Scenario Catalog"
          >
            <span>←</span>
            <span>Scenarios</span>
          </button>

          <div className={styles.titleGroup}>
            <span style={{ fontSize: '1.1rem' }}>{isBecScenario ? '✉️' : '🎯'}</span>
            <span
              className={styles.scenarioTitle}
              title={statusData?.labName || (isBecScenario ? 'Business Email Compromise (BEC) & Phishing Triage' : 'Controlled Network Attack')}
            >
              {statusData?.labName || (isBecScenario ? 'Business Email Compromise (BEC) & Phishing Triage' : 'Controlled Network Attack')}
            </span>
            <span className={styles.badgeRunning}>
              {isRunning && <span className={styles.livePulseDot} />}
              <span>{statusData?.status || 'RUNNING'}</span>
            </span>
            <span className={styles.badgeIsolated} title="NetworkPolicy Active: Zero Public Egress">
              <span>🔒</span>
              <span>Zero-Egress Isolated</span>
            </span>
          </div>

          {/* DUAL-MACHINE OR BEC 3-TAB SWITCHER */}
          {isBecScenario ? (
            <div className={styles.becTabsGroup}>
              {/* Desktop Tab */}
              <button
                className={`${styles.becTabBtn} ${becActiveTab === 'desktop' ? styles.becTabBtnActiveDesktop : ''}`}
                onClick={() => setBecActiveTab('desktop')}
                title="Switch to Analyst Desktop Workstation [Press 1]"
              >
                <span>🖥️</span>
                <span>Desktop</span>
                <span className={styles.becTabPortBadge}>6901</span>
              </button>

              {/* Webmail Tab */}
              <button
                className={`${styles.becTabBtn} ${becActiveTab === 'webmail' ? styles.becTabBtnActiveWebmail : ''}`}
                onClick={() => setBecActiveTab('webmail')}
                title="Switch to Mailpit Webmail Client [Press 2]"
              >
                <span>✉️</span>
                <span>Webmail</span>
                <span className={styles.becTabPortBadge}>8025</span>
              </button>

              {/* Browser Tab */}
              <button
                className={`${styles.becTabBtn} ${becActiveTab === 'browser' ? styles.becTabBtnActiveBrowser : ''}`}
                onClick={() => setBecActiveTab('browser')}
                title="Switch to Apex Intranet & Inbox Rule Auditor [Press 3]"
              >
                <span>🌐</span>
                <span>Browser</span>
                <span className={styles.becTabPortBadge}>8080</span>
              </button>
            </div>
          ) : (
            <div className={styles.machineSwitcher}>
              {/* Kali Linux Attacker Button */}
              <button
                className={`${styles.machineSwitchBtn} ${activeViewMode === 'single' && activeMachine === 'kali' ? styles.machineSwitchBtnActiveKali : ''}`}
                onClick={() => {
                  setActiveViewMode('single');
                  setActiveMachine('kali');
                }}
                title="Switch view to Kali Linux (Attacker Workstation) [Press 1]"
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: activeMachine === 'kali' ? '0 0 8px #ef4444' : 'none' }} />
                <span>Kali Linux</span>
                <span className={styles.tagAttacker}>ATTACKER</span>
                {kaliMachine?.internalIp && (
                  <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.45)', marginLeft: '2px' }}>
                    {kaliMachine.internalIp}
                  </span>
                )}
              </button>

              {/* Ubuntu Linux Target Button */}
              <button
                className={`${styles.machineSwitchBtn} ${activeViewMode === 'single' && activeMachine === 'ubuntu' ? styles.machineSwitchBtnActiveUbuntu : ''}`}
                onClick={() => {
                  setActiveViewMode('single');
                  setActiveMachine('ubuntu');
                }}
                title="Switch view to Ubuntu Linux (Target System) [Press 2]"
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7', boxShadow: activeMachine === 'ubuntu' ? '0 0 8px #0284c7' : 'none' }} />
                <span>Ubuntu Linux</span>
                <span className={styles.tagTarget}>TARGET</span>
                {ubuntuMachine?.internalIp && (
                  <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.45)', marginLeft: '2px' }}>
                    {ubuntuMachine.internalIp}
                  </span>
                )}
              </button>

              <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.12)', margin: '0 2px' }} />

              {/* Lock / Split Screen Toggle */}
              <button
                className={`${styles.lockToggleBtn} ${activeViewMode === 'split' ? styles.lockToggleBtnActive : ''}`}
                onClick={() => setActiveViewMode((prev) => (prev === 'single' ? 'split' : 'single'))}
                title={activeViewMode === 'single' ? 'Locked to single machine view (Click to toggle Side-by-Side Split View [Press 3])' : 'Split View active (Click to Lock to active machine)'}
              >
                <span>{activeViewMode === 'single' ? '🔒 Locked' : '◫ Split View'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Center Zone: Session TTL Timer & 1:1 Scale Badge */}
        <div className={styles.topBarCenter}>
          {statusData && (
            <SessionTimer
              sessionId={sessionId}
              expiresAt={statusData.expiresAt}
              startedAt={statusData.startedAt}
              onExtendSuccess={(newExp) => setStatusData((prev: any) => prev ? { ...prev, expiresAt: newExp } : prev)}
            />
          )}

          <span
            className={styles.scaleBadge}
            onClick={() => {
              setResizeMode((prev) => (prev === 'remote' ? 'scale' : 'remote'));
              toast.info(`Resolution mode: ${resizeMode === 'remote' ? 'Scaled' : '1:1 Native Scale'}`);
            }}
            title={resizeMode === 'remote' ? '1:1 Native Resolution Active (Icons/Text stay crisp)' : 'Scaled View Active'}
          >
            <span>🖥️</span>
            <span>{resizeMode === 'remote' ? '1:1 Native Scale' : 'Scaled View'}</span>
          </span>
        </div>

        {/* Right Zone: Mission Control, Paste, Terminal, Fullscreen, Tools, User Profile */}
        <div className={styles.topBarRight}>
          {/* Mission Control Button */}
          <button
            className={`${styles.missionBtn} ${isMissionDrawerOpen ? styles.missionBtnActive : ''}`}
            onClick={() => setIsMissionDrawerOpen(!isMissionDrawerOpen)}
            title="Toggle Mission Control Objectives & Intelligence (Alt+M)"
          >
            <span>🎯</span>
            <span>Mission Control</span>
          </button>

          {/* Quick Paste to Active Machine */}
          <button
            className={styles.pasteBtn}
            onClick={handleQuickPaste}
            title={`1-Click: Paste host clipboard into ${activeMachine === 'kali' ? 'Kali Linux' : 'Ubuntu Linux'}`}
          >
            <span>📋</span>
            <span>Paste to {activeMachine === 'kali' ? 'Kali' : 'Ubuntu'}</span>
          </button>

          {/* Terminal Launcher */}
          <button
            className={styles.terminalBtn}
            onClick={() => {
              setTerminalActiveTab(activeMachine);
              setIsTerminalModalOpen(true);
            }}
            title="Open Interactive Shell Terminal for scenario machines"
          >
            <span>💻</span>
            <span>Terminal</span>
          </button>

          {/* Live Network Isolation Audit */}
          <button
            className={styles.auditBtn}
            onClick={handleRunVerification}
            disabled={verifying}
            title="Audit zero-egress NetworkPolicy and internal cross-machine connectivity"
          >
            <span>🛡️</span>
            <span>{verifying ? 'Auditing...' : 'Audit Isolation'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            className={styles.fullscreenBtn}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Native Fullscreen'}
          >
            <span>⛶</span>
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>

          {/* More Tools Menu */}
          <div style={{ position: 'relative' }} ref={moreMenuRef}>
            <button
              className={styles.toolsBtn}
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              title="Workstation Display & Scenario Tools"
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
                  width: '260px',
                  backgroundColor: 'rgba(9, 14, 26, 0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-card, rgba(255, 255, 255, 0.15))',
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
                    reloadActiveViewport();
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
                    color: '#f8fafc',
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
                    color: '#f8fafc',
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
                    const activeUrl = activeMachine === 'kali' ? kaliUrl : ubuntuUrl;
                    if (activeUrl) window.open(activeUrl, '_blank');
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
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>↗</span>
                  <span>Open {activeMachine === 'kali' ? 'Kali' : 'Ubuntu'} in New Tab</span>
                </button>

                <button
                  onClick={() => {
                    setActiveViewMode((prev) => (prev === 'single' ? 'split' : 'single'));
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
                    color: '#60a5fa',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>◫</span>
                  <span>{activeViewMode === 'single' ? 'Switch to Split Screen' : 'Lock to Single View'}</span>
                </button>

                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setIsTerminateConfirmOpen(true);
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
                    color: '#fb7185',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>⚠️</span>
                  <span>Terminate Scenario Environment</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

          {/* Student Profile Pill & Sign Out */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={styles.userPill} title={`Operator: ${user.username} (${user.role})`}>
                <div className={styles.avatar}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                    {user.username}
                  </span>
                  <span style={{ fontSize: '0.55rem', fontWeight: 800, color: user.role === 'ADMIN' ? '#c084fc' : '#10b981', textTransform: 'uppercase' }}>
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                className={styles.signOutBtn}
                onClick={() => setIsSignOutConfirmOpen(true)}
                title="Sign out of Cyber Range"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Viewport Container (100% Width & Height) */}
      <div className={styles.viewportContainer}>
        {/* Loading / Handshake HUD */}
        {loading && (
          <div className={styles.loadingHud}>
            <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse-glow 2s infinite' }}>⚡</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
                {isBecScenario
                  ? 'Initializing BEC & Phishing Incident Response Sandbox'
                  : 'Initializing Controlled Network Attack Environment'}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5, marginBottom: '1.5rem', fontStyle: 'italic' }}>
                &ldquo;{CYBER_QUOTES[quoteIndex].quote}&rdquo;
              </p>
              <span style={{ fontSize: '0.7rem', color: '#00f5d4', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '1.5rem' }}>
                — {CYBER_QUOTES[quoteIndex].author}
              </span>

              {/* Progress bar */}
              <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #00f5d4, #3b82f6, #8b5cf6)', animation: 'pulse-glow 1.5s infinite' }} />
              </div>

              {/* Checklist */}
              <div style={{ background: 'rgba(13, 20, 36, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Dedicated Namespace Sandbox:</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Verified</span>
                </div>
                {isBecScenario ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Incident Response Workstation (6901):</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Ready</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Mailpit Webmail Engine (8025):</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Ready</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Apex Intranet & Rule Auditor (8080):</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Ready</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Kali Attacker Workstation:</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Ready</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Ubuntu Target Node:</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Ready</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Zero-Egress Isolation Policy:</span>
                  <span style={{ color: '#00f5d4', fontWeight: 700 }}>● Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            BEC INVESTIGATION: 3-TAB ZERO-UNMOUNT WORKSPACE
            ======================================================= */}
        {isBecScenario ? (
          <div className={styles.becWorkspaceContainer}>
            {/* 1. Desktop Tab: Analyst Kali XFCE Workstation (Port 6901) */}
            <div
              className={styles.becViewportPane}
              style={{ display: becActiveTab === 'desktop' ? 'flex' : 'none' }}
            >
              {becDesktopUrl ? (
                <iframe
                  ref={kaliIframeRef}
                  key={`bec-desktop-${becDesktopUrl}-${iframeKeyKali}`}
                  src={becDesktopUrl}
                  title="Analyst Desktop Workstation"
                  className={styles.desktopIframeSingle}
                  onLoad={() => setKaliVncStatus('connected')}
                  allow="fullscreen; clipboard-read; clipboard-write"
                />
              ) : (
                <div className={styles.emptyViewportNotice}>
                  <div style={{ fontSize: '2rem', animation: 'pulse-glow 1.5s infinite' }}>⚡</div>
                  <span>Connecting to Analyst IR Desktop Workstation (Port 6901)...</span>
                </div>
              )}
            </div>

            {/* 2. Webmail Tab: Mailpit Mock Mail Server (Port 8025) */}
            <div
              className={styles.becViewportPane}
              style={{ display: becActiveTab === 'webmail' ? 'flex' : 'none' }}
            >
              {/* LabEx In-Browser Mini Address Bar */}
              <div className={styles.browserAddressBar}>
                <div className={styles.browserNavControls}>
                  <button
                    className={styles.browserNavBtn}
                    title="Back"
                    onClick={() => {
                      try {
                        webmailIframeRef.current?.contentWindow?.history.back();
                      } catch {}
                    }}
                  >
                    ‹
                  </button>
                  <button
                    className={styles.browserNavBtn}
                    title="Forward"
                    onClick={() => {
                      try {
                        webmailIframeRef.current?.contentWindow?.history.forward();
                      } catch {}
                    }}
                  >
                    ›
                  </button>
                  <button
                    className={styles.browserNavBtn}
                    title="Reload Webmail Client"
                    onClick={() => setIframeKeyWebmail((k) => k + 1)}
                  >
                    ↻
                  </button>
                </div>

                <div className={styles.browserPortPill}>
                  <span className={styles.browserPortDot} style={{ color: '#0284c7', backgroundColor: '#0284c7' }} />
                  <span>port: 8025</span>
                </div>

                <div className={styles.browserUrlField}>
                  <span className={styles.browserLockIcon}>🔒</span>
                  <span className={styles.browserUrlText}>{becWebmailUrl || 'http://mail-server:8025/'}</span>
                </div>

                <div className={styles.browserActions}>
                  <button
                    className={styles.browserActionBtn}
                    title="Copy Webmail URL"
                    onClick={() => {
                      if (becWebmailUrl) {
                        navigator.clipboard.writeText(becWebmailUrl);
                        toast.success('Webmail URL copied to clipboard');
                      }
                    }}
                  >
                    <span>📋</span>
                    <span>Copy URL</span>
                  </button>
                  <button
                    className={styles.browserActionBtn}
                    title="Open Webmail in New Tab"
                    onClick={() => {
                      if (becWebmailUrl) window.open(becWebmailUrl, '_blank');
                    }}
                  >
                    <span>↗</span>
                    <span>Open External</span>
                  </button>
                </div>
              </div>

              {becWebmailUrl ? (
                <iframe
                  ref={webmailIframeRef}
                  key={`bec-webmail-${becWebmailUrl}-${iframeKeyWebmail}`}
                  src={becWebmailUrl}
                  title="Corporate Webmail Service"
                  className={styles.desktopIframeSingle}
                  allow="fullscreen; clipboard-read; clipboard-write"
                />
              ) : (
                <div className={styles.emptyViewportNotice}>
                  <div style={{ fontSize: '2rem', animation: 'pulse-glow 1.5s infinite' }}>✉️</div>
                  <span>Connecting to Corporate Mailpit Webmail Service (Port 8025)...</span>
                </div>
              )}
            </div>

            {/* 3. Browser Tab: Apex Intranet & Inbox Rule Auditor (Port 8080) */}
            <div
              className={styles.becViewportPane}
              style={{ display: becActiveTab === 'browser' ? 'flex' : 'none' }}
            >
              {/* LabEx In-Browser Mini Address Bar */}
              <div className={styles.browserAddressBar}>
                <div className={styles.browserNavControls}>
                  <button
                    className={styles.browserNavBtn}
                    title="Back"
                    onClick={() => {
                      try {
                        browserIframeRef.current?.contentWindow?.history.back();
                      } catch {}
                    }}
                  >
                    ‹
                  </button>
                  <button
                    className={styles.browserNavBtn}
                    title="Forward"
                    onClick={() => {
                      try {
                        browserIframeRef.current?.contentWindow?.history.forward();
                      } catch {}
                    }}
                  >
                    ›
                  </button>
                  <button
                    className={styles.browserNavBtn}
                    title="Reload Intranet Portal"
                    onClick={() => setIframeKeyBrowser((k) => k + 1)}
                  >
                    ↻
                  </button>
                </div>

                <div className={styles.browserPortPill}>
                  <span className={styles.browserPortDot} style={{ color: '#00f5d4', backgroundColor: '#00f5d4' }} />
                  <span>port: 8080</span>
                </div>

                <div className={styles.browserUrlField}>
                  <span className={styles.browserLockIcon}>🔒</span>
                  <span className={styles.browserUrlText}>{becBrowserUrl || 'http://phish-engine:8080/'}</span>
                </div>

                <div className={styles.browserActions}>
                  <button
                    className={styles.browserActionBtn}
                    title="Copy Portal URL"
                    onClick={() => {
                      if (becBrowserUrl) {
                        navigator.clipboard.writeText(becBrowserUrl);
                        toast.success('Intranet URL copied to clipboard');
                      }
                    }}
                  >
                    <span>📋</span>
                    <span>Copy URL</span>
                  </button>
                  <button
                    className={styles.browserActionBtn}
                    title="Open Intranet Portal in New Tab"
                    onClick={() => {
                      if (becBrowserUrl) window.open(becBrowserUrl, '_blank');
                    }}
                  >
                    <span>↗</span>
                    <span>Open External</span>
                  </button>
                </div>
              </div>

              {becBrowserUrl ? (
                <iframe
                  ref={browserIframeRef}
                  key={`bec-browser-${becBrowserUrl}-${iframeKeyBrowser}`}
                  src={becBrowserUrl}
                  title="Apex Intranet & Inbox Rule Auditor"
                  className={styles.desktopIframeSingle}
                  allow="fullscreen; clipboard-read; clipboard-write"
                />
              ) : (
                <div className={styles.emptyViewportNotice}>
                  <div style={{ fontSize: '2rem', animation: 'pulse-glow 1.5s infinite' }}>🌐</div>
                  <span>Connecting to Apex Corporate Intranet & Inbox Rule Auditor (Port 8080)...</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =======================================================
             CONTROLLED NETWORK ATTACK: DUAL-MACHINE WORKSPACE
             ======================================================= */
          <>
            {/* SINGLE WORKSTATION VIEW (0ms INSTANT TOGGLE VIA DISPLAY NONE) */}
            {activeViewMode === 'single' && (
              <>
                {kaliUrl && (
                  <iframe
                    ref={kaliIframeRef}
                    key={`kali-${iframeKeyKali}`}
                    src={kaliUrl}
                    title="Kali Linux Desktop Viewport"
                    className={styles.desktopIframeSingle}
                    style={{
                      display: activeMachine === 'kali' ? 'block' : 'none'
                    }}
                    onLoad={() => setKaliVncStatus('connected')}
                    allow="fullscreen; clipboard-read; clipboard-write"
                  />
                )}

                {ubuntuUrl && (
                  <iframe
                    ref={ubuntuIframeRef}
                    key={`ubuntu-${iframeKeyUbuntu}`}
                    src={ubuntuUrl}
                    title="Ubuntu Linux Desktop Viewport"
                    className={styles.desktopIframeSingle}
                    style={{
                      display: activeMachine === 'ubuntu' ? 'block' : 'none'
                    }}
                    onLoad={() => setUbuntuVncStatus('connected')}
                    allow="fullscreen; clipboard-read; clipboard-write"
                  />
                )}
              </>
            )}

            {/* DUAL SPLIT-SCREEN VIEW (SIDE-BY-SIDE SIMULTANEOUS OPERATION) */}
            {activeViewMode === 'split' && (
              <div className={styles.splitLayout}>
                {/* Left Pane: Kali Linux Attacker */}
                <div className={styles.splitPane} style={{ borderRight: '1px solid rgba(239, 68, 68, 0.4)' }}>
                  <div className={styles.splitPaneHeader} style={{ background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(9, 14, 26, 0.95))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                      <span style={{ color: '#ffffff' }}>Kali Linux (Attacker Workstation)</span>
                      <span className={styles.tagAttacker}>ATTACKER</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>IP: {kaliMachine?.internalIp || '10.42.0.x'}</span>
                      <button
                        onClick={() => {
                          setActiveViewMode('single');
                          setActiveMachine('kali');
                        }}
                        style={{ background: 'none', border: 'none', color: '#00f5d4', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}
                      >
                        Focus ⛶
                      </button>
                    </div>
                  </div>

                  {kaliUrl ? (
                    <iframe
                      ref={kaliIframeRef}
                      key={`split-kali-${iframeKeyKali}`}
                      src={kaliUrl}
                      title="Kali Linux Split View"
                      className={styles.splitIframe}
                      allow="fullscreen; clipboard-read; clipboard-write"
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                      Loading Kali workstation stream...
                    </div>
                  )}
                </div>

                {/* Right Pane: Ubuntu Linux Target */}
                <div className={styles.splitPane} style={{ borderLeft: '1px solid rgba(2, 132, 199, 0.4)' }}>
                  <div className={styles.splitPaneHeader} style={{ background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.15), rgba(9, 14, 26, 0.95))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7' }} />
                      <span style={{ color: '#ffffff' }}>Ubuntu Linux (Target Node)</span>
                      <span className={styles.tagTarget}>TARGET</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>IP: {ubuntuMachine?.internalIp || '10.42.0.y'}</span>
                      <button
                        onClick={() => {
                          setActiveViewMode('single');
                          setActiveMachine('ubuntu');
                        }}
                        style={{ background: 'none', border: 'none', color: '#00f5d4', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}
                      >
                        Focus ⛶
                      </button>
                    </div>
                  </div>

                  {ubuntuUrl ? (
                    <iframe
                      ref={ubuntuIframeRef}
                      key={`split-ubuntu-${iframeKeyUbuntu}`}
                      src={ubuntuUrl}
                      title="Ubuntu Linux Split View"
                      className={styles.splitIframe}
                      allow="fullscreen; clipboard-read; clipboard-write"
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                      Loading Ubuntu target stream...
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slide-in Mission Control Drawer (Includes bottom-right floating trigger button) */}
      <MissionDrawer
        labId={statusData?.labId || statusData?.id}
        labName={statusData?.labName || 'Controlled Network Attack'}
        sessionId={sessionId}
        expiresAt={statusData?.expiresAt}
        isOpen={isMissionDrawerOpen}
        onToggle={() => setIsMissionDrawerOpen(!isMissionDrawerOpen)}
        onCopyToKali={(cmd) => sendClipboardToMachine(cmd, activeMachine)}
        portalContainer={containerRef.current}
      />

      {/* Modal: Interactive Shell Terminal */}
      <Modal
        isOpen={isTerminalModalOpen}
        onClose={() => setIsTerminalModalOpen(false)}
        title="Interactive Container Shell"
        icon="💻"
        maxWidth="820px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Machine Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px' }}>
            <button
              onClick={() => setTerminalActiveTab('kali')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: terminalActiveTab === 'kali' ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid transparent',
                background: terminalActiveTab === 'kali' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: terminalActiveTab === 'kali' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'
              }}
            >
              🔴 Kali Linux (Attacker Shell)
            </button>
            <button
              onClick={() => setTerminalActiveTab('ubuntu')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: terminalActiveTab === 'ubuntu' ? '1px solid rgba(2, 132, 199, 0.6)' : '1px solid transparent',
                background: terminalActiveTab === 'ubuntu' ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: terminalActiveTab === 'ubuntu' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'
              }}
            >
              🔵 Ubuntu Linux (Target Shell)
            </button>
          </div>

          <div style={{ height: '420px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <TerminalComponent
              sessionId={sessionId}
              machineId={terminalActiveTab}
              machineName={terminalActiveTab === 'kali' ? 'Kali Linux Attacker' : 'Ubuntu Linux Target'}
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Live Network Isolation Audit */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title="Network Policy & Isolation Audit"
        icon="🛡️"
        maxWidth="640px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
            This audit executes live telemetry probes from inside the <code>kali-attacker</code> container to verify internal reachability and strict external egress blocking.
          </p>

          {verifying ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', animation: 'pulse-glow 1.5s infinite', marginBottom: '8px' }}>🔄</div>
              <p style={{ fontSize: '0.85rem', color: '#00f5d4', fontWeight: 700 }}>Dispatching live ICMP & HTTP probes across pods...</p>
            </div>
          ) : auditResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Check 1: Internal Ping */}
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>1. Internal Subnet Ping (Kali → Ubuntu Target)</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: auditResult.internalPing?.success ? '#10b981' : '#ef4444' }}>
                    {auditResult.internalPing?.success ? '✓ 100% PASSED' : '✕ FAILED'}
                  </span>
                </div>
                <code style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.4)', padding: '4px 8px', borderRadius: '4px', display: 'block' }}>
                  {auditResult.internalPing?.command}
                </code>
              </div>

              {/* Check 2: Intranet HTTP Service */}
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>2. Target Intranet HTTP Service (Port 80)</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: auditResult.internalService?.success ? '#10b981' : '#ef4444' }}>
                    {auditResult.internalService?.success ? '✓ 200 OK VERIFIED' : '✕ FAILED'}
                  </span>
                </div>
                <code style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.4)', padding: '4px 8px', borderRadius: '4px', display: 'block' }}>
                  {auditResult.internalService?.command}
                </code>
              </div>

              {/* Check 3: External Internet Egress */}
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>3. Public Internet Egress (0.0.0.0/0)</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: auditResult.externalEgressBlocked?.blocked ? '#10b981' : '#ef4444' }}>
                    {auditResult.externalEgressBlocked?.blocked ? '✓ STRICTLY BLOCKED' : '⚠️ LEAKAGE DETECTED'}
                  </span>
                </div>
                <code style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.4)', padding: '4px 8px', borderRadius: '4px', display: 'block' }}>
                  {auditResult.externalEgressBlocked?.output}
                </code>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              onClick={handleRunVerification}
              disabled={verifying}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #00f5d4 0%, #3b82f6 100%)',
                border: 'none',
                color: '#050811',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {verifying ? 'Auditing...' : '🔄 Re-Run Live Audit'}
            </button>
            <button
              onClick={() => setIsAuditModalOpen(false)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Bi-directional Clipboard Bridge */}
      <Modal
        isOpen={isClipboardModalOpen}
        onClose={() => setIsClipboardModalOpen(false)}
        title="Bi-directional Clipboard Bridge"
        icon="📋"
        maxWidth="540px"
      >
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00f5d4' }}>
              SEND TEXT TO {activeMachine === 'kali' ? 'KALI ATTACKER' : 'UBUNTU TARGET'}
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
                color: 'rgba(255, 255, 255, 0.5)',
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
            placeholder="Paste any command, exploit payload, script, or target URL here..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(5, 8, 17, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
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
                  sendClipboardToMachine(customPasteText, activeMachine);
                  setIsClipboardModalOpen(false);
                  toast.success(`Dispatched to ${activeMachine === 'kali' ? 'Kali Linux' : 'Ubuntu Linux'} clipboard!`);
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
              📋 Send to {activeMachine === 'kali' ? 'Kali' : 'Ubuntu'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)' }}>
              RECEIVED FROM ACTIVE MACHINE
            </span>
            <button
              onClick={() => fetchMachineClipboard(false, activeMachine)}
              style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
            >
              🔄 Read Container Clipboard
            </button>
          </div>
          <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: machineClipboard ? '#f8fafc' : 'rgba(255, 255, 255, 0.4)', maxHeight: '70px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {machineClipboard || '(Click "Read Container Clipboard" or copy text inside the workstation)'}
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: '0.76rem', color: '#c4b5fd', lineHeight: 1.5 }}>
          <div>💡 <strong>In Terminal:</strong> Press <code>Ctrl+Shift+V</code> to paste commands directly.</div>
          <div>💡 <strong>Switch Active Target:</strong> Use topbar machine pills to target Kali or Ubuntu.</div>
        </div>
      </Modal>

      {/* Confirm Decommission Environment */}
      <ConfirmDialog
        isOpen={isTerminateConfirmOpen}
        title="Terminate Scenario Environment?"
        message="This action permanently tears down the dedicated scenario Kubernetes namespace and deletes all containers, including attacker and target workstations. Are you sure?"
        confirmText={terminating ? 'Tearing down...' : 'Terminate Environment'}
        cancelText="Cancel"
        type="danger"
        onConfirm={handleTerminateEnvironment}
        onCancel={() => setIsTerminateConfirmOpen(false)}
      />

      {/* Confirm Sign Out */}
      <ConfirmDialog
        isOpen={isSignOutConfirmOpen}
        title="Sign Out of Cyber Range?"
        message="Your active scenario sandbox will remain running until its TTL lease expires. Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Stay in Mission"
        type="danger"
        onConfirm={() => {
          setIsSignOutConfirmOpen(false);
          logout();
        }}
        onCancel={() => setIsSignOutConfirmOpen(false)}
      />
    </div>
  );
}
