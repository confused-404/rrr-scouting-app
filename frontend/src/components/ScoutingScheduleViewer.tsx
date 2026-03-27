import React, { useState, useMemo, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import type { Competition, GeneratedAssignment } from '../types/competition.types';
import { tbaApi } from '../services/api';

interface ScoutingScheduleViewerProps {
  selectedCompetition: Competition | null;
}

/** Map "red1" → { alliance: 'red', slot: 0 } */
const parsePosition = (pos: string): { alliance: 'red' | 'blue'; slot: number } | null => {
  const m = pos.match(/^(red|blue)(\d)$/i);
  if (!m) return null;
  return { alliance: m[1].toLowerCase() as 'red' | 'blue', slot: parseInt(m[2]) - 1 };
};

export const ScoutingScheduleViewer: React.FC<ScoutingScheduleViewerProps> = ({ selectedCompetition }) => {
  const [viewMode, setViewMode] = useState<'all' | 'myMatches'>('all');

  // TBA match data: match_number → { red: string[3], blue: string[3] }
  const [tbaMatches, setTbaMatches] = useState<Map<number, { red: string[]; blue: string[] }>>(new Map());
  const [tbaLoading, setTbaLoading] = useState(false);
  const [tbaError, setTbaError] = useState('');

  useEffect(() => {
    if (!selectedCompetition?.eventKey) {
      setTbaMatches(new Map());
      return;
    }
    fetchTbaMatches(selectedCompetition.eventKey);
  }, [selectedCompetition?.eventKey]);

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

  /** Resolve team number for a given assignment */
  const resolveTeamNumber = (assignment: GeneratedAssignment): string | null => {
    const parsed = parsePosition(assignment.position);
    if (!parsed) return null;
    const matchData = tbaMatches.get(assignment.matchNumber);
    if (!matchData) return null;
    const teams = parsed.alliance === 'red' ? matchData.red : matchData.blue;
    return teams[parsed.slot] ?? null;
  };

  const now = new Date();

  const getNextMatch = () => {
    if (!selectedCompetition?.scoutingAssignments) return null;
    return selectedCompetition.scoutingAssignments
      .filter(a => a.matchTime && a.matchTime * 1000 > now.getTime())
      .sort((a, b) => a.matchTime! - b.matchTime!)[0] || null;
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

  const uniqueTeams = useMemo(() => {
    const teamMap = new Map<string, GeneratedAssignment[]>();
    assignments.forEach(assignment => {
      if (!teamMap.has(assignment.teamId)) teamMap.set(assignment.teamId, []);
      teamMap.get(assignment.teamId)!.push(assignment);
    });
    return Array.from(teamMap.entries()).map(([teamId, teamAssignments]) => ({
      teamId,
      teamName: teamAssignments[0].teamName,
      assignments: teamAssignments.sort((a, b) => a.matchNumber - b.matchNumber),
    }));
  }, [assignments]);

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
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="bg-white rounded-lg shadow-sm p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        <div className="space-y-4">
          {uniqueTeams.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              <p>No assignments currently visible.</p>
              <p className="text-sm text-gray-400">Switch to "All Matches" to see the full schedule.</p>
            </div>
          ) : (
            uniqueTeams.map(team => (
              <div key={team.teamId} className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">{team.teamName}</h3>
                <div className="space-y-2">
                  {team.assignments.map(assignment => {
                    const teamNum = resolveTeamNumber(assignment);
                    const parsed = parsePosition(assignment.position);
                    const matchData = tbaMatches.get(assignment.matchNumber);
                    const allianceTeams = matchData
                      ? (parsed?.alliance === 'red' ? matchData.red : matchData.blue)
                      : [];
                    const isRed = assignment.position.startsWith('red');

                    return (
                      <div
                        key={`${assignment.matchNumber}-${assignment.position}`}
                        className="flex flex-wrap items-center gap-2 sm:gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        {/* Match number */}
                        <div className="font-black text-gray-800 w-20 flex-shrink-0">
                          Match {assignment.matchNumber}
                        </div>

                        {/* Alliance badge */}
                        <div className={`px-2.5 py-1 rounded-lg text-sm font-black border ${getPositionBg(assignment.position)}`}>
                          {getPositionLabel(assignment.position)}
                        </div>

                        {/* Team number — the key info */}
                        <div className={`font-black text-xl ${isRed ? 'text-red-700' : 'text-blue-700'}`}>
                          {teamNum ? (
                            <>Scout: Team <span className="tabular-nums">{teamNum}</span></>
                          ) : (
                            <span className="text-sm text-gray-400 font-normal">Team # loading…</span>
                          )}
                        </div>

                        {/* Rest of alliance for context */}
                        {allianceTeams.length > 0 && (
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-1">Alliance:</span>
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

                        {/* Time */}
                        {assignment.matchTime && (
                          <div className="text-xs text-gray-500 ml-auto hidden sm:block">
                            {new Date(assignment.matchTime * 1000).toLocaleString()}
                          </div>
                        )}

                        {/* Scout names */}
                        {assignment.scouts.length > 0 && (
                          <div className="text-sm text-gray-500 w-full sm:w-auto sm:ml-auto">
                            {assignment.scouts.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
