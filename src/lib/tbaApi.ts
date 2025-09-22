// The Blue Alliance API integration
const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
const API_KEY = import.meta.env.VITE_TBA_API_KEY;

interface TBATeam {
  key: string;
  team_number: number;
  nickname: string;
  name: string;
  city: string;
  state_prov: string;
  country: string;
}

interface TBAEvent {
  key: string;
  name: string;
  event_code: string;
  event_type: number;
  district?: {
    abbreviation: string;
    display_name: string;
    key: string;
  };
  city: string;
  state_prov: string;
  country: string;
  start_date: string;
  end_date: string;
  year: number;
}

interface TBAMatch {
  key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: {
    red: {
      team_keys: string[];
      score: number;
    };
    blue: {
      team_keys: string[];
      score: number;
    };
  };
  time: number;
  predicted_time: number;
  actual_time?: number;
}

interface ProcessedMatch {
  matchNumber: string;
  time: string;
  redAlliance: [string, string, string];
  blueAlliance: [string, string, string];
  compLevel: string;
}

class TBAApiService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private async makeRequest(endpoint: string): Promise<any> {
    if (!API_KEY || API_KEY === 'your_api_key_here') {
      throw new Error('TBA API key not configured. Please set VITE_TBA_API_KEY in your .env file.');
    }

    // Check cache first
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    const response = await fetch(`${TBA_BASE_URL}${endpoint}`, {
      headers: {
        'X-TBA-Auth-Key': API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TBA API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache the result
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  }

  async getTeam(teamNumber: string): Promise<TBATeam | null> {
    try {
      const team = await this.makeRequest(`/team/frc${teamNumber}`);
      return team;
    } catch (error) {
      console.warn(`Failed to fetch team ${teamNumber}:`, error);
      return null;
    }
  }

  async getTeams(teamNumbers: string[]): Promise<Map<string, TBATeam>> {
    const teams = new Map<string, TBATeam>();
    
    // Batch requests to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < teamNumbers.length; i += batchSize) {
      const batch = teamNumbers.slice(i, i + batchSize);
      const promises = batch.map(async (teamNumber) => {
        const team = await this.getTeam(teamNumber);
        if (team) {
          teams.set(teamNumber, team);
        }
      });
      
      await Promise.all(promises);
      
      // Small delay to respect rate limits
      if (i + batchSize < teamNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return teams;
  }

  async getEvent(eventKey: string): Promise<TBAEvent | null> {
    try {
      const event = await this.makeRequest(`/event/${eventKey}`);
      return event;
    } catch (error) {
      console.warn(`Failed to fetch event ${eventKey}:`, error);
      return null;
    }
  }

  async getEventMatches(eventKey: string): Promise<TBAMatch[]> {
    try {
      const matches = await this.makeRequest(`/event/${eventKey}/matches`);
      return matches || [];
    } catch (error) {
      console.warn(`Failed to fetch matches for event ${eventKey}:`, error);
      return [];
    }
  }

  async getCurrentEvents(): Promise<TBAEvent[]> {
    try {
      const currentYear = new Date().getFullYear();
      const events = await this.makeRequest(`/events/${currentYear}`);
      
      // Filter to current/upcoming events
      const now = new Date();
      return events.filter((event: TBAEvent) => {
        const endDate = new Date(event.end_date);
        return endDate >= now;
      });
    } catch (error) {
      console.warn('Failed to fetch current events:', error);
      return [];
    }
  }

  async searchEvents(query: string, year?: number): Promise<TBAEvent[]> {
    try {
      const searchYear = year || new Date().getFullYear();
      const events = await this.makeRequest(`/events/${searchYear}`);
      
      if (!query.trim()) return events;
      
      const lowerQuery = query.toLowerCase();
      return events.filter((event: TBAEvent) => 
        event.name.toLowerCase().includes(lowerQuery) ||
        event.event_code.toLowerCase().includes(lowerQuery) ||
        event.city.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.warn('Failed to search events:', error);
      return [];
    }
  }

  async getEventTeams(eventKey: string): Promise<TBATeam[]> {
    try {
      const teams = await this.makeRequest(`/event/${eventKey}/teams`);
      return teams || [];
    } catch (error) {
      console.warn(`Failed to fetch teams for event ${eventKey}:`, error);
      return [];
    }
  }

  async processEventMatches(eventKey: string): Promise<ProcessedMatch[]> {
    try {
      const matches = await this.getEventMatches(eventKey);
      
      return matches
        .filter(match => match.comp_level === 'qm') // Only qualification matches
        .sort((a, b) => a.match_number - b.match_number)
        .map(match => {
          // Extract team numbers from keys (remove 'frc' prefix)
          const redTeams = match.alliances.red.team_keys.map(key => key.replace('frc', ''));
          const blueTeams = match.alliances.blue.team_keys.map(key => key.replace('frc', ''));
          
          // Format time
          let timeStr = 'TBD';
          if (match.time && match.time > 0) {
            const date = new Date(match.time * 1000);
            timeStr = date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
          } else if (match.predicted_time && match.predicted_time > 0) {
            const date = new Date(match.predicted_time * 1000);
            timeStr = date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
          }

          return {
            matchNumber: match.match_number.toString(),
            time: timeStr,
            redAlliance: [redTeams[0] || '', redTeams[1] || '', redTeams[2] || ''] as [string, string, string],
            blueAlliance: [blueTeams[0] || '', blueTeams[1] || '', blueTeams[2] || ''] as [string, string, string],
            compLevel: match.comp_level
          };
        });
    } catch (error) {
      console.warn(`Failed to process matches for event ${eventKey}:`, error);
      return [];
    }
  }

  async getAllEventTeamNumbers(eventKey: string): Promise<string[]> {
    try {
      const teams = await this.getEventTeams(eventKey);
      return teams.map(team => team.team_number.toString());
    } catch (error) {
      console.warn(`Failed to fetch team numbers for event ${eventKey}:`, error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const tbaApi = new TBAApiService();
export type { TBATeam, TBAEvent, TBAMatch, ProcessedMatch };