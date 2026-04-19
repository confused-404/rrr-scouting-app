import express from 'express';
import { statboticsController } from '../controllers/statboticsController.js';
import { verifyToken } from '../middleware/userAuth.js';

const router = express.Router();

// Statbotics proxy routes require an authenticated app user.

// Single team at a single event — most commonly used
// GET /api/statbotics/team_event/254/2024casj
router.get('/team_event/:team/:event', verifyToken, statboticsController.getTeamEvent);

// Teleop balls breakdown for a team at a single event
// GET /api/statbotics/team_event/254/2024casj/teleop_balls
router.get('/team_event/:team/:event/teleop_balls', verifyToken, statboticsController.getTeamEventTeleopBalls);

// List of team_events with optional filters
// GET /api/statbotics/team_events?team=254&year=2024
// GET /api/statbotics/team_events?event=2024casj
router.get('/team_events', verifyToken, statboticsController.getTeamEvents);

// Per-team per-match EPA data for an event or team
// GET /api/statbotics/team_matches?event=2026idbo&limit=999
router.get('/team_matches', verifyToken, statboticsController.getTeamMatches);

// Single team's overall info and EPA
// GET /api/statbotics/team/254
router.get('/team/:team', verifyToken, statboticsController.getTeam);

// Single event info and EPA summary
// GET /api/statbotics/event/2024casj
router.get('/event/:event', verifyToken, statboticsController.getEvent);

// Single event match schedule
// GET /api/statbotics/event/2024casj/matches
router.get('/event/:event/matches', verifyToken, statboticsController.getEventMatches);

// Team's EPA stats for a full season
// GET /api/statbotics/team_year/254/2024
router.get('/team_year/:team/:year', verifyToken, statboticsController.getTeamYear);

export default router;
