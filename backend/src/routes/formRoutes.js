import express from 'express';
import { formController } from '../controllers/formController.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Form routes
router.get('/', formController.getForms);
router.get('/competition/:competitionId', formController.getFormsByCompetition);
router.get('/:id', formController.getForm);
router.post('/', verifyToken, formController.createForm);
router.put('/:id', verifyToken, formController.updateForm);
router.delete('/:id', verifyToken, formController.deleteForm);

// Submission routes
router.get('/:id/submissions', verifyToken, formController.getSubmissions);
router.get('/competition/:competitionId/submissions', verifyToken, formController.getSubmissionsByCompetition);
router.post('/submissions', formController.createSubmission);

export default router;