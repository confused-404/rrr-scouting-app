import express from 'express';
import { formController } from '../controllers/formController.js';
import { verifyToken, isAdmin } from '../middleware/userAuth.js';

const router = express.Router();

// Form routes
router.get('/', formController.getForms);
router.get('/competition/:competitionId', formController.getFormsByCompetition);
router.get('/:id', formController.getForm);
router.post('/', verifyToken, isAdmin, formController.createForm);
router.post('/:id/copy', verifyToken, isAdmin, formController.copyForm);
router.put('/:id', verifyToken, isAdmin, formController.updateForm);
router.delete('/:id', verifyToken, isAdmin, formController.deleteForm);

// Submission routes
router.get('/:id/submissions', verifyToken, isAdmin, formController.getSubmissions);
router.get('/competition/:competitionId/submissions', verifyToken, isAdmin, formController.getSubmissionsByCompetition);
router.get('/competition/:competitionId/cross-form-values', verifyToken, formController.getCrossFormValuesByTeam);
router.post('/submissions', verifyToken, formController.createSubmission);

// Admin-only: update an existing submission in-place (no new document created)
router.put('/submissions/:id', verifyToken, isAdmin, formController.updateSubmission);

export default router;
