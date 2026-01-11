import axios from 'axios';
import { auth } from '../config/firebase';
import type { Form, FormField, Submission } from '../types/form.types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
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

export const formApi = {
  getForms: async (): Promise<Form[]> => {
    const response = await api.get('/forms');
    return response.data;
  },

  getForm: async (id: string): Promise<Form> => {
    const response = await api.get(`/forms/${id}`);
    return response.data;
  },

  createForm: async (fields: FormField[]): Promise<Form> => {
    const response = await api.post('/forms', { fields });
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

  createSubmission: async (formId: string, data: Record<string, any>): Promise<Submission> => {
    const response = await api.post('/forms/submissions', { formId, data });
    return response.data;
  },
};