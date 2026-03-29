import express from 'express';
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
  deleteUser,
} from '../controllers/authController.js';
import { verifyToken, isAdmin } from '../middleware/userAuth.js';

const router = express.Router();

// BOOTSTRAP: Call this once to create your first admin and the 'users' collection
router.post('/initialize-admin', initializeFirstAdmin);

// PUBLIC
router.post('/signup', signup);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

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
router.post('/users/:uid/promote', verifyToken, isAdmin, promoteUser);
router.post('/users/:uid/demote', verifyToken, isAdmin, demoteUser);
router.delete('/users/:uid', verifyToken, isAdmin, deleteUser);

export default router;