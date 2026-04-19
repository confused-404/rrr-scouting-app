const cacheEntries = new Map();
const inFlightRequests = new Map();

const DEFAULT_TTL_MS = 5 * 60_000;

const stableSerialize = (value) => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value)
    .filter(([, nestedValue]) => nestedValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`).join(',')}}`;
};

const cloneValue = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const buildCacheKey = (namespace, path, params = {}) => (
  `${namespace}::${path}::${stableSerialize(params)}`
);

const getCachedEntry = (cacheKey) => {
  const entry = cacheEntries.get(cacheKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cacheEntries.delete(cacheKey);
    return null;
  }

  return entry;
};

export const getCachedUpstreamJson = async ({
  namespace,
  path,
  params = {},
  ttlMs = DEFAULT_TTL_MS,
  bypassCache = false,
  loader,
}) => {
  const cacheKey = buildCacheKey(namespace, path, params);
  const cachedEntry = bypassCache ? null : getCachedEntry(cacheKey);

  if (cachedEntry) {
    return {
      data: cloneValue(cachedEntry.data),
      cacheStatus: 'hit',
      ttlMs: Math.max(cachedEntry.expiresAt - Date.now(), 0),
    };
  }

  const activeRequest = bypassCache ? null : inFlightRequests.get(cacheKey);
  if (activeRequest) {
    const data = await activeRequest;
    return {
      data: cloneValue(data),
      cacheStatus: 'deduped',
      ttlMs,
    };
  }

  const requestPromise = Promise.resolve()
    .then(() => loader())
    .then((data) => {
      cacheEntries.set(cacheKey, {
        data: cloneValue(data),
        expiresAt: Date.now() + ttlMs,
      });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, requestPromise);

  const data = await requestPromise;
  return {
    data: cloneValue(data),
    cacheStatus: 'miss',
    ttlMs,
  };
};

export const applyUpstreamCacheHeaders = (res, { cacheStatus, ttlMs }) => {
  res.set('X-Upstream-Cache', cacheStatus);
  res.set('Cache-Control', `private, max-age=${Math.max(Math.floor(ttlMs / 1000), 0)}`);
};

export const clearUpstreamCache = () => {
  cacheEntries.clear();
  inFlightRequests.clear();
};
