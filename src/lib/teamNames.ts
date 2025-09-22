import { tbaApi, type TBATeam } from './tbaApi';

// Fallback team names for when API is unavailable
const fallbackTeamNames: { [key: string]: string } = {
  "1": "The Juggernauts",
  "27": "Team RUSH",
  "33": "Killer Bees",
  "67": "The HOT Team",
  "118": "The Robonauts",
  "148": "The Robowranglers",
  "254": "The Cheesy Poofs",
  "330": "The Beach Bots",
  "469": "Las Guerrillas",
  "973": "Greybots",
  "1114": "Simbotics",
  "1323": "MadTown Robotics",
  "1678": "Citrus Circuits",
  "2056": "OP Robotics",
  "2471": "Team Mean Machine",
  "3476": "Code Orange",
  "4414": "HighTide",
  "5940": "BREAD",
  "6328": "Mechanical Advantage",
  "7492": "Jaguar Robotics",
  "8033": "HighlanderBots"
};

// Cache for TBA team data
const teamCache = new Map<string, { name: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const getTeamName = (teamNumber: string): string => {
  return fallbackTeamNames[teamNumber] || "Unknown Team";
};

export const addTeamName = (teamNumber: string, teamName: string): void => {
  const customNames = JSON.parse(localStorage.getItem("customTeamNames") || "{}");
  customNames[teamNumber] = teamName;
  localStorage.setItem("customTeamNames", JSON.stringify(customNames));
};

export const getTeamNameWithCustom = (teamNumber: string): string => {
  // Check custom names first
  const customNames = JSON.parse(localStorage.getItem("customTeamNames") || "{}");
  if (customNames[teamNumber]) {
    return customNames[teamNumber];
  }

  // Check TBA cache
  const cached = teamCache.get(teamNumber);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.name;
  }

  // Return fallback while we fetch from TBA
  return fallbackTeamNames[teamNumber] || `Team ${teamNumber}`;
};

export const fetchTeamNameFromTBA = async (teamNumber: string): Promise<string> => {
  try {
    const team = await tbaApi.getTeam(teamNumber);
    if (team && team.nickname) {
      const name = team.nickname;
      // Cache the result
      teamCache.set(teamNumber, { name, timestamp: Date.now() });
      return name;
    }
  } catch (error) {
    console.warn(`Failed to fetch team ${teamNumber} from TBA:`, error);
  }
  
  return fallbackTeamNames[teamNumber] || `Team ${teamNumber}`;
};

export const fetchMultipleTeamNames = async (teamNumbers: string[]): Promise<Map<string, string>> => {
  const results = new Map<string, string>();
  
  try {
    const teams = await tbaApi.getTeams(teamNumbers);
    
    for (const [teamNumber, team] of teams) {
      if (team && team.nickname) {
        results.set(teamNumber, team.nickname);
        // Cache the result
        teamCache.set(teamNumber, { name: team.nickname, timestamp: Date.now() });
      } else {
        results.set(teamNumber, fallbackTeamNames[teamNumber] || `Team ${teamNumber}`);
      }
    }
    
    // Fill in any missing teams with fallbacks
    for (const teamNumber of teamNumbers) {
      if (!results.has(teamNumber)) {
        results.set(teamNumber, fallbackTeamNames[teamNumber] || `Team ${teamNumber}`);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch team names from TBA:', error);
    // Use fallbacks for all teams
    for (const teamNumber of teamNumbers) {
      results.set(teamNumber, fallbackTeamNames[teamNumber] || `Team ${teamNumber}`);
    }
  }
  
  return results;
};

export const preloadTeamNames = async (teamNumbers: string[]): Promise<void> => {
  const uncachedTeams = teamNumbers.filter(teamNumber => {
    const cached = teamCache.get(teamNumber);
    return !cached || Date.now() - cached.timestamp >= CACHE_DURATION;
  });
  
  if (uncachedTeams.length > 0) {
    await fetchMultipleTeamNames(uncachedTeams);
  }
};