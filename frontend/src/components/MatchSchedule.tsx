import React, { useEffect, useState } from 'react';
import type { Competition } from '../types/competition.types';
import { tbaApi, statboticsApi } from '../services/api';

export const MatchSchedule: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'tba' | 'statbotics'>('tba');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [fetchError, setFetchError] = useState<string>('');

  useEffect(() => {
    if (!selectedCompetition?.eventKey) {
      setMatches([]);
      return;
    }
    fetchMatches();
  }, [selectedCompetition, dataSource]);

  const fetchMatches = async () => {
    if (!selectedCompetition?.eventKey) return;

    setLoading(true);
    setFetchError('');
    try {
      let data: any[] = [];
      if (dataSource === 'tba') {
        data = await tbaApi.getEventMatches(selectedCompetition.eventKey);
      } else {
        data = await statboticsApi.getEventMatches(selectedCompetition.eventKey);
      }
      setMatches(data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
      try {
        const fallbackSource = dataSource === 'tba' ? 'statbotics' : 'tba';
        const fallbackData = fallbackSource === 'tba'
          ? await tbaApi.getEventMatches(selectedCompetition.eventKey)
          : await statboticsApi.getEventMatches(selectedCompetition.eventKey);

        setMatches(fallbackData || []);
        setFetchError(`Primary source (${dataSource.toUpperCase()}) failed. Showing ${fallbackSource.toUpperCase()} data instead.`);
      } catch (fallbackError) {
        console.error('Fallback match fetch also failed:', fallbackError);
        setMatches([]);
        setFetchError('Could not fetch match schedule right now. Please try again in a moment.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter(match => {
    if (!teamFilter) return true;

    const teamKey = teamFilter.startsWith('frc') ? teamFilter : `frc${teamFilter}`;
    const redTeams = match.alliances?.red?.team_keys || [];
    const blueTeams = match.alliances?.blue?.team_keys || [];

    return redTeams.includes(teamKey) || blueTeams.includes(teamKey) ||
           redTeams.includes(parseInt(teamFilter)) || blueTeams.includes(parseInt(teamFilter));
  });

  const getMatchTime = (match: any) => {
    if (dataSource === 'statbotics') {
      return match.time ? new Date(match.time * 1000).toLocaleString() : 'TBD';
    } else {
      return match.time ? new Date(match.time * 1000).toLocaleString() : 'TBD';
    }
  };

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <p>No active competition selected</p>
      </div>
    );
  }

  if (!selectedCompetition.eventKey) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <p>No event key configured for this competition</p>
        <p className="text-sm text-gray-400">Admins can set the event key in the Competitions tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Header and Controls */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">{selectedCompetition.name} - Match Schedule</h3>

        {/* Data Source Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Data Source:</label>
            <select
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value as 'tba' | 'statbotics')}
              className="w-full sm:w-auto px-3 py-2 sm:py-1 border border-gray-300 rounded text-sm"
            >
              <option value="tba">The Blue Alliance</option>
              <option value="statbotics">Statbotics</option>
            </select>
          </div>

          {/* Team Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter Team:</label>
            <input
              type="text"
              placeholder="Team number (e.g. 254)"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 sm:py-1 border border-gray-300 rounded text-sm w-full sm:w-32"
            />
          </div>
        </div>

        {teamFilter && (
          <p className="text-sm text-blue-600">
            Showing matches for team {teamFilter} ({filteredMatches.length} matches)
          </p>
        )}

        {fetchError && (
          <p className="text-sm text-amber-700 mt-3">{fetchError}</p>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center font-black text-gray-300 animate-pulse tracking-widest uppercase">Loading schedule...</div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredMatches.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed font-bold italic">
              {teamFilter ? `No matches found for team ${teamFilter}` : 'No matches available.'}
            </div>
          ) : (
            filteredMatches
              .sort((a, b) => {
                // Sort by match number, handling different data structures
                const aNum = a.match_number || (a.key ? parseInt(a.key.split('m')[1]) : 0);
                const bNum = b.match_number || (b.key ? parseInt(b.key.split('m')[1]) : 0);
                return aNum - bNum;
              })
              .map((m: any) => (
                <div key={m.key} className="bg-white p-3 sm:p-4 rounded-lg shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1">
                    <div className="font-black uppercase text-sm">
                      {m.comp_level}{m.match_number || (m.key ? m.key.split('m')[1] : '')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getMatchTime(m)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="font-bold text-red-600">Red Alliance</div>
                      <ul className="list-disc list-inside text-sm break-words">
                        {(m.alliances?.red?.team_keys || []).map((tk: string | number) => (
                          <li key={tk} className={teamFilter && (tk.toString().includes(teamFilter) || tk.toString() === `frc${teamFilter}`) ? 'font-bold text-red-700' : ''}>
                            {tk}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">Blue Alliance</div>
                      <ul className="list-disc list-inside text-sm break-words">
                        {(m.alliances?.blue?.team_keys || []).map((tk: string | number) => (
                          <li key={tk} className={teamFilter && (tk.toString().includes(teamFilter) || tk.toString() === `frc${teamFilter}`) ? 'font-bold text-blue-700' : ''}>
                            {tk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};