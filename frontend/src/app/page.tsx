'use client';
import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function Dashboard() {
  const [labs, setLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingLabId, setStartingLabId] = useState<string | null>(null);

  // Note: Hardcoding a user ID for demo purposes. 
  // In a real app, this comes from authentication context.
  const MOCK_USER_ID = "106e72ed-9e6c-4cae-9705-528f44c4ffad"; // Seeded user ID

  useEffect(() => {
    // Fetch real lab definitions from backend
    const fetchLabs = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/labs');
        const data = await response.json();
        setLabs(data.labs || []);
      } catch (error) {
        console.error('Failed to fetch labs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLabs();
  }, []);

  const handleStartLab = async (labId: string) => {
    try {
      setStartingLabId(labId);
      const response = await fetch('http://localhost:3001/api/labs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: MOCK_USER_ID, // Will be replaced with real user ID
          labId: labId
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Lab starting! Connect at: ${data.url}`);
        // Optionally redirect to active sessions page or open terminal
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to start lab:', error);
      alert('Network error occurred while trying to start lab.');
    } finally {
      setStartingLabId(null);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Available Labs</h1>
        <p className={styles.subtitle}>Select a training environment to spin up a dedicated instance.</p>
      </div>

      {loading ? (
        <p>Loading labs from database...</p>
      ) : (
        <div className={styles.grid}>
          {labs.map(lab => (
            <div key={lab.id} className={`glass-panel ${styles.card}`}>
              <div className={styles.cardHeader}>
                <span className={styles.badge}>{lab.difficulty}</span>
              </div>
              
              <h3 className={styles.cardTitle}>{lab.name}</h3>
              <p className={styles.cardDesc}>{lab.description}</p>
              
              <button 
                className={styles.button}
                onClick={() => handleStartLab(lab.id)}
                disabled={startingLabId === lab.id}
              >
                {startingLabId === lab.id ? 'Starting in K8s...' : 'Start Lab Instance'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
