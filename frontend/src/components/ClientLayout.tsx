'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ToastProvider, useToast } from './ToastProvider';
import AuthModal from './AuthModal';
import GlobalSearchModal from './GlobalSearchModal';
import AstraIcon from './AstraIcons';
import styles from '../app/layout.module.css';

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, openAuthModal, logout, token, apiUrl } = useAuth();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const [activeSessionCount, setActiveSessionCount] = useState<number>(0);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Global Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  // Notifications Modal State
  const [isNotifModalOpen, setIsNotifModalOpen] = useState<boolean>(false);
  const [notifications] = useState<any[]>([
    { title: 'Welcome to CyberRange', text: 'Start your offensive & defensive security journey today.', route: '/academy' }
  ]);

  // Join Cohort Modal State
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [cohortCode, setCohortCode] = useState<string>('');
  const [joinLoading, setJoinLoading] = useState<boolean>(false);
  const [joinMsg, setJoinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User Dropdown Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer and user menu on route change
  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  // Click outside and Escape handler for User Dropdown Menu
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  // Global Ctrl+K / Cmd+K listener for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll for active session count and student profile
  useEffect(() => {
    if (!token) {
      setActiveSessionCount(0);
      setProfileData(null);
      return;
    }

    const fetchData = async () => {
      try {
        const [sessRes, profRes] = await Promise.all([
          fetch(`${apiUrl}/api/labs/sessions`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null),
          fetch(`${apiUrl}/api/learning/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null)
        ]);

        if (sessRes && sessRes.ok) {
          const sData = await sessRes.json();
          const running = (sData.sessions || []).filter(
            (s: any) => s.status !== 'STOPPED' && s.status !== 'ERROR'
          );
          setActiveSessionCount(running.length);
        }

        if (profRes && profRes.ok) {
          const pData = await profRes.json();
          setProfileData(pData);
        }
      } catch {
        // Silently tolerate polling errors
      }
    };

    fetchData();
    const timer = setInterval(fetchData, 6000);
    return () => clearInterval(timer);
  }, [token, apiUrl]);

  const handleJoinCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortCode.trim() || !token) return;

    try {
      setJoinLoading(true);
      setJoinMsg(null);
      const res = await fetch(`${apiUrl}/api/instructor/cohorts/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: cohortCode.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setJoinMsg({ type: 'success', text: `Enrolled successfully in ${data.cohort?.name || 'cohort'}!` });
        setTimeout(() => {
          setIsJoinModalOpen(false);
          setCohortCode('');
          setJoinMsg(null);
        }, 1600);
      } else {
        setJoinMsg({ type: 'error', text: data.error || 'Failed to join cohort.' });
      }
    } catch {
      setJoinMsg({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setJoinLoading(false);
    }
  };

  const isLoginPage = pathname === '/login';
  const isWorkstationRoute = Boolean(
    pathname &&
      ((pathname.startsWith('/sessions/') && (pathname.includes('/desktop') || pathname.includes('/terminal'))) ||
       pathname.startsWith('/scenarios/environment/'))
  );

  const studentName = user?.username || 'Operator';
  const avatarInitials = (studentName.slice(0, 2) || 'OP').toUpperCase();
  const streakDays = user?.streakDays ?? profileData?.user?.streakDays ?? 1;
  const level = user?.level ?? profileData?.user?.level ?? 1;
  const rankTitle = user?.rankTitle ?? profileData?.user?.rankTitle ?? 'Initiate Operator';
  const solvedCount = profileData?.solvedCount || 0;
  const dailyGoal = 3;
  const dailyProgress = Math.min(dailyGoal, Math.max(0, solvedCount % 4));

  // Route guarding navigation effects
  useEffect(() => {
    if (!loading) {
      if (!user && !isLoginPage) {
        const currentPath = pathname + (typeof window !== 'undefined' ? window.location.search || '' : '');
        router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
      } else if (user && isLoginPage) {
        router.replace('/');
      }
    }
  }, [loading, user, isLoginPage, pathname, router]);

  // 1. Loading Splash: Prevents dashboard flashing on initial load
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #EEF2F7)',
        gap: '16px'
      }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '14px',
          background: 'var(--blue, #2E4C6D)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 10px 24px -4px rgba(46, 76, 109, 0.35)'
        }}>
          <AstraIcon name="shield" size={28} style={{ stroke: '#ffffff' }} />
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted, #64748b)' }}>
          Verifying operator credentials...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Gate: Show login page if on /login, else show redirecting splash
  if (!user) {
    if (isLoginPage) {
      return <>{children}</>;
    }
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #EEF2F7)',
        gap: '16px'
      }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '14px',
          background: 'var(--blue, #2E4C6D)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 10px 24px -4px rgba(46, 76, 109, 0.35)'
        }}>
          <AstraIcon name="shield" size={28} style={{ stroke: '#ffffff' }} />
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted, #64748b)' }}>
          Redirecting to CyberRange Access...
        </div>
      </div>
    );
  }

  // 3. Authenticated user visiting /login -> render null while redirect effect runs
  if (isLoginPage) {
    return null;
  }

  // 4. Role-based access for /instructor
  const isInstructorRoute = pathname === '/instructor' || pathname?.startsWith('/instructor/');
  if (isInstructorRoute && user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') {
    return (
      <div className={styles.container}>
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card, #F9FAFC)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '480px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: '42px', marginBottom: '16px' }}>🛡️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', marginBottom: '8px' }}>
              Instructor Access Restricted
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted, #64748b)', lineHeight: 1.5, marginBottom: '24px' }}>
              Your account (<strong>{user.username}</strong>) has the <strong>STUDENT</strong> role. Cohort management and progress grading require <strong>INSTRUCTOR</strong> or <strong>ADMIN</strong> privileges.
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn"
              style={{ width: '100%' }}
            >
              Return to Student Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ──────────────────────────────────────────────────────────
         Sidebar Navigation (Astra Design Architecture)
         ────────────────────────────────────────────────────────── */}
      <aside
        className={`${styles.sidebar} ${isWorkstationRoute ? styles.sidebarCollapsed : ''} ${isMobileNavOpen ? styles.open : ''}`}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>
            <AstraIcon name="shield" size={22} style={{ stroke: '#ffffff' }} />
          </span>
          <span>CyberRange</span>
        </Link>
        <span className={styles.brandSub}>LEARNING PLATFORM</span>

        {/* Section 1: Your Workspace */}
        <div className={styles.navCaption}>YOUR WORKSPACE</div>
        <nav className={styles.nav}>
          <Link
            href="/"
            className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
          >
            <AstraIcon name="home" size={18} />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/scenarios"
            className={`${styles.navLink} ${pathname?.startsWith('/scenarios') ? styles.active : ''}`}
          >
            <AstraIcon name="network" size={18} />
            <span>Scenarios</span>
          </Link>

          <Link
            href="/academy"
            className={`${styles.navLink} ${pathname === '/academy' ? styles.active : ''}`}
          >
            <AstraIcon name="book" size={18} />
            <span>Learn</span>
          </Link>

          <Link
            href="/#practice"
            className={styles.navLink}
          >
            <AstraIcon name="target" size={18} />
            <span>Practice</span>
          </Link>

          <Link
            href="/sessions"
            className={`${styles.navLink} ${pathname?.startsWith('/sessions') ? styles.active : ''}`}
          >
            <AstraIcon name="lab" size={18} />
            <span>Active labs</span>
            {activeSessionCount > 0 && (
              <span className={styles.navCount}>{activeSessionCount}</span>
            )}
          </Link>
        </nav>

        {/* Section 2: Your Growth */}
        <div className={styles.navCaption}>YOUR GROWTH</div>
        <nav className={styles.nav}>
          <Link
            href="/profile"
            className={`${styles.navLink} ${pathname === '/profile' ? styles.active : ''}`}
          >
            <AstraIcon name="chart" size={18} />
            <span>My progress</span>
          </Link>

          <Link
            href="/profile#achievements"
            className={styles.navLink}
          >
            <AstraIcon name="award" size={18} />
            <span>Achievements</span>
          </Link>

          {/* Instructor Command Portal for Instructors / Admins */}
          {user && (user.role === 'INSTRUCTOR' || user.role === 'ADMIN') && (
            <Link
              href="/instructor"
              className={`${styles.navLink} ${pathname === '/instructor' ? styles.active : ''}`}
            >
              <AstraIcon name="user" size={18} />
              <span>Instructor Portal</span>
            </Link>
          )}
        </nav>

        {/* Sidebar Bottom: Goal Card, Cohort Button, Student Profile */}
        <div className={styles.sidebarBottom}>
          <div className={styles.sideGoal}>
            <span className={styles.sideGoalTitle}>A little progress, every day.</span>
            <p className={styles.sideGoalSub}>{dailyProgress} of {dailyGoal} activities today</p>
            <div className="progress">
              <span style={{ width: `${Math.round((dailyProgress / dailyGoal) * 100)}%` }} />
            </div>
          </div>

          <button
            onClick={() => {
              if (user) {
                setIsJoinModalOpen(true);
              } else {
                openAuthModal();
              }
            }}
            className={styles.cohortBtn}
          >
            <AstraIcon name="user" size={16} />
            <span>{user ? 'Join a class cohort' : 'Sign In / Register'}</span>
          </button>

          <div
            className={styles.sideProfile}
            onClick={() => {
              if (user) {
                router.push('/profile');
              } else {
                openAuthModal();
              }
            }}
          >
            <span className={styles.avatar}>{avatarInitials}</span>
            <div className={styles.sideProfileInfo}>
              <span className={styles.sideProfileName}>{studentName}</span>
              <span className={styles.sideProfileRole}>Level {level} · {rankTitle}</span>
            </div>
            <AstraIcon name="chevron" size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
          </div>
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────
         Application Shell (Topbar + Main Content)
         ────────────────────────────────────────────────────────── */}
      <div className={`${styles.app} ${isWorkstationRoute ? styles.appExpanded : ''}`}>
        {!isWorkstationRoute && (
          <header className={styles.topbar}>
            {/* Mobile Hamburger Button */}
            <button
              className={`${styles.iconBtn} ${styles.mobileMenuBtn}`}
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              aria-label="Toggle navigation"
            >
              <AstraIcon name="menu" size={20} />
            </button>

            {/* Global Search Button with Ctrl+K */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className={styles.globalSearchBtn}
              aria-label="Search courses, labs, and skills"
            >
              <AstraIcon name="search" size={16} />
              <span>Search courses, labs, and skills</span>
              <kbd className={styles.key}>Ctrl K</kbd>
            </button>

            {/* Topbar Actions (Streak, Notifications, User) */}
            <div className={styles.topActions}>
              <span className={styles.topStreak}>
                <AstraIcon name="flame" size={16} style={{ stroke: 'var(--amber)' }} />
                <span>{streakDays} day streak</span>
              </span>

              <span className={styles.topDivider} />

              <button
                onClick={() => setIsNotifModalOpen(true)}
                className={`${styles.iconBtn} ${notifications.length ? styles.unreadDot : ''}`}
                aria-label="Notifications"
                title="Notifications"
              >
                <AstraIcon name="bell" size={18} />
              </button>

              {/* User Avatar with Dropdown Card */}
              <div className={styles.userMenuWrapper} ref={userMenuRef}>
                <button
                  onClick={() => {
                    if (user) {
                      setIsUserMenuOpen(prev => !prev);
                    } else {
                      openAuthModal();
                    }
                  }}
                  className={`${styles.avatarBtn} ${isUserMenuOpen ? styles.avatarBtnActive : ''}`}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                  title={user ? `${studentName} · Click for options` : 'Click to Sign In'}
                >
                  {avatarInitials}
                </button>

                {isUserMenuOpen && user && (
                  <div className={styles.userDropdownCard} role="menu">
                    {/* User Summary Header */}
                    <div className={styles.userDropdownHeader}>
                      <span className={styles.userDropdownAvatar}>{avatarInitials}</span>
                      <div className={styles.userDropdownMeta}>
                        <span className={styles.userDropdownName}>{studentName}</span>
                        <span className={styles.userDropdownRole}>Level {level} · {rankTitle}</span>
                        <span className={styles.userDropdownEmail}>{user.email}</span>
                      </div>
                    </div>

                    {/* Streak Badge */}
                    <div className={styles.userDropdownStreak}>
                      <AstraIcon name="flame" size={13} style={{ stroke: 'var(--amber)' }} />
                      <span>{streakDays} day streak</span>
                    </div>

                    <div className={styles.userDropdownDivider} />

                    {/* My Profile Button */}
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        router.push('/profile');
                      }}
                      className={styles.userDropdownItem}
                      role="menuitem"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <div>
                        <div className={styles.dropdownItemTitle}>My Profile</div>
                        <div className={styles.dropdownItemSub}>View stats, badges & progress</div>
                      </div>
                    </button>

                    <div className={styles.userDropdownDivider} />

                    {/* Logout Button */}
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                        toast.success('Logged out successfully.');
                        router.replace('/login');
                      }}
                      className={styles.userDropdownItemDanger}
                      role="menuitem"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <div>
                        <div className={styles.dropdownItemTitle}>Log Out</div>
                        <div className={styles.dropdownItemSub}>Sign out of your account</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Main Routed Page Content */}
        <main className={isWorkstationRoute ? styles.workstationMainContent : styles.mainContent}>
          {children}
        </main>

        {!isWorkstationRoute && (
          <footer className={styles.footer}>
            <span>CyberRange Academy</span>
            <span>Interactive prototype · All labs are simulated</span>
          </footer>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
         Mobile Navigation (Fixed Bottom Bar <= 760px)
         ────────────────────────────────────────────────────────── */}
      <nav className={styles.mobileNav} aria-label="Mobile navigation">
        <Link
          href="/"
          className={`${styles.mobileNavLink} ${pathname === '/' ? styles.active : ''}`}
        >
          <AstraIcon name="home" size={18} />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/academy"
          className={`${styles.mobileNavLink} ${pathname === '/academy' ? styles.active : ''}`}
        >
          <AstraIcon name="book" size={18} />
          <span>Learn</span>
        </Link>

        <Link
          href="/#practice"
          className={styles.mobileNavLink}
        >
          <AstraIcon name="target" size={18} />
          <span>Practice</span>
        </Link>

        <Link
          href="/sessions"
          className={`${styles.mobileNavLink} ${pathname?.startsWith('/sessions') ? styles.active : ''}`}
        >
          <AstraIcon name="lab" size={18} />
          <span>Labs</span>
        </Link>

        <Link
          href="/profile"
          className={`${styles.mobileNavLink} ${pathname === '/profile' ? styles.active : ''}`}
        >
          <AstraIcon name="chart" size={18} />
          <span>Progress</span>
        </Link>
      </nav>

      {/* ──────────────────────────────────────────────────────────
         Modals (Global Search, Notifications, Class Cohort)
         ────────────────────────────────────────────────────────── */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        apiUrl={apiUrl}
        token={token}
      />

      {/* Notifications Modal */}
      {isNotifModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '80px 32px 0 0'
          }}
          onClick={() => setIsNotifModalOpen(false)}
        >
          <div
            style={{
              width: '320px',
              background: 'var(--bg-card, #F9FAFC)',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              padding: '18px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>Notifications</h3>
              <button
                onClick={() => setIsNotifModalOpen(false)}
                className="icon-btn"
                style={{ width: '24px', height: '24px' }}
              >
                <AstraIcon name="close" size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map((n, i) => (
                <div key={i} style={{ padding: '10px', background: 'var(--sky)', borderRadius: '8px', fontSize: '13px' }}>
                  <strong style={{ color: 'var(--blue)', display: 'block', marginBottom: '2px' }}>{n.title}</strong>
                  <p style={{ color: 'var(--text-body)', fontSize: '12px' }}>{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Join Cohort Modal */}
      {isJoinModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setIsJoinModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--bg-card, #F9FAFC)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line)',
              boxShadow: '0 15px 40px rgba(0,0,0,0.18)',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>Join a Class Cohort</h3>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="icon-btn"
                style={{ width: '28px', height: '28px' }}
              >
                <AstraIcon name="close" size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Enter the unique 6-character cohort invitation token provided by your cybersecurity instructor.
            </p>

            <form onSubmit={handleJoinCohort}>
              <input
                type="text"
                placeholder="e.g. ALPHA-2026"
                value={cohortCode}
                onChange={(e) => setCohortCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                  marginBottom: '16px',
                  fontFamily: 'monospace'
                }}
                required
              />

              {joinMsg && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  marginBottom: '14px',
                  background: joinMsg.type === 'success' ? 'var(--green-bg)' : '#fee2e2',
                  color: joinMsg.type === 'success' ? 'var(--green)' : 'var(--red)'
                }}>
                  {joinMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="btn secondary small"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="btn small"
                >
                  {joinLoading ? 'Validating...' : 'Join Cohort'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
        <AuthModal />
      </ToastProvider>
    </AuthProvider>
  );
}
