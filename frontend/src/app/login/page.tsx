'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import AstraIcon from '@/components/AstraIcons';
import styles from './login.module.css';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';

  const { isAuthenticated, loading: authLoading, login, register } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(redirectTarget);
    }
  }, [isAuthenticated, authLoading, redirectTarget, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (tab === 'login') {
        if (!identifier.trim() || !password) {
          setError('Please provide your username/email and password.');
          setSubmitting(false);
          return;
        }

        const result = await login(identifier.trim(), password);
        if (!result.success) {
          setError(result.error || 'Invalid credentials. Please verify and try again.');
        } else {
          if (result.streakIncreased) {
            toast.success(`🔥 Day ${result.streakDays} Streak! Keep up the momentum!`);
          } else {
            toast.success(`Welcome back, ${identifier}!`);
          }
          router.replace(redirectTarget);
        }
      } else {
        if (!username.trim() || !email.trim() || !password) {
          setError('All fields are required for registration.');
          setSubmitting(false);
          return;
        }

        if (username.trim().length < 3) {
          setError('Username must be at least 3 characters long.');
          setSubmitting(false);
          return;
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setSubmitting(false);
          return;
        }

        const result = await register(username.trim(), email.trim(), password);
        if (!result.success) {
          setError(result.error || 'Registration failed. Please try again.');
        } else {
          toast.success('Account created successfully! Welcome to CyberRange.');
          router.replace(redirectTarget);
        }
      }
    } catch {
      setError('Network error connecting to auth server.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoStudent = () => {
    setTab('login');
    setIdentifier('student01');
    setPassword('Student@1234');
    setError(null);
  };

  if (authLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.brandIconLarge}>
          <AstraIcon name="shield" size={32} style={{ stroke: '#ffffff' }} />
        </div>
        <div className={styles.loadingText}>Verifying operator credentials...</div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandIcon}>
            <AstraIcon name="shield" size={26} style={{ stroke: '#ffffff' }} />
          </div>
          <h1 className={styles.title}>CyberRange Access</h1>
          <p className={styles.subtitle}>
            Sign in to access your cybersecurity workspace, learning paths, and isolated lab environments.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className={styles.tabContainer} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            onClick={() => { setTab('login'); setError(null); }}
            className={`${styles.tabBtn} ${tab === 'login' ? styles.tabBtnActive : ''}`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            onClick={() => { setTab('register'); setError(null); }}
            className={`${styles.tabBtn} ${tab === 'register' ? styles.tabBtnActive : ''}`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className={styles.errorBox} role="alert">
            <span style={{ fontSize: '15px' }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {tab === 'login' ? (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="login-identifier">
                  Email or Username
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. student01 or student@cyberrange.local"
                  className={styles.input}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={styles.input}
                  autoComplete="current-password"
                />
              </div>

              {/* Demo Auto-fill Helper */}
              <div className={styles.demoBar}>
                <span>Demo Account:</span>
                <button
                  type="button"
                  onClick={fillDemoStudent}
                  className={styles.demoBtn}
                  title="Auto-fill student credentials"
                >
                  Auto-fill <strong>student01</strong>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-username">
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. cyber_operator"
                  className={styles.input}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-email">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@domain.com"
                  className={styles.input}
                  autoComplete="email"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-password">
                  Password (min. 6 characters)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={styles.input}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={styles.submitBtn}
          >
            {submitting ? (
              <span className={styles.spinner} />
            ) : tab === 'login' ? (
              'Sign In →'
            ) : (
              'Create Account →'
            )}
          </button>
        </form>

        {/* Security Notice Footer */}
        <div className={styles.footerNotice}>
          🔒 End-to-end authenticated sandbox environment with role-based access control.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loadingContainer}>
          <div className={styles.brandIconLarge}>
            <AstraIcon name="shield" size={32} style={{ stroke: '#ffffff' }} />
          </div>
          <div className={styles.loadingText}>Initializing CyberRange...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
