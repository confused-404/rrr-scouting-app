import express from 'express';
import { tbaController } from '../controllers/tbaController.js';

const router = express.Router();

// All TBA routes are public reads (no auth required),
// matching the pattern used for Statbotics and public competition/form routes.

// Status
// GET /api/tba/status
router.get('/status', tbaController.getStatus);

// Team endpoints
// GET /api/tba/team/frc254
router.get('/team/:team_key', tbaController.getTeam);

// GET /api/tba/team/frc254/events/2024
router.get('/team/:team_key/events/:year', tbaController.getTeamEvents);

// GET /api/tba/team/frc254/event/2024casj/matches
router.get('/team/:team_key/event/:event_key/matches', tbaController.getTeamEventMatches);

// Event endpoints
// GET /api/tba/events/2024
router.get('/events/:year', tbaController.getEvents);

// GET /api/tba/event/2024casj
router.get('/event/:event_key', tbaController.getEvent);

// GET /api/tba/event/2024casj/teams
router.get('/event/:event_key/teams', tbaController.getEventTeams);

// GET /api/tba/event/2024casj/matches
router.get('/event/:event_key/matches', tbaController.getEventMatches);

// GET /api/tba/event/2024casj/rankings
router.get('/event/:event_key/rankings', tbaController.getEventRankings);

// GET /api/tba/event/2024casj/oprs
router.get('/event/:event_key/oprs', tbaController.getEventOPRs);

// Match endpoint
// GET /api/tba/match/2024casj_qm1
router.get('/match/:match_key', tbaController.getMatch);

export default router;
