'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import Modal from '@/components/Modal';
import { TableSkeleton } from '@/components/Skeleton';
import styles from './instructor.module.css';

interface Cohort {
  id: string;
  name: string;
  description: string;
  code: string;
  studentCount: number;
  assignmentCount: number;
  createdAt: string;
}

interface MatrixTask {
  id: string;
  title: string;
  points: number;
  labName?: string;
  mitreTechnique?: string;
}

interface StudentTaskStatus {
  taskId: string;
  taskTitle: string;
  isSolved: boolean;
  awardedPoints: number;
  hintsUsedCount: number;
  pointsDeducted: number;
}

interface MatrixRow {
  student: {
    id: string;
    username: string;
    email: string;
    xp: number;
    level: number;
    rankTitle: string;
    lastActiveAt?: string;
  };
  joinedAt: string;
  totalSolved: number;
  totalTasks: number;
  completionRate: number;
  totalScore: number;
  taskStatuses: StudentTaskStatus[];
  isStuck: boolean;
  activeSession: { id: string; startedAt: string } | null;
}

interface LabOption {
  id: string;
  name: string;
  category: string;
  difficulty: string;
}

export default function InstructorPortalPage() {
  const router = useRouter();
  const { token, apiUrl, user, openAuthModal } = useAuth();
  const toast = useToast();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [matrixTasks, setMatrixTasks] = useState<MatrixTask[]>([]);
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [availableLabs, setAvailableLabs] = useState<LabOption[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [matrixLoading, setMatrixLoading] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortDesc, setNewCohortDesc] = useState('');
  const [assignTitle, setAssignTitle] = useState('');
  const [assignLabId, setAssignLabId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check role guard
  const isAuthorized = user && (user.role === 'INSTRUCTOR' || user.role === 'ADMIN');

  // Load cohorts & available labs
  useEffect(() => {
    if (!token || !isAuthorized) {
      setLoading(false);
      return;
    }

    const initData = async () => {
      try {
        setLoading(true);
        const [cRes, lRes] = await Promise.all([
          fetch(`${apiUrl}/api/instructor/cohorts`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiUrl}/api/labs`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (cRes.ok) {
          const cData = await cRes.json();
          setCohorts(cData.cohorts || []);
          if (cData.cohorts?.length > 0) {
            setSelectedCohortId(cData.cohorts[0].id);
          }
        }

        if (lRes.ok) {
          const lData = await lRes.json();
          setAvailableLabs(lData.labs || []);
          if (lData.labs?.length > 0) {
            setAssignLabId(lData.labs[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load instructor data:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [token, apiUrl, isAuthorized]);

  // Load matrix whenever selectedCohortId changes
  useEffect(() => {
    if (!selectedCohortId || !token) return;

    const fetchMatrix = async () => {
      try {
        setMatrixLoading(true);
        const res = await fetch(`${apiUrl}/api/instructor/cohorts/${selectedCohortId}/matrix`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setMatrixTasks(data.tasks || []);
          setMatrixRows(data.matrix || []);
        }
      } catch (err) {
        console.error('Failed to load cohort matrix:', err);
      } finally {
        setMatrixLoading(false);
      }
    };

    fetchMatrix();
  }, [selectedCohortId, token, apiUrl]);

  const filteredMatrixRows = useMemo(() => {
    if (!studentSearch.trim()) return matrixRows;
    const q = studentSearch.toLowerCase();
    return matrixRows.filter(
      (r) =>
        r.student.username.toLowerCase().includes(q) ||
        r.student.email.toLowerCase().includes(q) ||
        (r.student.rankTitle && r.student.rankTitle.toLowerCase().includes(q))
    );
  }, [matrixRows, studentSearch]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Cohort invite code copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohortName.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`${apiUrl}/api/instructor/cohorts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCohortName.trim(),
          description: newCohortDesc.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Cohort "${data.cohort.name}" successfully created!`);
        setCohorts((prev) => [data.cohort, ...prev]);
        setSelectedCohortId(data.cohort.id);
        setIsCreateModalOpen(false);
        setNewCohortName('');
        setNewCohortDesc('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create cohort.');
      }
    } catch {
      toast.error('Network error creating cohort.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCohortId || !assignTitle.trim() || !assignLabId) return;

    try {
      setSubmitting(true);
      const res = await fetch(`${apiUrl}/api/instructor/cohorts/${selectedCohortId}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: assignTitle.trim(),
          labId: assignLabId,
          dueDate: assignDueDate ? new Date(assignDueDate).toISOString() : null
        })
      });

      if (res.ok) {
        toast.success('Scenario assignment assigned to cohort!');
        setIsAssignModalOpen(false);
        setAssignTitle('');
        setAssignDueDate('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to assign scenario.');
      }
    } catch {
      toast.error('Network error assigning scenario.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: '540px', margin: '6rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <div style={{ background: 'var(--bg-card, #F9FAFC)', border: '1px solid var(--border-card)', borderRadius: '16px', padding: '3.5rem 2rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👨‍🏫</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
            Instructor Access Required
          </h2>
          <p style={{ color: 'var(--text-body)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
            Sign in with an instructor or platform administrator credential to access cohort telemetry.
          </p>
          <button
            onClick={openAuthModal}
            className={styles.primaryBtn}
            style={{ width: 'auto', display: 'inline-flex', padding: '10px 24px' }}
          >
            Authenticate →
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div style={{ maxWidth: '540px', margin: '6rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <div style={{ background: 'var(--bg-card, #F9FAFC)', border: '1px solid var(--border-card)', borderRadius: '16px', padding: '3.5rem 2rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: '#e11d48' }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--text-body)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
            Your account role ({user?.role}) does not possess instructor permissions. Please contact your range administrator.
          </p>
          <button
            onClick={() => router.push('/')}
            className={styles.secondaryBtn}
            style={{ width: 'auto', display: 'inline-flex' }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const selectedCohort = cohorts.find((c) => c.id === selectedCohortId);
  const totalStudents = cohorts.reduce((acc, c) => acc + c.studentCount, 0);
  const stuckStudents = matrixRows.filter((r) => r.isStuck);
  const avgCompletion = matrixRows.length > 0
    ? Math.round(matrixRows.reduce((acc, r) => acc + r.completionRate, 0) / matrixRows.length)
    : 0;

  return (
    <div className={styles.container}>
      {/* Header & Quick Telemetry HUD */}
      <div className={styles.headerCard}>
        <div>
          <div className={styles.headerTitleRow}>
            <span style={{ fontSize: '1.8rem' }}>👨‍🏫</span>
            <h1 className={styles.title}>Instructor Command Portal</h1>
            <span className={styles.headerTag}>COHORT TELEMETRY</span>
          </div>
          <p className={styles.subtitle}>
            Oversee classroom scenarios, track live objective submissions, manage class invite keys, and diagnose student bottlenecks in real-time.
          </p>
        </div>

        {/* Global Stats Grid */}
        <div className={styles.hudGrid}>
          <div className={styles.hudCard}>
            <div className={styles.hudLabel}>Active Cohorts</div>
            <div className={styles.hudValue}>{cohorts.length}</div>
          </div>

          <div className={styles.hudCard}>
            <div className={styles.hudLabel}>Enrolled Cadets</div>
            <div className={styles.hudValue} style={{ color: 'var(--text-main)' }}>{totalStudents}</div>
          </div>

          <div className={styles.hudCard}>
            <div className={styles.hudLabel}>Avg Progress</div>
            <div className={styles.hudValue} style={{ color: '#16a34a' }}>{avgCompletion}%</div>
          </div>

          <div className={stuckStudents.length > 0 ? styles.hudAlertCard : styles.hudCard}>
            <div className={stuckStudents.length > 0 ? styles.hudAlertLabel : styles.hudLabel}>Bottlenecks</div>
            <div className={stuckStudents.length > 0 ? styles.hudAlertValue : styles.hudValue} style={stuckStudents.length === 0 ? { color: 'var(--text-muted)' } : {}}>
              {stuckStudents.length}
            </div>
          </div>
        </div>
      </div>

      {/* Cohort Management Controls Bar */}
      <div className={styles.controlsBar}>
        {/* Cohort Tabs */}
        <div className={styles.cohortTabs}>
          {cohorts.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCohortId(c.id)}
              className={`${styles.cohortTab} ${selectedCohortId === c.id ? styles.cohortTabActive : ''}`}
            >
              <span>{c.name}</span>
              <span className={styles.countPill}>
                {c.studentCount}
              </span>
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className={styles.actionRow}>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className={styles.secondaryBtn}
          >
            <span>➕</span>
            <span>New Cohort</span>
          </button>

          <button
            onClick={() => setIsAssignModalOpen(true)}
            disabled={!selectedCohortId}
            className={styles.primaryBtn}
          >
            <span>🎯</span>
            <span>Assign Scenario</span>
          </button>
        </div>
      </div>

      {/* Selected Cohort Identity Banner */}
      {selectedCohort && (
        <div className={styles.cohortBanner}>
          <div>
            <h2 className={styles.cohortBannerTitle}>
              {selectedCohort.name}
            </h2>
            <p className={styles.cohortBannerDesc}>
              {selectedCohort.description || 'Targeted cyber defense training cohort.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Class Invite Code:
            </span>
            <div className={styles.codeBox}>
              <code className={styles.codeText}>
                {selectedCohort.code}
              </code>
              <button
                onClick={() => handleCopyCode(selectedCohort.code)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copiedCode === selectedCohort.code ? '#16a34a' : 'var(--brand-primary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Copy student invite code"
              >
                {copiedCode === selectedCohort.code ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Struggling Students Alert Panel */}
      {stuckStudents.length > 0 && (
        <div className={styles.alertPanel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#be123c', margin: 0 }}>
              Cadet Bottleneck Detected ({stuckStudents.length})
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#9f1239', marginBottom: '10px' }}>
            The following student(s) have an active lab session running for &gt;30 minutes without scoring an initial flag:
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {stuckStudents.map((s) => (
              <span
                key={s.student.id}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #fecdd3',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#be123c'
                }}
              >
                {s.student.username} ({s.student.email})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2D Student Progress Matrix */}
      <div className={styles.matrixCard}>
        <div className={styles.tableHeaderRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>🎯</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Live Scenario Completion Matrix
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Real-time per-objective telemetry across all enrolled operators
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                placeholder="Filter cadets..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className={styles.searchInput}
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  title="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>

            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ color: '#15803d', fontWeight: 700 }}>Solved</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} />
              <span style={{ color: '#b45309', fontWeight: 700 }}>Hints Used</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} />
              <span style={{ color: 'var(--text-muted)' }}>Unattempted</span>
            </span>
          </div>
        </div>

        {matrixLoading ? (
          <div style={{ padding: '1.5rem 0' }}>
            <TableSkeleton rows={4} cols={Math.max(matrixTasks.length + 3, 5)} />
          </div>
        ) : matrixRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '10px' }}>No students enrolled in this cohort yet.</p>
            <p style={{ fontSize: '0.85rem' }}>
              Share the invite code <code style={{ color: 'var(--brand-primary)', fontWeight: 800 }}>{selectedCohort?.code}</code> with your students to begin telemetry.
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{ minWidth: '180px' }}>CADET / OPERATOR</th>
                <th className={styles.th} style={{ width: '90px' }}>RANK</th>
                <th className={styles.th} style={{ width: '110px' }}>PROGRESS</th>
                <th className={styles.th} style={{ width: '90px' }}>TOTAL XP</th>
                {matrixTasks.map((t) => (
                  <th
                    key={t.id}
                    className={styles.th}
                    style={{
                      minWidth: '130px',
                      maxWidth: '160px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={`${t.labName ? `[${t.labName}] ` : ''}${t.title} (${t.points} pts)`}
                  >
                    <div>{t.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                      {t.points} XP {t.mitreTechnique ? `• ${t.mitreTechnique}` : ''}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMatrixRows.map((row) => (
                <tr
                  key={row.student.id}
                  className={styles.tr}
                  style={row.isStuck ? { backgroundColor: '#fff1f2' } : {}}
                >
                  {/* Student Name & Email */}
                  <td className={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {row.isStuck && <span title="Stalled in active session" style={{ color: '#e11d48' }}>⚠️</span>}
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                          {row.student.username}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {row.student.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Level / Rank */}
                  <td className={styles.td}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        color: 'var(--brand-primary)',
                        fontSize: '0.7rem',
                        fontWeight: 800
                      }}
                    >
                      LVL {row.student.level}
                    </span>
                  </td>

                  {/* Progress % */}
                  <td className={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${row.completionRate}%`,
                            background: row.completionRate === 100 ? '#16a34a' : 'var(--brand-primary)'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', minWidth: '32px' }}>
                        {row.completionRate}%
                      </span>
                    </div>
                  </td>

                  {/* Total Score */}
                  <td className={styles.td} style={{ fontWeight: 800, color: 'var(--brand-primary)' }}>
                    +{row.totalScore} XP
                  </td>

                  {/* Per-Task Columns */}
                  {matrixTasks.map((t) => {
                    const taskStatus = row.taskStatuses.find((ts) => ts.taskId === t.id);
                    const isSolved = taskStatus?.isSolved || false;
                    const hintsUsed = taskStatus?.hintsUsedCount || 0;

                    return (
                      <td key={t.id} className={styles.td}>
                        {isSolved ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: '#f0fdf4',
                              border: '1px solid #86efac',
                              color: '#15803d',
                              fontSize: '0.72rem',
                              fontWeight: 800
                            }}
                          >
                            <span>✓</span>
                            <span>+{taskStatus?.awardedPoints}</span>
                            {hintsUsed > 0 && (
                              <span title={`${hintsUsed} hint(s) deducted points`} style={{ color: '#d97706', fontSize: '0.68rem' }}>
                                ({hintsUsed}h)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: 'var(--bg, #EEF2F7)',
                              border: '1px solid #e2e8f0',
                              color: 'var(--text-muted)',
                              fontSize: '0.72rem'
                            }}
                          >
                            —
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Create Cohort */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Training Cohort"
        icon="👥"
        maxWidth="480px"
      >
        <form onSubmit={handleCreateCohort} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Cohort Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Advanced SOC Analysts 2026"
              value={newCohortName}
              onChange={(e) => setNewCohortName(e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Description (Optional)
            </label>
            <textarea
              placeholder="e.g. Defensive network monitoring and incident response training..."
              rows={3}
              value={newCohortDesc}
              onChange={(e) => setNewCohortDesc(e.target.value)}
              className={styles.formInput}
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className={styles.secondaryBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={styles.primaryBtn}
            >
              {submitting ? 'Creating...' : 'Deploy Cohort'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Scenario */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Scenario to Cohort"
        icon="🎯"
        maxWidth="500px"
      >
        <form onSubmit={handleAssignScenario} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Assignment Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Lab Exercise 1: Workstation Reconnaissance"
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Select Scenario Lab *
            </label>
            <select
              value={assignLabId}
              onChange={(e) => setAssignLabId(e.target.value)}
              className={styles.formInput}
            >
              {availableLabs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} [{l.category} • {l.difficulty}]
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Target Due Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={assignDueDate}
              onChange={(e) => setAssignDueDate(e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className={styles.secondaryBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={styles.primaryBtn}
            >
              {submitting ? 'Publishing...' : 'Publish Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
