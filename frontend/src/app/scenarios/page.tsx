'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import AstraIcon from '@/components/AstraIcons';
import styles from './scenarios.module.css';

interface ScenarioMachine {
  id: string;
  name: string;
  os: string;
  role: 'ATTACKER' | 'TARGET' | 'SERVER';
  roleTitle: string;
  hostname: string;
  description: string;
}

interface Scenario {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  mitreTactics: string[];
  mitreTechniques: string[];
  skillsCovered: string[];
  learningObjectives: string[];
  labRequirements: string[];
  machines: ScenarioMachine[];
}

interface ProvisioningStage {
  label: string;
  isComplete: boolean;
  isActive: boolean;
}

export default function ScenariosCatalogPage() {
  const { token, apiUrl, user, openAuthModal } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Detail Modal State
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  // Provisioning Modal State
  const [provisioningSessionId, setProvisioningSessionId] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisioningStatus, setProvisioningStatus] = useState<any>(null);
  const [launching, setLaunching] = useState<boolean>(false);

  // Fetch scenarios from backend
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/api/scenarios`);
        if (res.ok) {
          const data = await res.json();
          setScenarios(data.scenarios || []);
        } else {
          toast.error('Failed to load scenario catalog.');
        }
      } catch (err) {
        console.error('Error fetching scenarios:', err);
        toast.error('Network error connecting to orchestrator.');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [apiUrl]);

  // Polling provisioning status
  useEffect(() => {
    if (!provisioningSessionId || !token) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/scenarios/sessions/${provisioningSessionId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          setProvisioningStatus(data);

          if (data.status === 'RUNNING' && data.ready) {
            clearInterval(pollInterval);
            toast.success('Isolated scenario environment is fully provisioned and verified!');
            setTimeout(() => {
              router.push(`/scenarios/environment/${provisioningSessionId}`);
            }, 1200);
          } else if (data.status === 'ERROR') {
            clearInterval(pollInterval);
            toast.error('Encountered an error while provisioning scenario.');
            setIsProvisioning(false);
          }
        }
      } catch (err) {
        console.warn('Status poll error:', err);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [provisioningSessionId, token, apiUrl, router, toast]);

  // Handle Scenario Launch
  const handleLaunchScenario = async (scenario: Scenario) => {
    if (!user) {
      openAuthModal();
      return;
    }

    try {
      setLaunching(true);
      const res = await fetch(`${apiUrl}/api/scenarios/${scenario.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        setProvisioningSessionId(data.sessionId);
        setIsProvisioning(true);
        setSelectedScenario(null);
        toast.info('Initializing isolated multi-OS cluster environment...');
      } else {
        toast.error(data.error || 'Failed to start scenario environment.');
      }
    } catch (err) {
      console.error('Launch error:', err);
      toast.error('Failed to trigger scenario deployment.');
    } finally {
      setLaunching(false);
    }
  };

  // Filter scenarios
  const filteredScenarios = scenarios.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.skillsCovered.some((sk) => sk.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...Array.from(new Set(scenarios.map((s) => s.category)))];

  // Derive real provisioning progress stages
  const getStages = (): ProvisioningStage[] => {
    const s = provisioningStatus?.stages;
    const status = provisioningStatus?.status || 'CREATING';
    const isBec = provisioningStatus?.scenarioId === 'bec-investigation';

    if (isBec) {
      return [
        {
          label: 'Allocating dedicated Kubernetes scenario namespace',
          isComplete: Boolean(s?.environmentNamespace),
          isActive: status === 'PENDING' || status === 'CREATING'
        },
        {
          label: 'Deploying zero-trust NetworkPolicy isolation (block external egress)',
          isComplete: Boolean(s?.internalNetwork),
          isActive: Boolean(s?.environmentNamespace && !s?.internalNetwork)
        },
        {
          label: 'Initializing Incident Response Workstation & display engine (Priority 10)',
          isComplete: Boolean(s?.workstationStarted && s?.workstationReady),
          isActive: Boolean(s?.internalNetwork && !s?.workstationReady)
        },
        {
          label: 'Booting Mailpit Mock Mail Server & Webmail on port 8025 (Priority 15)',
          isComplete: Boolean(s?.webmailAccessible),
          isActive: Boolean(s?.workstationReady && !s?.webmailAccessible)
        },
        {
          label: 'Starting Apex Executive Portal & Rule Auditor on port 8080 (Priority 15)',
          isComplete: Boolean(s?.browserAccessible),
          isActive: Boolean(s?.webmailAccessible && !s?.browserAccessible)
        },
        {
          label: 'Connecting noVNC management gateway on port 6901 (Priority 30)',
          isComplete: Boolean(s?.desktopAccessible),
          isActive: Boolean(s?.browserAccessible && !s?.desktopAccessible)
        }
      ];
    }

    return [
      {
        label: 'Allocating dedicated Kubernetes scenario namespace',
        isComplete: Boolean(s?.environmentNamespace),
        isActive: status === 'PENDING' || status === 'CREATING'
      },
      {
        label: 'Deploying zero-trust NetworkPolicy isolation (block external egress)',
        isComplete: Boolean(s?.internalNetwork),
        isActive: Boolean(s?.environmentNamespace && !s?.internalNetwork)
      },
      {
        label: 'Starting Kali Linux Workstation (Attacker)',
        isComplete: Boolean(s?.kaliStarted && s?.kaliReady),
        isActive: Boolean(s?.internalNetwork && !s?.kaliReady)
      },
      {
        label: 'Starting Ubuntu Linux Workstation (Target)',
        isComplete: Boolean(s?.ubuntuStarted && s?.ubuntuReady),
        isActive: Boolean(s?.kaliReady && !s?.ubuntuReady)
      },
      {
        label: 'Configuring NodePort management gateways (noVNC / Terminal)',
        isComplete: Boolean(s?.desktopAccessible),
        isActive: Boolean(s?.ubuntuReady && !s?.desktopAccessible)
      },
      {
        label: 'Verifying Kali ↔ Ubuntu internal connectivity & zero-egress enforcement',
        isComplete: Boolean(s?.internalConnectivity && s?.externalBlocked),
        isActive: Boolean(s?.desktopAccessible && !s?.internalConnectivity)
      }
    ];
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <AstraIcon name="network" size={30} style={{ stroke: 'var(--blue, #2E4C6D)' }} />
            Scenario Environments
          </h1>
        </div>
        <p className={styles.subtitle}>
          Launch isolated, multi-operating-system cybersecurity lab environments. Practice real attacker reconnaissance,
          lateral movement, and target auditing within a zero-leakage, egress-restricted Kubernetes sandbox.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <AstraIcon name="search" size={16} style={{ color: '#64748B' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search scenarios, tactics, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.categoryPills}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`${styles.pill} ${selectedCategory === cat ? styles.activePill : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'ALL' ? 'All Scenarios' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
          Loading scenario environments...
        </div>
      ) : filteredScenarios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
          No scenario environments match your filter criteria.
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredScenarios.map((scenario) => (
            <div key={scenario.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span
                  className={`${styles.badgeCategory} ${
                    scenario.category === 'EMAIL SECURITY & FORENSICS' ? styles.badgeCategoryEmail : ''
                  }`}
                >
                  {scenario.category}
                </span>
                <span className={styles.badgeDifficulty}>{scenario.difficulty}</span>
              </div>

              <h2 className={styles.cardTitle}>{scenario.name}</h2>
              <div className={styles.cardTagline}>{scenario.tagline}</div>
              <p className={styles.cardDescription}>{scenario.description}</p>

              {/* Machines in Scenario */}
              <div className={styles.machinesSection}>
                <span className={styles.machinesLabel}>Topology Nodes ({scenario.machines.length} Workstations)</span>
                <div className={styles.machineChips}>
                  {scenario.machines.map((m) => {
                    const isMailpit = m.id === 'mailpit';
                    const isGophish = m.id === 'gophish';
                    const isAnalyst = m.role === 'ATTACKER' || m.id === 'kali';
                    const roleBadgeClass = isAnalyst
                      ? styles.roleAttacker
                      : isMailpit
                      ? styles.roleMailpit
                      : isGophish
                      ? styles.roleGophish
                      : styles.roleTarget;
                    const roleLabel = isMailpit
                      ? 'MAILPIT'
                      : isGophish
                      ? 'GOPHISH'
                      : isAnalyst && scenario.id === 'bec-investigation'
                      ? 'ANALYST'
                      : m.role;

                    return (
                      <div key={m.id} className={`${styles.machineChip} ${roleBadgeClass}`}>
                        <AstraIcon name={isAnalyst ? 'shield' : isMailpit ? 'mail' : 'monitor'} size={14} />
                        <span>{m.name}</span>
                        <strong style={{ fontSize: '10px', textTransform: 'uppercase' }}>[{roleLabel}]</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card Footer */}
              <div className={styles.cardFooter}>
                <div className={styles.metaGroup}>
                  <span className={styles.metaItem}>
                    <AstraIcon name="clock" size={14} />
                    {scenario.estimatedMinutes} min
                  </span>
                  <span className={styles.metaItem}>
                    <AstraIcon name="lock" size={14} />
                    Zero Egress
                  </span>
                </div>

                <button
                  className={styles.btnPrimary}
                  onClick={() => setSelectedScenario(scenario)}
                >
                  <span>View Scenario & Launch</span>
                  <AstraIcon name="arrow" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scenario Details Modal */}
      {selectedScenario && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedScenario(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.badgeCategory}>{selectedScenario.category}</span>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>
                  {selectedScenario.name}
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--blue, #2E4C6D)', fontWeight: 600 }}>
                  {selectedScenario.tagline}
                </p>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setSelectedScenario(null)}
                aria-label="Close modal"
              >
                <AstraIcon name="close" size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.6, marginBottom: '24px' }}>
                {selectedScenario.description}
              </p>

              {/* Visual Network Topology Diagram */}
              <div className={styles.topologyContainer}>
                <div className={styles.topologyHeader}>
                  <span>ISOLATED LAB TOPOLOGY SPECIFICATION</span>
                  <span>SECURITY BOUNDARY: STRICT ZERO-EGRESS</span>
                </div>

                <div className={styles.topologyDiagram}>
                  {selectedScenario.id === 'bec-investigation' ? (
                    <>
                      {/* Node 1: Kali Linux Analyst */}
                      <div className={`${styles.topologyNode} ${styles.nodeAttacker}`}>
                        <div className={styles.nodeTitle}>Kali Linux</div>
                        <span className={styles.nodeRole} style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                          ANALYST
                        </span>
                        <div className={styles.nodeIp}>Node: analyst-workstation</div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Port 6901 noVNC</div>
                      </div>

                      {/* Internal Connection Wire */}
                      <div className={styles.topologyWire}>
                        <span className={styles.wireLabel}>Internal Bus</span>
                        <div className={styles.wireLine}>
                          <span className={styles.wirePulse} />
                        </div>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>SMTP :1025</span>
                      </div>

                      {/* Node 2: Corporate Mail Server (Mailpit) */}
                      <div className={`${styles.topologyNode} ${styles.nodeTarget}`} style={{ border: '1px solid rgba(2, 132, 199, 0.4)' }}>
                        <div className={styles.nodeTitle}>Mail Server</div>
                        <span className={styles.nodeRole} style={{ background: '#0c4a6e', color: '#7dd3fc' }}>
                          MAILPIT
                        </span>
                        <div className={styles.nodeIp}>Node: mail-server</div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Port 8025 Webmail</div>
                      </div>

                      {/* Internal Connection Wire */}
                      <div className={styles.topologyWire}>
                        <span className={styles.wireLabel}>HTTP API</span>
                        <div className={styles.wireLine}>
                          <span className={styles.wirePulse} />
                        </div>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Port :8080</span>
                      </div>

                      {/* Node 3: Apex Intranet & Phishing Engine */}
                      <div className={`${styles.topologyNode}`} style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.4)' }}>
                        <div className={styles.nodeTitle} style={{ color: '#fde68a' }}>Phish Engine</div>
                        <span className={styles.nodeRole} style={{ background: '#78350f', color: '#fde68a' }}>
                          GOPHISH
                        </span>
                        <div className={styles.nodeIp}>Node: phish-engine</div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Port 8080 Portal</div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Attacker Node */}
                      <div className={`${styles.topologyNode} ${styles.nodeAttacker}`}>
                        <div className={styles.nodeTitle}>Kali Linux</div>
                        <span className={styles.nodeRole} style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                          ATTACKER
                        </span>
                        <div className={styles.nodeIp}>Node: kali-attacker</div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Port 6901 noVNC</div>
                      </div>

                      {/* Internal Connection Wire */}
                      <div className={styles.topologyWire}>
                        <span className={styles.wireLabel}>Internal Network</span>
                        <div className={styles.wireLine}>
                          <span className={styles.wirePulse} />
                        </div>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Bi-directional L3</span>
                      </div>

                      {/* Target Node */}
                      <div className={`${styles.topologyNode} ${styles.nodeTarget}`}>
                        <div className={styles.nodeTitle}>Ubuntu Linux</div>
                        <span className={styles.nodeRole} style={{ background: '#0c4a6e', color: '#7dd3fc' }}>
                          TARGET / VICTIM
                        </span>
                        <div className={styles.nodeIp}>Node: ubuntu-target</div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Port 80 (HTTP) + 6901</div>
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.topologyFooter}>
                  <span className={styles.isolatedBadge}>
                    <AstraIcon name="lock" size={14} />
                    External Internet Access: <strong>BLOCKED</strong>
                  </span>
                  <span style={{ color: '#10b981' }}>
                    Multi-Tenant Isolation: <strong>ENFORCED</strong>
                  </span>
                </div>
              </div>

              {/* Learning Objectives */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                  Learning Objectives
                </h3>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedScenario.learningObjectives.map((obj, i) => (
                    <li key={i} style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skills Covered */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                  Skills Covered
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedScenario.skillsCovered.map((skill, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '4px 12px',
                        borderRadius: '6px'
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* MITRE Mapping */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                  MITRE ATT&CK Mapping
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedScenario.mitreTechniques.map((tech, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(46, 76, 109, 0.08)',
                        color: 'var(--blue, #2E4C6D)',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '6px'
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  className={styles.pill}
                  onClick={() => setSelectedScenario(null)}
                  disabled={launching}
                >
                  Cancel
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={() => handleLaunchScenario(selectedScenario)}
                  disabled={launching}
                >
                  <AstraIcon name="bolt" size={16} />
                  <span>{launching ? 'Initializing...' : 'Launch Isolated Scenario'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Provisioning Progress Modal */}
      {isProvisioning && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent} style={{ maxWidth: '640px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                  Provisioning Scenario Environment
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  Deploying multi-OS Kubernetes workloads and verifying zero-trust isolation...
                </p>
              </div>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.stepper}>
                {getStages().map((stage, idx) => (
                  <div key={idx} className={styles.stepItem}>
                    <div
                      className={`${styles.stepIcon} ${
                        stage.isComplete
                          ? styles.stepDone
                          : stage.isActive
                          ? styles.stepActive
                          : styles.stepPending
                      }`}
                    >
                      {stage.isComplete ? '✓' : idx + 1}
                    </div>
                    <span
                      style={{
                        fontWeight: stage.isActive || stage.isComplete ? 600 : 400,
                        color: stage.isComplete ? '#0f172a' : stage.isActive ? 'var(--blue, #2E4C6D)' : '#94a3b8'
                      }}
                    >
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>

              {provisioningStatus?.ready && (
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <button
                    className={styles.btnPrimary}
                    style={{ margin: '0 auto' }}
                    onClick={() => router.push(`/scenarios/environment/${provisioningSessionId}`)}
                  >
                    <span>Enter Scenario Environment</span>
                    <AstraIcon name="arrow" size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
