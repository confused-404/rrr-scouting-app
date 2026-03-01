const STATBOTICS_BASE_URL = 'https://api.statbotics.io/v3';

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

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`Statbotics API error: ${response.status}`);
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  return response.json();
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

      const data = await fetchStatbotics(`/team_event/${team}/${event}`);
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamEvent:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Team event not found' });
      }
      res.status(500).json({ message: error.message });
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

      const data = await fetchStatbotics('/team_events', {
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
      });

      res.json(data);
    } catch (error) {
      console.error('Error in getTeamEvents:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'No team events found' });
      }
      res.status(500).json({ message: error.message });
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

      const data = await fetchStatbotics(`/team/${team}`);
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

      const data = await fetchStatbotics(`/event/${event}`);
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

      const data = await fetchStatbotics(`/team_year/${team}/${year}`);
      res.json(data);
    } catch (error) {
      console.error('Error in getTeamYear:', error);
      if (error.status === 404) {
        return res.status(404).json({ message: 'Team year not found' });
      }
      res.status(500).json({ message: error.message });
    }
  },
};