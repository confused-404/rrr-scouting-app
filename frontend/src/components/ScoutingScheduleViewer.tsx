import React, { useState, useMemo, useEffect } from 'react';
import { Clock, AlertCircle, Search } from 'lucide-react';
import type { Competition, GeneratedAssignment } from '../types/competition.types';
import type { Form, Submission } from '../types/form.types';
import { formApi, tbaApi, statboticsApi } from '../services/api';

interface ScoutingScheduleViewerProps {
  selectedCompetition: Competition | null;
  scouterName?: string | null;
}

/** Map "red1" → { alliance: 'red', slot: 0 } */
const parsePosition = (pos: string): { alliance: 'red' | 'blue'; slot: number } | null => {
  const m = pos.match(/^(red|blue)(\d)$/i);
  if (!m) return null;
  return { alliance: m[1].toLowerCase() as 'red' | 'blue', slot: parseInt(m[2]) - 1 };
};

const normalizeName = (value: string): string => value.toLowerCase().trim().replace(/\s+/g, ' ');

const namesMatch = (candidate: string, target: string): boolean => {
  const c = normalizeName(candidate);
  const t = normalizeName(target);
  if (!c || !t) return false;
  return c === t || c.includes(t) || t.includes(c);
};

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

const getSubmittedLiveMatchCounter = (forms: Form[], submissions: Submission[]): number | null => {
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

export const ScoutingScheduleViewer: React.FC<ScoutingScheduleViewerProps> = ({ selectedCompetition, scouterName }) => {
  const [viewMode, setViewMode] = useState<'nextMatch' | 'all' | 'myMatches'>('nextMatch');
  const [searchQuery, setSearchQuery] = useState('');

  // When scouterName becomes known (after login + profile fetch), auto-switch to My Assignments
  useEffect(() => {
    if (scouterName) {
      setViewMode('nextMatch');
      setSearchQuery(scouterName);
    }
  }, [scouterName]); // Add this line

  // TBA match data: match_number → { red: string[3], blue: string[3] }
  const [tbaMatches, setTbaMatches] = useState<Map<number, { red: string[]; blue: string[] }>>(new Map());
  const [tbaLoading, setTbaLoading] = useState(false);
  const [tbaError, setTbaError] = useState('');
  const [statboticsLiveQualMatch, setStatboticsLiveQualMatch] = useState<number | null>(null);
  const [formLiveMatch, setFormLiveMatch] = useState<number | null>(null);
  const [statboticsLoading, setStatboticsLoading] = useState(false);
  const [statboticsError, setStatboticsError] = useState('');
  const [formProgressError, setFormProgressError] = useState('');
  const [dismissedAssignments, setDismissedAssignments] = useState<Set<string>>(new Set());

  const getAssignmentKey = (assignment: GeneratedAssignment) =>
    `${assignment.matchNumber}-${assignment.position}-${assignment.teamId || assignment.teamName}`;

  useEffect(() => {
    const key = `dismissedAssignments:${selectedCompetition?.id ?? 'none'}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setDismissedAssignments(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setDismissedAssignments(new Set(parsed));
    } catch {
      setDismissedAssignments(new Set());
    }
  }, [selectedCompetition?.id]);

  const persistDismissed = (next: Set<string>) => {
    const key = `dismissedAssignments:${selectedCompetition?.id ?? 'none'}`;
    setDismissedAssignments(next);
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(next)));
    } catch {
      // ignore storage errors
    }
  };

  const dismissAssignment = (assignment: GeneratedAssignment) => {
    const key = getAssignmentKey(assignment);
    const next = new Set(dismissedAssignments);
    next.add(key);
    persistDismissed(next);
  };

  const restoreAllDismissed = () => {
    persistDismissed(new Set());
  };

  useEffect(() => {
    if (!selectedCompetition?.eventKey) {
      setTbaMatches(new Map());
    } else {
      fetchTbaMatches(selectedCompetition.eventKey);
      fetchStatboticsProgress(selectedCompetition.eventKey);
    }

    if (!selectedCompetition?.id) {
      setFormLiveMatch(null);
      return;
    }

    fetchFormProgress(selectedCompetition.id);
  }, [selectedCompetition?.eventKey, selectedCompetition?.id]);

  const myAssignments = useMemo(() => {
    const all = selectedCompetition?.scoutingAssignments || [];
    const query = normalizeName(searchQuery);

    if (!query) return all;

    return all.filter(a => {
      // Check both scouts array and the team name
      const matchesScout = a.scouts.some(name => namesMatch(name, query));
      const matchesTeam = normalizeName(a.teamName || '').includes(query);
      return matchesScout || matchesTeam;
    });
  }, [selectedCompetition?.scoutingAssignments, searchQuery]);

  const visibleAssignments = useMemo(() => {
    if (dismissedAssignments.size === 0) return myAssignments;
    return myAssignments.filter((a) => !dismissedAssignments.has(getAssignmentKey(a)));
  }, [myAssignments, dismissedAssignments]);

  const fetchTbaMatches = async (eventKey: string) => {
    setTbaLoading(true);
    setTbaError('');
    try {
      const raw = await tbaApi.getEventMatches(eventKey) as Array<Record<string, unknown>>;
      const map = new Map<number, { red: string[]; blue: string[] }>();

      for (const match of raw) {
        const matchNum = typeof match.match_number === 'number'
          ? match.match_number
          : (typeof match.key === 'string' ? parseInt((match.key as string).split('_qm')[1] ?? '') : NaN);
        if (isNaN(matchNum)) continue;

        // Only include qual matches (key ends with _qm<n>)
        if (typeof match.key === 'string' && !(match.key as string).includes('_qm')) continue;

        const alliances = match.alliances as Record<string, { team_keys?: string[] }> | undefined;
        const red = (alliances?.red?.team_keys ?? []).map((k: string) => k.replace(/^frc/, ''));
        const blue = (alliances?.blue?.team_keys ?? []).map((k: string) => k.replace(/^frc/, ''));

        map.set(matchNum, { red, blue });
      }

      setTbaMatches(map);
    } catch {
      setTbaError('Could not load team numbers from TBA. Team numbers may not be shown.');
    } finally {
      setTbaLoading(false);
    }
  };

  const fetchStatboticsProgress = async (eventKey: string) => {
    setStatboticsLoading(true);
    setStatboticsError('');

    try {
      const rows = await statboticsApi.getEventMatches(eventKey) as Array<Record<string, unknown>>;

      const qualRows = rows
        .filter(row => {
          const compLevel = typeof row.comp_level === 'string' ? row.comp_level.toLowerCase() : '';
          const key = typeof row.key === 'string' ? row.key.toLowerCase() : '';
          return compLevel === 'qm' || key.includes('_qm');
        })
        .map(row => {
          const matchNumber = typeof row.match_number === 'number'
            ? row.match_number
            : (typeof row.match_number === 'string' ? parseInt(row.match_number, 10) : NaN);
          const status = typeof row.status === 'string' ? row.status.toLowerCase() : '';
          return { matchNumber, status };
        })
        .filter(row => Number.isFinite(row.matchNumber))
        .sort((a, b) => a.matchNumber - b.matchNumber);

      // First non-completed qual match approximates the "current" event progress.
      const firstOpen = qualRows.find(row => row.status !== 'completed');
      setStatboticsLiveQualMatch(firstOpen ? firstOpen.matchNumber : null);
    } catch {
      setStatboticsLiveQualMatch(null);
      setStatboticsError('Could not load live match progress from Statbotics.');
    } finally {
      setStatboticsLoading(false);
    }
  };

  const fetchFormProgress = async (competitionId: string) => {
    setFormProgressError('');
    try {
      const forms = await formApi.getFormsByCompetition(competitionId);
      const submissionLists = await Promise.all(forms.map((form) => formApi.getSubmissions(form.id)));
      const submissions = submissionLists.flat();
      setFormLiveMatch(getSubmittedLiveMatchCounter(forms, submissions));
    } catch {
      setFormLiveMatch(null);
      setFormProgressError('Could not load submitted form progress. Falling back to official live match pointer.');
    }
  };

  /** Resolve team number for a given assignment */
  const resolveTeamNumber = (assignment: GeneratedAssignment): string | null => {
    const parsed = parsePosition(assignment.position);
    if (!parsed) return null;
    const matchData = tbaMatches.get(assignment.matchNumber);
    if (!matchData) return null;
    const teams = parsed.alliance === 'red' ? matchData.red : matchData.blue;
    return teams[parsed.slot] ?? null;
  };

  const liveMatchCounter = formLiveMatch ?? statboticsLiveQualMatch ?? 1;
  const liveCounterSource: 'forms' | 'official' | 'default' =
    formLiveMatch != null ? 'forms' : (statboticsLiveQualMatch != null ? 'official' : 'default');

  const getNextMatch = () => {
    if (!selectedCompetition?.scoutingAssignments) return null;

    // Primary: scouterName is linked — exact personalized match
    let pool: GeneratedAssignment[];
    if (scouterName) {
      pool = selectedCompetition.scoutingAssignments.filter(a =>
        a.scouts.some(s => namesMatch(s, scouterName))
      );
      pool = pool.filter((a) => !dismissedAssignments.has(getAssignmentKey(a)));
    } else if (searchQuery.trim()) {
      // Fallback: not linked yet but user has filtered by their name manually
      pool = visibleAssignments;
    } else {
      return null;
    }

    const byCounter = [...pool]
      .filter(a => a.matchNumber >= liveMatchCounter)
      .sort((a, b) => a.matchNumber - b.matchNumber);
    if (byCounter.length > 0) return byCounter[0];

    // If every assignment is below the live counter, return the earliest assignment.
    return [...pool].sort((a, b) => a.matchNumber - b.matchNumber)[0] || null;
  };

  const nextMatch = getNextMatch();

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p>Please select a competition to view the scouting schedule</p>
      </div>
    );
  }

  const assignments = selectedCompetition.scoutingAssignments || [];

  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p>No scouting schedule has been generated yet.</p>
        <p className="text-sm text-gray-400">Admins can generate schedules in the Scouting Teams tab.</p>
      </div>
    );
  }

  const getPositionBg = (position: string) =>
    position.startsWith('red') ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200';

  const getPositionLabel = (position: string) => {
    const color = position.startsWith('red') ? 'Red' : 'Blue';
    const num = position.slice(-1);
    return `${color} ${num}`;
  };

  const maxMatch = Math.max(...assignments.map(a => a.matchNumber), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <Clock size={24} className="text-blue-600" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Scouting Schedule</h2>
        </div>
        <p className="text-sm text-gray-500">{selectedCompetition.name} ({selectedCompetition.season})</p>

        {/* TBA status */}
        {tbaLoading && (
          <p className="text-xs text-gray-400 mt-2 animate-pulse">Loading team numbers from TBA…</p>
        )}
        {tbaError && (
          <div className="flex items-center gap-2 mt-2 text-xs text-amber-700">
            <AlertCircle size={14} /> {tbaError}
          </div>
        )}
        {statboticsLoading && (
          <p className="text-xs text-gray-400 mt-1 animate-pulse">Loading live event progress from Statbotics…</p>
        )}
        {statboticsError && (
          <div className="flex items-center gap-2 mt-1 text-xs text-amber-700">
            <AlertCircle size={14} /> {statboticsError}
          </div>
        )}
        {formProgressError && (
          <div className="flex items-center gap-2 mt-1 text-xs text-amber-700">
            <AlertCircle size={14} /> {formProgressError}
          </div>
        )}
        <p className="text-xs text-blue-700 mt-1 font-semibold">
          Live match counter: Qual Match {liveMatchCounter}
          {liveCounterSource === 'forms' && ' (from submitted forms)'}
          {liveCounterSource === 'official' && ' (from official live feed)'}
          {liveCounterSource === 'default' && ' (default)'}
        </p>
        {!selectedCompetition.eventKey && (
          <div className="flex items-center gap-2 mt-2 text-xs text-amber-700">
            <AlertCircle size={14} /> No event key set — team numbers from TBA are unavailable.
          </div>
        )}
      </div>

      {/* Next Match Alert */}
      {nextMatch && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-blue-600" />
            <span className="font-semibold text-blue-900">Your Next Match</span>
          </div>
          <div className="text-sm text-blue-800">
            <p>
              <strong>Match {nextMatch.matchNumber}</strong> — {getPositionLabel(nextMatch.position)}
              {(() => {
                const t = resolveTeamNumber(nextMatch);
                return t ? <span className="ml-1 font-black text-blue-900">(Team {t})</span> : null;
              })()}
            </p>
            <p>{nextMatch.matchTime ? new Date(nextMatch.matchTime * 1000).toLocaleString() : 'Time TBD'}</p>
            {nextMatch.scouts.length > 0 && (
              <p className="mt-1">Scouting with: {nextMatch.scouts.join(', ')}</p>
            )}
            <button
              type="button"
              onClick={() => dismissAssignment(nextMatch)}
              className="mt-3 text-xs font-bold text-red-700 hover:text-red-900"
            >
              Cancel this assignment
            </button>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="bg-white rounded-lg shadow-sm p-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          onClick={() => setViewMode('nextMatch')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            viewMode === 'nextMatch' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Next Match
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Matches
        </button>
        <button
          onClick={() => setViewMode('myMatches')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            viewMode === 'myMatches' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          My Assignments
        </button>
      </div>

      {viewMode === 'nextMatch' && (
        <div className="space-y-3">
          {!nextMatch ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              <p className="font-semibold">No upcoming match found.</p>
              <p className="text-sm text-gray-400 mt-1">
                {scouterName
                  ? `No future assignments found for ${scouterName}.`
                  : 'Link this account to a scouter name (Manage Users) or use My Assignments search.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-black uppercase tracking-wider">
                  Up Next
                </span>
                <h3 className="text-xl font-black text-gray-900">
                  Match {nextMatch.matchNumber}
                </h3>
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                  nextMatch.position.startsWith('red')
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {nextMatch.position}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Scouting Team</div>
                  <div className="text-lg font-black text-gray-900 tabular-nums">
                    {resolveTeamNumber(nextMatch) ?? nextMatch.teamName ?? '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Planned Time</div>
                  <div className="text-sm font-bold text-gray-800">
                    {nextMatch.matchTime ? new Date(nextMatch.matchTime * 1000).toLocaleString() : 'Time TBD'}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Starts In</div>
                  <div className="text-sm font-bold text-blue-700">
                    Match-based counter in use
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Scouting With</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {nextMatch.scouts.length > 0 ? nextMatch.scouts.join(', ') : '—'}
                  </div>
                </div>
              </div>

              {(() => {
                const parsed = parsePosition(nextMatch.position);
                const matchData = tbaMatches.get(nextMatch.matchNumber);
                const allianceTeams = matchData
                  ? (parsed?.alliance === 'red' ? matchData.red : matchData.blue)
                  : [];

                if (allianceTeams.length === 0) return null;

                return (
                  <div className="rounded-lg border border-gray-100 p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                      Alliance Context
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allianceTeams.map((t, i) => (
                        <span
                          key={i}
                          className={`text-xs font-black px-2 py-1 rounded ${
                            t === resolveTeamNumber(nextMatch)
                              ? nextMatch.position.startsWith('red')
                                ? 'bg-red-200 text-red-800'
                                : 'bg-blue-200 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Team {t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {viewMode === 'myMatches' && (
        <div className="relative mb-4 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by your name or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          </div>
          <button
            type="button"
            onClick={restoreAllDismissed}
            disabled={dismissedAssignments.size === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Restore canceled
          </button>
        </div>
      )}

      {/* All Matches View */}
      {viewMode === 'all' && (
        <div className="space-y-2">
          {Array.from({ length: maxMatch }, (_, i) => i + 1).map(matchNum => {
            const matchAssignments = assignments.filter(a => a.matchNumber === matchNum);
            if (matchAssignments.length === 0) return null;
            const matchData = tbaMatches.get(matchNum);

            return (
              <div key={matchNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="font-black text-gray-800">Match {matchNum}</span>
                  {matchAssignments[0]?.matchTime && (
                    <span className="text-xs text-gray-500">
                      {new Date(matchAssignments[0].matchTime * 1000).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {matchAssignments.map(assignment => {
                    const parsed = parsePosition(assignment.position);
                    const teamNum = resolveTeamNumber(assignment);
                    const allianceTeams = matchData
                      ? (parsed?.alliance === 'red' ? matchData.red : matchData.blue)
                      : [];

                    return (
                      <div
                        key={`${matchNum}-${assignment.position}`}
                        className={`rounded-lg border px-4 py-3 ${getPositionBg(assignment.position)}`}
                      >
                        {/* Position label */}
                        <div className="font-black text-xs uppercase tracking-widest mb-1 opacity-70">
                          {getPositionLabel(assignment.position)}
                        </div>

                        {/* BIG team number */}
                        <div className="font-black text-2xl leading-tight mb-0.5">
                          {teamNum
                            ? <>Team <span className="tabular-nums">{teamNum}</span></>
                            : <span className="text-sm opacity-50">—</span>}
                        </div>

                        {/* Scouting team name */}
                        <div className="text-xs font-semibold opacity-60 truncate">{assignment.teamName}</div>

                        {/* All 3 teams in alliance (context) */}
                        {allianceTeams.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-current border-opacity-20 flex gap-1 flex-wrap">
                            {allianceTeams.map((t, i) => (
                              <span
                                key={i}
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  t === teamNum
                                    ? 'bg-white bg-opacity-60'
                                    : 'opacity-50'
                                }`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Scout names */}
                        {assignment.scouts.length > 0 && (
                          <div className="text-[10px] mt-1 pt-1 border-t border-current border-opacity-10 opacity-60">
                            {assignment.scouts.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My Assignments View */}
      {viewMode === 'myMatches' && (
        <div className="space-y-2">
          {visibleAssignments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              <p>{searchQuery ? `No results for "${searchQuery}"` : "No assignments currently visible."}</p>
            </div>
          ) : (
            visibleAssignments.map((assignment, idx) => {
              const teamNum = assignment.teamName; // Using teamName from assignment
              const parsed = parsePosition(assignment.position);
              const matchData = tbaMatches.get(assignment.matchNumber);
              const allianceTeams = matchData
                ? (parsed?.alliance === 'red' ? matchData.red : matchData.blue)
                : [];
              const isRed = assignment.position.startsWith('red');

              return (
                <div
                  key={`${assignment.matchNumber}-${assignment.position}-${idx}`}
                  className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-2 sm:gap-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Match number */}
                  <div className="bg-gray-100 px-3 py-1 rounded-lg font-black text-gray-700 w-20 text-center">
                    M{assignment.matchNumber}
                  </div>

                  {/* Alliance badge */}
                  <div className={`w-20 text-center py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                    isRed ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {assignment.position}
                  </div>

                  {/* Team number */}
                  <div className="w-16 font-black text-gray-900 text-lg tabular-nums">
                    {teamNum || '—'}
                  </div>

                  {/* Rest of alliance for context */}
                  {allianceTeams.length > 0 && (
                    <div className="flex items-center gap-1 hidden sm:flex">
                      {allianceTeams.map((t, i) => (
                        <span
                          key={i}
                          className={`text-xs font-black px-1.5 py-0.5 rounded ${
                            t === teamNum
                              ? isRed ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Scout names */}
                  <div className="text-sm text-gray-500 ml-auto">
                    {assignment.scouts.join(', ')}
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissAssignment(assignment)}
                    className="text-xs font-bold text-red-700 hover:text-red-900"
                  >
                    Cancel
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
