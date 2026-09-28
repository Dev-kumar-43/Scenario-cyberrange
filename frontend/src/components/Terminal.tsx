'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import '@xterm/xterm/css/xterm.css';
import { useAuth } from '../context/AuthContext';

interface TerminalComponentProps {
  sessionId: string;
  machineId?: string;
  machineName?: string;
}

export default function TerminalComponent({ sessionId, machineId, machineName }: TerminalComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const { token, wsUrl } = useAuth();

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js instance
    const term = new Terminal({
      theme: {
        background: '#0a0e17',
        foreground: '#e2e8f0',
        cursor: '#10b981',
        selectionBackground: 'rgba(16, 185, 129, 0.3)',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
    });

    xtermRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    if (!token) {
      term.writeln('\x1b[31m[Error]: Authentication token not found. Please log in first.\x1b[0m');
      return;
    }

    // Connect to WebSocket with sessionId, machineId and JWT token
    const socketUrl = `${wsUrl}/api/terminal?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}${machineId ? `&machineId=${encodeURIComponent(machineId)}` : ''}`;
    const ws = new WebSocket(socketUrl);

    term.writeln('\x1b[36mInitiating secure connection to target container shell...\x1b[0m');

    ws.onopen = () => {
      term.writeln('\x1b[32m✔ WebSocket connection established.\x1b[0m');
      const attachAddon = new AttachAddon(ws);
      term.loadAddon(attachAddon);

      // Send initial terminal dimensions
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onerror = (e) => {
      term.writeln('\r\n\x1b[31m[WebSocket Connection Error]: Failed to connect to terminal backend.\x1b[0m');
      console.error('[Terminal] WebSocket Error:', e);
    };

    ws.onclose = (event) => {
      term.writeln(`\r\n\x1b[33m[Connection closed]: Code ${event.code} (${event.reason || 'Terminated'}).\x1b[0m`);
    };

    // Handle window resize and send resize frame to backend
    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      term.dispose();
    };
  }, [sessionId, token, wsUrl]);

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
          Terminal Shell <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>| Session {sessionId.substring(0, 8)}</span>
        </h2>
        <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-primary)', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px' }}>
          Interactive TTY
        </span>
      </div>
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          borderRadius: '10px',
          padding: '12px',
          background: '#0a0e17',
          border: '1px solid var(--border-color)',
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.1)'
        }}
      />
    </div>
  );
}
