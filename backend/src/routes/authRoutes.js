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

// ADMIN ONLY
router.post('/make-admin', verifyToken, isAdmin, makeAdmin);
router.get('/admins', verifyToken, isAdmin, getAdminEmails);
router.get('/users', verifyToken, isAdmin, getAllUsers);
router.put('/users/:uid/scouter', verifyToken, isAdmin, updateScouterName);

export default router;