'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastProvider';

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (tab === 'login') {
        const result = await login(identifier, password);
        if (!result.success) {
          setError(result.error || 'Login failed');
        } else if (result.streakIncreased) {
          toast.success(`🔥 Day ${result.streakDays} Streak! Keep up the momentum!`);
        } else {
          toast.success(`Welcome back, ${identifier}!`);
        }
      } else {
        const result = await register(username, email, password);
        if (!result.success) {
          setError(result.error || 'Registration failed');
        } else {
          toast.success(`Account created! Welcome to CyberRange.`);
        }
      }
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAuthModal();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem 2rem',
          position: 'relative',
          boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.18), 0 8px 16px -4px rgba(15, 23, 42, 0.06)',
          background: 'var(--bg-card, #F9FAFC)',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          animation: 'modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0f172a';
            e.currentTarget.style.background = '#e2e8f0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#64748b';
            e.currentTarget.style.background = '#f1f5f9';
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2E4C6D 0%, #213954 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            margin: '0 auto 0.85rem',
            boxShadow: '0 4px 12px -2px rgba(46, 76, 109, 0.4)'
          }}>
            🛡️
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.3rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
            CyberRange Access
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {tab === 'login' ? 'Sign in to access your learning paths and active labs' : 'Create an account to start your training'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f1f5f9',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '1.5rem',
          border: '1px solid #e2e8f0'
        }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '9px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              backgroundColor: tab === 'login' ? 'var(--bg-card, #F9FAFC)' : 'transparent',
              color: tab === 'login' ? 'var(--blue, #2E4C6D)' : '#64748b',
              boxShadow: tab === 'login' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            style={{
              flex: 1,
              padding: '9px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              backgroundColor: tab === 'register' ? 'var(--bg-card, #F9FAFC)' : 'transparent',
              color: tab === 'register' ? 'var(--blue, #2E4C6D)' : '#64748b',
              boxShadow: tab === 'register' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '10px 14px',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {tab === 'register' ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. operator01"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'var(--bg-card, #F9FAFC)',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--blue, #2E4C6D)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@cyberrange.local"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'var(--bg-card, #F9FAFC)',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--blue, #2E4C6D)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
            </>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Email or Username
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="student01 or admin@cyberrange.local"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: 'var(--bg-card, #F9FAFC)',
                  color: '#0f172a',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--blue, #2E4C6D)')}
                onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'var(--bg-card, #F9FAFC)',
                color: '#0f172a',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--blue, #2E4C6D)')}
              onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
            />
          </div>

          {/* Quick Demo Credentials Autofill */}
          {tab === 'login' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#f0f9ff',
              border: '1px dashed #bae6fd',
              fontSize: '0.78rem'
            }}>
              <span style={{ color: '#64748b' }}>Demo: <code style={{ color: '#0369a1', fontWeight: 700 }}>student01</code></span>
              <button
                type="button"
                onClick={fillDemoStudent}
                style={{
                  color: '#0284c7',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  fontSize: '0.75rem'
                }}
              >
                Auto-fill
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '0.35rem',
              background: 'linear-gradient(135deg, #2E4C6D 0%, #213954 100%)',
              color: '#ffffff',
              fontWeight: 700,
              padding: '12px',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px -1px rgba(46, 76, 109, 0.4)',
              fontSize: '0.9rem',
              letterSpacing: '0.01em'
            }}
          >
            {submitting ? 'Authenticating...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
