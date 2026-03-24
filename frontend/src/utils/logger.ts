type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export interface LogEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  context?: SerializableValue;
}

interface LoggerApi {
  debug: (message: string, context?: unknown) => void;
  info: (message: string, context?: unknown) => void;
  warn: (message: string, context?: unknown) => void;
  error: (message: string, context?: unknown) => void;
}

interface LoggerDebugApi {
  getLogs: () => LogEntry[];
  clearLogs: () => void;
  exportLogs: () => string;
  setLevel: (level: LogLevel) => void;
  getLevel: () => LogLevel;
}

declare global {
  interface Window {
    __SCOUT_LOGGER__?: LoggerDebugApi;
    __SCOUT_LOGS__?: LogEntry[];
  }
}

const STORAGE_KEY = 'scout-frontend-logs';
const LOG_LEVEL_STORAGE_KEY = 'scout-log-level';
const MAX_LOG_ENTRIES = 500;
const CONSOLE_SCOPE = 'console';
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|api[-_]?key|cookie/i;

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const rawConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  log: console.log.bind(console),
};

const sessionId = createId();
const logEntries = loadStoredLogs();
let activeLevel = readInitialLevel();
let consolePatched = false;
let globalHandlersInstalled = false;
let loggerInitialized = false;

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readInitialLevel(): LogLevel {
  if (typeof window !== 'undefined') {
    const storedLevel = window.localStorage.getItem(LOG_LEVEL_STORAGE_KEY);
    if (isLogLevel(storedLevel)) {
      return storedLevel;
    }
  }

  const envLevel = import.meta.env.VITE_LOG_LEVEL;
  return isLogLevel(envLevel) ? envLevel : 'info';
}

function isLogLevel(value: unknown): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

function loadStoredLogs(): LogEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as LogEntry[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_LOG_ENTRIES) : [];
  } catch {
    return [];
  }
}

function persistLogs(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const nextLogs = logEntries.slice(-MAX_LOG_ENTRIES);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextLogs));
    window.__SCOUT_LOGS__ = nextLogs;
  } catch {
    // Ignore storage errors so logging never breaks the app.
  }
}

function shouldPrint(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[activeLevel];
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(sanitizeForLogging(value));
  } catch {
    return String(value);
  }
}

function sanitizeObject(value: Record<string, unknown>, seen: WeakSet<object>): Record<string, SerializableValue> {
  const entries = Object.entries(value).map(([key, nestedValue]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return [key, REDACTED] as const;
    }

    return [key, sanitizeForLogging(nestedValue, seen)] as const;
  });

  return Object.fromEntries(entries);
}

export function sanitizeForLogging(value: unknown, seen = new WeakSet<object>()): SerializableValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return formatErrorForLogging(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogging(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    if (value instanceof Response) {
      return {
        ok: value.ok,
        redirected: value.redirected,
        status: value.status,
        statusText: value.statusText,
        type: value.type,
        url: value.url,
      };
    }

    if (value instanceof Event) {
      return {
        type: value.type,
      };
    }

    return sanitizeObject(value as Record<string, unknown>, seen);
  }

  return String(value);
}

export function formatErrorForLogging(error: unknown): SerializableValue {
  if (error instanceof Error) {
    const errorWithCause = error as Error & { cause?: unknown };

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: errorWithCause.cause ? sanitizeForLogging(errorWithCause.cause) : undefined,
    };
  }

  return sanitizeForLogging(error);
}

function buildEntry(level: LogLevel, scope: string, message: string, context?: unknown): LogEntry {
  return {
    id: createId(),
    sessionId,
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    context: context === undefined ? undefined : sanitizeForLogging(context),
  };
}

function pushEntry(entry: LogEntry): void {
  logEntries.push(entry);

  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.splice(0, logEntries.length - MAX_LOG_ENTRIES);
  }

  persistLogs();
}

function printEntry(entry: LogEntry): void {
  if (!shouldPrint(entry.level)) {
    return;
  }

  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}`;
  const payload = entry.context === undefined ? [prefix] : [prefix, entry.context];

  switch (entry.level) {
    case 'debug':
      rawConsole.debug(...payload);
      break;
    case 'info':
      rawConsole.info(...payload);
      break;
    case 'warn':
      rawConsole.warn(...payload);
      break;
    case 'error':
      rawConsole.error(...payload);
      break;
  }
}

function record(level: LogLevel, scope: string, message: string, context?: unknown): void {
  const entry = buildEntry(level, scope, message, context);
  pushEntry(entry);
  printEntry(entry);
}

function extractConsoleContext(args: unknown[]): unknown {
  if (args.length === 0) {
    return undefined;
  }

  if (args.length === 1) {
    return args[0];
  }

  return args;
}

export function patchConsole(): void {
  if (consolePatched) {
    return;
  }

  consolePatched = true;

  const consoleLevelMap: Array<[LogLevel, 'debug' | 'info' | 'warn' | 'error' | 'log']> = [
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ];

  consoleLevelMap.forEach(([level, method]) => {
    const originalMethod = rawConsole[method];
    console[method] = (...args: unknown[]) => {
      const [message, ...rest] = args;
      const entry = buildEntry(level, CONSOLE_SCOPE, stringifyValue(message), extractConsoleContext(rest));
      pushEntry(entry);
      originalMethod(...args);
    };
  });

  console.log = (...args: unknown[]) => {
    const [message, ...rest] = args;
    const entry = buildEntry('info', CONSOLE_SCOPE, stringifyValue(message), extractConsoleContext(rest));
    pushEntry(entry);
    rawConsole.log(...args);
  };
}

export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled || typeof window === 'undefined') {
    return;
  }

  globalHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    record('error', 'window', 'Unhandled browser error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: formatErrorForLogging(event.error),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    record('error', 'window', 'Unhandled promise rejection', {
      reason: formatErrorForLogging(event.reason),
    });
  });
}

function exposeLoggerApi(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.__SCOUT_LOGGER__ = {
    getLogs: () => [...logEntries],
    clearLogs: () => {
      logEntries.splice(0, logEntries.length);
      persistLogs();
    },
    exportLogs: () => JSON.stringify(logEntries, null, 2),
    setLevel: (level: LogLevel) => {
      activeLevel = level;
      window.localStorage.setItem(LOG_LEVEL_STORAGE_KEY, level);
      record('info', 'logger', 'Log level updated', { level });
    },
    getLevel: () => activeLevel,
  };

  window.__SCOUT_LOGS__ = [...logEntries];
}

export function initializeLogger(): void {
  if (loggerInitialized) {
    return;
  }

  loggerInitialized = true;
  patchConsole();
  installGlobalErrorHandlers();
  exposeLoggerApi();

  record('info', 'logger', 'Frontend logger initialized', {
    level: activeLevel,
    mode: import.meta.env.MODE,
    url: typeof window === 'undefined' ? undefined : window.location.href,
    sessionId,
  });
}

export function setLogLevel(level: LogLevel): void {
  activeLevel = level;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOG_LEVEL_STORAGE_KEY, level);
  }
}

export function createLogger(scope: string): LoggerApi {
  return {
    debug: (message, context) => record('debug', scope, message, context),
    info: (message, context) => record('info', scope, message, context),
    warn: (message, context) => record('warn', scope, message, context),
    error: (message, context) => record('error', scope, message, context),
  };
}