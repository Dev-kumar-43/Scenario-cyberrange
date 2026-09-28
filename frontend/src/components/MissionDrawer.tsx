'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import NetworkTopology from './NetworkTopology';
import SessionTimer from './SessionTimer';

export interface MissionTask {
  id: string;
  title: string;
  description: string;
  hints: string[];
  points: number;
  order: number;
  answerType?: string;
  mitreTechnique?: string | null;
  isCompleted: boolean;
  hintsUsedCount?: number;
  pointsDeducted?: number;
  submittedAt?: string;
}

interface MissionDrawerProps {
  labId: string;
  labName?: string;
  sessionId?: string;
  expiresAt?: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onExtendSuccess?: (newExpiresAt: string) => void;
  onCopyToKali?: (text: string) => void;
  portalContainer?: HTMLElement | null;
}

// Curated Command Arsenal tailored for cyber ranges
const COMMAND_ARSENAL: Record<string, Array<{ name: string; cmd: string; desc: string }>> = {
  Reconnaissance: [
    {
      name: 'Full Port SYN Stealth Scan',
      cmd: 'nmap -sS -sV -p- -T4 --open <target-ip>',
      desc: 'High-speed stealth SYN scan across all 65,535 TCP ports with version detection.'
    },
    {
      name: 'Vulnerability Detection Script Scan',
      cmd: 'nmap --script=vuln -p 80,443,8080 <target-ip>',
      desc: 'Executes NSE vulnerability scripts against exposed HTTP/HTTPS services.'
    },
    {
      name: 'Subnet Host Discovery',
      cmd: 'nmap -sn 10.42.0.0/24',
      desc: 'Ping sweep to identify all live pods and endpoints in the pod network.'
    }
  ],
  'Packet Analysis': [
    {
      name: 'Launch Wireshark GUI',
      cmd: 'wireshark &',
      desc: 'Launches GUI packet analyzer in the background on the XFCE desktop.'
    },
    {
      name: 'Capture HTTP Traffic to PCAP',
      cmd: 'tcpdump -i eth0 -nn -s0 -w /root/Desktop/traffic.pcap "tcp port 80 or tcp port 3000"',
      desc: 'Captures full frame payload on interface eth0 and saves to desktop.'
    },
    {
      name: 'Inspect Plaintext Flags in Traffic',
      cmd: 'tshark -r /root/Desktop/traffic.pcap -Y "http contains FLAG" -T fields -e text',
      desc: 'Extracts frames containing FLAG string directly from PCAP file.'
    }
  ],
  'Web & Exploitation': [
    {
      name: 'SQLi Authentication Bypass',
      cmd: "admin' --",
      desc: 'Classic SQL injection payload terminating password verification in WHERE clause.'
    },
    {
      name: 'SQLi Tautology Exploit',
      cmd: "' OR '1'='1' --",
      desc: 'Tautology payload that evaluates truthy for all records in the table.'
    },
    {
      name: 'Interactive TTY Upgrade',
      cmd: "python3 -c 'import pty; pty.spawn(\"/bin/bash\")'",
      desc: 'Spawns a full pseudo-terminal shell with job control from raw netcat connection.'
    },
    {
      name: 'Find SUID Binaries',
      cmd: 'find / -perm -u=s -type f 2>/dev/null',
      desc: 'Scans filesystem for root SUID binaries vulnerable to privilege escalation.'
    }
  ]
};

export default function MissionDrawer({
  labId,
  labName = 'Target System',
  sessionId,
  expiresAt,
  isOpen,
  onToggle,
  onExtendSuccess,
  onCopyToKali,
  portalContainer
}: MissionDrawerProps) {
  const { token, apiUrl, updateUserStats, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'tasks' | 'topology' | 'commands' | 'hints' | 'notes'>('tasks');
  const [tasks, setTasks] = useState<MissionTask[]>([]);
  const [labMetadata, setLabMetadata] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Flag input state per task
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    taskId: string;
    isCorrect: boolean;
    message: string;
    points?: number;
  } | null>(null);

  // Progressive hints state: { [taskId]: revealedHintsCount }
  const [unlockedHints, setUnlockedHints] = useState<Record<string, number>>({});
  const [hintConfirmTaskId, setHintConfirmTaskId] = useState<string | null>(null);

  // Scratchpad notes state
  const [scratchpadContent, setScratchpadContent] = useState<string>('');
  const [noteSyncStatus, setNoteSyncStatus] = useState<'synced' | 'saving' | 'unsaved'>('synced');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const updateTarget = () => {
      if (typeof document !== 'undefined') {
        const fsEl = (document.fullscreenElement as HTMLElement | null) ||
                     ((document as any).webkitFullscreenElement as HTMLElement | null);
        setPortalTarget(fsEl || portalContainer || document.body);
      }
    };
    updateTarget();
    document.addEventListener('fullscreenchange', updateTarget);
    document.addEventListener('webkitfullscreenchange', updateTarget);
    return () => {
      document.removeEventListener('fullscreenchange', updateTarget);
      document.removeEventListener('webkitfullscreenchange', updateTarget);
    };
  }, [portalContainer]);

  // Keyboard accessibility: Close drawer on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle]);

  // Fetch lab tasks and initial scratchpad note
  useEffect(() => {
    if (!labId || !token) return;

    const fetchTasks = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/api/learning/labs/${labId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks || []);
          if (data.note !== undefined) {
            setScratchpadContent(data.note);
          }
          if (data.labMetadata) {
            setLabMetadata(data.labMetadata);
          }
        } else {
          setError('Failed to fetch mission objectives.');
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
        setError('Connection error loading tasks.');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [labId, token, apiUrl]);

  // Handle flag submission with hint penalties
  const handleSubmitFlag = async (task: MissionTask) => {
    const inputFlag = flagInputs[task.id]?.trim();
    if (!inputFlag) return;

    setSubmittingTaskId(task.id);
    setSubmissionFeedback(null);

    const hintsCount = unlockedHints[task.id] || 0;
    const pointsDeducted = hintsCount * 10;

    try {
      const res = await fetch(`${apiUrl}/api/learning/flags/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId: task.id,
          flag: inputFlag,
          sessionId,
          hintsUsedCount: hintsCount,
          pointsDeducted
        })
      });

      const data = await res.json();

      if (res.ok && data.isCorrect) {
        setSubmissionFeedback({
          taskId: task.id,
          isCorrect: true,
          message: data.message || `CONFIRMED! +${data.awardedPoints} XP`,
          points: data.awardedPoints
        });

        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, isCompleted: true } : t))
        );

        if (data.newXp !== undefined) {
          updateUserStats({
            xp: data.newXp,
            level: data.newLevel,
            rankTitle: data.rankTitle
          });
        }
        refreshUser();
      } else {
        setSubmissionFeedback({
          taskId: task.id,
          isCorrect: false,
          message: data.message || 'Access Denied: Invalid flag sequence.'
        });
      }
    } catch (err) {
      console.error('Submit flag error:', err);
      setSubmissionFeedback({
        taskId: task.id,
        isCorrect: false,
        message: 'Network error submitting flag.'
      });
    } finally {
      setSubmittingTaskId(null);
    }
  };

  // Debounced auto-save for field scratchpad
  const handleNotesChange = (val: string) => {
    setScratchpadContent(val);
    setNoteSyncStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setNoteSyncStatus('saving');
      try {
        const res = await fetch(`${apiUrl}/api/learning/labs/${labId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ content: val })
        });
        if (res.ok) {
          setNoteSyncStatus('synced');
        } else {
          setNoteSyncStatus('unsaved');
        }
      } catch {
        setNoteSyncStatus('unsaved');
      }
    }, 1200);
  };

  // Keyboard shortcut: Escape to close drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle]);


  const copyCommand = (cmd: string) => {
    // 1. Copy to modern host browser clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).catch(() => {});
    }
    // 2. Transmit directly to Kali Linux VNC clipboard bridge callback
    if (onCopyToKali) {
      onCopyToKali(cmd);
    }
    // 3. Direct backend API injection (Guaranteed write into Kali X11 server via pod exec)
    if (sessionId && token) {
      fetch(`${apiUrl}/api/labs/sessions/${sessionId}/clipboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: cmd })
      }).catch(() => {});
    }
    // 4. Fallback broadcast to window message bus
    if (typeof window !== 'undefined') {
      window.postMessage({ type: 'KALI_CLIPBOARD_PASTE', text: cmd }, '*');
    }
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const confirmRevealHint = (taskId: string, totalHints: number) => {
    setUnlockedHints((prev) => {
      const current = prev[taskId] || 0;
      if (current < totalHints) {
        return { ...prev, [taskId]: current + 1 };
      }
      return prev;
    });
    setHintConfirmTaskId(null);
  };

  const solvedCount = tasks.filter((t) => t.isCompleted).length;
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0);
  const earnedPoints = tasks.filter((t) => t.isCompleted).reduce((sum, t) => sum + t.points, 0);

  if (!mounted || !portalTarget) return null;

  const isInsideFullscreen = portalTarget !== (typeof document !== 'undefined' ? document.body : null);

  return createPortal(
    <>
      <style>{`
        @keyframes radar-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes orb-glow {
          0%, 100% { box-shadow: 0 0 25px rgba(0, 245, 212, 0.4), 0 0 10px rgba(139, 92, 246, 0.4); }
          50% { box-shadow: 0 0 40px rgba(0, 245, 212, 0.7), 0 0 20px rgba(139, 92, 246, 0.6); }
        }
      `}</style>

      {/* Floating Circular Mission Control Orb when drawer is closed */}
      {!isOpen && (
        <div
          style={{
            position: isInsideFullscreen ? 'absolute' : 'fixed',
            right: '26px',
            bottom: '26px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Pulsing Radar Ring */}
          <div
            style={{
              position: 'absolute',
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              border: '2px solid rgba(0, 245, 212, 0.45)',
              animation: 'radar-pulse 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
              pointerEvents: 'none'
            }}
          />

          <button
            onClick={onToggle}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, rgba(0, 245, 212, 0.35), rgba(13, 20, 36, 0.95) 75%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(0, 245, 212, 0.55)',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              animation: 'orb-glow 3s ease-in-out infinite',
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              outline: 'none'
            }}
            title="Mission Control: Objectives, SOC Milestones & Flags (Alt+M)"
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
          >
            <span style={{ fontSize: '1.45rem', filter: 'drop-shadow(0 0 6px rgba(0, 245, 212, 0.8))' }}>🎯</span>

            {/* Micro Solved/Total Task Badge */}
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: solvedCount === tasks.length && tasks.length > 0 ? '#10b981' : '#7c3aed',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                color: '#ffffff',
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '0.02em',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)'
              }}
            >
              {solvedCount}/{tasks.length}
            </span>
          </button>
        </div>
      )}

      {/* Backdrop-blurred drawer overlay when open */}
      {isOpen && (
        <div
          onClick={onToggle}
          style={{
            position: isInsideFullscreen ? 'absolute' : 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 17, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99998,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* Slide-in HUD Drawer Container */}
      <aside
        aria-label="Mission Control Panel"
        style={{
          position: isInsideFullscreen ? 'absolute' : 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          height: '100%',
          width: 'min(500px, 95vw)',
          backgroundColor: 'rgba(5, 8, 17, 0.98)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderLeft: '1px solid rgba(0, 245, 212, 0.25)',
          boxShadow: '-10px 0 50px rgba(0, 0, 0, 0.85), 0 0 40px rgba(0, 245, 212, 0.12)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          color: '#f8fafc',
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '14px 18px',
            background: 'linear-gradient(180deg, rgba(13, 20, 36, 0.98) 0%, rgba(9, 14, 26, 0.95) 100%)',
            borderBottom: '1px solid var(--border-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🎯</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em', margin: 0, whiteSpace: 'nowrap' }}>
                  MISSION CONTROL
                </h3>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: 'var(--cyber-emerald)',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    flexShrink: 0
                  }}
                >
                  LIVE
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {labName} • {earnedPoints}/{totalPoints} XP
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {sessionId && (
              <SessionTimer
                sessionId={sessionId}
                expiresAt={expiresAt}
                onExtendSuccess={onExtendSuccess}
              />
            )}
            <button
              onClick={onToggle}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              title="Close Mission Control (Esc)"
              aria-label="Close Mission Control"
            >
              ✕
            </button>
          </div>
        </div>

        {/* HUD Progress Bar */}
        <div style={{ height: '3px', width: '100%', background: 'rgba(255, 255, 255, 0.05)' }}>
          <div
            style={{
              height: '100%',
              width: `${tasks.length > 0 ? (solvedCount / tasks.length) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #00f5d4, #8b5cf6)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>

        {/* Tab Navigation Strip */}
        <div
          role="tablist"
          aria-label="Mission Control Tabs"
          style={{
            display: 'flex',
            padding: '6px 12px',
            background: 'rgba(9, 14, 26, 0.5)',
            borderBottom: '1px solid var(--border-card)',
            gap: '4px'
          }}
        >
          {[
            { key: 'tasks', label: 'Objectives', icon: '🎯', count: tasks.length },
            { key: 'topology', label: 'Topology', icon: '🌐' },
            { key: 'commands', label: 'Arsenal', icon: '⚡' },
            { key: 'hints', label: 'Intel', icon: '💡' },
            { key: 'notes', label: 'Scratchpad', icon: '📝' }
          ].map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`mission-panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: activeTab === tab.key ? 'rgba(0, 245, 212, 0.15)' : 'transparent',
                border: activeTab === tab.key ? '1px solid rgba(0, 245, 212, 0.35)' : '1px solid transparent',
                color: activeTab === tab.key ? 'var(--cyber-cyan)' : 'var(--text-muted)'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    padding: '1px 5px',
                    borderRadius: '8px',
                    background: activeTab === tab.key ? 'rgba(0, 245, 212, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    fontSize: '0.62rem'
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main Tab Content */}
        <div 
          role="tabpanel" 
          id={`mission-panel-${activeTab}`} 
          style={{ flex: 1, overflowY: 'auto', padding: '14px' }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', animation: 'spin 1.5s infinite linear', marginBottom: '0.75rem' }}>◬</div>
              <p style={{ fontSize: '0.85rem' }}>Synchronizing Mission Directives...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '8px', color: '#fda4af' }}>
              {error}
            </div>
          ) : (
            <>
              {/* TAB 1: OBJECTIVES & CTF FLAGS */}
              {activeTab === 'tasks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                      No active mission objectives configured for this scenario.
                    </div>
                  ) : (
                    tasks.map((task, idx) => (
                      <div
                        key={task.id}
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          border: task.isCompleted
                            ? '1px solid rgba(16, 185, 129, 0.45)'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          background: task.isCompleted
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'rgba(13, 20, 36, 0.92)',
                          boxShadow: task.isCompleted
                            ? '0 4px 20px rgba(16, 185, 129, 0.12)'
                            : '0 4px 16px rgba(0, 0, 0, 0.4)',
                          transition: 'all 0.25s ease'
                        }}
                      >
                        {/* Task Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                background: task.isCompleted ? 'var(--cyber-emerald)' : 'rgba(255, 255, 255, 0.12)',
                                color: task.isCompleted ? '#050811' : '#f8fafc'
                              }}
                            >
                              {task.isCompleted ? '✓' : idx + 1}
                            </span>
                            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: task.isCompleted ? 'var(--cyber-emerald)' : '#f8fafc', margin: 0 }}>
                              {task.title}
                            </h4>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {task.mitreTechnique && (
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  background: 'rgba(139, 92, 246, 0.18)',
                                  border: '1px solid rgba(139, 92, 246, 0.35)',
                                  color: '#c4b5fd',
                                  fontSize: '0.65rem',
                                  fontWeight: 800
                                }}
                                title={`MITRE ATT&CK Technique: ${task.mitreTechnique}`}
                              >
                                {task.mitreTechnique}
                              </span>
                            )}
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(245, 158, 11, 0.18)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                color: '#fbbf24',
                                fontSize: '0.7rem',
                                fontWeight: 800
                              }}
                            >
                              +{task.points} XP
                            </span>
                          </div>
                        </div>

                        {/* Task Description */}
                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '10px' }}>
                          {task.description}
                        </p>

                        {/* Answer Type indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Format:</span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: 'rgba(0, 245, 212, 0.1)',
                              border: '1px solid rgba(0, 245, 212, 0.25)',
                              color: 'var(--cyber-cyan)'
                            }}
                          >
                            {task.answerType === 'HASH'
                              ? '🔐 Password / MD5 Hash'
                              : task.answerType === 'IP_ADDRESS'
                              ? '🔍 IoC / IP Address'
                              : task.answerType === 'REGEX'
                              ? '📝 Case Pattern'
                              : '🚩 Secret Flag (FLAG{...})'}
                          </span>
                        </div>

                        {/* Flag Submission Area */}
                        {task.isCompleted ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              color: 'var(--cyber-emerald)',
                              fontSize: '0.76rem',
                              fontWeight: 700
                            }}
                          >
                            <span>🎖️</span>
                            <span>Objective Secured • Verified</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder={task.answerType === 'HASH' ? 'hash...' : 'FLAG{...}'}
                                value={flagInputs[task.id] || ''}
                                onChange={(e) =>
                                  setFlagInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSubmitFlag(task);
                                }}
                                style={{
                                  flex: 1,
                                  padding: '7px 11px',
                                  fontSize: '0.8rem',
                                  fontFamily: 'var(--font-mono)',
                                  backgroundColor: 'rgba(5, 8, 17, 0.95)',
                                  border: '1px solid rgba(255, 255, 255, 0.16)',
                                  borderRadius: '6px',
                                  color: '#f8fafc',
                                  outline: 'none',
                                  transition: 'border-color 0.2s'
                                }}
                              />
                              <button
                                onClick={() => handleSubmitFlag(task)}
                                disabled={submittingTaskId === task.id || !flagInputs[task.id]?.trim()}
                                style={{
                                  padding: '7px 14px',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  background: 'linear-gradient(135deg, #00f5d4, #3b82f6)',
                                  border: 'none',
                                  color: '#050811',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  opacity: submittingTaskId === task.id || !flagInputs[task.id]?.trim() ? 0.6 : 1,
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {submittingTaskId === task.id ? '...' : 'Submit'}
                              </button>
                            </div>

                            {/* Submission Feedback Message */}
                            {submissionFeedback && submissionFeedback.taskId === task.id && (
                              <div
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  backgroundColor: submissionFeedback.isCorrect
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(244, 63, 94, 0.15)',
                                  border: `1px solid ${
                                    submissionFeedback.isCorrect ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
                                  }`,
                                  color: submissionFeedback.isCorrect ? 'var(--cyber-emerald)' : '#fca5a5'
                                }}
                              >
                                {submissionFeedback.message}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: NETWORK TOPOLOGY */}
              {activeTab === 'topology' && (
                <NetworkTopology
                  labName={labName}
                  targetPort={labMetadata?.exposedPort || 80}
                  protocol={labMetadata?.protocol || 'TCP'}
                />
              )}

              {/* TAB 3: COMMAND ARSENAL */}
              {activeTab === 'commands' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(0, 245, 212, 0.08)',
                        border: '1px solid rgba(0, 245, 212, 0.25)',
                        fontSize: '0.74rem',
                        color: '#e2e8f0',
                        lineHeight: 1.5
                      }}
                    >
                      ⚡ <strong style={{ color: 'var(--cyber-cyan)' }}>Instant Kali Sync:</strong> Click any command below to immediately copy and sync to your Kali Linux clipboard. In your Kali terminal, simply press <code>Ctrl+Shift+V</code> or <em>Right-Click → Paste</em>.
                    </div>

                  {Object.entries(COMMAND_ARSENAL).map(([category, items]) => (
                    <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--cyber-cyan)'
                        }}
                      >
                        {category}
                      </span>

                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => copyCommand(item.cmd)}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            position: 'relative',
                            borderRadius: '8px',
                            transition: 'all 0.2s ease',
                            border: copiedCmd === item.cmd ? '1px solid var(--cyber-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                            background: copiedCmd === item.cmd ? 'rgba(0, 245, 212, 0.08)' : 'rgba(13, 20, 36, 0.88)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
                              {item.name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: copiedCmd === item.cmd ? 800 : 600,
                                color: copiedCmd === item.cmd ? '#00f5d4' : '#94a3b8',
                                background: copiedCmd === item.cmd ? 'rgba(0, 245, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                boxShadow: copiedCmd === item.cmd ? '0 0 8px rgba(0, 245, 212, 0.4)' : 'none',
                                transition: 'all 0.2s'
                              }}
                            >
                              {copiedCmd === item.cmd ? '✓ SYNCED TO KALI!' : '📋 Copy'}
                            </span>
                          </div>
                          <code
                            style={{
                              display: 'block',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              background: '#030712',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              color: '#67e8f9',
                              fontSize: '0.74rem',
                              fontFamily: 'var(--font-mono)',
                              overflowX: 'auto',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.cmd}
                          </code>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: INTEL & PROGRESSIVE HINTS WITH XP PENALTY */}
              {activeTab === 'hints' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tasks.map((task) => {
                    const revealedCount = unlockedHints[task.id] || 0;
                    const hintsList = task.hints || [];

                    return (
                      <div
                        key={task.id}
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: 'rgba(13, 20, 36, 0.88)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                            {task.title}
                          </h4>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            {hintsList.length} intel item{hintsList.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {hintsList.length === 0 ? (
                          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0 }}>
                            No encrypted hints configured for this objective.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {hintsList.map((hint, hIdx) => {
                              const isRevealed = hIdx < revealedCount;
                              return (
                                <div
                                  key={hIdx}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    background: isRevealed ? 'rgba(139, 92, 246, 0.14)' : 'rgba(5, 8, 17, 0.7)',
                                    border: isRevealed ? '1px solid rgba(139, 92, 246, 0.35)' : '1px dashed rgba(255, 255, 255, 0.12)',
                                    fontSize: '0.74rem'
                                  }}
                                >
                                  {isRevealed ? (
                                    <div>
                                      <span style={{ fontWeight: 700, color: '#c4b5fd', marginRight: '6px' }}>
                                        💡 Intel #{hIdx + 1} (-10 XP):
                                      </span>
                                      <span style={{ color: '#f1f5f9' }}>{hint}</span>
                                    </div>
                                  ) : (
                                    <div>
                                      {hintConfirmTaskId === `${task.id}-${hIdx}` ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                          <span style={{ color: '#fbbf24', fontSize: '0.7rem' }}>
                                            ⚠️ Unlocking deducts 10 XP from reward.
                                          </span>
                                          <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                              onClick={() => confirmRevealHint(task.id, hintsList.length)}
                                              style={{
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                background: 'var(--cyber-amber)',
                                                border: 'none',
                                                color: '#000000',
                                                fontSize: '0.68rem',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Confirm
                                            </button>
                                            <button
                                              onClick={() => setHintConfirmTaskId(null)}
                                              style={{
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                border: 'none',
                                                color: '#ffffff',
                                                fontSize: '0.68rem',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>🔒</span>
                                            <span>Encrypted Intel #{hIdx + 1}</span>
                                          </span>
                                          <button
                                            onClick={() => setHintConfirmTaskId(`${task.id}-${hIdx}`)}
                                            style={{
                                              padding: '3px 9px',
                                              borderRadius: '4px',
                                              background: 'rgba(139, 92, 246, 0.18)',
                                              border: '1px solid rgba(139, 92, 246, 0.4)',
                                              color: '#c4b5fd',
                                              fontSize: '0.68rem',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              transition: 'all 0.2s ease'
                                            }}
                                          >
                                            Decrypt (-10 XP)
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 5: OPERATOR SCRATCHPAD */}
              {activeTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Operator Field Notes (Markdown)
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color:
                          noteSyncStatus === 'synced'
                            ? 'var(--cyber-emerald)'
                            : noteSyncStatus === 'saving'
                            ? '#60a5fa'
                            : '#fbbf24'
                      }}
                    >
                      {noteSyncStatus === 'synced'
                        ? '● Cloud Synced'
                        : noteSyncStatus === 'saving'
                        ? '◌ Synchronizing...'
                        : '○ Unsaved'}
                    </span>
                  </div>

                  <textarea
                    value={scratchpadContent}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder={`# Field Engagement Notes\n\n- Target IP: 10.42.0.x\n- Discovered open ports:\n- Vulnerability hypothesis:\n- Credentials captured:`}
                    style={{
                      width: '100%',
                      minHeight: '360px',
                      padding: '10px',
                      fontSize: '0.78rem',
                      lineHeight: 1.5,
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'rgba(5, 8, 17, 0.85)',
                      border: '1px solid var(--border-card)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>,
    portalTarget
  );
}
