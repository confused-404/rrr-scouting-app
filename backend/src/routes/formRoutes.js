import express from 'express';
import { formController } from '../controllers/formController.js';
import { verifyToken } from '../middleware/userAuth.js';
import { isAdmin } from '../middleware/userAuth.js';

const router = express.Router();

// Form routes
router.get('/', formController.getForms);
router.get('/competition/:competitionId', formController.getFormsByCompetition);
router.get('/:id', formController.getForm);
router.post('/', verifyToken, formController.createForm);
router.post('/:id/copy', verifyToken, formController.copyForm);
router.put('/:id', verifyToken, formController.updateForm);
router.delete('/:id', verifyToken, formController.deleteForm);

// Submission routes
router.get('/:id/submissions', verifyToken, formController.getSubmissions);
router.get('/competition/:competitionId/submissions', verifyToken, formController.getSubmissionsByCompetition);
router.post('/submissions', formController.createSubmission);

// Admin-only: update an existing submission in-place (no new document created)
router.put('/submissions/:id', verifyToken, isAdmin, formController.updateSubmission);

export default router;
