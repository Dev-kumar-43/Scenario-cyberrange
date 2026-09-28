/**
 * Centralized CyberRange API Client
 * 
 * Provides typed, consistent access to backend Express APIs.
 * Automatically injects JWT Bearer tokens and timezone headers,
 * and intercepts 401 Unauthorized responses to trigger clean session expiration.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UnauthorizedHandler = () => void;
let onUnauthorizedCallback: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(callback: UnauthorizedHandler) {
  onUnauthorizedCallback = callback;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-timezone-offset': String(new Date().getTimezoneOffset()),
    ...(options.headers as Record<string, string> || {}),
  };

  const activeToken = token !== undefined ? token : (typeof window !== 'undefined' ? localStorage.getItem('cyberrange_token') : null);
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cyberrange_token');
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `API request failed with status ${response.status}`);
  }

  return data as T;
}

/* ──────────────────────────────────────────────────────────
   1. Authentication API
   ────────────────────────────────────────────────────────── */
export const authApi = {
  login: (identifier: string, password: string) =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, timezoneOffset: new Date().getTimezoneOffset() }),
    }),

  register: (username: string, email: string, password: string) =>
    apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  getMe: (token?: string | null) =>
    apiFetch('/api/auth/me', { method: 'GET' }, token),
};

/* ──────────────────────────────────────────────────────────
   2. Learning & Curriculum API
   ────────────────────────────────────────────────────────── */
export const learningApi = {
  getPaths: (token?: string | null) =>
    apiFetch<{ paths: any[] }>('/api/learning/paths', { method: 'GET' }, token),

  getPathBySlug: (slug: string, token?: string | null) =>
    apiFetch<{ path: any }>(`/api/learning/paths/${slug}`, { method: 'GET' }, token),

  getProfile: (token?: string | null) =>
    apiFetch<any>('/api/learning/profile', { method: 'GET' }, token),

  getLabTasks: (labId: string, token?: string | null) =>
    apiFetch<{ tasks: any[]; note: string; labMetadata: any }>(`/api/learning/labs/${labId}/tasks`, { method: 'GET' }, token),

  saveNote: (labId: string, content: string, token?: string | null) =>
    apiFetch(`/api/learning/labs/${labId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }, token),

  submitFlag: (taskId: string, flag: string, hintsUsedCount = 0, pointsDeducted = 0, token?: string | null) =>
    apiFetch<{ isCorrect: boolean; message: string; awardedPoints?: number; alreadySolved?: boolean }>('/api/learning/flags/submit', {
      method: 'POST',
      body: JSON.stringify({ taskId, flag, hintsUsedCount, pointsDeducted }),
    }, token),
};

/* ──────────────────────────────────────────────────────────
   3. Labs & Sandbox Provisioning API
   ────────────────────────────────────────────────────────── */
export const labsApi = {
  getLabs: () =>
    apiFetch<{ labs: any[] }>('/api/labs', { method: 'GET' }),

  getSessions: (token?: string | null) =>
    apiFetch<{ sessions: any[] }>('/api/labs/sessions', { method: 'GET' }, token),

  startLab: (labId: string, token?: string | null) =>
    apiFetch<{ session: any }>('/api/labs/start', {
      method: 'POST',
      body: JSON.stringify({ labId }),
    }, token),

  stopLab: (sessionId: string, token?: string | null) =>
    apiFetch<{ message: string; session: any }>('/api/labs/stop', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }, token),

  extendSession: (sessionId: string, token?: string | null) =>
    apiFetch<{ message: string; session: any }>('/api/labs/extend', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }, token),

  getLabStatus: (labId: string, token?: string | null) =>
    apiFetch<{ status: string; podName: string }>(`/api/labs/${labId}/status`, { method: 'GET' }, token),

  getClipboard: (sessionId: string, token?: string | null) =>
    apiFetch<{ clipboard: string }>(`/api/labs/sessions/${sessionId}/clipboard`, { method: 'GET' }, token),

  setClipboard: (sessionId: string, content: string, token?: string | null) =>
    apiFetch(`/api/labs/sessions/${sessionId}/clipboard`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }, token),
};

/* ──────────────────────────────────────────────────────────
   4. Instructor & Cohorts API
   ────────────────────────────────────────────────────────── */
export const instructorApi = {
  joinCohort: (code: string, token?: string | null) =>
    apiFetch<{ message: string; cohort: any }>('/api/instructor/cohorts/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),

  getCohorts: (token?: string | null) =>
    apiFetch<{ cohorts: any[] }>('/api/instructor/cohorts', { method: 'GET' }, token),

  createCohort: (name: string, description: string, code: string, token?: string | null) =>
    apiFetch<{ cohort: any }>('/api/instructor/cohorts', {
      method: 'POST',
      body: JSON.stringify({ name, description, code }),
    }, token),

  getCohortDetails: (id: string, token?: string | null) =>
    apiFetch<{ cohort: any }>(`/api/instructor/cohorts/${id}`, { method: 'GET' }, token),

  createAssignment: (cohortId: string, data: { title: string; labId?: string; learningPathId?: string; dueDate?: string }, token?: string | null) =>
    apiFetch<{ assignment: any }>(`/api/instructor/cohorts/${cohortId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  getCohortMatrix: (id: string, token?: string | null) =>
    apiFetch<{ tasks: any[]; matrix: any[] }>(`/api/instructor/cohorts/${id}/matrix`, { method: 'GET' }, token),
};
