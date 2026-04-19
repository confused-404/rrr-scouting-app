const DEFAULT_MESSAGE = 'Too many requests. Please try again later.';

const normalizePositiveInteger = (value, fallbackValue) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallbackValue;
  }

  return Math.floor(numericValue);
};

const normalizeKey = (value) => {
  const text = String(value ?? '').trim();
  return text || 'anonymous';
};

export const createRateLimiter = ({
  windowMs,
  maxRequests,
  keyResolver,
  message = DEFAULT_MESSAGE,
  now = () => Date.now(),
} = {}) => {
  const normalizedWindowMs = normalizePositiveInteger(windowMs, 60_000);
  const normalizedMaxRequests = normalizePositiveInteger(maxRequests, 60);
  const resolveKey = typeof keyResolver === 'function'
    ? keyResolver
    : (req) => req.ip;

  const buckets = new Map();

  const pruneExpiredBuckets = (currentTimestamp) => {
    for (const [bucketKey, bucket] of buckets.entries()) {
      if ((bucket.resetAt + normalizedWindowMs) <= currentTimestamp) {
        buckets.delete(bucketKey);
      }
    }
  };

  const middleware = (req, res, next) => {
    const currentTimestamp = now();
    pruneExpiredBuckets(currentTimestamp);

    const bucketKey = normalizeKey(resolveKey(req));
    const existingBucket = buckets.get(bucketKey);
    const bucket = !existingBucket || existingBucket.resetAt <= currentTimestamp
      ? { count: 0, resetAt: currentTimestamp + normalizedWindowMs }
      : existingBucket;

    if (bucket.count >= normalizedMaxRequests) {
      const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - currentTimestamp) / 1000), 1);
      res.set('Retry-After', String(retryAfterSeconds));
      res.set('X-RateLimit-Limit', String(normalizedMaxRequests));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
      return res.status(429).json({ message });
    }

    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    res.set('X-RateLimit-Limit', String(normalizedMaxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(normalizedMaxRequests - bucket.count, 0)));
    res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    return next();
  };

  middleware.clear = () => {
    buckets.clear();
  };

  return middleware;
};
