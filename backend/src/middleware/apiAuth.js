export const validateApiKey = (req, res, next) => {
  // Skip API key validation for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY || 'dev-key-for-local-testing';
  
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing API key' });
  }
  
  next();
};

export const rateLimit = (maxRequests, windowMs) => {
  const requests = new Map();
  
  return (req, res, next) => {
    // Skip rate limiting for OPTIONS requests
    if (req.method === 'OPTIONS') {
      return next();
    }

    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const userRequests = requests.get(key) || [];
    
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ message: 'Too many requests' });
    }
    
    recentRequests.push(now);
    requests.set(key, recentRequests);
    
    next();
  };
};