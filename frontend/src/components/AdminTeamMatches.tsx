import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, RefreshCw, Save, X } from 'lucide-react';
import type { Competition } from '../types/competition.types';
import type { Form, Submission } from '../types/form.types';
import { competitionApi, formApi, statboticsApi, tbaApi } from '../services/api';

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

const DRIVE_TEAM_SELECTED_TEAM_STORAGE_KEY = 'adminTeamMatches.selectedTeam';
const teamFieldRegex = /team|team number|team #/i;
const autoPathFieldRegex = /auto.*path|path.*auto|starting position|start position/i;

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

const parseSuperscouterEntry = (raw: unknown): { notes: string; rating: number | null } => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as { notes?: unknown; rating?: unknown };
      if (parsed && typeof parsed === 'object') {
        return {
          notes: typeof parsed.notes === 'string' ? parsed.notes : '',
          rating: typeof parsed.rating === 'number' && Number.isFinite(parsed.rating) ? parsed.rating : null,
        };
      }
    } catch {
      return { notes: raw, rating: null };
    }

    return { notes: raw, rating: null };
  }

  if (raw && typeof raw === 'object') {
    const parsed = raw as { notes?: unknown; rating?: unknown };
    return {
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      rating: typeof parsed.rating === 'number' && Number.isFinite(parsed.rating) ? parsed.rating : null,
    };
  }

  return { notes: '', rating: null };
};

const normalizeTeamNumber = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.startsWith('frc')) return text.replace(/^frc/i, '').trim();
  const digits = text.match(/\d+/)?.[0];
  return digits || null;
};

const resolveTeamFieldId = (form: Form): number | null => {
  if (
    Number.isInteger(form.teamNumberFieldId)
    && form.fields.some((field) => field.id === form.teamNumberFieldId)
  ) {
    return form.teamNumberFieldId as number;
  }

  const fallbackField = form.fields.find((field) => teamFieldRegex.test(field.label));
  return fallbackField?.id ?? null;
};

export const AdminTeamMatches: React.FC<AdminTeamMatchesProps> = ({ selectedCompetition }) => {
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    if (typeof window === 'undefined') return TEAM_OPTIONS[0].number;
    try {
      const raw = sessionStorage.getItem(DRIVE_TEAM_SELECTED_TEAM_STORAGE_KEY);
      const valid = TEAM_OPTIONS.some((team) => team.number === raw);
      return valid ? (raw as string) : TEAM_OPTIONS[0].number;
    } catch {
      return TEAM_OPTIONS[0].number;
    }
  });
  const [matches, setMatches] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);
  const [selectedMatchTeam, setSelectedMatchTeam] = useState<string | null>(null);
  const [teamDetails, setTeamDetails] = useState<Record<string, { loading: boolean; error: string; data: Record<string, unknown> | null }>>({});
  const [scoutingForms, setScoutingForms] = useState<Form[]>([]);
  const [scoutingSubmissions, setScoutingSubmissions] = useState<Submission[]>([]);

  const [strategyValue, setStrategyValue] = useState('');
  const [strategyDraft, setStrategyDraft] = useState('');
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategySaving, setStrategySaving] = useState(false);
  const [strategyError, setStrategyError] = useState('');
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const holdTimerRef = useRef<number | null>(null);
  const holdMovedRef = useRef(false);

  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const touchPoints = navigator.maxTouchPoints > 0;
    return Boolean(coarse || touchPoints);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRIVE_TEAM_SELECTED_TEAM_STORAGE_KEY, selectedTeam);
    } catch {
      // Ignore storage failures.
    }
  }, [selectedTeam]);

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

  useEffect(() => {
    const loadScoutingData = async () => {
      if (!selectedCompetition?.id) {
        setScoutingForms([]);
        setScoutingSubmissions([]);
        return;
      }

      try {
        const forms = await formApi.getFormsByCompetition(selectedCompetition.id);
        setScoutingForms(forms);

        const submissionsByForm = await Promise.all(forms.map((form) => formApi.getSubmissions(form.id)));
        setScoutingSubmissions(submissionsByForm.flat());
      } catch {
        setScoutingForms([]);
        setScoutingSubmissions([]);
      }
    };

    loadScoutingData();
  }, [selectedCompetition?.id]);

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

  const orderedMatches = useMemo(() => {
    const nextIndex = filteredMatches.findIndex((match) => !isMatchComplete(match));
    if (nextIndex <= 0) return filteredMatches;

    const nextMatch = filteredMatches[nextIndex];
    return [
      nextMatch,
      ...filteredMatches.slice(0, nextIndex),
      ...filteredMatches.slice(nextIndex + 1),
    ];
  }, [filteredMatches]);

  const nextMatchIndex = useMemo(
    () => orderedMatches.findIndex((match) => !isMatchComplete(match)),
    [orderedMatches]
  );

  const selectedMatch = useMemo(() => {
    if (!selectedMatchKey) return null;
    return orderedMatches.find((match, index) => {
      const key = String(match.key || `${match.comp_level}-${match.match_number}-${index}`);
      return key === selectedMatchKey;
    }) || null;
  }, [orderedMatches, selectedMatchKey]);


  useEffect(() => {
    if (orderedMatches.length === 0) return;

    const targetIndex = nextMatchIndex >= 0 ? nextMatchIndex : 0;
    const target = cardRefs.current[targetIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [orderedMatches, nextMatchIndex]);

  useEffect(() => {
    if (orderedMatches.length === 0) {
      setSelectedMatchKey(null);
      setSelectedMatchTeam(null);
      setTeamDetails({});
      setIsEditingStrategy(false);
      return;
    }

    // Clear selection only if the selected match is no longer in the list
    if (selectedMatchKey !== null) {
      const stillValid = orderedMatches.some((match, index) => {
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
  }, [orderedMatches, selectedMatchKey]);

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
      <div className="sticky top-[60px] z-30 rounded-xl border border-gray-100 bg-white/95 p-2.5 shadow-sm backdrop-blur sm:top-[64px] sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {TEAM_OPTIONS.map((team) => (
              <button
                key={team.number}
                type="button"
                onClick={() => setSelectedTeam(team.number)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 sm:py-2 sm:text-sm ${
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 sm:px-3 sm:py-2 sm:text-sm"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 sm:text-sm">
          <Calendar size={13} className="text-gray-500 sm:h-[15px] sm:w-[15px]" />
          <span>
            {selectedCompetition.name} ({selectedCompetition.season})
          </span>
        </div>

      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-400">Loading matches...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : orderedMatches.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-500">
          No matches found for team {selectedTeam}.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Click a match row to open match details
          </div>

          <div className="space-y-2 sm:space-y-3">
              {orderedMatches.map((match, index) => {
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
                    className={`rounded-xl border p-2.5 sm:p-4 transition-all ${
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
                      <div className="mb-1.5 flex items-center justify-between sm:mb-2">
                        <div className="text-xs font-black text-gray-800 sm:text-sm">{getMatchLabel(match)}</div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px] ${
                            completed ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {completed ? 'Completed' : 'Next'}
                        </span>
                      </div>
                      <div className="mb-2 text-[11px] text-gray-500 sm:mb-3 sm:text-xs">{getMatchTime(match)}</div>

                      <div className="grid grid-cols-2 gap-2 text-xs sm:gap-3 sm:text-sm">
                        <div>
                          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-red-600 sm:text-[11px]">Red</div>
                          <div className="space-y-1">
                            {redTeams.map((team) => (
                              <div
                                key={`red-${matchKey}-${team}`}
                                className={`rounded px-1.5 py-0.5 sm:px-2 sm:py-1 ${
                                  team === selectedTeam ? 'bg-red-200 font-bold text-red-900' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {team}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-blue-600 sm:text-[11px]">Blue</div>
                          <div className="space-y-1">
                            {blueTeams.map((team) => (
                              <div
                                key={`blue-${matchKey}-${team}`}
                                className={`rounded px-1.5 py-0.5 sm:px-2 sm:py-1 ${
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
                  const superscouterRaw = selectedMatchTeam ? selectedCompetition.superscouterNotes?.[selectedMatchTeam] : undefined;
                  const superscouter = parseSuperscouterEntry(superscouterRaw);

                  // Statbotics v3 wraps values in {mean, sd} objects; v2 uses plain numbers
                  const readEpa = (val: unknown): number | null => {
                    if (typeof val === 'number') return val;
                    if (val && typeof val === 'object') {
                      const mean = (val as Record<string, unknown>).mean;
                      if (typeof mean === 'number') return mean;
                    }
                    return null;
                  };

                  const autoPathStatsFromForms = (() => {
                    if (!selectedMatchTeam) return [] as Array<{ label: string; counts: Record<string, number>; options: string[]; totalResponses: number; type: string }>;
                    const normalizedTeam = normalizeTeamNumber(selectedMatchTeam);
                    if (!normalizedTeam) return [] as Array<{ label: string; counts: Record<string, number>; options: string[]; totalResponses: number; type: string }>;

                    const summaries: Array<{ label: string; counts: Record<string, number>; options: string[]; totalResponses: number; type: string }> = [];

                    scoutingForms.forEach((form) => {
                      const teamFieldId = resolveTeamFieldId(form);
                      if (teamFieldId === null) return;

                      const autoPathFields = form.fields.filter((field) => autoPathFieldRegex.test(field.label));
                      if (autoPathFields.length === 0) return;

                      const formSubs = scoutingSubmissions.filter((sub) => (
                        sub.formId === form.id
                        && normalizeTeamNumber(sub.data?.[teamFieldId]) === normalizedTeam
                      ));

                      autoPathFields.forEach((field) => {
                        const counts: Record<string, number> = {};
                        let totalResponses = 0;

                        formSubs.forEach((sub) => {
                          const raw = sub.data?.[field.id];
                          if (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return;
                          totalResponses += 1;

                          if (field.type === 'multiple_select' && Array.isArray(raw)) {
                            raw.forEach((option) => {
                              const key = String(option);
                              counts[key] = (counts[key] || 0) + 1;
                            });
                            return;
                          }

                          if (field.type === 'rank_order' && Array.isArray(raw)) {
                            const compact = raw
                              .map((item) => String(item ?? '').trim())
                              .filter((item) => item !== '');
                            if (compact.length > 0) {
                              const rankingString = compact.join(' > ');
                              counts[rankingString] = (counts[rankingString] || 0) + 1;
                            }
                            return;
                          }

                          const key = String(raw);
                          counts[key] = (counts[key] || 0) + 1;
                        });

                        const options = field.type === 'rank_order'
                          ? Object.keys(counts).sort((a, b) => counts[b] - counts[a])
                          : (field.options && field.options.length > 0 ? field.options : Object.keys(counts));

                        summaries.push({
                          label: field.label,
                          counts,
                          options,
                          totalResponses,
                          type: field.type,
                        });
                      });
                    });

                    return summaries;
                  })();

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
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-1">
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Teleop</div>
                          <div className="font-bold text-gray-800">{readEpa(breakdown?.teleop_points) !== null ? readEpa(breakdown?.teleop_points)!.toFixed(1) : 'N/A'}</div>
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Superscouter Notes</div>
                          {superscouter.notes ? (
                            <div className="mt-1 whitespace-pre-wrap text-xs text-gray-800">{superscouter.notes}</div>
                          ) : (
                            <div className="mt-1 text-xs text-gray-500">No superscouter notes yet.</div>
                          )}
                          {superscouter.rating !== null && (
                            <div className="mt-1 text-xs font-semibold text-gray-700">Rating: {superscouter.rating}/5</div>
                          )}
                        </div>
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Auto Path Statistics</div>
                          <div className="mt-1 text-[10px] text-gray-500">
                            From scouter form submissions (unofficial, not field-official data).
                          </div>
                          {autoPathStatsFromForms.length > 0 ? (
                            <div className="mt-2 space-y-3">
                              {autoPathStatsFromForms.map((summary) => (
                                <div key={summary.label} className="rounded border border-gray-200 bg-white p-2">
                                  <div className="mb-2 text-[11px] font-black text-gray-700">{summary.label}</div>
                                  <div className="space-y-1.5">
                                    {summary.options.map((item) => {
                                      const count = summary.counts[item] || 0;
                                      const percentage = summary.totalResponses > 0
                                        ? ((count / summary.totalResponses) * 100).toFixed(1)
                                        : '0';

                                      return (
                                        <div
                                          key={`${summary.label}-${item}`}
                                          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                          <span className="text-xs break-words text-gray-700">{item}</span>
                                          <div className="flex items-center gap-2 sm:min-w-[10rem]">
                                            <div className="h-2 flex-1 rounded-full bg-gray-200 sm:w-24 sm:flex-none">
                                              <div
                                                className="h-2 rounded-full bg-blue-600"
                                                style={{ width: `${percentage}%` }}
                                              />
                                            </div>
                                            <span className="min-w-[3rem] text-right text-xs font-medium text-gray-600">
                                              {count} ({percentage}%)
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-gray-500">No auto path scouting data available for this team.</div>
                          )}
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
