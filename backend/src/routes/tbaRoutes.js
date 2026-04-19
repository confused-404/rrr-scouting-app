import express from 'express';
import { tbaController } from '../controllers/tbaController.js';
import { verifyToken } from '../middleware/userAuth.js';

const router = express.Router();

// TBA proxy routes require an authenticated app user.

// Status
// GET /api/tba/status
router.get('/status', verifyToken, tbaController.getStatus);

// Team endpoints
// GET /api/tba/team/frc254
router.get('/team/:team_key', verifyToken, tbaController.getTeam);

// GET /api/tba/team/frc254/events/2024
router.get('/team/:team_key/events/:year', verifyToken, tbaController.getTeamEvents);

// GET /api/tba/team/frc254/event/2024casj/matches
router.get('/team/:team_key/event/:event_key/matches', verifyToken, tbaController.getTeamEventMatches);

// Event endpoints
// GET /api/tba/events/2024
router.get('/events/:year', verifyToken, tbaController.getEvents);

// Supplemental team routes
// GET /api/tba/teams/2024/simple
router.get('/teams/:year/simple', verifyToken, tbaController.getTeamsSimple);


// GET /api/tba/event/2024casj
router.get('/event/:event_key', verifyToken, tbaController.getEvent);

// GET /api/tba/event/2024casj/teams
router.get('/event/:event_key/teams', verifyToken, tbaController.getEventTeams);

// GET /api/tba/event/2024casj/matches
router.get('/event/:event_key/matches', verifyToken, tbaController.getEventMatches);

// GET /api/tba/event/2024casj/rankings
router.get('/event/:event_key/rankings', verifyToken, tbaController.getEventRankings);

// GET /api/tba/event/2024casj/oprs
router.get('/event/:event_key/oprs', verifyToken, tbaController.getEventOPRs);

// Match endpoint
// GET /api/tba/match/2024casj_qm1
router.get('/match/:match_key', verifyToken, tbaController.getMatch);

export default router;
