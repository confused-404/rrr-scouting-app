import React, { useEffect, useMemo, useState } from 'react';
import { Download, Pin, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Competition } from '../types/competition.types';
import type { Form, Submission } from '../types/form.types';
import { formApi, tbaApi, statboticsApi } from '../services/api';
import { matchesTeamQuery } from '../utils/teamNameSearch';

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

const matchFieldRegex = /match( number| #|#|num| no\.?|)/i;

const parseMatchNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const digits = text.match(/\d+/)?.[0];
  if (!digits) return null;
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const getFormMatchFieldId = (form: Form): string | null => {
  const field = form.fields.find((f) => matchFieldRegex.test(f.label));
  return field ? String(field.id) : null;
};

const getFormLiveMatchCounter = (forms: Form[], submissions: Submission[]): number | null => {
  const formMatchField = new Map<string, string | null>();
  forms.forEach((form) => {
    formMatchField.set(form.id, getFormMatchFieldId(form));
  });

  let maxSubmittedMatch: number | null = null;
  submissions.forEach((submission) => {
    const matchFieldId = formMatchField.get(submission.formId);
    if (!matchFieldId) return;
    const matchNumber = parseMatchNumber(submission.data?.[matchFieldId]);
    if (matchNumber == null) return;
    if (maxSubmittedMatch == null || matchNumber > maxSubmittedMatch) {
      maxSubmittedMatch = matchNumber;
    }
  });

  return maxSubmittedMatch == null ? null : maxSubmittedMatch + 1;
};

const getOfficialLiveQualMatch = (rows: Array<Record<string, unknown>>): number | null => {
  const qualRows = rows
    .filter((row) => {
      const compLevel = typeof row.comp_level === 'string' ? row.comp_level.toLowerCase() : '';
      const key = typeof row.key === 'string' ? row.key.toLowerCase() : '';
      return compLevel === 'qm' || key.includes('_qm');
    })
    .map((row) => ({
      matchNumber: parseMatchNumber(row.match_number),
      status: typeof row.status === 'string' ? row.status.toLowerCase() : '',
    }))
    .filter((row): row is { matchNumber: number; status: string } => row.matchNumber != null)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  const firstOpen = qualRows.find((row) => row.status !== 'completed');
  return firstOpen?.matchNumber ?? null;
};

const getMatchNumberFromScheduleRow = (match: any): number => {
  return match.match_number || (match.key ? parseInt(match.key.split('m')[1]) : 0);
};

const getMatchKey = (match: any): string => {
  if (typeof match.key === 'string' && match.key.trim()) {
    return match.key;
  }
  const comp = match.comp_level || 'qm';
  const set = match.set_number || 0;
  const num = getMatchNumberFromScheduleRow(match);
  return `${comp}-${set}-${num}`;
};

export type PinnedScheduleMatch = {
  key: string;
  label: string;
  redTeams: string[];
  blueTeams: string[];
};

type TeamHistoryModalState = {
  teamNumber: string;
  currentMatchLabel: string;
  pastMatches: string[];
};

type MatchScheduleProps = {
  selectedCompetition?: Competition | null;
  onTeamLookup?: (teamNumber: string) => void;
  pinnedMatchKeys?: string[];
  onPinMatch?: (match: PinnedScheduleMatch) => void;
  onUnpinMatch?: (matchKey: string) => void;
};

export const MatchSchedule: React.FC<MatchScheduleProps> = ({
  selectedCompetition,
  onTeamLookup,
  pinnedMatchKeys,
  onPinMatch,
  onUnpinMatch,
}) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'tba' | 'statbotics'>('tba');
  const [teamFilterInput, setTeamFilterInput] = useState<string>('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [multiTeamMode, setMultiTeamMode] = useState(false);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [showPastMatches, setShowPastMatches] = useState(true);
  const [fetchError, setFetchError] = useState<string>('');
  const [teamHistoryModal, setTeamHistoryModal] = useState<TeamHistoryModalState | null>(null);
  const [liveMatchCounter, setLiveMatchCounter] = useState(1);
  const [liveCounterSource, setLiveCounterSource] = useState<'forms' | 'official' | 'default'>('default');
  const [liveCounterError, setLiveCounterError] = useState('');
  const canPinMatches = Boolean(onPinMatch || onUnpinMatch);

  const teamSuggestions = useMemo(() => {
    const q = teamFilterInput.trim();
    if (!q) return [] as Array<{ team: string; nickname: string }>;

    return Object.entries(teamNames)
      .map(([team, nickname]) => ({ team, nickname }))
      .filter((row) => matchesTeamQuery(row.team, row.nickname, q))
      .sort((a, b) => Number(a.team) - Number(b.team))
      .slice(0, 8);
  }, [teamFilterInput, teamNames]);

  useEffect(() => {
    const eventKey = selectedCompetition?.eventKey;
    if (!eventKey) { setTeamNames({}); return; }
    (async () => {
      try {
        const teams = await tbaApi.getEventTeams(eventKey) as Array<Record<string, unknown>>;
        const names: Record<string, string> = {};
        for (const t of teams) {
          const num = String(t.team_number ?? '').trim();
          const nick = String(t.nickname ?? '').trim();
          if (num && nick) names[num] = nick;
        }
        setTeamNames(names);
      } catch { /* non-critical */ }
    })();
  }, [selectedCompetition?.eventKey]);

  useEffect(() => {
    if (!selectedCompetition?.eventKey) {
      setMatches([]);
      return;
    }
    fetchMatches();
  }, [selectedCompetition, dataSource]);

  useEffect(() => {
    // Reset filter state on competition change to avoid stale team selections.
    setTeamFilterInput('');
    setSelectedTeams([]);
    setMultiTeamMode(false);
    setShowTeamSuggestions(false);
  }, [selectedCompetition?.id, selectedCompetition?.eventKey]);

  useEffect(() => {
    const fetchLiveCounter = async () => {
      if (!selectedCompetition?.id) {
        setLiveMatchCounter(1);
        setLiveCounterSource('default');
        setLiveCounterError('');
        return;
      }

      setLiveCounterError('');

      try {
        const forms = await formApi.getFormsByCompetition(selectedCompetition.id);
        const submissionLists = await Promise.all(forms.map((form) => formApi.getSubmissions(form.id)));
        const submissions = submissionLists.flat();
        const formCounter = getFormLiveMatchCounter(forms, submissions);

        let officialCounter: number | null = null;
        if (selectedCompetition.eventKey) {
          try {
            const rows = await statboticsApi.getEventMatches(selectedCompetition.eventKey) as Array<Record<string, unknown>>;
            officialCounter = getOfficialLiveQualMatch(rows);
          } catch {
            // fallback stays null
          }
        }

        if (formCounter != null) {
          setLiveMatchCounter(formCounter);
          setLiveCounterSource('forms');
          return;
        }

        if (officialCounter != null) {
          setLiveMatchCounter(officialCounter);
          setLiveCounterSource('official');
          return;
        }

        setLiveMatchCounter(1);
        setLiveCounterSource('default');
      } catch {
        setLiveMatchCounter(1);
        setLiveCounterSource('default');
        setLiveCounterError('Could not compute live match counter from submissions. Using default match 1.');
      }
    };

    fetchLiveCounter();
  }, [selectedCompetition?.id, selectedCompetition?.eventKey]);

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
    if (selectedTeams.length === 0) return true;
    const allTeamKeys: Array<string | number> = [
      ...(match.alliances?.red?.team_keys || []),
      ...(match.alliances?.blue?.team_keys || []),
    ];
    return selectedTeams.some(filterTeam =>
      allTeamKeys.some(teamKey => formatTeamNumber(teamKey) === filterTeam)
    );
  });

  const sortedMatches = filteredMatches;

  const visibleMatches = showPastMatches
    ? sortedMatches
    : sortedMatches.filter((match) => getMatchNumberFromScheduleRow(match) >= liveMatchCounter);

  const getMatchTime = (match: any) => {
    if (dataSource === 'statbotics') {
      return match.time ? new Date(match.time * 1000).toLocaleString() : 'TBD';
    } else {
      return match.time ? new Date(match.time * 1000).toLocaleString() : 'TBD';
    }
  };

  const getLiveCounterSnapshot = async (): Promise<number> => {
    if (!selectedCompetition?.id) return 1;

    try {
      const forms = await formApi.getFormsByCompetition(selectedCompetition.id);
      const submissionLists = await Promise.all(forms.map((form) => formApi.getSubmissions(form.id)));
      const submissions = submissionLists.flat();
      const formCounter = getFormLiveMatchCounter(forms, submissions);
      if (formCounter != null) return formCounter;

      if (selectedCompetition.eventKey) {
        try {
          const rows = await statboticsApi.getEventMatches(selectedCompetition.eventKey) as Array<Record<string, unknown>>;
          const officialCounter = getOfficialLiveQualMatch(rows);
          if (officialCounter != null) return officialCounter;
        } catch {
          // Ignore and fall back to default below.
        }
      }
    } catch {
      // Ignore and fall back to default below.
    }

    return 1;
  };

  const getLatestMatchesSnapshot = async (): Promise<any[]> => {
    if (!selectedCompetition?.eventKey) return [];
    try {
      const primaryData = dataSource === 'tba'
        ? await tbaApi.getEventMatches(selectedCompetition.eventKey)
        : await statboticsApi.getEventMatches(selectedCompetition.eventKey);
      return Array.isArray(primaryData) ? primaryData : [];
    } catch {
      const fallbackSource = dataSource === 'tba' ? 'statbotics' : 'tba';
      try {
        const fallbackData = fallbackSource === 'tba'
          ? await tbaApi.getEventMatches(selectedCompetition.eventKey)
          : await statboticsApi.getEventMatches(selectedCompetition.eventKey);
        return Array.isArray(fallbackData) ? fallbackData : [];
      } catch {
        return [];
      }
    }
  };

  const exportSchedule = async () => {
    if (!selectedCompetition) {
      return;
    }

    const latestMatches = await getLatestMatchesSnapshot();
    const sortedLatest = getSortedMatches(latestMatches);

    const latestFiltered = sortedLatest.filter((match) => {
      if (selectedTeams.length === 0) return true;
      const allTeamKeys: Array<string | number> = [
        ...(match.alliances?.red?.team_keys || []),
        ...(match.alliances?.blue?.team_keys || []),
      ];
      return selectedTeams.some(filterTeam =>
        allTeamKeys.some(teamKey => formatTeamNumber(teamKey) === filterTeam)
      );
    });

    const liveCounterForExport = showPastMatches
      ? liveMatchCounter
      : await getLiveCounterSnapshot();

    const latestVisible = showPastMatches
      ? latestFiltered
      : latestFiltered.filter((match) => getMatchNumberFromScheduleRow(match) >= liveCounterForExport);

    if (latestVisible.length === 0) return;

    const rows = latestVisible.map((match) => {
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
    const filterSuffix = selectedTeams.length === 1
      ? `-team-${selectedTeams[0]}`
      : selectedTeams.length > 1
        ? `-teams-${selectedTeams.join('-')}`
        : '';

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

            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Filter Team:</label>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search team # or name"
                    value={teamFilterInput}
                    onChange={(e) => {
                      setTeamFilterInput(e.target.value);
                      if (!multiTeamMode) setSelectedTeams([]);
                      setShowTeamSuggestions(true);
                    }}
                    onFocus={() => setShowTeamSuggestions(true)}
                    onBlur={() => setShowTeamSuggestions(false)}
                    className="px-3 py-2 sm:py-1 border border-gray-300 rounded text-sm w-full"
                  />
                  {showTeamSuggestions && teamSuggestions.length > 0 && (
                    <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {teamSuggestions.map((row) => (
                        <li
                          key={row.team}
                          onMouseDown={() => {
                            if (multiTeamMode) {
                              if (!selectedTeams.includes(row.team)) {
                                setSelectedTeams(prev => [...prev, row.team]);
                              }
                              setTeamFilterInput('');
                            } else {
                              setSelectedTeams([row.team]);
                              setTeamFilterInput(`${row.team} - ${row.nickname}`);
                            }
                            setShowTeamSuggestions(false);
                          }}
                          className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm"
                        >
                          <span className="font-bold text-blue-700">{row.team}</span>
                          <span className="ml-2 text-gray-600">{row.nickname}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !multiTeamMode;
                    setMultiTeamMode(next);
                    if (!next) {
                      setSelectedTeams([]);
                      setTeamFilterInput('');
                    }
                  }}
                  className={`px-3 py-2 sm:py-1 rounded text-sm font-bold transition-colors ${
                    multiTeamMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={multiTeamMode ? 'Multi-team mode ON — click to disable' : 'Click to filter by multiple teams'}
                >
                  +
                </button>
                {selectedTeams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeams([]);
                      setTeamFilterInput('');
                    }}
                    className="px-3 py-2 sm:py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
              {multiTeamMode && selectedTeams.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:ml-24">
                  {selectedTeams.map(team => (
                    <span
                      key={team}
                      className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full"
                    >
                      {team}{teamNames[team] ? ` · ${teamNames[team]}` : ''}
                      <button
                        type="button"
                        onClick={() => setSelectedTeams(prev => prev.filter(t => t !== team))}
                        className="hover:text-blue-600 ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Past Matches:</label>
              <button
                type="button"
                onClick={() => setShowPastMatches((prev) => !prev)}
                className={`w-full sm:w-auto px-3 py-2 sm:py-1 rounded text-sm font-semibold transition-colors ${
                  showPastMatches
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {showPastMatches ? 'Shown' : 'Hidden'}
              </button>
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

        {selectedTeams.length > 0 && !multiTeamMode && (
          <p className="text-sm text-blue-600">
            Showing matches for team {selectedTeams[0]}
            {teamNames[selectedTeams[0]] ? ` (${teamNames[selectedTeams[0]]})` : ''}
            {` (${filteredMatches.length} matches)`}
          </p>
        )}

        {selectedTeams.length > 0 && multiTeamMode && (
          <p className="text-sm text-blue-600">
            Showing matches for {selectedTeams.length} team{selectedTeams.length > 1 ? 's' : ''}: {selectedTeams.join(', ')} ({filteredMatches.length} matches)
          </p>
        )}

        {selectedTeams.length === 0 && teamFilterInput.trim() && (
          <p className="text-sm text-amber-700">
            Select a team from suggestions to apply the schedule filter.
          </p>
        )}

        {selectedTeams.length === 0 && sortedMatches.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Export downloads all visible matches in the current schedule.
          </p>
        )}

        <p className="text-xs text-blue-700 mt-2 font-semibold">
          Live match counter: Qual Match {liveMatchCounter}
          {liveCounterSource === 'forms' && ' (from submitted forms)'}
          {liveCounterSource === 'official' && ' (from official qualification feed)'}
          {liveCounterSource === 'default' && ' (default)'}
        </p>

        {!showPastMatches && (
          <p className="text-xs text-gray-500 mt-1">
            Showing matches at or after match {liveMatchCounter}.
          </p>
        )}

        {liveCounterError && (
          <p className="text-xs text-amber-700 mt-1">{liveCounterError}</p>
        )}

        {selectedTeams.length > 0 && sortedMatches.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Export downloads only the filtered matches.
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
          {visibleMatches.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed font-bold italic">
              {selectedTeams.length > 0
                ? `No visible matches found for the selected team${selectedTeams.length > 1 ? 's' : ''}.`
                : 'No visible matches available.'}
            </div>
          ) : (
            visibleMatches
              .map((m: any) => (
                <div key={getMatchKey(m)} className="bg-white p-3 sm:p-4 rounded-lg shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1">
                    <div className="flex items-center gap-2">
                      <div className="font-black uppercase text-sm">
                        {getMatchLabel(m)}
                      </div>
                      {canPinMatches && (
                        <button
                          type="button"
                          onClick={() => {
                            const matchKey = getMatchKey(m);
                            const isPinned = Boolean(pinnedMatchKeys?.includes(matchKey));
                            if (isPinned) {
                              onUnpinMatch?.(matchKey);
                              return;
                            }

                            onPinMatch?.({
                              key: matchKey,
                              label: getMatchLabel(m),
                              redTeams: getTeamNumbers(m.alliances?.red?.team_keys || []),
                              blueTeams: getTeamNumbers(m.alliances?.blue?.team_keys || []),
                            });
                          }}
                          className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                            pinnedMatchKeys?.includes(getMatchKey(m))
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={pinnedMatchKeys?.includes(getMatchKey(m)) ? 'Unpin match' : 'Pin match'}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Pin size={12} />
                            {pinnedMatchKeys?.includes(getMatchKey(m)) ? 'Pinned' : 'Pin'}
                          </span>
                        </button>
                      )}
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
                          <li key={tk} className={selectedTeams.length > 0 && selectedTeams.includes(formatTeamNumber(tk)) ? 'font-bold text-red-700' : ''}>
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
                          <li key={tk} className={selectedTeams.length > 0 && selectedTeams.includes(formatTeamNumber(tk)) ? 'font-bold text-blue-700' : ''}>
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

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onTeamLookup) {
                    onTeamLookup(teamHistoryModal.teamNumber);
                  }
                  setTeamHistoryModal(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Team Lookup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};