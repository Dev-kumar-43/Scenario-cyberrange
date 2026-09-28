'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CardSkeleton } from '@/components/Skeleton';
import styles from './sessions.module.css';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [sessionToTerminate, setSessionToTerminate] = useState<any | null>(null);

  const { user, token, openAuthModal, apiUrl } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const fetchSessions = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/labs/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const activeList = data.sessions || [];
        setSessions(activeList);

        // Also check live status for any non-stopped session to sync DB state with K8s
        activeList.forEach(async (sess: any) => {
          if (sess.status === 'CREATING' || sess.status === 'PENDING') {
            try {
              await fetch(`${apiUrl}/api/labs/${sess.id}/status`, {
                headers: { Authorization: `Bearer ${token}` }
              });
            } catch {
              // Silently handle status polling
            }
          }
        });
      } else {
        const errData = await response.json();
        toast.error(errData.error || 'Failed to fetch sessions.');
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, toast]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 4000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleStopLab = async (sessionId: string) => {
    if (!token) return;

    setStoppingId(sessionId);

    try {
      const response = await fetch(`${apiUrl}/api/labs/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        toast.success('Sandbox environment successfully decommissioned.');
        setSessionToTerminate(null);
        fetchSessions();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to stop lab.');
      }
    } catch (error) {
      console.error('Failed to stop lab:', error);
      toast.error('Network error occurred while trying to stop lab.');
    } finally {
      setStoppingId(null);
    }
  };

  const handleCopy = (text: string, label: string = 'Endpoint URL') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const calculateTimeRemaining = (startedAt: string) => {
    const started = new Date(startedAt).getTime();
    const ttlMs = 2 * 60 * 60 * 1000; // 2 hour default session TTL
    const diffSeconds = Math.max(0, Math.floor((started + ttlMs - Date.now()) / 1000));
    const mins = Math.floor(diffSeconds / 60);
    const secs = diffSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user && !loading) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyCard}>
          <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '28px', marginBottom: '16px' }}>
            🔒
          </div>
          <h2 className={styles.emptyTitle}>Authentication Required</h2>
          <p className={styles.emptyDesc}>
            Sign in to access your dedicated Kubernetes sandboxes, live Kali Linux GUI workstations, and active exercises.
          </p>
          <button
            className="btn"
            onClick={openAuthModal}
            style={{ width: 'auto' }}
          >
            Sign In / Register →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Astra Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Your active labs</h1>
          <p className={styles.pageSub}>
            Keep your learning context close while you practice. Manage live sandboxes and access tools.
          </p>
        </div>

        <button
          className="btn secondary"
          onClick={() => router.push('/')}
        >
          Browse practice →
        </button>
      </div>

      {loading ? (
        <CardSkeleton count={2} />
      ) : sessions.length === 0 ? (
        /* Astra Empty State */
        <div className={styles.emptyCard}>
          <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '28px', marginBottom: '16px' }}>
            ⚡
          </div>
          <h2 className={styles.emptyTitle}>No active labs right now</h2>
          <p className={styles.emptyDesc}>
            Continue your current course or choose a practice environment. Your completed objectives and flags are always preserved.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={() => router.push('/academy')}
            >
              Continue learning →
            </button>
            <button
              className="btn secondary"
              onClick={() => router.push('/')}
            >
              Browse practice
            </button>
          </div>
        </div>
      ) : (
        /* Astra Active Lab Cards Grid */
        <div className={styles.grid}>
          {sessions.map((session) => {
            const isRunning = session.status === 'RUNNING';
            const isVNC = session.lab?.protocol === 'VNC';
            const targetRoute = isVNC
              ? `/sessions/${session.id}/desktop`
              : `/sessions/${session.id}/terminal`;

            return (
              <article key={session.id} className={styles.card}>
                <div>
                  <div className={styles.cardHeader}>
                    <div className={styles.headerBadges}>
                      <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '18px' }}>
                        {isVNC ? '🖥️' : '⚡'}
                      </div>
                      <span className={`pill ${isRunning ? 'green' : 'blue'}`}>
                        {isRunning && <span className="live-pulse-dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', marginRight: '4px' }} />}
                        {isRunning ? 'Running • Live Pod' : session.status}
                      </span>
                      <span className="pill">
                        {isVNC ? '🖥️ Kali GUI Desktop' : '💻 Terminal Shell'}
                      </span>
                    </div>

                    <span className={styles.timestamp}>
                      Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className={styles.cardTitle}>{session.lab?.name || 'Sandbox Environment'}</h3>
                  <div className={styles.cardSubtitle}>
                    {session.lab?.category || 'Tactical Lab'} • Dedicated Cluster Pod
                  </div>

                  {/* Timer Strip */}
                  <div className={styles.labTime}>
                    <span>Session time remaining:</span>
                    <strong>{calculateTimeRemaining(session.startedAt)}</strong>
                  </div>

                  {/* Metadata Info */}
                  <div className={styles.metaBox}>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Pod Namespace:</span>
                      <code className={styles.metaValue}>{session.k8sNamespace}</code>
                    </div>

                    {session.traefikUrl && (
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Ingress URL:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                            {session.traefikUrl.slice(0, 22)}...
                          </span>
                          <button
                            onClick={() => handleCopy(session.traefikUrl, 'Traefik Endpoint')}
                            className="btn soft small"
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            title="Copy Ingress URL"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.actionsArea}>
                  <div className={styles.connectRow}>
                    <button
                      className="btn full"
                      onClick={() => router.push(targetRoute)}
                      disabled={!isRunning}
                    >
                      {isVNC ? '🖥️ Open Workspace' : '💻 Open Terminal'}
                    </button>

                    {isVNC && (
                      <button
                        className="btn secondary"
                        onClick={() => router.push(`/sessions/${session.id}/terminal`)}
                        title="Open complementary shell session"
                      >
                        Terminal
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (session.status === 'ERROR') {
                        handleStopLab(session.id);
                      } else {
                        setSessionToTerminate(session);
                      }
                    }}
                    disabled={stoppingId === session.id || session.status === 'STOPPING'}
                    className="text-link"
                    style={{
                      color: 'var(--red)',
                      fontSize: '13px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: 'none',
                      background: 'none',
                      padding: '4px 0'
                    }}
                  >
                    {stoppingId === session.id || session.status === 'STOPPING'
                      ? 'Decommissioning pod...'
                      : session.status === 'ERROR'
                      ? 'Dismiss Error Session'
                      : 'Stop environment'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Astra Callout Banner */}
      <div className="callout" style={{ marginTop: '16px' }}>
        <strong>Learning follows you</strong>
        <p>
          Lab objectives contribute directly to your skills matrix and rank achievements. Stopping an environment gracefully saves your completed flags and notes.
        </p>
      </div>

      {/* Confirmation Dialog for Destructive Sandbox Termination */}
      <ConfirmDialog
        isOpen={Boolean(sessionToTerminate)}
        title="Stop Sandbox Environment?"
        message={`Are you sure you want to stop the sandbox for "${sessionToTerminate?.lab?.name || 'Lab Environment'}"? The container pod in namespace ${sessionToTerminate?.k8sNamespace || ''} will be cleanly decommissioned. Your captured flags and learning progress remain saved.`}
        confirmText="Stop Environment"
        type="danger"
        loading={stoppingId === sessionToTerminate?.id}
        onConfirm={() => {
          if (sessionToTerminate) {
            handleStopLab(sessionToTerminate.id);
          }
        }}
        onCancel={() => setSessionToTerminate(null)}
      />
    </div>
  );
}
