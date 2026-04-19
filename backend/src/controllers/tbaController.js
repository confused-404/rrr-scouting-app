import { applyUpstreamCacheHeaders, getCachedUpstreamJson } from '../utils/upstreamCache.js';

const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
const TBA_API_KEY = process.env.TBA_API_KEY;
const TBA_TTLS = {
  status: 5 * 60_000,
  team: 12 * 60 * 60_000,
  teamEvents: 12 * 60 * 60_000,
  teamEventMatches: 2 * 60_000,
  teamsSimple: 12 * 60 * 60_000,
  events: 12 * 60 * 60_000,
  event: 12 * 60 * 60_000,
  eventTeams: 30 * 60_000,
  eventMatches: 2 * 60_000,
  eventRankings: 2 * 60_000,
  eventOPRs: 5 * 60_000,
  match: 2 * 60_000,
};

if (!TBA_API_KEY) {
  console.warn('WARNING: TBA_API_KEY environment variable is not set');
}

/**
 * Generic fetch helper for The Blue Alliance API v3.
 * Automatically adds the required X-TBA-Auth-Key header.
 */
const fetchTBA = async (path, params = {}) => {
  const url = new URL(`${TBA_BASE_URL}${path}`);

  // Append query params, filtering out undefined/null
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-TBA-Auth-Key': TBA_API_KEY || '',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`TBA API error: ${response.status}`);
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  return response.json();
};

const shouldBypassUpstreamCache = (req) => String(req.get('X-Bypass-Upstream-Cache') || '').toLowerCase() === 'true';

export const tbaController = {
  /**
   * GET /api/tba/status
   * Returns API status and current season info
   */
  getStatus: async (req, res) => {
    try {
      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: '/status',
        params: {},
        ttlMs: TBA_TTLS.status,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA('/status'),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getStatus:', error);
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/team/:team_key
   * Get a single team by key (e.g., 'frc254')
   * Example: /api/tba/team/frc254
   */
  getTeam: async (req, res) => {
    try {
      const { team_key } = req.params;

      if (!team_key) {
        return res.status(400).json({ message: 'Team key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/team/${team_key}`,
        params: {},
        ttlMs: TBA_TTLS.team,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/team/${team_key}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeam:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Team not found' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/team/:team_key/events/:year
   * Get all events a team participated in for a given year
   * Example: /api/tba/team/frc254/events/2024
   */
  getTeamEvents: async (req, res) => {
    try {
      const { team_key, year } = req.params;

      if (!team_key || !year) {
        return res.status(400).json({ message: 'Team key and year are required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/team/${team_key}/events/${year}`,
        params: {},
        ttlMs: TBA_TTLS.teamEvents,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/team/${team_key}/events/${year}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamEvents:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'No events found' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/team/:team_key/event/:event_key/matches
   * Get all matches for a team at a specific event
   * Example: /api/tba/team/frc254/event/2024casj/matches
   */
  getTeamEventMatches: async (req, res) => {
    try {
      const { team_key, event_key } = req.params;

      if (!team_key || !event_key) {
        return res.status(400).json({ message: 'Team key and event key are required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/team/${team_key}/event/${event_key}/matches`,
        params: {},
        ttlMs: TBA_TTLS.teamEventMatches,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/team/${team_key}/event/${event_key}/matches`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamEventMatches:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'No matches found' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/teams/:year/simple
   * Proxy TBA endpoint that returns simple team objects for the given year
   * Example: /api/tba/teams/2024/simple
   */
  getTeamsSimple: async (req, res) => {
    try {
      const { year } = req.params;
      if (!year) {
        return res.status(400).json({ message: 'Year is required' });
      }
      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/teams/${year}/simple`,
        params: {},
        ttlMs: TBA_TTLS.teamsSimple,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/teams/${year}/simple`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamsSimple:', error);
      res.status(error.status || 500).json({ message: error.message });
    }
  },


  /**
   * GET /api/tba/events/:year
   * Get all events in a given year
   * Example: /api/tba/events/2024
   */
  getEvents: async (req, res) => {
    try {
      const { year } = req.params;

      if (!year) {
        return res.status(400).json({ message: 'Year is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/events/${year}`,
        params: {},
        ttlMs: TBA_TTLS.events,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/events/${year}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getEvents:', error);
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/event/:event_key
   * Get a single event by key (e.g., '2024casj')
   * Example: /api/tba/event/2024casj
   */
  getEvent: async (req, res) => {
    try {
      const { event_key } = req.params;

      if (!event_key) {
        return res.status(400).json({ message: 'Event key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/event/${event_key}`,
        params: {},
        ttlMs: TBA_TTLS.event,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/event/${event_key}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getEvent:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Event not found' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/event/:event_key/teams
   * Get all teams at a specific event
   * Example: /api/tba/event/2024casj/teams
   */
  getEventTeams: async (req, res) => {
    try {
      const { event_key } = req.params;

      if (!event_key) {
        return res.status(400).json({ message: 'Event key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/event/${event_key}/teams`,
        params: {},
        ttlMs: TBA_TTLS.eventTeams,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/event/${event_key}/teams`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getEventTeams:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'No teams found' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/event/:event_key/matches
   * Get all matches at a specific event
   * Example: /api/tba/event/2024casj/matches
   */
  getEventMatches: async (req, res) => {
    try {
      const { event_key } = req.params;

      if (!event_key) {
        return res.status(400).json({ message: 'Event key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/event/${event_key}/matches`,
        params: {},
        ttlMs: TBA_TTLS.eventMatches,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/event/${event_key}/matches`),
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
   * GET /api/tba/event/:event_key/rankings
   * Get rankings at a specific event
   * Example: /api/tba/event/2024casj/rankings
   */
  getEventRankings: async (req, res) => {
    try {
      const { event_key } = req.params;

      if (!event_key) {
        return res.status(400).json({ message: 'Event key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/event/${event_key}/rankings`,
        params: {},
        ttlMs: TBA_TTLS.eventRankings,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/event/${event_key}/rankings`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getEventRankings:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Rankings not found' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/event/:event_key/oprs
   * Get OPR, DPR, and CCWM stats for an event
   * Example: /api/tba/event/2024casj/oprs
   */
  getEventOPRs: async (req, res) => {
    try {
      const { event_key } = req.params;

      if (!event_key) {
        return res.status(400).json({ message: 'Event key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/event/${event_key}/oprs`,
        params: {},
        ttlMs: TBA_TTLS.eventOPRs,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/event/${event_key}/oprs`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getEventOPRs:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'OPR data not found' });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * GET /api/tba/match/:match_key
   * Get a single match by key (e.g., '2024casj_qm1')
   * Example: /api/tba/match/2024casj_qm1
   */
  getMatch: async (req, res) => {
    try {
      const { match_key } = req.params;

      if (!match_key) {
        return res.status(400).json({ message: 'Match key is required' });
      }

      const { data, cacheStatus, ttlMs } = await getCachedUpstreamJson({
        namespace: 'tba',
        path: `/match/${match_key}`,
        params: {},
        ttlMs: TBA_TTLS.match,
        bypassCache: shouldBypassUpstreamCache(req),
        loader: () => fetchTBA(`/match/${match_key}`),
      });
      applyUpstreamCacheHeaders(res, { cacheStatus, ttlMs });
      res.json(data);
    } catch (error) {
      console.error('Error in getMatch:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Match not found' });
      }
      res.status(500).json({ message: error.message });
    }
  },
};
