const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_DEV_API_KEY = 'dev-key-for-local-testing';

const getConfiguredApiKey = () => {
  const configuredKey = process.env.API_KEY?.trim();
  if (configuredKey) return configuredKey;
  return isProduction ? '' : DEFAULT_DEV_API_KEY;
};

const getRateLimitKey = (req) => req.ip || 'unknown';

export const validateApiKey = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const expectedKey = getConfiguredApiKey();
  if (!expectedKey) {
    console.error('API key validation misconfigured: API_KEY is required in production.');
    return res.status(500).json({ message: 'API authentication is not configured.' });
  }

  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey !== 'string' || apiKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing API key' });
  }

  return next();
};

export const rateLimit = (maxRequests, windowMs) => {
  const requests = new Map();

  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const key = getRateLimitKey(req);
    const now = Date.now();
    const userRequests = requests.get(key) || [];
    const recentRequests = userRequests.filter((time) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      if (recentRequests.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, recentRequests);
      }
      return res.status(429).json({ message: 'Too many requests' });
    }

    recentRequests.push(now);
    requests.set(key, recentRequests);

    for (const [requestKey, timestamps] of requests.entries()) {
      const activeTimestamps = timestamps.filter((time) => now - time < windowMs);
      if (activeTimestamps.length === 0) {
        requests.delete(requestKey);
      } else if (activeTimestamps.length !== timestamps.length) {
        requests.set(requestKey, activeTimestamps);
      }
    }

    return next();
  };
};
