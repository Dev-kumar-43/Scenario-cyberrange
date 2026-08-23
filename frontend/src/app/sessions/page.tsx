'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const MOCK_USER_ID = "106e72ed-9e6c-4cae-9705-528f44c4ffad";

  const fetchSessions = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/labs/sessions?userId=${MOCK_USER_ID}`);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStopLab = async (sessionId: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/labs/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (response.ok) {
        alert(`Lab is stopping. It will be removed shortly.`);
        fetchSessions();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to stop lab:', error);
      alert('Network error occurred while trying to stop lab.');
    }
  };

  const handleOpenTerminal = (sessionId: string) => {
    router.push(`/sessions/${sessionId}/terminal`);
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Active Sessions</h1>
        <p className={styles.subtitle}>Manage your running lab environments and terminals.</p>
      </div>

      {loading ? (
        <p>Loading active sessions...</p>
      ) : sessions.length === 0 ? (
        <p>No active sessions found. Go to the Dashboard to start a lab.</p>
      ) : (
        <div className={styles.grid}>
          {sessions.map(session => (
            <div key={session.id} className={`glass-panel ${styles.card}`}>
              <div className={styles.cardHeader}>
                <span className={styles.badge}>{session.status}</span>
              </div>
              
              <h3 className={styles.cardTitle}>{session.lab.name}</h3>
              <p className={styles.cardDesc}>Namespace: {session.k8sNamespace}</p>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                <button 
                  className={styles.button}
                  style={{ flex: 1 }}
                  onClick={() => handleOpenTerminal(session.id)}
                  disabled={session.status !== 'RUNNING' && session.status !== 'CREATING' && session.status !== 'PENDING'}
                >
                  Terminal
                </button>
                <button 
                  className={styles.button}
                  style={{ flex: 1, background: 'rgba(255, 50, 50, 0.2)', border: '1px solid rgba(255, 50, 50, 0.5)' }}
                  onClick={() => handleStopLab(session.id)}
                  disabled={session.status === 'STOPPING'}
                >
                  {session.status === 'STOPPING' ? 'Stopping...' : 'Stop Lab'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
