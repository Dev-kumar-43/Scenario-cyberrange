'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';

interface SearchItem {
  id: string;
  title: string;
  type: string;
  route: string;
  icon: string;
  keywords: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  token: string | null;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  apiUrl,
  token
}: GlobalSearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(['SQL', 'Network', 'Workstation', 'Active Directory']);

  // Fetch searchable content (paths + labs) once
  useEffect(() => {
    if (!isOpen) return;

    const fetchIndex = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [labsRes, pathsRes] = await Promise.all([
          fetch(`${apiUrl}/api/labs`).catch(() => null),
          fetch(`${apiUrl}/api/learning/paths`, { headers }).catch(() => null)
        ]);

        const indexItems: SearchItem[] = [];

        if (pathsRes && pathsRes.ok) {
          const pData = await pathsRes.json();
          (pData.paths || []).forEach((p: any) => {
            indexItems.push({
              id: `path-${p.id}`,
              title: p.title,
              type: `Learning Path • ${p.difficulty}`,
              route: `/academy?path=${p.slug}`,
              icon: p.icon || '🛡️',
              keywords: `${p.title} ${p.description || ''} ${p.difficulty || ''}`
            });

            // Also index its modules
            (p.modules || []).forEach((m: any) => {
              indexItems.push({
                id: `mod-${m.id}`,
                title: m.title,
                type: `Course Module • ${p.title}`,
                route: `/academy?path=${p.slug}&module=${m.id}`,
                icon: '📖',
                keywords: `${m.title} ${m.description || ''}`
              });
            });
          });
        }

        if (labsRes && labsRes.ok) {
          const lData = await labsRes.json();
          (lData.labs || []).forEach((l: any) => {
            indexItems.push({
              id: `lab-${l.id}`,
              title: l.name,
              type: `Lab Scenario • ${l.protocol === 'VNC' ? 'Desktop GUI' : 'Terminal'}`,
              route: `/?scenario=${l.id}`,
              icon: l.protocol === 'VNC' ? '🖥️' : '💻',
              keywords: `${l.name} ${l.description || ''} ${l.category || ''} ${l.difficulty || ''}`
            });
          });
        }

        setItems(indexItems);
      } catch (e) {
        console.error('Failed to load search index:', e);
      }
    };

    fetchIndex();
  }, [isOpen, apiUrl, token]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, items]);

  const handleSelect = (route: string, label: string) => {
    if (query.trim()) {
      setRecentSearches(prev => [label, ...prev.filter(s => s !== label)].slice(0, 5));
    }
    onClose();
    router.push(route);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Search CyberRange"
      icon="🔍"
      maxWidth="560px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Search Bar Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg-card, #F9FAFC)',
            border: '2px solid var(--blue)',
            borderRadius: '10px',
            boxShadow: '0 0 0 3px rgba(46, 76, 109, 0.12)'
          }}
        >
          <span style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search courses, modules, labs, and skills..."
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '15px',
              fontFamily: 'inherit',
              color: 'var(--ink)'
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: '#f1f5f9',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'grid',
                placeItems: 'center',
                fontSize: '11px',
                color: 'var(--muted)'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Results / Suggestions Area */}
        {query ? (
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
              {filteredResults.length} matching result{filteredResults.length === 1 ? '' : 's'}
            </div>
            {filteredResults.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                No matches found for &quot;{query}&quot;. Try &quot;web&quot;, &quot;network&quot;, or &quot;sql&quot;.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                {filteredResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.route, item.title)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg-card, #F9FAFC)',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--sky)';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--bg-card, #F9FAFC)';
                      e.currentTarget.style.borderColor = 'var(--line)';
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '14px', color: 'var(--ink)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </strong>
                      <small style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {item.type}
                      </small>
                    </div>
                    <span style={{ color: 'var(--blue)', fontSize: '14px' }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '8px' }}>
              SUGGESTED TOPICS
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {['Web Security', 'Network Recon', 'SQL Injection', 'Linux GUI', 'Cloud IAM'].map(topic => (
                <button
                  key={topic}
                  onClick={() => setQuery(topic)}
                  className="chip"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg-card, #F9FAFC)',
                    fontSize: '13px',
                    color: 'var(--muted)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--blue)';
                    e.currentTarget.style.color = 'var(--blue)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--line)';
                    e.currentTarget.style.color = 'var(--muted)';
                  }}
                >
                  {topic}
                </button>
              ))}
            </div>

            {recentSearches.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                  POPULAR SEARCHES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {recentSearches.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQuery(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        color: 'var(--muted)',
                        fontSize: '13px',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--sky)';
                        e.currentTarget.style.color = 'var(--blue)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--muted)';
                      }}
                    >
                      <span>⏱️</span>
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
