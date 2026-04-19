import { auth, db } from '../config/firebase.js';
import {
  extractBearerToken,
  hasRequiredRole,
  isSetupSecretValid,
  resolveEffectiveRole,
} from '../utils/authz.js';

export const verifyToken = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const docRole = userDoc.exists ? userDoc.data()?.role : null;
    const effectiveRole = resolveEffectiveRole(decodedToken, docRole);

    req.user = {
      ...decodedToken,
      appRole: effectiveRole,
      admin: effectiveRole === 'admin',
      driveTeam: effectiveRole === 'drive',
    };
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (hasRequiredRole(req.user, allowedRoles)) {
    return next();
  }

  return res.status(403).json({ message: 'Forbidden' });
};

export const isAdmin = requireRoles('admin');
export const isAdminOrDriveTeam = requireRoles('admin', 'drive');

export const requireSetupSecret = (req, res, next) => {
  const providedSecret = req.headers['x-setup-secret'];
  const expectedSecret = process.env.INITIAL_ADMIN_SETUP_SECRET;

  if (!isSetupSecretValid(
    Array.isArray(providedSecret) ? providedSecret[0] : providedSecret,
    expectedSecret,
  )) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return next();
};
