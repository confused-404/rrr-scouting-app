const MAX_STRING_LENGTH = 4000;
const MAX_CONTEXT_DEPTH = 4;
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|api[-_]?key|cookie/i;

const trimString = (value) => String(value ?? '').slice(0, MAX_STRING_LENGTH);

const sanitizeValue = (value, depth = 0, seen = new WeakSet()) => {
  if (
    value === null
    || value === undefined
    || typeof value === 'boolean'
    || typeof value === 'number'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return trimString(value);
  }

  if (depth >= MAX_CONTEXT_DEPTH) {
    return '[DepthLimit]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: trimString(value.message),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => (
        SENSITIVE_KEY_PATTERN.test(key)
          ? [key, REDACTED]
          : [key, sanitizeValue(nestedValue, depth + 1, seen)]
      )),
    );
  }

  return trimString(value);
};

export const clientLogController = {
  ingest: async (req, res) => {
    const allowedLevels = new Set(['warn', 'error']);
    const level = typeof req.body?.level === 'string' ? req.body.level : '';

    if (!allowedLevels.has(level)) {
      return res.status(204).end();
    }

    const scope = trimString(req.body?.scope || 'client');
    const message = trimString(req.body?.message || '');
    const timestamp = trimString(req.body?.timestamp || new Date().toISOString());
    const sessionId = trimString(req.body?.sessionId || '');

    if (!message) {
      return res.status(204).end();
    }

    const payload = {
      sessionId,
      timestamp,
      level,
      scope,
      message,
      context: sanitizeValue(req.body?.context),
      url: trimString(req.body?.url || ''),
      userAgent: trimString(req.body?.userAgent || ''),
    };

    console[level]('[client-log]', payload);
    return res.status(204).end();
  },
};
