import express from 'express';
// Import your controller functions
import { signup, getMe, getAdminEmails } from '../controllers/authController.js';
// Import your middleware
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
router.post('/signup', signup);

/**
 * PROTECTED ROUTES (Any logged-in user)
 */
// verifyToken checks if the user is logged in and attaches them to req.user
router.get('/me', verifyToken, getMe);

/**
 * ADMIN ROUTES (Logged-in AND has admin claim)
 */
// verifyToken checks identity, then isAdmin checks the specific 'admin' claim
router.get('/admins', verifyToken, isAdmin, getAdminEmails);

export default router;