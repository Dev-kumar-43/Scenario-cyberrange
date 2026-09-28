'use client';

import React, { useState } from 'react';

interface NetworkNode {
  id: string;
  label: string;
  role: 'attacker' | 'gateway' | 'target' | 'database';
  ip: string;
  ports: string[];
  os: string;
  status: 'ACTIVE' | 'ISOLATED' | 'VULNERABLE';
  details: string;
  x: number;
  y: number;
}

interface NetworkTopologyProps {
  labName?: string;
  targetPort?: number;
  protocol?: string;
  targetIp?: string;
}

export default function NetworkTopology({
  labName = 'Target System',
  targetPort = 80,
  protocol = 'TCP',
  targetIp = '10.42.0.45'
}: NetworkTopologyProps) {
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  const nodes: NetworkNode[] = [
    {
      id: 'attacker',
      label: 'Operator Workstation',
      role: 'attacker',
      ip: '10.42.0.88',
      ports: ['22/TCP', '4444/TCP (Listener)'],
      os: 'Kali Linux Rolling (Sandboxed Pod)',
      status: 'ACTIVE',
      details: 'Assigned operator container instance with active terminal and desktop tools (Nmap, Wireshark, Dirb).',
      x: 80,
      y: 120
    },
    {
      id: 'gateway',
      label: 'NetworkPolicy Boundary',
      role: 'gateway',
      ip: '10.42.0.1',
      ports: ['53/UDP (DNS)', 'Traffic Filter'],
      os: 'Kubernetes CNI / Flannel Gateway',
      status: 'ISOLATED',
      details: 'Multi-tenant egress boundary blocking internet access and cross-namespace pod traversal.',
      x: 230,
      y: 120
    },
    {
      id: 'target',
      label: labName,
      role: 'target',
      ip: targetIp,
      ports: [`${targetPort}/TCP (${protocol})`, 'Ephemeral'],
      os: 'Debian GNU/Linux 12 (Target)',
      status: 'VULNERABLE',
      details: `Vulnerable target host running sandboxed scenario workload exposed on port ${targetPort}.`,
      x: 380,
      y: 120
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: '8px',
          background: 'rgba(0, 245, 212, 0.08)',
          border: '1px solid rgba(0, 245, 212, 0.2)'
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          🌐 <strong style={{ color: 'var(--cyber-cyan)' }}>Active Subnet Topology:</strong> Click any network node to inspect interfaces, open ports, and threat signatures.
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--cyber-emerald)', fontWeight: 800 }}>
          ● SUBNET 10.42.0.0/24 LIVE
        </span>
      </div>

      {/* SVG Network Map */}
      <div
        style={{
          position: 'relative',
          borderRadius: '12px',
          background: 'radial-gradient(circle at center, rgba(13, 20, 36, 0.9) 0%, rgba(5, 8, 17, 0.95) 100%)',
          border: '1px solid var(--border-card)',
          overflow: 'hidden',
          padding: '10px 0'
        }}
      >
        <svg viewBox="0 0 460 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Background Grid Accent */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.5" />
            </pattern>
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00f5d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          <rect width="460" height="220" fill="url(#grid)" />

          {/* Connection Cables */}
          <line x1="80" y1="120" x2="230" y2="120" stroke="url(#linkGrad)" strokeWidth="2" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="8;0" dur="1s" repeatCount="indefinite" />
          </line>
          <line x1="230" y1="120" x2="380" y2="120" stroke="url(#linkGrad)" strokeWidth="2" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="8;0" dur="1s" repeatCount="indefinite" />
          </line>

          {/* Packet Pulses */}
          <circle r="3" fill="#00f5d4">
            <animateMotion path="M 80 120 L 230 120" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle r="3" fill="#f43f5e">
            <animateMotion path="M 230 120 L 380 120" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Nodes */}
          {nodes.map((n) => {
            const isSelected = selectedNode?.id === n.id;
            const nodeColor =
              n.role === 'attacker' ? '#00f5d4' : n.role === 'gateway' ? '#3b82f6' : '#f43f5e';
            const nodeIcon = n.role === 'attacker' ? '💻' : n.role === 'gateway' ? '🛡️' : '🎯';

            return (
              <g
                key={n.id}
                onClick={() => setSelectedNode(n)}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow ring on hover/select */}
                {isSelected && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r="34"
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth="2"
                    strokeOpacity="0.6"
                  >
                    <animate attributeName="r" values="30;36;30" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                <circle
                  cx={n.x}
                  cy={n.y}
                  r="26"
                  fill="rgba(5, 8, 17, 0.9)"
                  stroke={nodeColor}
                  strokeWidth={isSelected ? '3' : '1.5'}
                  filter="drop-shadow(0px 0px 8px rgba(0,0,0,0.8))"
                />

                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  fontSize="14"
                  dominantBaseline="middle"
                >
                  {nodeIcon}
                </text>

                {/* Node Label */}
                <text
                  x={n.x}
                  y={n.y + 42}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="var(--font-sans)"
                >
                  {n.id === 'target' ? 'Target Pod' : n.label}
                </text>

                {/* IP Pill */}
                <text
                  x={n.x}
                  y={n.y + 56}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                >
                  {n.ip}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Node Details Card */}
      {selectedNode && (
        <div
          className="cyber-glass-card"
          style={{
            padding: '12px 14px',
            border: `1px solid ${
              selectedNode.role === 'attacker'
                ? 'rgba(0, 245, 212, 0.4)'
                : selectedNode.role === 'gateway'
                ? 'rgba(59, 130, 246, 0.4)'
                : 'rgba(244, 63, 94, 0.4)'
            }`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>
                {selectedNode.role === 'attacker' ? '💻' : selectedNode.role === 'gateway' ? '🛡️' : '🎯'}
              </span>
              <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{selectedNode.label}</strong>
            </div>

            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '10px',
                background:
                  selectedNode.status === 'VULNERABLE'
                    ? 'rgba(244, 63, 94, 0.2)'
                    : 'rgba(16, 185, 129, 0.2)',
                color: selectedNode.status === 'VULNERABLE' ? '#fb7185' : 'var(--cyber-emerald)'
              }}
            >
              {selectedNode.status}
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '8px' }}>
            {selectedNode.details}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.72rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px' }}>
              <span style={{ color: 'var(--text-dim)' }}>IP Address: </span>
              <span style={{ color: 'var(--cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedNode.ip}</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Open Ports: </span>
              <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{selectedNode.ports.join(', ')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
