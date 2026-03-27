import axios, { AxiosHeaders } from 'axios';
import { auth } from '../config/firebase';
import type { Form, FormField, Submission } from '../types/form.types';
import type { Competition } from '../types/competition.types';
import { createLogger, formatErrorForLogging, sanitizeForLogging } from '../utils/logger';

type RequestMetadata = {
  requestId: string;
  startedAt: number;
};

type LoggingConfig = {
  metadata?: RequestMetadata;
};

type TbaEventOprsResponse = {
  oprs?: Record<string, number>;
};

export type TeleopBallsResponse = {
  team: string;
  event: string;
  year: number | null;
  epa: number | null;
  teleopBalls: Record<string, number> | null;
};

const apiLogger = createLogger('api');

const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  if (import.meta.env.DEV) return '/api';
  return `${window.location.protocol}//${window.location.host}/api`;
};

const API_BASE_URL = getApiUrl();
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-for-local-testing';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
});

apiLogger.info('Configured API client', {
  baseUrl: API_BASE_URL,
  hasApiKey: Boolean(API_KEY),
});

api.interceptors.request.use(async (config) => {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nextConfig = config as typeof config & LoggingConfig;
  const headers = AxiosHeaders.from(nextConfig.headers);
  nextConfig.metadata = { requestId, startedAt: Date.now() };
  headers.set('X-Request-ID', requestId);

  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch (error) {
      apiLogger.error('Failed to attach Firebase auth token', {
        requestId,
        url: nextConfig.url,
        error: formatErrorForLogging(error),
      });
      throw error;
    }
  }

  nextConfig.headers = headers;
  apiLogger.debug('API request started', {
    requestId,
    method: nextConfig.method,
    url: nextConfig.url,
    params: sanitizeForLogging(nextConfig.params),
    data: sanitizeForLogging(nextConfig.data),
  });
  return nextConfig;
});

api.interceptors.response.use(
  (response) => {
    const config = response.config as typeof response.config & LoggingConfig;
    const durationMs = config.metadata ? Date.now() - config.metadata.startedAt : undefined;
    apiLogger.debug('API request completed', {
      requestId: config.metadata?.requestId,
      method: config.method,
      url: config.url,
      status: response.status,
      durationMs,
    });
    return response;
  },
  (error) => {
    const config = error.config as (typeof error.config & LoggingConfig) | undefined;
    const durationMs = config?.metadata ? Date.now() - config.metadata.startedAt : undefined;
    apiLogger.error('API request failed', {
      requestId: config?.metadata?.requestId,
      method: config?.method,
      url: config?.url,
      status: error.response?.status,
      durationMs,
      code: error.code,
      error: formatErrorForLogging(error),
      responseData: sanitizeForLogging(error.response?.data),
    });
    return Promise.reject(error);
  },
);

export const authApi = {
  signup: async (email: string, password: string) => {
    const response = await api.post('/auth/signup', { email, password });
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', { email, code, newPassword });
    return response.data;
  },
};

export const competitionApi = {
  getAll: async (): Promise<Competition[]> => {
    const response = await api.get('/competitions');
    return response.data;
  },
  getActive: async (): Promise<Competition | null> => {
    const response = await api.get('/competitions/active');
    return response.data;
  },
  getById: async (id: string): Promise<Competition> => {
    const response = await api.get(`/competitions/${id}`);
    return response.data;
  },
  create: async (competition: Partial<Competition>): Promise<Competition> => {
    const response = await api.post('/competitions', competition);
    return response.data;
  },
  update: async (id: string, competition: Partial<Competition>): Promise<Competition> => {
    const response = await api.put(`/competitions/${id}`, competition);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/competitions/${id}`);
  },
  addForm: async (competitionId: string, formId: string): Promise<Competition> => {
    const response = await api.post(`/competitions/${competitionId}/forms/add`, { formId });
    return response.data;
  },
  removeForm: async (competitionId: string, formId: string): Promise<Competition> => {
    const response = await api.post(`/competitions/${competitionId}/forms/remove`, { formId });
    return response.data;
  },
  setActiveForm: async (competitionId: string, formId: string | null): Promise<Competition> => {
    const response = await api.post(`/competitions/${competitionId}/forms/set-active`, { formId });
    return response.data;
  },
  saveSuperscouterNotes: async (competitionId: string, teamNumber: string, notes: string): Promise<Competition> => {
    const response = await api.post(`/competitions/${competitionId}/superscouterNotes`, { teamNumber, notes });
    return response.data;
  },
  getSuperscouterNotes: async (competitionId: string, teamNumber: string): Promise<{ teamNumber: string; notes: string }> => {
    const response = await api.get(`/competitions/${competitionId}/superscouterNotes`, { params: { teamNumber } });
    return response.data;
  },
};

export const formApi = {
  getForms: async (): Promise<Form[]> => {
    const response = await api.get('/forms');
    return response.data;
  },
  getFormsByCompetition: async (competitionId: string): Promise<Form[]> => {
    const response = await api.get(`/forms/competition/${competitionId}`);
    return response.data;
  },
  getForm: async (id: string): Promise<Form> => {
    const response = await api.get(`/forms/${id}`);
    return response.data;
  },
  createForm: async (competitionId: string, fields: FormField[], name?: string): Promise<Form> => {
    const response = await api.post('/forms', { competitionId, fields, name });
    return response.data;
  },
  updateForm: async (id: string, fields: FormField[], name?: string): Promise<Form> => {
    const response = await api.put(`/forms/${id}`, { fields, name });
    return response.data;
  },
  deleteForm: async (id: string): Promise<void> => {
    await api.delete(`/forms/${id}`);
  },
  getSubmissions: async (formId: string): Promise<Submission[]> => {
    const response = await api.get(`/forms/${formId}/submissions`);
    return response.data;
  },
  getSubmissionsByCompetition: async (competitionId: string): Promise<Submission[]> => {
    const response = await api.get(`/forms/competition/${competitionId}/submissions`);
    return response.data;
  },
  createSubmission: async (formId: string, competitionId: string, data: Record<string, unknown>): Promise<Submission> => {
    const response = await api.post('/forms/submissions', { formId, competitionId, data });
    return response.data;
  },
  /**
   * Overwrite an existing submission's data in-place (admin only).
   * Sends PUT /forms/submissions/:id  — the backend validates the data
   * against the form's field definitions and updates ONLY the data field.
   * The original document (formId, competitionId, timestamp) is preserved.
   */
  updateSubmission: async (submissionId: string, data: Record<string, unknown>): Promise<Submission> => {
    const response = await api.put(`/forms/submissions/${submissionId}`, { data });
    return response.data;
  },
};

export const tbaApi = {
  getTeam: async (teamKey: string): Promise<unknown> => {
    const response = await api.get(`/tba/team/${teamKey}`);
    return response.data;
  },
  getTeamsSimple: async (year: string): Promise<unknown[]> => {
    const response = await api.get(`/tba/teams/${year}/simple`);
    return response.data;
  },
  getEvents: async (year: string): Promise<unknown[]> => {
    const response = await api.get(`/tba/events/${year}`);
    return response.data;
  },
  getEventMatches: async (eventKey: string): Promise<unknown[]> => {
    const response = await api.get(`/tba/event/${eventKey}/matches`);
    return response.data;
  },
  getEventOPRs: async (eventKey: string): Promise<TbaEventOprsResponse> => {
    const response = await api.get(`/tba/event/${eventKey}/oprs`);
    return response.data;
  },
};

export const statboticsApi = {
  getEventMatches: async (eventKey: string): Promise<unknown[]> => {
    const response = await api.get(`/statbotics/event/${eventKey}/matches`);
    return response.data;
  },
  getTeamEvent: async (team: string, event: string): Promise<unknown> => {
    const response = await api.get(`/statbotics/team_event/${team}/${event}`);
    return response.data;
  },
  getTeamEvents: async (params?: { team?: string; year?: string; event?: string; limit?: number; offset?: number }): Promise<unknown[]> => {
    const response = await api.get('/statbotics/team_events', { params });
    return response.data;
  },
  getTeamEventTeleopBalls: async (team: string, event: string): Promise<TeleopBallsResponse> => {
    const response = await api.get(`/statbotics/team_event/${team}/${event}/teleop_balls`);
    return response.data;
  },
};
