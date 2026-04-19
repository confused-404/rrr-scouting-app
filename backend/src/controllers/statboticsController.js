import { applyUpstreamCacheHeaders, getCachedUpstreamJson } from '../utils/upstreamCache.js';
import { fetchJsonWithTimeout } from '../utils/upstreamFetch.js';

const STATBOTICS_BASE_URL = 'https://api.statbotics.io/v3';
const STATBOTICS_TTLS = {
  teamEvent: 10 * 60_000,
  teamEventTeleopBalls: 10 * 60_000,
  teamEvents: 10 * 60_000,
  teamMatches: 5 * 60_000,
  team: 12 * 60 * 60_000,
  event: 12 * 60 * 60_000,
  eventMatches: 2 * 60_000,
  teamYear: 12 * 60 * 60_000,
};

/**
 * Generic fetch helper for the Statbotics API.
 * Throws a structured error if the upstream request fails.
 */
const fetchStatbotics = async (path, params = {}) => {
  const url = new URL(`${STATBOTICS_BASE_URL}${path}`);

  // Append any query params, filtering out undefined/null values
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
    }
  });

  return fetchJsonWithTimeout({
    url: url.toString(),
    headers: {
      Accept: 'application/json',
    },
  });
};

const shouldBypassUpstreamCache = (req) => String(req.get('X-Bypass-Upstream-Cache') || '').toLowerCase() === 'true';

/**
 * Extract teleop balls from a Statbotics team_event object.
 * Statbotics stores EPA breakdowns in unitless_epa / breakdown fields.
 * The exact field name varies by year; we try several known paths.
 */
const extractTeleopBalls = (data) => {
  if (!data) return null;

  // Statbotics v3 stores year-specific breakdowns under data.breakdown
  // or under data.epa.breakdown (varies by season).
  // Teleop ball-scoring fields across recent seasons:
  //   2024: teleopAmpNoteCount, teleopSpeakerNoteCount, teleopSpeakerNoteAmplifiedCount
  //   2023: teleopGamePieceCount / teleopChargeStationPoints (no "balls" — cones/cubes)
  //   2022: teleopCargoPoints (cargo = balls)
  //   2020: teleopCellsBottom, teleopCellsOuter, teleopCellsInner (power cells)
  //   2019: no balls — hatches/cargo (cargo counted separately)

  const breakdown =
    data?.breakdown ||
    data?.epa?.breakdown ||
    data?.norm_epa?.breakdown ||
    null;

  if (!breakdown) return null;

  // Try to build a year-agnostic "teleop balls" count from known fields
  const candidates = {
    // 2024 (Crescendo) — notes in amp + speaker
    teleopAmpNoteCount: breakdown.teleopAmpNoteCount,
    teleopSpeakerNoteCount: breakdown.teleopSpeakerNoteCount,
    teleopSpeakerNoteAmplifiedCount: breakdown.teleopSpeakerNoteAmplifiedCount,
    // 2022 (Rapid React) — cargo
    teleopCargoPoints: breakdown.teleopCargoPoints,
    teleopCargoLower: breakdown.teleopCargoLowerBlue != null
      ? (breakdown.teleopCargoLowerBlue ?? 0) + (breakdown.teleopCargoLowerRed ?? 0)
      : breakdown.teleopCargoLower,
    teleopCargoUpper: breakdown.teleopCargoUpperBlue != null
      ? (breakdown.teleopCargoUpperBlue ?? 0) + (breakdown.teleopCargoUpperRed ?? 0)
      : breakdown.teleopCargoUpper,
    // 2020/2021 (Infinite Recharge) — power cells
    teleopCellsBottom: breakdown.teleopCellsBottom,
    teleopCellsOuter: breakdown.teleopCellsOuter,
    teleopCellsInner: breakdown.teleopCellsInner,
    // Generic fallback field names
    teleopBallPoints: breakdown.teleopBallPoints,
    teleopGamePiecePoints: breakdown.teleopGamePiecePoints,
    teleopPoints: breakdown.teleopPoints,
  };

  // Filter to only non-null/undefined numeric values
  const found = Object.fromEntries(
    Object.entries(candidates).filter(([, v]) => v != null && typeof v === 'number')
  );

  return Object.keys(found).length > 0 ? found : null;
};

export const statboticsController = {
  /**
   * GET /api/statbotics/team_event/:team/:event
   * Returns EPA and performance data for a single team at a single event.
   * Example: /api/statbotics/team_event/254/2024casj
   */
  getTeamEvent: async (req, res) => {
    try {
      const { team, event } = req.params;

      if (!team || !event) {
        return res.status(400).json({ message: 'Team number and event key are required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: `/team_event/${team}/${event}`,
        params: {},
        ttlMs: STATBOTICS_TTLS.teamEvent,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics(`/team_event/${team}/${event}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamEvent:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Team event not found' });
      }
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * GET /api/statbotics/team_event/:team/:event/teleop_balls
   * Returns teleop ball-scoring breakdown for a single team at a single event.
   * Parses year-specific Statbotics breakdown fields to extract teleop ball counts.
   * Example: /api/statbotics/team_event/254/2024casj/teleop_balls
   */
  getTeamEventTeleopBalls: async (req, res) => {
    try {
      const { team, event } = req.params;

      if (!team || !event) {
        return res.status(400).json({ message: 'Team number and event key are required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: `/team_event/${team}/${event}`,
        params: {},
        ttlMs: STATBOTICS_TTLS.teamEventTeleopBalls,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics(`/team_event/${team}/${event}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      const teleopBalls = extractTeleopBalls(data);

      res.json({
        team,
        event,
        teleopBalls,
        // Also expose the raw EPA for context
        epa: data?.epa ?? data?.epa_end ?? null,
        year: data?.year ?? null,
      });
    } catch (error) {
      console.error('Error in getTeamEventTeleopBalls:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Team event not found' });
      }
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * GET /api/statbotics/team_events
   * Returns a list of team_event objects. All params are optional.
   * Query params: team, year, event, week, country, state, district, type, limit, offset
   * Example: /api/statbotics/team_events?team=254&year=2024
   * Example: /api/statbotics/team_events?event=2024casj
   */
  getTeamEvents: async (req, res) => {
    try {
      const {
        team,
        year,
        event,
        week,
        country,
        state,
        district,
        type,
        limit = 100,
        offset = 0,
      } = req.query;

      const params = {
        team,
        year,
        event,
        week,
        country,
        state,
        district,
        type,
        limit,
        offset,
      };
      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: '/team_events',
        params,
        ttlMs: STATBOTICS_TTLS.teamEvents,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics('/team_events', params),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });

      res.json(data);
    } catch (error) {
      console.error('Error in getTeamEvents:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'No team events found' });
      }
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * GET /api/statbotics/team_matches
   * Returns per-team per-match EPA data for an event or team.
   * Query params: team, year, event, limit, offset
   * Example: /api/statbotics/team_matches?event=2026idbo&limit=999
   */
  getTeamMatches: async (req, res) => {
    try {
      const { team, year, event, limit = 500, offset = 0 } = req.query;
      const params = { team, year, event, limit, offset };
      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: '/team_matches',
        params,
        ttlMs: STATBOTICS_TTLS.teamMatches,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics('/team_matches', params),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamMatches:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'No team matches found' });
      }
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * GET /api/statbotics/team/:team
   * Returns overall info and EPA ratings for a single team.
   * Example: /api/statbotics/team/254
   */
  getTeam: async (req, res) => {
    try {
      const { team } = req.params;

      if (!team) {
        return res.status(400).json({ message: 'Team number is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: `/team/${team}`,
        params: {},
        ttlMs: STATBOTICS_TTLS.team,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics(`/team/${team}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeam:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Team not found' });
      }
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * GET /api/statbotics/event/:event
   * Returns info and EPA summary for a single event.
   * Example: /api/statbotics/event/2024casj
   */
  getEvent: async (req, res) => {
    try {
      const { event } = req.params;

      if (!event) {
        return res.status(400).json({ message: 'Event key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: `/event/${event}`,
        params: {},
        ttlMs: STATBOTICS_TTLS.event,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics(`/event/${event}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getEvent:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Event not found' });
      }
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * GET /api/statbotics/event/:event/matches
   * Returns match schedule for a single event.
   * Example: /api/statbotics/event/2024casj/matches
   */
  getEventMatches: async (req, res) => {
    try {
      const { event } = req.params;

      if (!event) {
        return res.status(400).json({ message: 'Event key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: '/matches',
        params: { event },
        ttlMs: STATBOTICS_TTLS.eventMatches,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics('/matches', { event }),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getEventMatches:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'No matches found' });
      }
      res.status(error.status || 500).json({
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { upstream: error.body }),
      });
    }
  },

  /**
   * GET /api/statbotics/team_year/:team/:year
   * Returns a team's EPA stats aggregated for a full season year.
   * Example: /api/statbotics/team_year/254/2024
   */
  getTeamYear: async (req, res) => {
    try {
      const { team, year } = req.params;

      if (!team || !year) {
        return res.status(400).json({ message: 'Team number and year are required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'statbotics',
        path: `/team_year/${team}/${year}`,
        params: {},
        ttlMs: STATBOTICS_TTLS.teamYear,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchStatbotics(`/team_year/${team}/${year}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamYear:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Team year not found' });
      }
      res.status(error.status || 500).json({ message: error.message });
    }
  },
};
