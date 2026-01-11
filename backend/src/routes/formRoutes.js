import express from 'express';
import { formController } from '../controllers/formController.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Form routes - forms can be read by anyone, but only created/modified by authenticated users
router.get('/', formController.getForms);
router.get('/:id', formController.getForm);
router.post('/', verifyToken, formController.createForm); // Protected
router.put('/:id', verifyToken, formController.updateForm); // Protected
router.delete('/:id', verifyToken, formController.deleteForm); // Protected

// Submission routes - anyone can submit, only authenticated can view
router.get('/:id/submissions', verifyToken, formController.getSubmissions); // Protected
router.post('/submissions', formController.createSubmission); // Public

export default router;