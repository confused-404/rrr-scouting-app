import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, RefreshCw, Save, X } from 'lucide-react';
import type { Competition } from '../types/competition.types';
import { competitionApi, statboticsApi, tbaApi } from '../services/api';

type AdminTeamMatchesProps = {
  selectedCompetition: Competition | null;
};

type TeamOption = {
  number: string;
  name: string;
};

const TEAM_OPTIONS: TeamOption[] = [
  { number: '3006', name: 'Red Rock Robotics' },
  { number: '2726', name: 'Red Pebble Rebels' },
];

const normalizeTeamKey = (teamValue: string | number) => {
  const trimmed = String(teamValue).trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('frc') ? trimmed : `frc${trimmed}`;
};

const formatTeamNumber = (teamValue: string | number) => normalizeTeamKey(teamValue).replace('frc', '');

const getSortedMatches = (matches: Array<Record<string, unknown>>) => {
  const compLevelOrder: Record<string, number> = {
    qm: 1,
    ef: 2,
    qf: 3,
    sf: 4,
    f: 5,
  };

  return [...matches].sort((a, b) => {
    const aCompLevel = compLevelOrder[String(a.comp_level || 'qm')] || 99;
    const bCompLevel = compLevelOrder[String(b.comp_level || 'qm')] || 99;
    if (aCompLevel !== bCompLevel) return aCompLevel - bCompLevel;

    const aSet = Number(a.set_number || 0);
    const bSet = Number(b.set_number || 0);
    if (aSet !== bSet) return aSet - bSet;

    const aNum = Number(a.match_number || 0);
    const bNum = Number(b.match_number || 0);
    return aNum - bNum;
  });
};

const getMatchLabel = (match: Record<string, unknown>) => {
  const compLevel = String(match.comp_level || 'qm').toUpperCase();
  const setNumber = Number(match.set_number || 0);
  const matchNumber = Number(match.match_number || 0);

  if (compLevel === 'QM') return `QM${matchNumber}`;
  if (setNumber > 0) return `${compLevel}${setNumber}-${matchNumber}`;
  return `${compLevel}${matchNumber}`;
};

const isMatchComplete = (match: Record<string, unknown>) => {
  const alliances = (match.alliances as {
    red?: { score?: unknown };
    blue?: { score?: unknown };
  } | undefined) || {};

  const redScore = typeof alliances.red?.score === 'number' ? alliances.red.score : -1;
  const blueScore = typeof alliances.blue?.score === 'number' ? alliances.blue.score : -1;
  return redScore >= 0 && blueScore >= 0;
};

const getMatchTime = (match: Record<string, unknown>) => {
  const timestamp = typeof match.time === 'number' ? match.time : null;
  if (!timestamp) return 'TBD';
  return new Date(timestamp * 1000).toLocaleString();
};

export const AdminTeamMatches: React.FC<AdminTeamMatchesProps> = ({ selectedCompetition }) => {
  const [selectedTeam, setSelectedTeam] = useState<string>(TEAM_OPTIONS[0].number);
  const [matches, setMatches] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);
  const [selectedMatchTeam, setSelectedMatchTeam] = useState<string | null>(null);
  const [teamDetails, setTeamDetails] = useState<Record<string, { loading: boolean; error: string; data: Record<string, unknown> | null }>>({});

  const [eventOPRs, setEventOPRs] = useState<Record<string, number>>({});

  const [strategyValue, setStrategyValue] = useState('');
  const [strategyDraft, setStrategyDraft] = useState('');
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategySaving, setStrategySaving] = useState(false);
  const [strategyError, setStrategyError] = useState('');
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const holdTimerRef = useRef<number | null>(null);
  const holdMovedRef = useRef(false);

  useEffect(() => {
    if (!selectedCompetition?.eventKey) {
      setEventOPRs({});
      return;
    }
    const loadOPRs = async () => {
      try {
        const data = await tbaApi.getEventOPRs(selectedCompetition.eventKey!);
        setEventOPRs((data as { oprs?: Record<string, number> }).oprs ?? {});
      } catch {
        setEventOPRs({});
      }
    };
    loadOPRs();
  }, [selectedCompetition?.id, selectedCompetition?.eventKey]);

  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const touchPoints = navigator.maxTouchPoints > 0;
    return Boolean(coarse || touchPoints);
  }, []);

  useEffect(() => {
    const loadMatches = async () => {
      if (!selectedCompetition?.eventKey) {
        setMatches([]);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await tbaApi.getEventMatches(selectedCompetition.eventKey);
        setMatches(Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []);
      } catch {
        setError('Could not load matches for this event.');
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, [selectedCompetition?.id, selectedCompetition?.eventKey, refreshToken]);

  const filteredMatches = useMemo(() => {
    const teamKey = normalizeTeamKey(selectedTeam);
    return getSortedMatches(matches).filter((match) => {
      const alliances = (match.alliances as {
        red?: { team_keys?: Array<string | number> };
        blue?: { team_keys?: Array<string | number> };
      } | undefined) || {};

      const allTeams = [
        ...(alliances.red?.team_keys || []),
        ...(alliances.blue?.team_keys || []),
      ];

      return allTeams.some((team) => normalizeTeamKey(team) === teamKey);
    });
  }, [matches, selectedTeam]);

  const nextMatchIndex = useMemo(
    () => filteredMatches.findIndex((match) => !isMatchComplete(match)),
    [filteredMatches]
  );

  const selectedMatch = useMemo(() => {
    if (!selectedMatchKey) return null;
    return filteredMatches.find((match, index) => {
      const key = String(match.key || `${match.comp_level}-${match.match_number}-${index}`);
      return key === selectedMatchKey;
    }) || null;
  }, [filteredMatches, selectedMatchKey]);


  useEffect(() => {
    if (filteredMatches.length === 0) return;

    const targetIndex = nextMatchIndex >= 0 ? nextMatchIndex : 0;
    const target = cardRefs.current[targetIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [filteredMatches, nextMatchIndex]);

  useEffect(() => {
    if (filteredMatches.length === 0) {
      setSelectedMatchKey(null);
      setSelectedMatchTeam(null);
      setTeamDetails({});
      setIsEditingStrategy(false);
      return;
    }

    // Clear selection only if the selected match is no longer in the list
    if (selectedMatchKey !== null) {
      const stillValid = filteredMatches.some((match, index) => {
        const key = String(match.key || `${match.comp_level}-${match.match_number}-${index}`);
        return key === selectedMatchKey;
      });
      if (!stillValid) {
        setSelectedMatchKey(null);
        setSelectedMatchTeam(null);
        setTeamDetails({});
        setIsEditingStrategy(false);
      }
    }
  }, [filteredMatches, selectedMatchKey]);

  useEffect(() => {
    const loadStrategy = async () => {
      if (!selectedCompetition?.id || !selectedMatchKey) {
        setStrategyValue('');
        setStrategyDraft('');
        return;
      }

      setStrategyLoading(true);
      setStrategyError('');
      try {
        const response = await competitionApi.getDriveTeamStrategy(selectedCompetition.id, selectedTeam, selectedMatchKey);
        const strategy = typeof response.strategy === 'string' ? response.strategy : '';
        setStrategyValue(strategy);
        setStrategyDraft(strategy);
      } catch {
        setStrategyError('Could not load strategy notes.');
        setStrategyValue('');
        setStrategyDraft('');
      } finally {
        setStrategyLoading(false);
      }
    };

    setIsEditingStrategy(false);
    loadStrategy();
  }, [selectedCompetition?.id, selectedTeam, selectedMatchKey]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const startMobileHold = () => {
    holdMovedRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      if (!holdMovedRef.current) {
        setIsEditingStrategy(true);
      }
    }, 1000);
  };

  const handleStrategyTouchMove = () => {
    holdMovedRef.current = true;
    clearHoldTimer();
  };

  const handleStrategyTouchEnd = () => {
    clearHoldTimer();
  };

  const handleStrategyDesktopClick = () => {
    if (!isMobileDevice) {
      setIsEditingStrategy(true);
    }
  };

  const saveStrategy = async () => {
    if (!selectedCompetition?.id || !selectedMatchKey) return;
    setStrategySaving(true);
    setStrategyError('');
    try {
      await competitionApi.saveDriveTeamStrategy(selectedCompetition.id, selectedTeam, selectedMatchKey, strategyDraft);
      setStrategyValue(strategyDraft);
      setIsEditingStrategy(false);
    } catch {
      setStrategyError('Could not save strategy notes.');
    } finally {
      setStrategySaving(false);
    }
  };

  const prefetchMatchTeams = (match: Record<string, unknown>) => {
    if (!selectedCompetition?.eventKey) return;
    const alliances = (match.alliances as {
      red?: { team_keys?: Array<string | number> };
      blue?: { team_keys?: Array<string | number> };
    } | undefined) || {};
    const teams = [
      ...(alliances.red?.team_keys || []),
      ...(alliances.blue?.team_keys || []),
    ].map((t) => formatTeamNumber(t));

    for (const team of teams) {
      // Fire-and-forget — skip teams already loading or loaded
      setTeamDetails((prev) => {
        if (prev[team]?.data || prev[team]?.loading) return prev;
        // Mark as loading immediately so duplicate calls skip
        const next = { ...prev, [team]: { loading: true, error: '', data: null } };
        statboticsApi.getTeamEvent(team, selectedCompetition.eventKey!)
          .then((detail) => {
            setTeamDetails((p) => ({ ...p, [team]: { loading: false, error: '', data: detail as Record<string, unknown> } }));
          })
          .catch(() => {
            setTeamDetails((p) => ({ ...p, [team]: { loading: false, error: 'Could not load team details.', data: null } }));
          });
        return next;
      });
    }
  };

  const loadTeamDetail = async (teamNumber: string) => {
    if (!selectedCompetition?.eventKey) return;

    setSelectedMatchTeam(teamNumber);

    if (teamDetails[teamNumber]?.data || teamDetails[teamNumber]?.loading) {
      return;
    }

    setTeamDetails((prev) => ({
      ...prev,
      [teamNumber]: { loading: true, error: '', data: null },
    }));

    try {
      const detail = await statboticsApi.getTeamEvent(teamNumber, selectedCompetition.eventKey) as Record<string, unknown>;
      setTeamDetails((prev) => ({
        ...prev,
        [teamNumber]: { loading: false, error: '', data: detail },
      }));
    } catch {
      setTeamDetails((prev) => ({
        ...prev,
        [teamNumber]: { loading: false, error: 'Could not load team details.', data: null },
      }));
    }
  };

  if (!selectedCompetition) {
    return <div className="p-10 text-center text-gray-500">No active competition selected.</div>;
  }

  if (!selectedCompetition.eventKey) {
    return <div className="p-10 text-center text-gray-500">No event key configured for this competition.</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {TEAM_OPTIONS.map((team) => (
              <button
                key={team.number}
                type="button"
                onClick={() => setSelectedTeam(team.number)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  selectedTeam === team.number
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={team.name}
              >
                {team.number} - {team.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={15} className="text-gray-500" />
          <span>
            {selectedCompetition.name} ({selectedCompetition.season})
          </span>
        </div>

      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-400">Loading matches...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-500">
          No matches found for team {selectedTeam}.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Click a card to open match details
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {filteredMatches.map((match, index) => {
                const alliances = (match.alliances as {
                  red?: { team_keys?: Array<string | number>; score?: unknown };
                  blue?: { team_keys?: Array<string | number>; score?: unknown };
                } | undefined) || {};

                const redTeams = (alliances.red?.team_keys || []).map((team) => formatTeamNumber(team));
                const blueTeams = (alliances.blue?.team_keys || []).map((team) => formatTeamNumber(team));

                const matchKey = String(match.key || `${match.comp_level}-${match.match_number}-${index}`);
                const isNext = nextMatchIndex >= 0 && index === nextMatchIndex;
                const completed = isMatchComplete(match);
                const isSelected = selectedMatchKey === matchKey;

                return (
                  <div
                    key={matchKey}
                    ref={(element) => {
                      cardRefs.current[index] = element;
                    }}
                    className={`w-[300px] flex-shrink-0 rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50 shadow-md'
                        : isNext
                          ? 'border-blue-300 bg-blue-50 shadow-sm'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        setSelectedMatchKey(matchKey);
                        setSelectedMatchTeam(null);
                        setTeamDetails({});
                        prefetchMatchTeams(match);
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-black text-gray-800">{getMatchLabel(match)}</div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            completed ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {completed ? 'Completed' : 'Next'}
                        </span>
                      </div>
                      <div className="mb-3 text-xs text-gray-500">{getMatchTime(match)}</div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-red-600">Red</div>
                          <div className="space-y-1">
                            {redTeams.map((team) => (
                              <div
                                key={`red-${matchKey}-${team}`}
                                className={`rounded px-2 py-1 ${
                                  team === selectedTeam ? 'bg-red-200 font-bold text-red-900' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {team}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-blue-600">Blue</div>
                          <div className="space-y-1">
                            {blueTeams.map((team) => (
                              <div
                                key={`blue-${matchKey}-${team}`}
                                className={`rounded px-2 py-1 ${
                                  team === selectedTeam ? 'bg-blue-200 font-bold text-blue-900' : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {team}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedMatch && (
            <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) setSelectedMatchKey(null); }}>
              <div className="relative flex h-full flex-col overflow-y-auto bg-white md:m-auto md:h-auto md:max-h-[90vh] md:w-full md:max-w-2xl md:rounded-2xl md:shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                  <div className="text-base font-black uppercase tracking-wider text-gray-800">
                    {getMatchLabel(selectedMatch)} Details
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMatchKey(null)}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    aria-label="Close"
                  >
                    <X size={24} />
                  </button>
                </div>
              <div className="p-4 space-y-3">

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600">Match Strategy</div>
                {strategyLoading ? (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-400">Loading strategy...</div>
                ) : isEditingStrategy ? (
                  <div className="space-y-2">
                    <textarea
                      value={strategyDraft}
                      onChange={(event) => setStrategyDraft(event.target.value)}
                      rows={4}
                      autoFocus
                      className="w-full resize-y rounded-lg border border-blue-200 bg-white p-3 text-sm outline-none focus:border-blue-500"
                      placeholder={`Match plan notes for ${getMatchLabel(selectedMatch)} (${selectedTeam})`}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveStrategy}
                        disabled={strategySaving}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save size={13} />
                        {strategySaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStrategyDraft(strategyValue);
                          setIsEditingStrategy(false);
                        }}
                        className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleStrategyDesktopClick}
                    onKeyDown={(event) => {
                      if (!isMobileDevice && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        setIsEditingStrategy(true);
                      }
                    }}
                    onTouchStart={isMobileDevice ? startMobileHold : undefined}
                    onTouchMove={isMobileDevice ? handleStrategyTouchMove : undefined}
                    onTouchEnd={isMobileDevice ? handleStrategyTouchEnd : undefined}
                    onTouchCancel={isMobileDevice ? handleStrategyTouchEnd : undefined}
                    className="min-h-[92px] cursor-pointer rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-700"
                    title={isMobileDevice ? 'Press and hold for 1 second to edit' : 'Click to edit'}
                  >
                    {strategyValue ? (
                      <div className="whitespace-pre-wrap">{strategyValue}</div>
                    ) : (
                      <div className="text-gray-400">
                        {isMobileDevice
                          ? 'Press and hold for 1 second to add match strategy.'
                          : 'Click to add match strategy.'}
                      </div>
                    )}
                  </div>
                )}
                {strategyError && <p className="mt-2 text-xs text-red-600">{strategyError}</p>}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
                {(() => {
                  const alliances = (selectedMatch.alliances as {
                    red?: { team_keys?: Array<string | number> };
                    blue?: { team_keys?: Array<string | number> };
                  } | undefined) || {};

                  const redTeams = (alliances.red?.team_keys || []).map((team) => formatTeamNumber(team));
                  const blueTeams = (alliances.blue?.team_keys || []).map((team) => formatTeamNumber(team));

                  return (
                    <>
                      <div>
                        <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-red-600">Red</div>
                        <div className="flex flex-wrap gap-2">
                          {redTeams.map((team) => (
                            <button
                              type="button"
                              key={`menu-red-${String(selectedMatch.key)}-${team}`}
                              onClick={() => loadTeamDetail(team)}
                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                selectedMatchTeam === team
                                  ? 'bg-red-200 text-red-900'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {team}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-blue-600">Blue</div>
                        <div className="flex flex-wrap gap-2">
                          {blueTeams.map((team) => (
                            <button
                              type="button"
                              key={`menu-blue-${String(selectedMatch.key)}-${team}`}
                              onClick={() => loadTeamDetail(team)}
                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                selectedMatchTeam === team
                                  ? 'bg-blue-200 text-blue-900'
                                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              }`}
                            >
                              {team}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                {(() => {
                  const detail = selectedMatchTeam ? teamDetails[selectedMatchTeam] : undefined;
                  const epa = (detail?.data?.epa as Record<string, unknown> | undefined) || undefined;
                  const breakdown = (epa?.breakdown as Record<string, unknown> | undefined) || undefined;

                  // Statbotics v3 wraps values in {mean, sd} objects; v2 uses plain numbers
                  const readEpa = (val: unknown): number | null => {
                    if (typeof val === 'number') return val;
                    if (val && typeof val === 'object') {
                      const mean = (val as Record<string, unknown>).mean;
                      if (typeof mean === 'number') return mean;
                    }
                    return null;
                  };

                  const opr = selectedMatchTeam ? (eventOPRs[`frc${selectedMatchTeam}`] ?? null) : null;

                  if (!selectedMatchTeam) {
                    return <p className="text-xs text-gray-500">Select a team above to view details in this menu.</p>;
                  }

                  if (detail?.loading) {
                    return <p className="text-xs text-gray-400">Loading team {selectedMatchTeam}...</p>;
                  }

                  if (detail?.error) {
                    return <p className="text-xs text-red-600">{detail.error}</p>;
                  }

                  if (!detail?.data) {
                    return <p className="text-xs text-gray-500">Select a team above to view details in this menu.</p>;
                  }

                  return (
                    <div className="space-y-2 text-xs text-gray-700">
                      <div className="font-black text-sm text-gray-900">Team {selectedMatchTeam}</div>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">OPR</div>
                          <div className="font-bold text-gray-800">{opr !== null ? opr.toFixed(1) : 'N/A'}</div>
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">EPA</div>
                          <div className="font-bold text-gray-800">{readEpa(epa?.total_points) !== null ? readEpa(epa?.total_points)!.toFixed(1) : 'N/A'}</div>
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Auto</div>
                          <div className="font-bold text-gray-800">{readEpa(breakdown?.auto_points) !== null ? readEpa(breakdown?.auto_points)!.toFixed(1) : 'N/A'}</div>
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Teleop</div>
                          <div className="font-bold text-gray-800">{readEpa(breakdown?.teleop_points) !== null ? readEpa(breakdown?.teleop_points)!.toFixed(1) : 'N/A'}</div>
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Endgame</div>
                          <div className="font-bold text-gray-800">{readEpa(breakdown?.endgame_points) !== null ? readEpa(breakdown?.endgame_points)!.toFixed(1) : 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              </div>
            </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
