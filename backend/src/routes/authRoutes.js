import express from 'express';
import { 
  signup, 
  getMe, 
  makeAdmin, 
  getAdminEmails 
} from '../controllers/authController.js';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
router.post('/signup', signup);

/**
 * PROTECTED ROUTES (Requires Login)
 */
router.get('/me', verifyToken, getMe);

/**
 * ADMIN ONLY ROUTES (Requires Login + Admin Claim)
 */
// Use Custom Claims API to promote a user
router.post('/make-admin', verifyToken, isAdmin, makeAdmin);

// Fetch list of admin emails from Firestore
router.get('/admins', verifyToken, isAdmin, getAdminEmails);

export default router;