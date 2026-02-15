import express from 'express';
import { statboticsController } from '../controllers/statboticsController.js';

const router = express.Router();

// All Statbotics routes are public reads (no auth required),
// matching the pattern used for competition and form GET routes.

// Single team at a single event — most commonly used
// GET /api/statbotics/team_event/254/2024casj
router.get('/team_event/:team/:event', statboticsController.getTeamEvent);

// List of team_events with optional filters
// GET /api/statbotics/team_events?team=254&year=2024
// GET /api/statbotics/team_events?event=2024casj
router.get('/team_events', statboticsController.getTeamEvents);

// Single team's overall info and EPA
// GET /api/statbotics/team/254
router.get('/team/:team', statboticsController.getTeam);

// Single event info and EPA summary
// GET /api/statbotics/event/2024casj
router.get('/event/:event', statboticsController.getEvent);

// Team's EPA stats for a full season
// GET /api/statbotics/team_year/254/2024
router.get('/team_year/:team/:year', statboticsController.getTeamYear);

export default router;