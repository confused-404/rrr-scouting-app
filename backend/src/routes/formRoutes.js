import express from 'express';
import { formController } from '../controllers/formController.js';

const router = express.Router();

// Form routes
router.get('/', formController.getForms);
router.get('/:id', formController.getForm);
router.post('/', formController.createForm);
router.put('/:id', formController.updateForm);
router.delete('/:id', formController.deleteForm);

// Submission routes
router.get('/:id/submissions', formController.getSubmissions);
router.post('/submissions', formController.createSubmission);

export default router;