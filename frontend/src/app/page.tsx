'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import ProgressRing from '../components/ProgressRing';
import LaunchModal from '../components/LaunchModal';
import AstraIcon from '../components/AstraIcons';
import { CardSkeleton } from '../components/Skeleton';
import styles from './page.module.css';

interface Lab {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  protocol: string;
  cpuLimit: string;
  memLimit: string;
  exposedPort: number;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  labId: string | null;
  taskCount: number;
}

interface LearningPath {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  difficulty: string;
  totalModules: number;
  totalEstimatedMinutes: number;
  totalTasks: number;
  solvedTasks: number;
  progress: number;
  modules: Module[];
}

interface RadarItem {
  domain: string;
  score: number;
}

interface StudentProfile {
  user: {
    username: string;
    level: number;
    rankTitle: string;
    xp: number;
    streakDays: number;
  };
  solvedCount: number;
  badges: any[];
  radarData: RadarItem[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, openAuthModal, apiUrl } = useAuth();
  const toast = useToast();

  const [labs, setLabs] = useState<Lab[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Practice section filters
  const [practiceCategory, setPracticeCategory] = useState<string>('All');
  const [practiceSearch, setPracticeSearch] = useState<string>('');
  const [practiceDifficulty, setPracticeDifficulty] = useState<string>('All difficulties');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Launch lab modal state
  const [labToLaunch, setLabToLaunch] = useState<Lab | null>(null);
  const [launching, setLaunching] = useState(false);

  // 1. Fetch scenarios catalog
  useEffect(() => {
    const fetchLabs = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/labs`);
        const data = await response.json();
        setLabs(data.labs || []);
      } catch (error) {
        console.error('Failed to fetch labs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLabs();
  }, [apiUrl]);

  // 2. Fetch active sessions if authenticated
  useEffect(() => {
    if (!token) {
      setActiveSessions([]);
      return;
    }

    const fetchSessions = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/labs/sessions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const running = (data.sessions || []).filter(
            (s: any) => s.status !== 'STOPPED' && s.status !== 'ERROR'
          );
          setActiveSessions(running);
        }
      } catch {
        // Silently tolerate background poll errors
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [token, apiUrl]);

  // 3. Fetch learning paths & profile
  useEffect(() => {
    if (!token) {
      setLearningPaths([]);
      setProfile(null);
      return;
    }

    const fetchLearning = async () => {
      try {
        const [pathsRes, profRes] = await Promise.all([
          fetch(`${apiUrl}/api/learning/paths`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null),
          fetch(`${apiUrl}/api/learning/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null)
        ]);

        if (pathsRes && pathsRes.ok) {
          const pData = await pathsRes.json();
          setLearningPaths(pData.paths || []);
        }

        if (profRes && profRes.ok) {
          const prData = await profRes.json();
          setProfile(prData);
        }
      } catch (e) {
        console.error('Failed to load learning data:', e);
      }
    };

    fetchLearning();
  }, [token, apiUrl]);

  // Global '/' shortcut to focus practice search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Launch Lab handler using real POST /api/labs/start
  const handleConfirmLaunch = async () => {
    if (!labToLaunch) return;
    if (!user || !token) {
      setLabToLaunch(null);
      openAuthModal();
      return;
    }

    setLaunching(true);

    try {
      const response = await fetch(`${apiUrl}/api/labs/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ labId: labToLaunch.id })
      });

      const data = await response.json();

      if (response.ok && data.session) {
        toast.success('Sandbox environment spun up! Redirecting to workspace...');
        setLabToLaunch(null);
        setTimeout(() => {
          const target =
            data.session.lab?.protocol === 'VNC'
              ? `/sessions/${data.session.id}/desktop`
              : `/sessions/${data.session.id}/terminal`;
          router.push(target);
        }, 1200);
      } else {
        toast.error(data.error || 'Failed to start lab instance.');
      }
    } catch {
      toast.error('Network error connecting to orchestrator backend.');
    } finally {
      setLaunching(false);
    }
  };

  // Determine current active path and module
  const currentPath = useMemo(() => {
    if (!learningPaths || learningPaths.length === 0) return null;
    const inProgress = learningPaths.find(p => p.progress > 0 && p.progress < 100);
    return inProgress || learningPaths[0];
  }, [learningPaths]);

  const activeModule = useMemo(() => {
    if (!currentPath || !currentPath.modules || currentPath.modules.length === 0) return null;
    return currentPath.modules[0];
  }, [currentPath]);

  // Filtered practice scenarios
  const filteredLabs = useMemo(() => {
    return labs.filter(lab => {
      const matchCat = practiceCategory === 'All' || lab.category?.toLowerCase() === practiceCategory.toLowerCase();
      const matchDiff = practiceDifficulty === 'All difficulties' || lab.difficulty?.toUpperCase() === practiceDifficulty.toUpperCase();
      const matchSearch =
        practiceSearch === '' ||
        lab.name.toLowerCase().includes(practiceSearch.toLowerCase()) ||
        (lab.description && lab.description.toLowerCase().includes(practiceSearch.toLowerCase())) ||
        (lab.category && lab.category.toLowerCase().includes(practiceSearch.toLowerCase()));
      return matchCat && matchDiff && matchSearch;
    });
  }, [labs, practiceCategory, practiceDifficulty, practiceSearch]);

  const activeLiveSession = activeSessions[0] || null;

  // Dynamic daytime greeting
  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const studentDisplayName = user?.username || 'Operator';
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const level = user?.level ?? profile?.user?.level ?? 1;
  const xp = user?.xp ?? profile?.user?.xp ?? 0;
  const nextLevelXp = level >= 3 ? 650 : level === 2 ? 400 : 200;
  const xpToNext = Math.max(0, nextLevelXp - xp);
  const solvedCount = profile?.solvedCount || 0;
  const dailyGoal = 3;
  const dailyCompleted = Math.min(dailyGoal, Math.max(0, solvedCount % 4));

  // Dynamic skills progress list from profile radarData or calculated metrics
  const skillList = profile?.radarData && profile.radarData.length > 0
    ? profile.radarData.slice(0, 4).map(r => ({ name: r.domain, percent: Math.min(100, Math.round(r.score)) }))
    : [
        { name: 'Web Security', percent: Math.min(100, Math.max(20, solvedCount * 25)) },
        { name: 'Network Security', percent: 25 },
        { name: 'Forensics', percent: 10 },
        { name: 'Cloud Security', percent: 0 }
      ];

  return (
    <div className={styles.container}>
      {/* ──────────────────────────────────────────────────────────
         1. Page Heading: Greeting + Date (Screenshot 3)
         ────────────────────────────────────────────────────────── */}
      <div className={styles.pageHeading}>
        <div>
          <h1 className={styles.headingTitle}>
            {greetingTime}, {studentDisplayName} <AstraIcon name="sun" size={24} style={{ stroke: 'var(--amber)', verticalAlign: '-2px' }} />
          </h1>
          <p className={styles.headingSub}>
            A little learning today. A stronger skill set tomorrow.
          </p>
        </div>
        <span className={styles.headingDate}>{todayFormatted}</span>
      </div>

      {/* ──────────────────────────────────────────────────────────
         2. Main Grid: Two-Column Responsive Layout (Screenshots 1 & 3)
         ────────────────────────────────────────────────────────── */}
      <div className={styles.gridMain}>
        {/* Left Stack: Continue Learning, Roadmap Strip, Recommendations, Practice */}
        <div className={styles.stack}>
          {/* Featured "CONTINUE LEARNING" Card (Screenshot 3) */}
          <section className={styles.featured}>
            <div className={styles.featureEyebrow}>
              <AstraIcon name="book" size={15} style={{ stroke: 'var(--blue)' }} />
              <span>CONTINUE LEARNING</span>
            </div>

            <div className={styles.featureInner}>
              <div>
                <span className={styles.featureCourseSub}>
                  {currentPath?.title || 'Web Application Security'} / Module {activeModule?.order || 1}
                </span>
                <h2 className={styles.featureTitle}>
                  {activeModule?.title || 'SQL Injection Fundamentals'}
                </h2>
                <p className={styles.featureDesc}>
                  {activeModule?.description || 'Keep query structure separate from user data. Your next step is protect the query boundary.'}
                </p>
              </div>

              <ProgressRing
                percentage={currentPath?.progress ?? 40}
                size={122}
                strokeWidth={8}
                sublabel="complete"
              />
            </div>

            <div className={styles.featureBottom}>
              <Link
                href={`/academy?path=${currentPath?.slug || 'web-pentesting'}`}
                className="btn"
              >
                Continue learning →
              </Link>
              <div className={styles.featureTimeInfo}>
                <AstraIcon name="clock" size={15} />
                <span>{currentPath?.solvedTasks || 0} of {currentPath?.totalTasks || 6} lessons · ~{currentPath?.totalEstimatedMinutes || 15} min left</span>
              </div>
            </div>
          </section>

          {/* "Your learning path" Roadmap Strip (Screenshot 3) */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Your learning path</h2>
              <Link href="/academy" className={styles.textLink}>
                View path →
              </Link>
            </div>

            <div className={styles.metricLine}>
              <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{currentPath?.title || 'Web Application Security'}</strong>
              <strong style={{ color: 'var(--blue)', fontSize: '15px' }}>{currentPath?.progress ?? 40}%</strong>
            </div>

            {/* 5-Node Roadmap Strip */}
            <div className={styles.pathStrip}>
              {(currentPath?.modules && currentPath.modules.length > 0 ? currentPath.modules.slice(0, 5) : [
                { id: '1', title: 'Web basics', order: 1 },
                { id: '2', title: 'Authentication', order: 2 },
                { id: '3', title: 'SQL Injection', order: 3 },
                { id: '4', title: 'XSS', order: 4 },
                { id: '5', title: 'File uploads', order: 5 },
              ]).map((mod, idx) => {
                const isDone = idx === 0 || (currentPath?.progress ? idx < Math.floor(currentPath.progress / 30) : idx < 2);
                const isCurrent = !isDone && (idx === 1 || idx === Math.floor((currentPath?.progress || 0) / 30) || idx === 2);
                const sub = isDone ? 'Completed' : isCurrent ? 'In progress' : 'Up next';

                return (
                  <div
                    key={mod.id || idx}
                    className={`${styles.pathNode} ${isDone ? styles.pathNodeDone : isCurrent ? styles.pathNodeCurrent : ''}`}
                  >
                    <span className={`${styles.nodeDot} ${isDone ? styles.nodeDotDone : isCurrent ? styles.nodeDotCurrent : ''}`}>
                      {isDone ? '✓' : idx + 1}
                    </span>
                    <span className={styles.nodeTitle}>{mod.title}</span>
                    <span className={styles.nodeSub}>{sub}</span>
                  </div>
                );
              })}
            </div>

            <div className={styles.pathFoot}>
              <span>{currentPath?.modules?.length ? `${Math.min(currentPath.modules.length, 2)} of ${currentPath.modules.length} modules complete` : '2 of 7 modules complete'}</span>
              <span>5h 5m total learning</span>
            </div>
          </section>

          {/* "Keep building your skills" Recommendations (Screenshot 1) */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Keep building your skills</h2>
              <Link href="/academy" className={styles.textLink}>
                Explore academy →
              </Link>
            </div>

            <div className={styles.recList}>
              {[
                { title: 'Authentication Security', pill: 'Review & reinforce', pillColor: 'green', desc: 'Beginner · 40 min · Web · 100% complete', iconName: 'globe', tileColor: '', btnText: 'Review →', route: '/academy' },
                { title: 'Network Reconnaissance', pill: 'Recommended', pillColor: '', desc: 'Beginner · 35 min · Network · 0% complete', iconName: 'network', tileColor: 'teal', btnText: 'Explore →', route: '/academy' },
                { title: 'Log Analysis', pill: 'Recommended', pillColor: '', desc: 'Beginner · 30 min · Defensive Security · 0% complete', iconName: 'shield', tileColor: 'amber', btnText: 'Explore →', route: '/academy' }
              ].map((rec, i) => (
                <article key={i} className={styles.recRow}>
                  <div className={`tile-icon ${rec.tileColor}`}>
                    <AstraIcon name={rec.iconName} size={18} />
                  </div>
                  <div>
                    <span className={`pill ${rec.pillColor}`}>{rec.pill}</span>
                    <h3 className={styles.recRowTitle}>{rec.title}</h3>
                    <p className={styles.recRowMeta}>{rec.desc}</p>
                  </div>
                  <Link href={rec.route} className="btn secondary small">
                    {rec.btnText}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {/* "Recent achievements" Preview (Screenshot 1) */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Recent achievements</h2>
              <Link href="/profile#achievements" className={styles.textLink}>
                View all →
              </Link>
            </div>

            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="tile-icon amber">
                  <AstraIcon name="flag" size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>First Flag</strong>
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>Milestone unlocked</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="tile-icon amber">
                  <AstraIcon name="monitor" size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>Desktop Virtuoso</strong>
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>Milestone unlocked</p>
                </div>
              </div>
            </div>
          </section>

          {/* ──────────────────────────────────────────────────────────
             Hands-On Practice Labs & Scenarios Catalog (#practice)
             ────────────────────────────────────────────────────────── */}
          <section id="practice" className={styles.practiceSection}>
            <div className={styles.sectionHead}>
              <div>
                <h2>Practice with purpose</h2>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                  Apply what you know in isolated, hands-on Kubernetes sandboxes.
                </p>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className={styles.filters} role="toolbar" aria-label="Scenario categories">
              {['All', 'Web', 'Network', 'Forensics', 'Cloud', 'Active Directory', 'Defensive Security'].map(cat => (
                <button
                  key={cat}
                  className={`${styles.chip} ${practiceCategory === cat ? styles.chipActive : ''}`}
                  onClick={() => setPracticeCategory(cat)}
                  aria-pressed={practiceCategory === cat}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search & Difficulty Filter Row */}
            <div className={styles.filterRow}>
              <div className={styles.searchBar}>
                <AstraIcon name="search" size={16} style={{ stroke: 'var(--muted)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search scenarios or skills (Press / to focus)..."
                  value={practiceSearch}
                  onChange={e => setPracticeSearch(e.target.value)}
                  aria-label="Search practice scenarios"
                />
                {practiceSearch && (
                  <button
                    onClick={() => setPracticeSearch('')}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                className={styles.selectInput}
                value={practiceDifficulty}
                onChange={e => setPracticeDifficulty(e.target.value)}
                aria-label="Filter difficulty"
              >
                {['All difficulties', 'Beginner', 'Intermediate', 'Advanced'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Scenarios Grid */}
            {loading ? (
              <CardSkeleton count={3} />
            ) : filteredLabs.length === 0 ? (
              <div className={styles.panel} style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <AstraIcon name="search" size={32} style={{ stroke: 'var(--muted)', margin: '0 auto 8px' }} />
                <h3>No matching scenarios found</h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                  Try a broader topic or clear your search filters.
                </p>
                <button
                  onClick={() => {
                    setPracticeCategory('All');
                    setPracticeDifficulty('All difficulties');
                    setPracticeSearch('');
                  }}
                  className="btn secondary small"
                  style={{ marginTop: '12px' }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className={styles.catalogGrid}>
                {filteredLabs.map(lab => {
                  const isVNC = lab.protocol === 'VNC';
                  const activeSession = activeSessions.find(s => s.labId === lab.id);
                  const isRunning = Boolean(activeSession && (activeSession.status === 'RUNNING' || activeSession.status === 'CREATING' || activeSession.status === 'PENDING'));

                  return (
                    <article key={lab.id} className={styles.courseCard}>
                      <div className={styles.cardTop}>
                        <div className="tile-icon">
                          <AstraIcon name={isVNC ? 'monitor' : 'terminal'} size={18} />
                        </div>
                        <span className="pill blue">
                          {lab.difficulty || 'Beginner'}
                        </span>
                      </div>

                      <h3 className={styles.cardTitle}>{lab.name}</h3>
                      <p className={styles.cardDesc}>{lab.description}</p>

                      <div className={styles.cardMeta}>
                        <span>⚡ {lab.cpuLimit} CPU</span>
                        <span>💾 {lab.memLimit} RAM</span>
                        <span>{isVNC ? 'Desktop GUI' : 'Terminal Shell'}</span>
                      </div>

                      <div className="progress" style={{ margin: '8px 0 16px' }}>
                        <span style={{ width: isRunning ? '100%' : '0%' }} />
                      </div>

                      {isRunning ? (
                        <button
                          className="btn"
                          onClick={() => {
                            if (activeSession.status === 'RUNNING') {
                              router.push(isVNC ? `/sessions/${activeSession.id}/desktop` : `/sessions/${activeSession.id}/terminal`);
                            } else {
                              router.push('/sessions');
                            }
                          }}
                        >
                          <span>{isVNC ? '🖥️ Open Desktop' : '💻 Open Shell'}</span>
                          <span>→</span>
                        </button>
                      ) : (
                        <button
                          className="btn secondary"
                          onClick={() => setLabToLaunch(lab)}
                        >
                          <span>Launch lab</span>
                          <span>▶</span>
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Stack: Today's Goal, Active Lab, Skills, Level/XP (Screenshots 1 & 3) */}
        <div className={styles.stack}>
          {/* Today's Goal Panel (Screenshot 3) */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Today&apos;s goal</h2>
              <AstraIcon name="target" size={18} style={{ stroke: 'var(--blue)' }} />
            </div>

            <div className={styles.dailyGoalRow}>
              <div>
                <strong className={styles.dailyBig}>2</strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}> / 3 activities</span>
              </div>
              <span className="pill blue">
                Keep going
              </span>
            </div>

            <div className="progress" style={{ marginBottom: '14px' }}>
              <span style={{ width: '66%' }} />
            </div>

            <div className={`${styles.checkRow} ${styles.checkRowDone}`}>
              <span className="check-circle done">✓</span>
              <span>Review HTTP fundamentals</span>
            </div>

            <div className={`${styles.checkRow} ${styles.checkRowDone}`}>
              <span className="check-circle done">✓</span>
              <span>Understand query structure</span>
            </div>

            <div className={styles.checkRow}>
              <span className="check-circle current">
                3
              </span>
              <span>Complete a practice lab</span>
            </div>

            <div style={{ marginTop: '16px' }}>
              <Link
                href="/academy?path=web-pentesting"
                className="btn soft full"
              >
                Continue your goal →
              </Link>
            </div>
          </section>

          {/* Ready to practice? / Live Session Card */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>{activeLiveSession ? 'Active Lab Sandbox' : 'Ready to practice?'}</h2>
              <AstraIcon name={activeLiveSession ? 'terminal' : 'lab'} size={18} style={{ stroke: activeLiveSession ? 'var(--green)' : 'var(--muted)' }} />
            </div>

            {activeLiveSession ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="live-dot" />
                  <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                    {activeLiveSession.lab?.name || 'Isolated Lab Environment'}
                  </strong>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.4 }}>
                  Status: <strong style={{ color: 'var(--green)' }}>{activeLiveSession.status}</strong> · {activeLiveSession.lab?.protocol || 'CLI'} Container
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link
                    href={
                      activeLiveSession.lab?.protocol === 'VNC'
                        ? `/sessions/${activeLiveSession.id}/desktop`
                        : `/sessions/${activeLiveSession.id}/terminal`
                    }
                    className="btn primary small"
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    Open Console →
                  </Link>
                  <Link href="/sessions" className="btn secondary small">
                    Manage
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 16px', lineHeight: 1.5 }}>
                  No active labs. Put your next lesson into practice.
                </p>
                <a href="#practice" className="btn secondary full">
                  Explore practice →
                </a>
              </>
            )}
          </section>

          {/* "Your skills" Panel (Screenshot 1 & 3) */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Your skills</h2>
              <Link href="/profile" className={styles.textLink} aria-label="View all skills">
                →
              </Link>
            </div>

            {skillList.map((skill, idx) => (
              <div key={idx} className={styles.skillRow}>
                <div className={styles.skillLabel}>
                  <span>{skill.name}</span>
                  <strong>{skill.percent}%</strong>
                </div>
                <div className="progress">
                  <span style={{ width: `${skill.percent}%` }} />
                </div>
              </div>
            ))}

            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '16px' }}>
              Progress grows with completed activities.
            </p>
          </section>

          {/* Level & XP Footer Pill (Screenshot 1) */}
          <div className={styles.levelXpPill}>
            <span className="pill blue">LEVEL {level}</span>
            <strong style={{ color: 'var(--ink)' }}>{xp} XP</strong>
            <span>·</span>
            <span>{xpToNext} XP to next level</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Launch Real Lab */}
      <LaunchModal
        isOpen={Boolean(labToLaunch)}
        onClose={() => setLabToLaunch(null)}
        onConfirm={handleConfirmLaunch}
        loading={launching}
        lab={labToLaunch}
      />
    </div>
  );
}
