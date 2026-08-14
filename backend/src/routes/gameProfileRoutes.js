import express from 'express';
import { gameProfileController } from '../controllers/gameProfileController.js';
import { isAdmin, verifyToken } from '../middleware/userAuth.js';

const router = express.Router();

router.get('/', verifyToken, isAdmin, gameProfileController.getAll);
router.get('/:id', verifyToken, isAdmin, gameProfileController.getById);
router.get('/:id/test-data', verifyToken, isAdmin, gameProfileController.getTestData);
router.put('/:id/test-data', verifyToken, isAdmin, gameProfileController.setTestData);
router.post('/', verifyToken, isAdmin, gameProfileController.create);
router.put('/:id', verifyToken, isAdmin, gameProfileController.update);
router.delete('/:id', verifyToken, isAdmin, gameProfileController.delete);
router.post('/:id/publish', verifyToken, isAdmin, gameProfileController.publish);
router.post('/:id/lock', verifyToken, isAdmin, gameProfileController.lock);

export default router;
