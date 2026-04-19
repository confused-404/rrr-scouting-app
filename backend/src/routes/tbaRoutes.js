import express from 'express';
import { tbaController } from '../controllers/tbaController.js';
import { verifyToken } from '../middleware/userAuth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const upstreamProxyLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyResolver: (req) => `tba:${req.user?.uid || req.ip}`,
});

// TBA proxy routes require an authenticated app user.

// Status
// GET /api/tba/status
router.get('/status', verifyToken, upstreamProxyLimiter, tbaController.getStatus);

// Team endpoints
// GET /api/tba/team/frc254
router.get('/team/:team_key', verifyToken, upstreamProxyLimiter, tbaController.getTeam);

// GET /api/tba/team/frc254/events/2024
router.get('/team/:team_key/events/:year', verifyToken, upstreamProxyLimiter, tbaController.getTeamEvents);

// GET /api/tba/team/frc254/event/2024casj/matches
router.get('/team/:team_key/event/:event_key/matches', verifyToken, upstreamProxyLimiter, tbaController.getTeamEventMatches);

// Event endpoints
// GET /api/tba/events/2024
router.get('/events/:year', verifyToken, upstreamProxyLimiter, tbaController.getEvents);

// Supplemental team routes
// GET /api/tba/teams/2024/simple
router.get('/teams/:year/simple', verifyToken, upstreamProxyLimiter, tbaController.getTeamsSimple);


// GET /api/tba/event/2024casj
router.get('/event/:event_key', verifyToken, upstreamProxyLimiter, tbaController.getEvent);

// GET /api/tba/event/2024casj/teams
router.get('/event/:event_key/teams', verifyToken, upstreamProxyLimiter, tbaController.getEventTeams);

// GET /api/tba/event/2024casj/matches
router.get('/event/:event_key/matches', verifyToken, upstreamProxyLimiter, tbaController.getEventMatches);

// GET /api/tba/event/2024casj/rankings
router.get('/event/:event_key/rankings', verifyToken, upstreamProxyLimiter, tbaController.getEventRankings);

// GET /api/tba/event/2024casj/oprs
router.get('/event/:event_key/oprs', verifyToken, upstreamProxyLimiter, tbaController.getEventOPRs);

// Match endpoint
// GET /api/tba/match/2024casj_qm1
router.get('/match/:match_key', verifyToken, upstreamProxyLimiter, tbaController.getMatch);

export default router;
