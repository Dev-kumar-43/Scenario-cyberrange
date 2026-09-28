'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, registerUnauthorizedHandler } from '../lib/api';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  xp?: number;
  level?: number;
  rankTitle?: string;
  streakDays?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; streakIncreased?: boolean; streakDays?: number }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserStats: (stats: Partial<User>) => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  apiUrl: string;
  wsUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const isAuthenticated = Boolean(user && token);

  // Hook into centralized API 401 handler
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logout();
    });
  }, []);

  // Restore authenticated session on mount from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('cyberrange_token');
    if (storedToken) {
      setToken(storedToken);
      fetchUserProfile(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (jwtToken: string) => {
    try {
      const data = await authApi.getMe(jwtToken);
      if (data && data.user) {
        setUser(data.user);
      } else {
        logout();
      }
    } catch (err) {
      console.error('[AuthContext] Session verification failed:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-timezone-offset': String(tzOffset),
        },
        body: JSON.stringify({ identifier, password, timezoneOffset: tzOffset }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed.' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('cyberrange_token', data.token);
      setIsAuthModalOpen(false);
      return {
        success: true,
        streakIncreased: data.streakIncreased,
        streakDays: data.user?.streakDays,
      };
    } catch (error: any) {
      console.error('[AuthContext] Login error:', error);
      return { success: false, error: 'Network error connecting to auth server.' };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed.' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('cyberrange_token', data.token);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (error: any) {
      console.error('[AuthContext] Register error:', error);
      return { success: false, error: 'Network error connecting to auth server.' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('cyberrange_token');
  };

  const refreshUser = async () => {
    const currentToken = token || localStorage.getItem('cyberrange_token');
    if (currentToken) {
      await fetchUserProfile(currentToken);
    }
  };

  const updateUserStats = (stats: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...stats } : null));
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        refreshUser,
        updateUserStats,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        apiUrl: API_BASE_URL,
        wsUrl: WS_BASE_URL,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
