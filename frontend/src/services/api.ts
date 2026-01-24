import axios from 'axios';
import { auth } from '../config/firebase';
import type { Form, FormField, Submission } from '../types/form.types';
import type { Competition } from '../types/competition.types';

// Use environment variable for API URL, fallback to current domain in production
const getApiUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  
  // For development, use relative /api path
  // For production, construct from current domain
  if ((import.meta as any).env?.DEV) {
    return '/api';
  }
  
  return `${window.location.protocol}//${window.location.host}/api`;
};

const API_BASE_URL = getApiUrl();

// Get API key from environment (should match backend API_KEY)
const API_KEY = (import.meta as any).env?.VITE_API_KEY || 'dev-key-for-local-testing';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  signup: async (email: string, password: string) => {
    const response = await api.post('/auth/signup', { email, password });
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const competitionApi = {
  getAll: async (): Promise<Competition[]> => {
    const response = await api.get('/competitions');
    return response.data;
  },

  getActive: async (): Promise<Competition[]> => {
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

  createForm: async (competitionId: string, fields: FormField[]): Promise<Form> => {
    const response = await api.post('/forms', { competitionId, fields });
    return response.data;
  },

  updateForm: async (id: string, fields: FormField[]): Promise<Form> => {
    const response = await api.put(`/forms/${id}`, { fields });
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

  createSubmission: async (formId: string, competitionId: string, data: Record<string, any>): Promise<Submission> => {
    const response = await api.post('/forms/submissions', { formId, competitionId, data });
    return response.data;
  },
};