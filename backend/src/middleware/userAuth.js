import { auth } from '../config/firebase.js';

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    // The decodedToken contains any Custom Claims (like { admin: true })
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// NEW: Check for admin status
export const isAdmin = (req, res, next) => {
  // verifyToken must run BEFORE this to populate req.user
  if (req.user && req.user.admin === true) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};

export const optionalAuth = async (req, res, next) => {
  // ... your existing optionalAuth code ...
};