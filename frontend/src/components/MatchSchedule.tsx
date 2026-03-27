import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Competition } from '../types/competition.types';
import { tbaApi, statboticsApi } from '../services/api';

const normalizeTeamKey = (teamValue: string | number) => {
  const trimmedValue = teamValue.toString().trim().toLowerCase();
  if (!trimmedValue) return '';
  return trimmedValue.startsWith('frc') ? trimmedValue : `frc${trimmedValue}`;
};

const formatTeamNumber = (teamValue: string | number) => normalizeTeamKey(teamValue).replace('frc', '');

const getTeamNumbers = (teamKeys: Array<string | number>) => teamKeys.map((teamKey) => {
  return formatTeamNumber(teamKey);
});

const getAllianceSlot = (teamKeys: Array<string | number>, index: number) => getTeamNumbers(teamKeys)[index] || '';

const getSortedMatches = (matches: any[]) => [...matches].sort((a, b) => {
  const compLevelOrder: Record<string, number> = {
    qm: 1,
    ef: 2,
    qf: 3,
    sf: 4,
    f: 5,
  };

  const aCompLevel = compLevelOrder[a.comp_level || 'qm'] || 99;
  const bCompLevel = compLevelOrder[b.comp_level || 'qm'] || 99;

  if (aCompLevel !== bCompLevel) {
    return aCompLevel - bCompLevel;
  }

  const aSet = a.set_number || 0;
  const bSet = b.set_number || 0;

  if (aSet !== bSet) {
    return aSet - bSet;
  }

  const aNum = a.match_number || (a.key ? parseInt(a.key.split('m')[1]) : 0);
  const bNum = b.match_number || (b.key ? parseInt(b.key.split('m')[1]) : 0);
  return aNum - bNum;
});

const matchIncludesTeam = (match: any, teamKey: string) => {
  const redTeams = match.alliances?.red?.team_keys || [];
  const blueTeams = match.alliances?.blue?.team_keys || [];
  return [...redTeams, ...blueTeams].some((value: string | number) => normalizeTeamKey(value) === teamKey);
};

const getMatchLabel = (match: any) => `${match.comp_level || ''}${match.match_number || (match.key ? match.key.split('m')[1] : '')}`;

type TeamHistoryModalState = {
  teamNumber: string;
  currentMatchLabel: string;
  pastMatches: string[];
};

export const MatchSchedule: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'tba' | 'statbotics'>('tba');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [fetchError, setFetchError] = useState<string>('');
  const [teamHistoryModal, setTeamHistoryModal] = useState<TeamHistoryModalState | null>(null);

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

  const sortedAllMatches = getSortedMatches(matches);

  const filteredMatches = sortedAllMatches.filter(match => {
    if (!teamFilter) return true;

    const teamKey = normalizeTeamKey(teamFilter);
    return matchIncludesTeam(match, teamKey);
  });

  const sortedMatches = filteredMatches;

  const getMatchTime = (match: any) => {
    if (dataSource === 'statbotics') {
      return match.time ? new Date(match.time * 1000).toLocaleString() : 'TBD';
    } else {
      return match.time ? new Date(match.time * 1000).toLocaleString() : 'TBD';
    }
  };

  const exportSchedule = () => {
    if (!selectedCompetition || sortedMatches.length === 0) {
      return;
    }

    const rows = sortedMatches.map((match) => {
      const redTeams = match.alliances?.red?.team_keys || [];
      const blueTeams = match.alliances?.blue?.team_keys || [];

      return {
        Match: getMatchLabel(match),
        'Red 1': getAllianceSlot(redTeams, 0),
        'Red 2': getAllianceSlot(redTeams, 1),
        'Red 3': getAllianceSlot(redTeams, 2),
        'Blue 1': getAllianceSlot(blueTeams, 0),
        'Blue 2': getAllianceSlot(blueTeams, 1),
        'Blue 3': getAllianceSlot(blueTeams, 2),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

    const safeCompetitionName = selectedCompetition.name.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
    const filterSuffix = teamFilter.trim() ? `-team-${normalizeTeamKey(teamFilter).replace('frc', '')}` : '';

    XLSX.writeFile(workbook, `${safeCompetitionName || 'competition'}-schedule${filterSuffix}.xlsx`);
  };

  const openTeamHistory = (teamValue: string | number, currentMatch: any) => {
    const normalizedTeam = normalizeTeamKey(teamValue);
    const currentMatchIndex = sortedAllMatches.findIndex((match) => match.key === currentMatch.key);

    if (!normalizedTeam || currentMatchIndex < 0) {
      return;
    }

    const pastMatches = sortedAllMatches
      .slice(0, currentMatchIndex)
      .filter((match) => matchIncludesTeam(match, normalizedTeam))
      .map((match) => getMatchLabel(match));

    setTeamHistoryModal({
      teamNumber: formatTeamNumber(teamValue),
      currentMatchLabel: getMatchLabel(currentMatch),
      pastMatches,
    });
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
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 sm:gap-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              onClick={exportSchedule}
              disabled={sortedMatches.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Download size={16} />
              Export to Excel
            </button>
          </div>
        </div>

        {teamFilter && (
          <p className="text-sm text-blue-600">
            Showing matches for team {teamFilter} ({filteredMatches.length} matches)
          </p>
        )}

        {!teamFilter && sortedMatches.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Export downloads all visible matches in the current schedule.
          </p>
        )}

        {teamFilter && sortedMatches.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Export downloads only the filtered matches for team {teamFilter}.
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
            sortedMatches
              .map((m: any) => (
                <div key={m.key} className="bg-white p-3 sm:p-4 rounded-lg shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1">
                    <div className="font-black uppercase text-sm">
                      {getMatchLabel(m)}
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
                            <button
                              type="button"
                              onClick={() => openTeamHistory(tk, m)}
                              className="font-inherit text-left underline decoration-dotted underline-offset-2 hover:text-red-800"
                            >
                              {formatTeamNumber(tk)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">Blue Alliance</div>
                      <ul className="list-disc list-inside text-sm break-words">
                        {(m.alliances?.blue?.team_keys || []).map((tk: string | number) => (
                          <li key={tk} className={teamFilter && (tk.toString().includes(teamFilter) || tk.toString() === `frc${teamFilter}`) ? 'font-bold text-blue-700' : ''}>
                            <button
                              type="button"
                              onClick={() => openTeamHistory(tk, m)}
                              className="font-inherit text-left underline decoration-dotted underline-offset-2 hover:text-blue-800"
                            >
                              {formatTeamNumber(tk)}
                            </button>
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

      {teamHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setTeamHistoryModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Team {teamHistoryModal.teamNumber}</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Matches before {teamHistoryModal.currentMatchLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTeamHistoryModal(null)}
                className="rounded-md px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {teamHistoryModal.pastMatches.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600">
                No earlier matches found for team {teamHistoryModal.teamNumber}.
              </p>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Previous matches:</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {teamHistoryModal.pastMatches.map((matchLabel) => (
                    <li
                      key={matchLabel}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                    >
                      {matchLabel}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};