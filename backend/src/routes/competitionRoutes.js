import express from 'express';
import { competitionController } from '../controllers/competitionController.js';
import { verifyToken } from '../middleware/userAuth.js';

const router = express.Router();

// Competition routes - all protected except reading
router.get('/', competitionController.getAllCompetitions);
router.get('/active', competitionController.getActiveCompetitions);
router.get('/:id', competitionController.getCompetition);
router.post('/', verifyToken, competitionController.createCompetition);
router.put('/:id', verifyToken, competitionController.updateCompetition);
router.delete('/:id', verifyToken, competitionController.deleteCompetition);

// Form management routes
router.post('/:id/forms/add', verifyToken, competitionController.addFormId);
router.post('/:id/forms/remove', verifyToken, competitionController.removeFormId);
router.post('/:id/forms/set-active', verifyToken, competitionController.setActiveFormId);

export default router;