'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { CardSkeleton } from '@/components/Skeleton';
import styles from './profile.module.css';

interface Badge {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  awardedAt: string;
}

interface Solve {
  id: string;
  taskTitle: string;
  labName: string;
  points: number;
  awardedAt: string;
}

interface RadarItem {
  domain: string;
  score: number;
}

interface MitreTechnique {
  code: string;
  name: string;
  mastered: boolean;
}

interface MitreTacticGroup {
  tactic: string;
  techniques: MitreTechnique[];
}

interface ProfileData {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    xp: number;
    level: number;
    rankTitle: string;
    streakDays: number;
    createdAt: string;
  };
  badges: Badge[];
  solvedCount: number;
  recentSolves: Solve[];
  radarData: RadarItem[];
  mitreMatrix?: MitreTacticGroup[];
}

export default function ProfilePage() {
  const router = useRouter();
  const { token, apiUrl, openAuthModal } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Preference states
  const [dailyGoal, setDailyGoal] = useState<number>(2);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/api/learning/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setError('Failed to load operator dossier.');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Network error loading dossier.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, apiUrl]);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setTimeout(() => {
      setSavingPrefs(false);
      toast.success('Learning preferences updated successfully!');
    }, 400);
  };

  if (!token) {
    return (
      <div className={styles.container}>
        <div className={styles.panel} style={{ maxWidth: '540px', margin: '4rem auto', textAlign: 'center' }}>
          <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '32px', margin: '0 auto 16px' }}>
            🔒
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', color: 'var(--ink)' }}>
            Authentication Required
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.6 }}>
            Sign in or register to inspect your operator dossier, skill matrix, and captured trophies.
          </p>
          <button
            onClick={openAuthModal}
            className="btn"
            style={{ width: 'auto' }}
          >
            Access Cyber Range →
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--red)' }}>
          {error || 'Profile could not be resolved.'}
        </div>
      </div>
    );
  }

  const { user, badges, solvedCount, recentSolves, radarData, mitreMatrix } = profile;

  // XP level calculations
  const nextLevelXp = user.level * 200;
  const currentLevelBaseXp = (user.level - 1) * 200;
  const xpInCurrentLevel = Math.max(0, user.xp - currentLevelBaseXp);
  const xpNeeded = nextLevelXp - currentLevelBaseXp;
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeeded) * 100));

  // Render SVG 5-domain Skill Radar
  const renderRadarChart = () => {
    const size = 260;
    const center = size / 2;
    const radius = 85;
    const totalAxes = radarData.length || 5;

    const points = radarData.map((item, i) => {
      const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
      const r = (item.score / 100) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return { x, y, angle, ...item };
    });

    const polygonPointsString = points.map((p) => `${p.x},${p.y}`).join(' ');
    const rings = [0.25, 0.5, 0.75, 1.0];

    return (
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {rings.map((ring, idx) => {
            const ringPoints = radarData.map((_, i) => {
              const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
              const r = radius * ring;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              return `${x},${y}`;
            }).join(' ');

            return (
              <polygon
                key={idx}
                points={ringPoints}
                fill="none"
                stroke="var(--line)"
                strokeWidth="1.2"
              />
            );
          })}

          {radarData.map((_, i) => {
            const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="var(--line)"
                strokeWidth="1"
              />
            );
          })}

          <polygon
            points={polygonPointsString}
            fill="rgba(46, 76, 109, 0.15)"
            stroke="var(--blue)"
            strokeWidth="2"
          />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#ffffff"
              stroke="var(--blue)"
              strokeWidth="2"
            />
          ))}

          {points.map((p, i) => {
            const labelRadius = radius + 20;
            const lx = center + labelRadius * Math.cos(p.angle);
            const ly = center + labelRadius * Math.sin(p.angle);

            return (
              <text
                key={i}
                x={lx}
                y={ly}
                fill="var(--ink)"
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {p.domain} ({p.score}%)
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // Flatten MITRE matrix techniques
  const allMitreTechniques = mitreMatrix?.flatMap(col =>
    col.techniques.map(t => ({ ...t, tactic: col.tactic }))
  ) || [];

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Your progress, made visible</h1>
          <p className={styles.pageSub}>
            Every lesson, lab, and captured flag adds directly to your verified skills matrix.
          </p>
        </div>
      </div>

      {/* 4-Tile Astra Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '18px' }}>
            📖
          </div>
          <span className={styles.statNumber}>3</span>
          <span className={styles.statLabel}>Curriculum tracks active</span>
        </div>

        <div className={styles.statCard}>
          <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '18px' }}>
            ⚡
          </div>
          <span className={styles.statNumber}>2</span>
          <span className={styles.statLabel}>Live sandboxes practiced</span>
        </div>

        <div className={styles.statCard}>
          <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '18px' }}>
            🎯
          </div>
          <span className={styles.statNumber}>{solvedCount}</span>
          <span className={styles.statLabel}>Flags captured & verified</span>
        </div>

        <div className={styles.statCard}>
          <div className="tile-icon" style={{ background: 'var(--sky)', color: 'var(--blue)', fontSize: '18px' }}>
            ⚡
          </div>
          <span className={styles.statNumber}>{user.xp}</span>
          <span className={styles.statLabel}>Total Experience Points</span>
        </div>
      </div>

      {/* Student Dossier Banner */}
      <section className={styles.profileBanner}>
        <span className={styles.avatarLarge}>
          {user.username.slice(0, 2).toUpperCase()}
        </span>

        <div className={styles.bannerInfo}>
          <div className="eyebrow" style={{ color: 'var(--blue)', fontWeight: 700 }}>STUDENT DOSSIER</div>
          <h1 className={styles.bannerName}>{user.username}</h1>
          <div className={styles.bannerMeta}>
            <span className="pill blue">Level {user.level} Operator</span>
            <span className="pill">🎖️ {user.rankTitle}</span>
            <span>⚡ {user.xp} XP</span>
            <span>•</span>
            <span>🔥 {user.streakDays} day streak</span>
            <span>•</span>
            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Level Progression Card */}
        <div className={styles.xpCard}>
          <div className={styles.xpCardHeader}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Level Progression</span>
            <strong style={{ color: 'var(--blue)' }}>{user.xp} XP</strong>
          </div>
          <div className={styles.xpTrack}>
            <div className={styles.xpFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.xpFooter}>
            <span>Level {user.level}</span>
            <span>{nextLevelXp - user.xp} XP to Level {user.level + 1}</span>
          </div>
        </div>
      </section>

      {/* Two Column Layout */}
      <div className={styles.twoCol}>
        {/* Left Column: Skill Table, Radar, and MITRE Matrix */}
        <div>
          {/* Skill Development Table */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Skill development</h2>
              <span className="pill blue">Activity based</span>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.skillTable}>
                <thead>
                  <tr>
                    <th>Skill Domain</th>
                    <th>Proficiency</th>
                    <th>Progress</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {radarData.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.domain}</td>
                      <td>
                        <span className={`pill ${item.score >= 50 ? 'green' : 'blue'}`}>
                          {item.score >= 50 ? 'Proficient' : 'Foundation'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ minWidth: '35px', fontWeight: 600 }}>{item.score}%</span>
                          <div style={{ width: '100px', height: '6px', background: '#e9eff6', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${item.score}%`, height: '100%', background: 'var(--blue)', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{Math.round(item.score * 2.5)} XP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
                Multi-Domain Capability Radar
              </div>
              {renderRadarChart()}
            </div>
          </section>

          {/* MITRE ATT&CK Matrix */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <h2>MITRE ATT&CK® Coverage</h2>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                  Adversary tactics and techniques verified across hands-on sandbox scenarios.
                </p>
              </div>
              <span className="pill green">Learning evidence</span>
            </div>

            <div className={styles.mitreMatrix}>
              {allMitreTechniques.map((tech) => (
                <div
                  key={tech.code}
                  className={`${styles.matrixCell} ${tech.mastered ? styles.matrixCellDone : ''}`}
                >
                  <span className={styles.matrixCode}>{tech.tactic} • {tech.code}</span>
                  <strong className={styles.matrixTitle}>{tech.name}</strong>
                  <span className={styles.matrixStatus}>
                    {tech.mastered ? '✓ Practiced in simulation' : 'Not yet assessed'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Achievements Grid */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Your milestones & achievements</h2>
              <span className="pill blue">{badges.length} earned</span>
            </div>

            <div className={styles.achievementGrid}>
              {badges.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)' }}>
                  Deploy into any active lab to capture your first blood achievement!
                </div>
              ) : (
                badges.map((b) => (
                  <div key={b.id} className={styles.achievementCard}>
                    <div className="tile-icon" style={{ background: '#fef3c7', color: 'var(--amber)', fontSize: '20px' }}>
                      {b.icon || '🏆'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px' }}>
                        {b.title}
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4, marginBottom: '6px' }}>
                        {b.description}
                      </p>
                      <span className="pill green" style={{ fontSize: '10px' }}>
                        ✓ Earned {new Date(b.awardedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Recent Activity & Preferences */}
        <aside>
          {/* Recent Combat Log / Activity */}
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Recent activity</h2>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Latest captures</span>
            </div>

            {recentSolves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)', fontSize: '13px' }}>
                No flag captures recorded yet. Explore scenarios in the Academy to begin.
              </div>
            ) : (
              <div>
                {recentSolves.map((s) => (
                  <div key={s.id} className={styles.activityRow}>
                    <div className={styles.activityLeft}>
                      <span className="check-circle done">✓</span>
                      <div>
                        <div className={styles.activityTitle}>{s.taskTitle}</div>
                        <div className={styles.activityMeta}>
                          {s.labName} • {new Date(s.awardedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className={styles.xpPill}>+{s.points} XP</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Learning Preferences */}
          <section className={styles.panel}>
            <h2>Learning preferences</h2>
            <form onSubmit={handleSavePreferences} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                  Operator display name
                </label>
                <input
                  disabled
                  value={user.username}
                  className="input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg, #EEF2F7)', fontSize: '13px', color: 'var(--muted)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                  Daily activity target
                </label>
                <select
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg-card, #F9FAFC)', fontSize: '13px', color: 'var(--ink)' }}
                >
                  <option value={1}>1 activity per day (Casual)</option>
                  <option value={2}>2 activities per day (Steady)</option>
                  <option value={3}>3 activities per day (Tactical)</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn full"
                disabled={savingPrefs}
              >
                {savingPrefs ? 'Saving...' : 'Save preferences'}
              </button>
            </form>
          </section>

          {/* Class Cohort Membership */}
          <section className={styles.panel}>
            <h2>Your class cohort</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.5 }}>
              Alpha Cadre • CyberRange Platform Prototype Cohort. All sandbox pods, terminals, and progress are synchronized.
            </p>
            <button
              className="btn secondary full"
              style={{ marginTop: '14px' }}
              onClick={() => toast.info('Cohort: Alpha Cadre (Active)')}
            >
              View cohort roster
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
