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

const buildRateLimitHeaders = ({ response, limit, remaining, resetAt, retryAfterSeconds }) => {
  response.set('X-RateLimit-Limit', String(limit));
  response.set('X-RateLimit-Remaining', String(Math.max(remaining, 0)));
  response.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

  if (retryAfterSeconds !== undefined) {
    response.set('Retry-After', String(retryAfterSeconds));
  }
};

export const createMemoryRateLimitStore = ({ now = () => Date.now() } = {}) => {
  const buckets = new Map();

  const pruneExpiredBuckets = (currentTimestamp, windowMs) => {
    for (const [bucketKey, bucket] of buckets.entries()) {
      if ((bucket.resetAt + windowMs) <= currentTimestamp) {
        buckets.delete(bucketKey);
      }
    }
  };

  return {
    async consume({ key, windowMs, maxRequests }) {
      const currentTimestamp = now();
      pruneExpiredBuckets(currentTimestamp, windowMs);

      const existingBucket = buckets.get(key);
      const bucket = !existingBucket || existingBucket.resetAt <= currentTimestamp
        ? { count: 0, resetAt: currentTimestamp + windowMs }
        : existingBucket;

      if (bucket.count >= maxRequests) {
        return {
          allowed: false,
          limit: maxRequests,
          remaining: 0,
          resetAt: bucket.resetAt,
          retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - currentTimestamp) / 1000), 1),
        };
      }

      bucket.count += 1;
      buckets.set(key, bucket);

      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(maxRequests - bucket.count, 0),
        resetAt: bucket.resetAt,
      };
    },
    clear() {
      buckets.clear();
    },
  };
};

export const createFirestoreRateLimitStore = ({
  db,
  collectionName = '_rateLimits',
  now = () => Date.now(),
}) => ({
  async consume({ key, windowMs, maxRequests }) {
    const currentTimestamp = now();
    const docRef = db.collection(collectionName).doc(key);

    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const data = snapshot.exists ? (snapshot.data() || {}) : {};
      const resetAt = (
        typeof data.resetAt === 'number' && data.resetAt > currentTimestamp
          ? data.resetAt
          : currentTimestamp + windowMs
      );
      const count = resetAt === data.resetAt ? Number(data.count) || 0 : 0;

      if (count >= maxRequests) {
        return {
          allowed: false,
          limit: maxRequests,
          remaining: 0,
          resetAt,
          retryAfterSeconds: Math.max(Math.ceil((resetAt - currentTimestamp) / 1000), 1),
        };
      }

      const nextCount = count + 1;
      transaction.set(docRef, {
        count: nextCount,
        resetAt,
        updatedAt: currentTimestamp,
        expiresAt: resetAt + windowMs,
      }, { merge: true });

      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(maxRequests - nextCount, 0),
        resetAt,
      };
    });
  },
});

export const createRateLimiter = ({
  windowMs,
  maxRequests,
  keyResolver,
  message = DEFAULT_MESSAGE,
  now = () => Date.now(),
  store = createMemoryRateLimitStore({ now }),
} = {}) => {
  const normalizedWindowMs = normalizePositiveInteger(windowMs, 60_000);
  const normalizedMaxRequests = normalizePositiveInteger(maxRequests, 60);
  const resolveKey = typeof keyResolver === 'function'
    ? keyResolver
    : (req) => req.ip;

  const middleware = async (req, res, next) => {
    try {
      const bucketKey = normalizeKey(resolveKey(req));
      const result = await store.consume({
        key: bucketKey,
        windowMs: normalizedWindowMs,
        maxRequests: normalizedMaxRequests,
      });

      buildRateLimitHeaders({
        response: res,
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetAt,
        retryAfterSeconds: result.retryAfterSeconds,
      });

      if (!result.allowed) {
        return res.status(429).json({ message });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

  middleware.clear = () => {
    if (typeof store.clear === 'function') {
      store.clear();
    }
  };

  return middleware;
};
