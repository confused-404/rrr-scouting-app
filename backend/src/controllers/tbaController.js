const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
const TBA_API_KEY = process.env.TBA_API_KEY;

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

export const tbaController = {
  /**
   * GET /api/tba/status
   * Returns API status and current season info
   */
  getStatus: async (req, res) => {
    try {
      const data = await fetchTBA('/status');
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

      const data = await fetchTBA(`/team/${team_key}`);
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

      const data = await fetchTBA(`/team/${team_key}/events/${year}`);
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

      const data = await fetchTBA(`/team/${team_key}/event/${event_key}/matches`);
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
      const data = await fetchTBA(`/teams/${year}/simple`);
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

      const data = await fetchTBA(`/events/${year}`);
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

      const data = await fetchTBA(`/event/${event_key}`);
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

      const data = await fetchTBA(`/event/${event_key}/teams`);
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

      const data = await fetchTBA(`/event/${event_key}/matches`);
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

      const data = await fetchTBA(`/event/${event_key}/rankings`);
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

      const data = await fetchTBA(`/event/${event_key}/oprs`);
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

      const data = await fetchTBA(`/match/${match_key}`);
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
