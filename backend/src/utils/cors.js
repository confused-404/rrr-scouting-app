const LOCAL_DEV_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://[::1]:3000',
  'http://[::1]:5173',
]);

const normalizeOrigin = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return '';
  }
};

const parseOriginList = (value) => String(value ?? '')
  .split(',')
  .map((entry) => normalizeOrigin(entry))
  .filter(Boolean);

export const buildAllowedCorsOrigins = () => {
  const configuredOrigins = [
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.CORS_ORIGINS),
  ];

  return Array.from(new Set([
    ...LOCAL_DEV_ORIGINS,
    ...configuredOrigins,
  ]));
};

export const isAllowedCorsOrigin = (origin, allowedOrigins = buildAllowedCorsOrigins()) => {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return allowedOrigins.includes(normalizedOrigin);
};

