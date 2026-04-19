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

type CacheScope = 'memory' | 'session';

type CacheOptions = {
  ttlMs: number;
  tags?: string[];
  scope?: CacheScope;
  bypassCache?: boolean;
};

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  tags: string[];
  scope: CacheScope;
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
const API_KEY = import.meta.env.VITE_API_KEY || (import.meta.env.DEV ? 'dev-key-for-local-testing' : '');
const CACHE_STORAGE_KEY = 'api-cache:v1';
const FORCE_REFRESH_WINDOW_MS = 15_000;

const CACHE_TTLS = {
  authProfile: 60_000,
  activeCompetition: 60_000,
  competition: 5 * 60_000,
  forms: 5 * 60_000,
  submissions: 2 * 60_000,
  strategy: 60_000,
  notes: 60_000,
  externalEventData: 15 * 60_000,
  externalTeamData: 10 * 60_000,
} as const;

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

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
let forceRefreshUntil = 0;

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getAuthScopeKey = (): string => auth.currentUser?.uid ?? 'anonymous';

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, nestedValue]) => nestedValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`).join(',')}}`;
};

const buildCacheKey = (url: string, params?: unknown): string => (
  `${getAuthScopeKey()}::${url}::${stableSerialize(params ?? null)}`
);

const cloneCachedValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const readPersistedCache = (): Record<string, CacheEntry<unknown>> => {
  const storage = getSessionStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writePersistedCache = (): void => {
  const storage = getSessionStorage();
  if (!storage) return;

  const persistedEntries = Object.fromEntries(
    Array.from(responseCache.entries())
      .filter(([, entry]) => entry.scope === 'session' && entry.expiresAt > Date.now()),
  );

  try {
    if (Object.keys(persistedEntries).length === 0) {
      storage.removeItem(CACHE_STORAGE_KEY);
      return;
    }

    storage.setItem(CACHE_STORAGE_KEY, JSON.stringify(persistedEntries));
  } catch {
    // Ignore storage quota or serialization failures; memory cache still helps.
  }
};

const hydratePersistedCache = (): void => {
  const persistedEntries = readPersistedCache();
  const now = Date.now();
  let mutated = false;

  Object.entries(persistedEntries).forEach(([key, entry]) => {
    if (!entry || entry.expiresAt <= now) {
      mutated = true;
      return;
    }

    responseCache.set(key, entry);
  });

  if (mutated) {
    writePersistedCache();
  }
};

const getCachedEntry = <T>(cacheKey: string): CacheEntry<T> | null => {
  const entry = responseCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    if (entry.scope === 'session') {
      writePersistedCache();
    }
    return null;
  }

  return entry;
};

const setCachedEntry = <T>(cacheKey: string, data: T, options: CacheOptions): T => {
  const entry: CacheEntry<T> = {
    data: cloneCachedValue(data),
    expiresAt: Date.now() + options.ttlMs,
    tags: options.tags ?? [],
    scope: options.scope ?? 'memory',
  };

  responseCache.set(cacheKey, entry);

  if (entry.scope === 'session') {
    writePersistedCache();
  }

  return cloneCachedValue(entry.data);
};

const invalidateCache = (tags: string[]): void => {
  if (tags.length === 0) return;

  let sessionCacheTouched = false;

  Array.from(responseCache.entries()).forEach(([cacheKey, entry]) => {
    if (!entry.tags.some((tag) => tags.includes(tag))) return;
    responseCache.delete(cacheKey);
    if (entry.scope === 'session') {
      sessionCacheTouched = true;
    }
  });

  if (sessionCacheTouched) {
    writePersistedCache();
  }
};

const cachedGet = async <T>(url: string, options: CacheOptions & { params?: unknown }): Promise<T> => {
  const cacheKey = buildCacheKey(url, options.params);
  const shouldBypassCache = options.bypassCache || forceRefreshUntil > Date.now();

  if (!shouldBypassCache) {
    const cachedEntry = getCachedEntry<T>(cacheKey);
    if (cachedEntry) {
      apiLogger.debug('API cache hit', {
        url,
        cacheKey,
        scope: cachedEntry.scope,
        tags: cachedEntry.tags,
      });
      return cloneCachedValue(cachedEntry.data);
    }

    const inFlight = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
    if (inFlight) {
      apiLogger.debug('API request deduplicated via in-flight cache', {
        url,
        cacheKey,
      });
      return inFlight.then((result) => cloneCachedValue(result));
    }
  }

  const requestPromise = api.get<T>(url, { params: options.params }).then((response) => {
    if (options.ttlMs > 0) {
      return setCachedEntry(cacheKey, response.data, options);
    }

    return response.data;
  }).finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise.then((result) => cloneCachedValue(result));
};

const runMutation = async <T>(request: () => Promise<T>, invalidationTags: string[] = []): Promise<T> => {
  const result = await request();
  invalidateCache(invalidationTags);
  return result;
};

export const clearApiCache = (): void => {
  responseCache.clear();
  inFlightRequests.clear();

  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage failures; memory cache has already been cleared.
  }
};

export const forceApiRefresh = (): void => {
  clearApiCache();
  forceRefreshUntil = Date.now() + FORCE_REFRESH_WINDOW_MS;
};

hydratePersistedCache();

api.interceptors.request.use(async (config) => {
  const requestId =
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nextConfig = config as typeof config & LoggingConfig;
  const headers = AxiosHeaders.from(nextConfig.headers);
  nextConfig.metadata = { requestId, startedAt: Date.now() };
  headers.set('X-Request-ID', requestId);
  if (forceRefreshUntil > Date.now() && String(nextConfig.method || 'get').toLowerCase() === 'get') {
    headers.set('X-Bypass-Upstream-Cache', 'true');
  }

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
    return runMutation(async () => {
      const response = await api.post('/auth/signup', { email, password });
      return response.data;
    }, ['auth:me', 'auth:users']);
  },
  getCurrentUser: async () => {
    return cachedGet('/auth/me', {
      ttlMs: CACHE_TTLS.authProfile,
      tags: ['auth:me'],
    });
  },
  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', { email, code, newPassword });
    return response.data;
  },
  getAllUsers: async (): Promise<Array<{ uid: string; email: string; role: 'admin' | 'drive' | 'user'; scouterName: string | null }>> => {
    return cachedGet('/auth/users', {
      ttlMs: CACHE_TTLS.competition,
      tags: ['auth:users'],
    });
  },
  updateScouterName: async (uid: string, scouterName: string | null): Promise<void> => {
    await runMutation(() => api.put(`/auth/users/${uid}/scouter`, { scouterName }), ['auth:users', 'auth:me']);
  },
  promoteUser: async (uid: string): Promise<void> => {
    await runMutation(() => api.post(`/auth/users/${uid}/promote`), ['auth:users']);
  },
  demoteUser: async (uid: string): Promise<void> => {
    await runMutation(() => api.post(`/auth/users/${uid}/demote`), ['auth:users']);
  },
  setUserRole: async (uid: string, role: 'admin' | 'drive' | 'user'): Promise<void> => {
    await runMutation(() => api.put(`/auth/users/${uid}/role`, { role }), ['auth:users']);
  },
  deleteUser: async (uid: string): Promise<void> => {
    await runMutation(() => api.delete(`/auth/users/${uid}`), ['auth:users']);
  },
  getPinnedMatches: async (competitionId: string): Promise<Array<{ key: string; label: string; redTeams: string[]; blueTeams: string[] }>> => {
    return cachedGet(`/auth/pins/${competitionId}`, {
      ttlMs: CACHE_TTLS.competition,
      tags: [`auth:pins:${competitionId}`],
    });
  },
  savePinnedMatches: async (
    competitionId: string,
    matches: Array<{ key: string; label: string; redTeams: string[]; blueTeams: string[] }>,
  ): Promise<Array<{ key: string; label: string; redTeams: string[]; blueTeams: string[] }>> => {
    return runMutation(async () => {
      const response = await api.put(`/auth/pins/${competitionId}`, { matches });
      return response.data;
    }, [`auth:pins:${competitionId}`]);
  },
  getTeamBank: async (competitionId: string): Promise<string[]> => {
    return cachedGet(`/auth/team-bank/${competitionId}`, {
      ttlMs: CACHE_TTLS.competition,
      tags: [`auth:team-bank:${competitionId}`],
    });
  },
  saveTeamBank: async (competitionId: string, teams: string[]): Promise<string[]> => {
    return runMutation(async () => {
      const response = await api.put(`/auth/team-bank/${competitionId}`, { teams });
      return response.data;
    }, [`auth:team-bank:${competitionId}`]);
  },
};

export const competitionApi = {
  getAll: async (): Promise<Competition[]> => {
    return cachedGet('/competitions', {
      ttlMs: CACHE_TTLS.competition,
      tags: ['competitions', 'competitions:list'],
      scope: 'session',
    });
  },
  getActive: async (): Promise<Competition | null> => {
    return cachedGet('/competitions/active', {
      ttlMs: CACHE_TTLS.activeCompetition,
      tags: ['competitions', 'competitions:active'],
      scope: 'session',
    });
  },
  getById: async (id: string): Promise<Competition> => {
    return cachedGet(`/competitions/${id}`, {
      ttlMs: CACHE_TTLS.competition,
      tags: ['competitions', `competition:${id}`],
      scope: 'session',
    });
  },
  create: async (competition: Partial<Competition>): Promise<Competition> => {
    return runMutation(async () => {
      const response = await api.post('/competitions', competition);
      return response.data;
    }, ['competitions', 'competitions:list', 'competitions:active']);
  },
  update: async (id: string, competition: Partial<Competition>): Promise<Competition> => {
    return runMutation(async () => {
      const response = await api.put(`/competitions/${id}`, competition);
      return response.data;
    }, ['competitions', 'competitions:list', 'competitions:active', `competition:${id}`]);
  },
  delete: async (id: string): Promise<void> => {
    await runMutation(() => api.delete(`/competitions/${id}`), ['competitions', 'competitions:list', 'competitions:active', `competition:${id}`]);
  },
  addForm: async (competitionId: string, formId: string): Promise<Competition> => {
    return runMutation(async () => {
      const response = await api.post(`/competitions/${competitionId}/forms/add`, { formId });
      return response.data;
    }, ['competitions', 'competitions:list', 'competitions:active', `competition:${competitionId}`, 'forms', `forms:competition:${competitionId}`]);
  },
  removeForm: async (competitionId: string, formId: string): Promise<Competition> => {
    return runMutation(async () => {
      const response = await api.post(`/competitions/${competitionId}/forms/remove`, { formId });
      return response.data;
    }, ['competitions', 'competitions:list', 'competitions:active', `competition:${competitionId}`, 'forms', `forms:competition:${competitionId}`]);
  },
  setActiveForm: async (competitionId: string, formId: string | null): Promise<Competition> => {
    return runMutation(async () => {
      const response = await api.post(`/competitions/${competitionId}/forms/set-active`, { formId });
      return response.data;
    }, ['competitions', 'competitions:list', 'competitions:active', `competition:${competitionId}`, 'forms', `forms:competition:${competitionId}`]);
  },
  saveSuperscouterNotes: async (competitionId: string, teamNumber: string, notes: string): Promise<Competition> => {
    return runMutation(async () => {
      const response = await api.post(`/competitions/${competitionId}/superscouterNotes`, { teamNumber, notes });
      return response.data;
    }, [`competition:${competitionId}`, `competition:${competitionId}:superscouter-notes:${teamNumber}`]);
  },
  getSuperscouterNotes: async (competitionId: string, teamNumber: string): Promise<{ teamNumber: string; notes: string }> => {
    return cachedGet(`/competitions/${competitionId}/superscouterNotes`, {
      params: { teamNumber },
      ttlMs: CACHE_TTLS.notes,
      tags: [`competition:${competitionId}:superscouter-notes:${teamNumber}`],
    });
  },
  saveDriveTeamStrategy: async (competitionId: string, teamNumber: string, matchKey: string, strategy: string): Promise<Competition> => {
    return runMutation(async () => {
      const response = await api.post(`/competitions/${competitionId}/driveTeamStrategy`, { teamNumber, matchKey, strategy });
      return response.data;
    }, [`competition:${competitionId}:strategy:${teamNumber}:${matchKey}`]);
  },
  getDriveTeamStrategy: async (competitionId: string, teamNumber: string, matchKey: string): Promise<{ teamNumber: string; strategy: string }> => {
    return cachedGet(`/competitions/${competitionId}/driveTeamStrategy`, {
      params: { teamNumber, matchKey },
      ttlMs: CACHE_TTLS.strategy,
      tags: [`competition:${competitionId}:strategy:${teamNumber}:${matchKey}`],
    });
  },
};

export const formApi = {
  getForms: async (): Promise<Form[]> => {
    return cachedGet('/forms', {
      ttlMs: CACHE_TTLS.forms,
      tags: ['forms', 'forms:list'],
      scope: 'session',
    });
  },
  getFormsByCompetition: async (competitionId: string): Promise<Form[]> => {
    return cachedGet(`/forms/competition/${competitionId}`, {
      ttlMs: CACHE_TTLS.forms,
      tags: ['forms', `forms:competition:${competitionId}`],
      scope: 'session',
    });
  },
  getForm: async (id: string): Promise<Form> => {
    return cachedGet(`/forms/${id}`, {
      ttlMs: CACHE_TTLS.forms,
      tags: ['forms', `form:${id}`],
      scope: 'session',
    });
  },
  createForm: async (competitionId: string, form: { fields: FormField[]; name?: string; teamNumberFieldId?: number | null }): Promise<Form> => {
    return runMutation(async () => {
      const response = await api.post('/forms', { ...form, competitionId });
      return response.data;
    }, ['forms', 'forms:list', `forms:competition:${competitionId}`, 'competitions', `competition:${competitionId}`]);
  },
  copyForm: async (id: string, payload: { destinationCompetitionId: string; name?: string }): Promise<Form> => {
    return runMutation(async () => {
      const response = await api.post(`/forms/${id}/copy`, payload);
      return response.data;
    }, ['forms', 'forms:list', `form:${id}`, `forms:competition:${payload.destinationCompetitionId}`, 'competitions', `competition:${payload.destinationCompetitionId}`]);
  },
  updateForm: async (id: string, form: { fields: FormField[]; name: string; teamNumberFieldId?: number | null }): Promise<Form> => {
    return runMutation(async () => {
      const response = await api.put(`/forms/${id}`, form);
      return response.data;
    }, ['forms', 'forms:list', `form:${id}`]);
  },
  deleteForm: async (id: string): Promise<void> => {
    await runMutation(() => api.delete(`/forms/${id}`), ['forms', 'forms:list', `form:${id}`]);
  },
  getSubmissions: async (formId: string): Promise<Submission[]> => {
    return cachedGet(`/forms/${formId}/submissions`, {
      ttlMs: CACHE_TTLS.submissions,
      tags: ['submissions', `submissions:form:${formId}`],
      scope: 'session',
    });
  },
  getSubmissionsByCompetition: async (competitionId: string): Promise<Submission[]> => {
    return cachedGet(`/forms/competition/${competitionId}/submissions`, {
      ttlMs: CACHE_TTLS.submissions,
      tags: ['submissions', `submissions:competition:${competitionId}`],
      scope: 'session',
    });
  },
  createSubmission: async (formId: string, competitionId: string, data: Record<string, unknown>): Promise<Submission> => {
    return runMutation(async () => {
      const response = await api.post('/forms/submissions', { formId, competitionId, data });
      return response.data;
    }, ['submissions', `submissions:form:${formId}`, `submissions:competition:${competitionId}`]);
  },
  /**
   * Overwrite an existing submission's data in-place (admin only).
   * Sends PUT /forms/submissions/:id  — the backend validates the data
   * against the form's field definitions and updates ONLY the data field.
   * The original document (formId, competitionId, timestamp) is preserved.
   */
  updateSubmission: async (submissionId: string, data: Record<string, unknown>): Promise<Submission> => {
    return runMutation(async () => {
      const response = await api.put(`/forms/submissions/${submissionId}`, { data });
      return response.data;
    }, ['submissions']);
  },
};

export const tbaApi = {
  getTeam: async (teamKey: string): Promise<unknown> => {
    return cachedGet(`/tba/team/${teamKey}`, {
      ttlMs: CACHE_TTLS.externalTeamData,
      tags: [`tba:team:${teamKey}`],
      scope: 'session',
    });
  },
  getTeamsSimple: async (year: string): Promise<unknown[]> => {
    return cachedGet(`/tba/teams/${year}/simple`, {
      ttlMs: CACHE_TTLS.externalEventData,
      tags: [`tba:teams:${year}`],
      scope: 'session',
    });
  },
  getEvents: async (year: string): Promise<unknown[]> => {
    return cachedGet(`/tba/events/${year}`, {
      ttlMs: CACHE_TTLS.externalEventData,
      tags: [`tba:events:${year}`],
      scope: 'session',
    });
  },
  getEventMatches: async (eventKey: string): Promise<unknown[]> => {
    return cachedGet(`/tba/event/${eventKey}/matches`, {
      ttlMs: CACHE_TTLS.externalEventData,
      tags: [`tba:event:${eventKey}:matches`],
      scope: 'session',
    });
  },
  getEventOPRs: async (eventKey: string): Promise<TbaEventOprsResponse> => {
    return cachedGet(`/tba/event/${eventKey}/oprs`, {
      ttlMs: CACHE_TTLS.externalEventData,
      tags: [`tba:event:${eventKey}:oprs`],
      scope: 'session',
    });
  },
  getEventTeams: async (eventKey: string): Promise<unknown[]> => {
    try {
      return cachedGet(`/tba/event/${eventKey}/teams`, {
        ttlMs: CACHE_TTLS.externalEventData,
        tags: [`tba:event:${eventKey}:teams`],
        scope: 'session',
      });
    } catch (error) {
      try {
        // Fallback to Statbotics roster if TBA team list is unavailable.
        return cachedGet('/statbotics/team_events', {
          params: { event: eventKey, limit: 999 },
          ttlMs: CACHE_TTLS.externalEventData,
          tags: [`statbotics:event:${eventKey}:team-events`],
          scope: 'session',
        });
      } catch {
        throw error;
      }
    }
  },
};

export const statboticsApi = {
  normalizeEventKey: (eventKey: string) => eventKey.trim().toLowerCase(),
  normalizeTeam: (team: string) => team.trim().replace(/^frc/i, ''),
  getEvent: async (event: string): Promise<unknown> => {
    const normalizedEventKey = statboticsApi.normalizeEventKey(event);
    return cachedGet(`/statbotics/event/${normalizedEventKey}`, {
      ttlMs: CACHE_TTLS.externalEventData,
      tags: [`statbotics:event:${normalizedEventKey}`],
      scope: 'session',
    });
  },
  getEventMatches: async (eventKey: string): Promise<unknown[]> => {
    const normalizedEventKey = statboticsApi.normalizeEventKey(eventKey);
    return cachedGet(`/statbotics/event/${normalizedEventKey}/matches`, {
      ttlMs: CACHE_TTLS.externalEventData,
      tags: [`statbotics:event:${normalizedEventKey}:matches`],
      scope: 'session',
    });
  },
  getTeamEvent: async (team: string, event: string): Promise<unknown> => {
    const normalizedTeam = statboticsApi.normalizeTeam(team);
    const normalizedEventKey = statboticsApi.normalizeEventKey(event);
    return cachedGet(`/statbotics/team_event/${normalizedTeam}/${normalizedEventKey}`, {
      ttlMs: CACHE_TTLS.externalTeamData,
      tags: [`statbotics:team-event:${normalizedTeam}:${normalizedEventKey}`],
      scope: 'session',
    });
  },
  getEventTeams: async (event: string): Promise<unknown[]> => {
    const normalizedEventKey = statboticsApi.normalizeEventKey(event);
    return cachedGet('/statbotics/team_events', {
      params: { event: normalizedEventKey, limit: 999 },
      ttlMs: CACHE_TTLS.externalEventData,
      tags: [`statbotics:event:${normalizedEventKey}:team-events`],
      scope: 'session',
    });
  },
  getTeamEvents: async (params?: { team?: string; year?: string; event?: string; limit?: number; offset?: number }): Promise<unknown[]> => {
    const normalizedParams = {
      ...params,
      team: params?.team ? statboticsApi.normalizeTeam(params.team) : undefined,
      event: params?.event ? statboticsApi.normalizeEventKey(params.event) : undefined,
    };
    return cachedGet('/statbotics/team_events', {
      params: normalizedParams,
      ttlMs: CACHE_TTLS.externalEventData,
      tags: ['statbotics:team-events'],
      scope: 'session',
    });
  },
  getTeamEventTeleopBalls: async (team: string, event: string): Promise<TeleopBallsResponse> => {
    const normalizedTeam = statboticsApi.normalizeTeam(team);
    const normalizedEventKey = statboticsApi.normalizeEventKey(event);
    return cachedGet(`/statbotics/team_event/${normalizedTeam}/${normalizedEventKey}/teleop_balls`, {
      ttlMs: CACHE_TTLS.externalTeamData,
      tags: [`statbotics:team-event:${normalizedTeam}:${normalizedEventKey}:teleop-balls`],
      scope: 'session',
    });
  },
  getTeamMatches: async (params?: { team?: string; year?: string; event?: string; limit?: number; offset?: number }): Promise<unknown[]> => {
    const normalizedParams = {
      ...params,
      team: params?.team ? statboticsApi.normalizeTeam(params.team) : undefined,
      event: params?.event ? statboticsApi.normalizeEventKey(params.event) : undefined,
    };
    return cachedGet('/statbotics/team_matches', {
      params: normalizedParams,
      ttlMs: CACHE_TTLS.externalTeamData,
      tags: ['statbotics:team-matches'],
      scope: 'session',
    });
  },
};
