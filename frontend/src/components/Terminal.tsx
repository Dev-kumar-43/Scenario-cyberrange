'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import '@xterm/xterm/css/xterm.css';

interface TerminalComponentProps {
  sessionId: string;
}

export default function TerminalComponent({ sessionId }: TerminalComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e2e8f0',
        cursor: '#00ffcc',
        selectionBackground: 'rgba(0, 255, 204, 0.3)',
      },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
      cursorBlink: true,
    });
    
    xtermRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    // Setup WebSocket
    const wsUrl = `ws://localhost:3001/api/terminal?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);

    // Provide some feedback while connecting
    term.writeln('Connecting to container shell...');

    ws.onopen = () => {
      // Once open, we can attach xterm to it using the AttachAddon
      const attachAddon = new AttachAddon(ws);
      term.loadAddon(attachAddon);
    };

    ws.onerror = (e) => {
      term.writeln('\r\n\x1b[31mWebSocket Connection Error.\x1b[0m');
      console.error('WebSocket Error', e);
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[33mConnection closed.\x1b[0m');
    };

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Terminal: Session {sessionId.split('-')[0]}</h2>
      </div>
      <div 
        ref={terminalRef} 
        style={{ 
          flex: 1, 
          overflow: 'hidden', 
          borderRadius: '8px', 
          padding: '10px',
          background: '#1a1a2e',
          boxShadow: '0 0 20px rgba(0, 255, 204, 0.15)'
        }} 
      />
    </div>
  );
}
