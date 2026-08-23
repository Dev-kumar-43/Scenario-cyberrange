'use client';
import { useParams, useRouter } from 'next/navigation';
import TerminalComponent from '@/components/Terminal';
import styles from '@/app/page.module.css';

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px' }}>
        <button 
          className={styles.button} 
          style={{ width: 'auto', marginBottom: '10px' }}
          onClick={() => router.push('/sessions')}
        >
          ← Back to Sessions
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <TerminalComponent sessionId={sessionId} />
      </div>
    </div>
  );
}
