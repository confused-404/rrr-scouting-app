import express from 'express';
import { competitionController } from '../controllers/competitionController.js';
import { verifyToken, isAdmin, isAdminOrDriveTeam } from '../middleware/userAuth.js';

const router = express.Router();

// Competition routes - authenticated reads, admin writes
router.get('/', verifyToken, competitionController.getAllCompetitions);
router.get('/active', verifyToken, competitionController.getActiveCompetitions);
router.get('/:id', verifyToken, competitionController.getCompetition);
router.post('/', verifyToken, isAdmin, competitionController.createCompetition);
router.put('/:id', verifyToken, isAdmin, competitionController.updateCompetition);
router.delete('/:id', verifyToken, isAdmin, competitionController.deleteCompetition);

// Form management routes
router.post('/:id/forms/add', verifyToken, isAdmin, competitionController.addFormId);
router.post('/:id/forms/remove', verifyToken, isAdmin, competitionController.removeFormId);
router.post('/:id/forms/set-active', verifyToken, isAdmin, competitionController.setActiveFormId);
router.post('/:id/cache/warm', verifyToken, isAdmin, competitionController.warmActiveCompetitionCache);

// Superscouternotesroutes
router.post('/:id/superscouterNotes', verifyToken, isAdmin, competitionController.saveSuperscouterNotes);
router.get('/:id/superscouterNotes', verifyToken, isAdmin, competitionController.getSuperscouterNotes);
router.post('/:id/driveTeamStrategy', verifyToken, isAdminOrDriveTeam, competitionController.saveDriveTeamStrategy);
router.get('/:id/driveTeamStrategy', verifyToken, isAdminOrDriveTeam, competitionController.getDriveTeamStrategy);

export default router;
