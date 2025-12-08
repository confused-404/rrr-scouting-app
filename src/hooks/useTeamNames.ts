import { useState, useEffect } from 'react';
import { getTeamNameWithCustom, fetchTeamNameFromTBA, fetchMultipleTeamNames, getCustomTeamNames } from '@/lib/teamNames';

export const useTeamName = (teamNumber: string) => {
  const [teamName, setTeamName] = useState(() => getTeamNameWithCustom(teamNumber));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTeamName = async () => {
      if (!teamNumber) return;
      
      setLoading(true);
      try {
        const name = await fetchTeamNameFromTBA(teamNumber);
        setTeamName(name);
      } catch (error) {
        console.warn(`Failed to load team name for ${teamNumber}:`, error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamName();
  }, [teamNumber]);

  return { teamName, loading };
};

export const useTeamNames = (teamNumbers: string[]) => {
  const [teamNames, setTeamNames] = useState<Map<string, string>>(() => {
    const initial = new Map();
    teamNumbers.forEach(num => {
      initial.set(num, getTeamNameWithCustom(num));
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTeamNames = async () => {
      if (teamNumbers.length === 0) return;
      
      setLoading(true);
      try {
        const names = await fetchMultipleTeamNames(teamNumbers);
        // Merge any custom team names from Firestore
        try {
          const customs = await getCustomTeamNames();
          customs && Object.keys(customs).forEach(k => {
            if (!names.has(k)) names.set(k, customs[k]);
            else names.set(k, customs[k]);
          })
        } catch (err) {
          // ignore
        }
        setTeamNames(names);
      } catch (error) {
        console.warn('Failed to load team names:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamNames();
  }, [teamNumbers.join(',')]);

  return { teamNames, loading };
};

// Helper hook for getting a single team name with automatic TBA fetching
export const useTeamNameLive = (teamNumber: string) => {
  const { teamName, loading } = useTeamName(teamNumber);
  return teamName;
};