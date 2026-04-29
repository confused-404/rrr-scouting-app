import express from 'express';
import { db } from '../config/firebase.js';
import {
  signup, 
  getMe, 
  makeAdmin, 
  getAdminEmails,
  initializeFirstAdmin,
  forgotPassword,
  resetPassword,
  getAllUsers,
  updateScouterName,
  getPinnedMatches,
  savePinnedMatches,
  getTeamBank,
  saveTeamBank,
  promoteUser,
  demoteUser,
  setUserRole,
  deleteUser,
} from '../controllers/authController.js';
import { clientLogController } from '../controllers/clientLogController.js';
import { verifyToken, isAdmin, requireSetupSecret } from '../middleware/userAuth.js';
import { createFirestoreRateLimitStore, createRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const publicAuthKey = (prefix) => (req) => `${prefix}:${req.ip}`;
const publicAuthAndEmailKey = (prefix) => (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'anonymous';
  return `${prefix}:${req.ip}:${email || 'anonymous'}`;
};
const sharedRateLimitStore = createFirestoreRateLimitStore({ db });

const initializeAdminLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 10,
  keyResolver: publicAuthKey('initialize-admin'),
  store: sharedRateLimitStore,
});

const signupLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 5,
  keyResolver: publicAuthAndEmailKey('signup'),
  store: sharedRateLimitStore,
});

const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 5,
  keyResolver: publicAuthAndEmailKey('forgot-password'),
  store: sharedRateLimitStore,
});

const resetPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 10,
  keyResolver: publicAuthAndEmailKey('reset-password'),
  store: sharedRateLimitStore,
});

const clientLogLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyResolver: (req) => `client-log:${req.ip}`,
  store: sharedRateLimitStore,
});

// BOOTSTRAP: Call this once to create your first admin and the 'users' collection
router.post('/initialize-admin', initializeAdminLimiter, requireSetupSecret, initializeFirstAdmin);

// PUBLIC
router.post('/signup', signupLimiter, signup);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);
router.post('/client-logs', clientLogLimiter, clientLogController.ingest);

// AUTHENTICATED
router.get('/me', verifyToken, getMe);
router.get('/pins/:competitionId', verifyToken, getPinnedMatches);
router.put('/pins/:competitionId', verifyToken, savePinnedMatches);
router.get('/team-bank/:competitionId', verifyToken, getTeamBank);
router.put('/team-bank/:competitionId', verifyToken, saveTeamBank);

// ADMIN ONLY
router.post('/make-admin', verifyToken, isAdmin, makeAdmin);
router.get('/admins', verifyToken, isAdmin, getAdminEmails);
router.get('/users', verifyToken, isAdmin, getAllUsers);
router.put('/users/:uid/scouter', verifyToken, isAdmin, updateScouterName);
router.put('/users/:uid/role', verifyToken, isAdmin, setUserRole);
router.post('/users/:uid/promote', verifyToken, isAdmin, promoteUser);
router.post('/users/:uid/demote', verifyToken, isAdmin, demoteUser);
router.delete('/users/:uid', verifyToken, isAdmin, deleteUser);

export default router;
