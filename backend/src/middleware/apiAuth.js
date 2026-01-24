// API Key validation middleware for service-to-service authentication
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // Allow health checks without auth
  if (req.path === '/health') {
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Missing API key. Include X-API-Key header.' 
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ 
      error: 'Invalid API key.' 
    });
  }

  next();
};

// Rate limiting helper
const requestCounts = new Map();

export const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }

    const timestamps = requestCounts.get(ip);
    
    // Remove old requests outside the window
    const recentRequests = timestamps.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.' 
      });
    }

    recentRequests.push(now);
    requestCounts.set(ip, recentRequests);
    
    next();
  };
};
