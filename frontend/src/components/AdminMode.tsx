import React, { useState, useEffect, useMemo } from 'react';
import { Settings, FileText, BarChart, Users, ClipboardList, Edit3, Save, X, Star, ChevronDown, ChevronUp, Trophy, UserCog, Search } from 'lucide-react';
import { CompetitionManager } from './CompetitionManager';
import { FormManager } from './FormManager';
import { ResponseViewer } from './ResponseViewer';
import { TeamLookup } from './TeamLookup';
import { MatchSchedule } from './MatchSchedule';
import { UnfinishedAssignments } from './UnfinishedAssignments';
import { ScoutingTeams } from './ScoutingTeams';
import { PickListManager } from './PickListManager';
import { ManageUsers } from './ManageUsers';
import { competitionApi, formApi, statboticsApi } from '../services/api';
import type { Competition } from '../types/competition.types';
import type { Form, Submission } from '../types/form.types';

type AdminTab = 'competitions' | 'forms' | 'scoutingTeams' | 'analytics' | 'superscout' | 'picklists' | 'manageUsers';
type AnalyticsTab = 'responses' | 'teamLookup' | 'schedule' | 'unfinishedAssignments';

// ─── climbing points by answer ───────────────────────────────────────────────
const CLIMB_POINTS: Record<string, number> = {
  'L1': 10,
  'L2': 20,
  'L3': 30,
  // handle case-insensitive / alternate spellings
  'l1': 10,
  'l2': 20,
  'l3': 30,
  'Level 1': 10,
  'Level 2': 20,
  'Level 3': 30,
};

// ─── helpers ─────────────────────────────────────────────────────────────────
const normalizeTeam = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.startsWith('frc')) return text.replace(/^frc/i, '').trim();
  const digits = text.match(/\d+/)?.[0];
  return digits || null;
};

const teamFieldRegex = /team|team number|team #/i;
const climbWhereRegex = /where did they climb|climb level|climb position/i;

const asNumberOrNull = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const parseLegacySuperscoutEntry = (raw: unknown): { notes: string; rating: number | null } => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as { notes?: unknown; rating?: unknown };
      if (parsed && typeof parsed === 'object') {
        return {
          notes: typeof parsed.notes === 'string' ? parsed.notes : '',
          rating: asNumberOrNull(parsed.rating),
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
      rating: asNumberOrNull(parsed.rating),
    };
  }

  return { notes: '', rating: null };
};

// ─── types ───────────────────────────────────────────────────────────────────
interface TeamSuperscoutData {
  team: string;
  /** Superscouter's manual rating 1–5 */
  rating: number | null;
  notes: string;
  /** Average climb points per match from scouting submissions */
  avgClimbPoints: number;
  /** Number of scouted matches */
  matchCount: number;
  /** Timestamps of matches (for last-N filtering) */
  matchTimestamps: number[];
  /** Climb points per match in order */
  climbPointsPerMatch: number[];
  /** teleop EPA from statbotics (null if not loaded yet) */
  teleopEpa: number | null;
  /** auto EPA from statbotics (null if not loaded yet) */
  autoEpa: number | null;
  /** Per-match teleop EPA values in chronological order */
  teleopPerMatch: number[];
  /** Per-match auto EPA values in chronological order */
  autoPerMatch: number[];
  /** Per-match endgame EPA values in chronological order */
  endgamePerMatch: number[];
}

/** Compute score for a team given last-N-matches window */
const computeScore = (
  team: TeamSuperscoutData,
  lastN: number,
): number => {
  const hasPerMatch = team.teleopPerMatch.length > 0 || team.autoPerMatch.length > 0;
  if (team.matchCount === 0 && !hasPerMatch) return 0;

  const slice = (arr: number[]) => lastN === 0 ? arr : arr.slice(-lastN);
  const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgTeleop = hasPerMatch ? avg(slice(team.teleopPerMatch)) : (team.teleopEpa ?? 0);
  const avgAuto = hasPerMatch ? avg(slice(team.autoPerMatch)) : (team.autoEpa ?? 0);
  const avgEndgame = hasPerMatch ? avg(slice(team.endgamePerMatch)) : 0;

  const avgClimb = avg(slice(team.climbPointsPerMatch));

  return avgTeleop + avgAuto + avgEndgame + avgClimb;
};

export const AdminMode: React.FC<{ onCompetitionUpdate?: () => void }> = ({ onCompetitionUpdate }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('responses');
  const [activeCompetition, setActiveCompetition] = useState<Competition | null>(null);

  // ── analytics team state (shared between superscouter & analytics tab) ──
  const [targetTeam, setTargetTeam] = useState('');
  // "live" superscouter notes for the current targetTeam (used in TeamLookup)
  const [scouterNotes, setScouterNotes] = useState('');

  // ── superscouter list state ───────────────────────────────────────────────
  const [superscoutTeams, setSuperscoutTeams] = useState<TeamSuperscoutData[]>([]);
  const [superscoutLoading, setSuperscoutLoading] = useState(false);
  const [lastN, setLastN] = useState<number>(0); // 0 = all matches
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState('');
  const [draftRating, setDraftRating] = useState<string>('');
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [epaLoadingTeams] = useState<Set<string>>(new Set());
  const [localRating, setLocalRating] = useState<string>('');
  const [superscoutSearch, setSuperscoutSearch] = useState('');

  // ── load active competition ───────────────────────────────────────────────
  useEffect(() => {
    const loadActiveCompetition = async () => {
      try {
        const comp = await competitionApi.getActive();
        setActiveCompetition(comp);
      } catch (error) {
        console.error('Error loading active competition:', error);
      }
    };
    loadActiveCompetition();
  }, []);

  // ── load superscouter data whenever competition changes ───────────────────
  useEffect(() => {
    if (activeTab === 'superscout' && activeCompetition) {
      loadSuperscoutData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeCompetition?.id, activeCompetition?.eventKey]);

  const loadSuperscoutData = async () => {
    if (!activeCompetition) return;
    setSuperscoutLoading(true);

    try {
      // 1. Load all forms + submissions for this competition
      const forms: Form[] = await formApi.getFormsByCompetition(activeCompetition.id);
      const allSubs: Submission[] = [];
      for (const form of forms) {
        const subs = await formApi.getSubmissions(form.id);
        allSubs.push(...subs);
      }

      // 2. Identify relevant fields across all forms
      const teamFieldMap = new Map<string, number>(); // formId → field.id
      const climbWhereMap = new Map<string, number>(); // formId → field.id
      for (const form of forms) {
        const teamField = form.fields.find(f => teamFieldRegex.test(f.label));
        const climbWhere = form.fields.find(f => climbWhereRegex.test(f.label));
        if (teamField) teamFieldMap.set(form.id, teamField.id);
        if (climbWhere) climbWhereMap.set(form.id, climbWhere.id);
      }

      // 3. Aggregate submissions by team
      const byTeam = new Map<string, { climbPoints: number[]; timestamps: number[] }>();

      for (const sub of allSubs) {
        const teamFieldId = teamFieldMap.get(sub.formId);
        if (!teamFieldId) continue;

        const team = normalizeTeam(sub.data?.[teamFieldId]);
        if (!team) continue;

        if (!byTeam.has(team)) byTeam.set(team, { climbPoints: [], timestamps: [] });
        const agg = byTeam.get(team)!;

        // timestamp — use sub.timestamp (ISO string) converted to ms
        const ts = sub.timestamp ? new Date(sub.timestamp).getTime() : 0;
        agg.timestamps.push(ts);

        // climb points
        const climbWhereId = climbWhereMap.get(sub.formId);
        let climbPts = 0;
        if (climbWhereId) {
          const climbVal = String(sub.data?.[climbWhereId] ?? '').trim();
          climbPts = CLIMB_POINTS[climbVal] ?? 0;
        }
        agg.climbPoints.push(climbPts);
      }

      // 4. Load existing superscouter notes from competition
      const existingNotes: Record<string, { notes: string; rating: number | null }> = {};
      const noteKeys = Object.keys(activeCompetition.superscouterNotes || {});
      for (const teamNum of noteKeys) {
        const raw = (activeCompetition.superscouterNotes as Record<string, unknown>)?.[teamNum];
        existingNotes[teamNum] = parseLegacySuperscoutEntry(raw);
      }

      // 5. Build team list — union of scouted teams + teams with existing notes
      const allTeams = new Set<string>([
        ...byTeam.keys(),
        ...Object.keys(existingNotes),
      ]);

      const teamList: TeamSuperscoutData[] = Array.from(allTeams).map(team => {
        const agg = byTeam.get(team);
        const noteData = existingNotes[team] ?? { notes: '', rating: null };

        // sort by timestamp so last-N is chronologically meaningful
        const paired = (agg?.timestamps ?? []).map((ts, i) => ({
          ts,
          climb: agg!.climbPoints[i],
        })).sort((a, b) => a.ts - b.ts);

        return {
          team,
          rating: noteData.rating,
          notes: noteData.notes,
          avgClimbPoints: paired.length === 0
            ? 0
            : paired.reduce((s, p) => s + p.climb, 0) / paired.length,
          matchCount: paired.length,
          matchTimestamps: paired.map(p => p.ts),
          climbPointsPerMatch: paired.map(p => p.climb),
          teleopEpa: null,
          autoEpa: null,
          teleopPerMatch: [],
          autoPerMatch: [],
          endgamePerMatch: [],
        };
      });

      setSuperscoutTeams(teamList);

      // 6. Load per-match EPA for all teams from Statbotics in one bulk request
      if (activeCompetition.eventKey) {
        const eventKey = activeCompetition.eventKey.trim().toLowerCase();
        loadPerMatchStatsForEvent(eventKey);
      }
    } catch (err) {
      console.error('Error loading superscouter data:', err);
    } finally {
      setSuperscoutLoading(false);
    }
  };

  const toggleExpand = (team: string, currentRating: number | null) => {
    if (expandedTeam === team) {
      setExpandedTeam(null);
    } else {
      setExpandedTeam(team);
      // Sync the input field to the team's actual rating when opening
      setLocalRating(currentRating != null ? String(currentRating) : '');
    }
  };

  const loadPerMatchStatsForEvent = async (eventKey: string) => {
    try {
      const rows = await statboticsApi.getTeamMatches({ event: eventKey, limit: 999 }) as Array<Record<string, unknown>>;

      // Group rows by team number
      const byTeam = new Map<string, Array<{ time: number; teleop: number; auto: number; endgame: number }>>();

      for (const row of rows) {
        const teamNum = String(row.team);
        const epaObj = (row.epa as Record<string, unknown>) ?? {};
        const breakdown = (epaObj.breakdown as Record<string, unknown>) ?? {};
        const teleop = typeof breakdown.teleop_points === 'number' ? breakdown.teleop_points : 0;
        const auto = typeof breakdown.auto_points === 'number' ? breakdown.auto_points : 0;
        const endgame = typeof breakdown.endgame_points === 'number' ? breakdown.endgame_points : 0;
        const time = typeof row.time === 'number' ? row.time : 0;

        if (!byTeam.has(teamNum)) byTeam.set(teamNum, []);
        byTeam.get(teamNum)!.push({ time, teleop, auto, endgame });
      }

      // Sort each team's rows chronologically and push into state
      setSuperscoutTeams(prev => prev.map(t => {
        const matchData = (byTeam.get(t.team) ?? []).sort((a, b) => a.time - b.time);
        if (matchData.length === 0) return t;
        const last = matchData[matchData.length - 1];
        return {
          ...t,
          teleopPerMatch: matchData.map(m => m.teleop),
          autoPerMatch: matchData.map(m => m.auto),
          endgamePerMatch: matchData.map(m => m.endgame),
          // Keep scalar fields updated for display (most recent match value)
          teleopEpa: last.teleop,
          autoEpa: last.auto,
        };
      }));
    } catch (err) {
      console.error('Error loading per-match Statbotics data:', err);
      // Fall back silently — teams still rank using scouting climb data
    }
  };

  // ── ranked teams for superscouter list ───────────────────────────────────
  const rankedTeams = useMemo(() => {
    return [...superscoutTeams].sort((a, b) => {
      const sa = computeScore(a, lastN);
      const sb = computeScore(b, lastN);
      return sb - sa;
    });
  }, [superscoutTeams, lastN]);

  const filteredTeams = useMemo(() => {
    const q = superscoutSearch.trim().toLowerCase();
    if (!q) return rankedTeams;
    return rankedTeams.filter(t => t.team.toLowerCase().includes(q));
  }, [rankedTeams, superscoutSearch]);

  // ── save superscouter notes + rating ─────────────────────────────────────
  const saveTeamSuperscout = async (team: string, notes: string, rating: number | null) => {
    if (!activeCompetition) return;
    setSavingTeam(team);
    try {
      // Store as object with both notes and rating
      const payload = { notes, rating };
      await competitionApi.saveSuperscouterNotes(activeCompetition.id, team, JSON.stringify(payload));

      setSuperscoutTeams(prev =>
        prev.map(t => t.team === team ? { ...t, notes, rating } : t)
      );

      // If this is the currently viewed team in analytics, sync live notes
      if (team === targetTeam) setScouterNotes(notes);

      setEditingTeam(null);
    } catch (err) {
      console.error('Error saving superscouter data:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSavingTeam(null);
    }
  };

  const handleRatingChange = async (team: string, newRating: number | null) => {
    const td = superscoutTeams.find(t => t.team === team);
    if (!td || !activeCompetition) return;
    await saveTeamSuperscout(team, td.notes, newRating);
  };

  const startEditing = (td: TeamSuperscoutData) => {
    setEditingTeam(td.team);
    setDraftNotes(td.notes);
    setDraftRating(td.rating != null ? String(td.rating) : '');
  };

  const cancelEditing = () => setEditingTeam(null);

  const commitEdit = async (team: string) => {
    const rating = draftRating !== '' ? parseFloat(draftRating) : null;
    const clampedRating = rating != null ? Math.min(5, Math.max(1, rating)) : null;
    await saveTeamSuperscout(team, draftNotes, clampedRating);
  };

  // ── competition update helper ─────────────────────────────────────────────
  const handleCompetitionUpdate = () => {
    const reload = async () => {
      try {
        const comp = await competitionApi.getActive();
        setActiveCompetition(comp);
      } catch (error) {
        console.error('Error loading active competition:', error);
      }
    };
    reload();
    if (onCompetitionUpdate) onCompetitionUpdate();
  };

  const handlePickListTeamSelect = (team: string) => {
    setTargetTeam(team);
    setActiveTab('analytics');
    setAnalyticsTab('teamLookup');
  };

  const handleSuperscoutTeamClick = (team: string) => {
    setTargetTeam(team);
    const td = superscoutTeams.find(t => t.team === team);
    setScouterNotes(td?.notes ?? '');
    setActiveTab('analytics');
    setAnalyticsTab('teamLookup');
  };

  // ── star rating widget ────────────────────────────────────────────────────
  const StarRating: React.FC<{ team: string; rating: number | null; disabled?: boolean }> = ({
    team, rating, disabled,
  }) => {
    const [hovered, setHovered] = useState<number | null>(null);
    const display = hovered ?? rating ?? 0;

    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(val => (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHovered(val)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => !disabled && handleRatingChange(team, rating === val ? null : val)}
            className="focus:outline-none disabled:cursor-not-allowed"
            title={`Rate ${val}/5`}
          >
            <Star
              size={18}
              className={`transition-colors ${
                display >= val
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {rating != null && (
          <span className="ml-1 text-xs font-bold text-gray-500">{rating}/5</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main Navigation */}
      <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100 flex gap-2 overflow-x-auto">
        {(
          [
            ['competitions', Settings, 'Competitions'],
            ['forms', FileText, 'Forms'],
            ['scoutingTeams', Users, 'Scouting Teams'],
            ['analytics', BarChart, 'Analytics'],
            ['superscout', ClipboardList, 'Superscouter'],
            ['picklists', ClipboardList, 'Pick Lists'],
            ['manageUsers', UserCog, 'Manage Users'],
          ] as const
        ).map(([tab, Icon, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as AdminTab)}
            className={`flex-1 min-w-[150px] px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide whitespace-nowrap transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon size={16} />
            <span className="text-center">{label}</span>
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'competitions' && <CompetitionManager onCompetitionUpdate={handleCompetitionUpdate} />}
        {activeTab === 'forms' && (
          <FormManager selectedCompetition={activeCompetition} onCompetitionUpdate={handleCompetitionUpdate} />
        )}
        {activeTab === 'scoutingTeams' && <ScoutingTeams selectedCompetition={activeCompetition} />}
        {activeTab === 'picklists' && (
          <PickListManager
            selectedCompetition={activeCompetition}
            onCompetitionUpdate={handleCompetitionUpdate}
            onTeamSelect={handlePickListTeamSelect}
          />
        )}
        {activeTab === 'manageUsers' && (
          <ManageUsers selectedCompetition={activeCompetition} />
        )}

        {/* ══════════════════════════════════════════════════════════
            SUPERSCOUTER TAB
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'superscout' && (
          <div className="space-y-4">
            {/* Header + controls */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Superscouter Command Center</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Teams ranked by Teleop EPA + Auto EPA + Avg Climb Points
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={superscoutSearch}
                      onChange={e => setSuperscoutSearch(e.target.value)}
                      placeholder="Search team…"
                      className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-40"
                    />
                    {superscoutSearch && (
                      <button
                        onClick={() => setSuperscoutSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={loadSuperscoutData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Last-N control */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Rank by last
                  </label>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 5, 8].map(n => (
                      <button
                        key={n}
                        onClick={() => setLastN(n)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          lastN === n
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {n === 0 ? 'All' : `${n}M`}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={lastN === 0 ? '' : lastN}
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        if (!isNaN(v) && v > 0) setLastN(v);
                      }}
                      placeholder="N"
                      className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {lastN === 0 ? 'matches (all competition)' : `matches`}
                  </span>
                </div>

                {!activeCompetition?.eventKey && (
                  <p className="text-xs text-amber-600 font-bold">
                    ⚠ Set an event key to enable Statbotics EPA scores
                  </p>
                )}
              </div>
            </div>

            {/* Team list */}
            {superscoutLoading ? (
              <div className="bg-white rounded-xl p-16 text-center text-gray-300 font-black uppercase tracking-widest animate-pulse">
                Loading teams…
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="bg-white rounded-xl p-16 text-center text-gray-400 border-2 border-dashed">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-20" />
                {superscoutSearch ? (
                  <p className="font-bold">No teams match &ldquo;{superscoutSearch}&rdquo;.</p>
                ) : (
                  <>
                    <p className="font-bold">No scouted teams yet.</p>
                    <p className="text-sm text-gray-400">Submit scouting forms or add notes below to populate this list.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTeams.map((td) => {
                  const rank = rankedTeams.findIndex(t => t.team === td.team);
                  const score = computeScore(td, lastN);
                  const allScore = computeScore(td, 0);
                  const isExpanded = expandedTeam === td.team;
                  const isEditing = editingTeam === td.team;
                  const epaLoading = epaLoadingTeams.has(td.team);

                  return (
                    <div
                      key={td.team}
                      className={`bg-white rounded-xl shadow-sm border transition-all ${
                        isExpanded ? 'border-blue-200 shadow-md' : 'border-gray-100 hover:border-blue-100'
                      }`}
                    >
                      {/* Row header */}
                      <div className="flex items-center gap-3 p-4">
                        {/* Rank badge */}
                        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          rank === 0 ? 'bg-yellow-400 text-yellow-900' :
                          rank === 1 ? 'bg-gray-300 text-gray-700' :
                          rank === 2 ? 'bg-amber-600 text-white' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {rank === 0 ? <Trophy size={16} /> : `#${rank + 1}`}
                        </div>

                        {/* Team number */}
                        <button
                          onClick={() => handleSuperscoutTeamClick(td.team)}
                          className="text-blue-700 font-black text-lg hover:underline"
                          title="View in Team Lookup"
                        >
                          {td.team}
                        </button>

                        {/* Score pill */}
                        <div className="flex items-center gap-2 ml-1">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black">
                            {score.toFixed(1)} pts
                            <span className="text-blue-400 font-normal ml-1">
                              ({lastN === 0 ? 'all' : `last ${lastN}`})
                            </span>
                          </span>
                          {lastN !== 0 && (
                            <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold">
                              {allScore.toFixed(1)} all
                            </span>
                          )}
                        </div>

                        {/* EPA chips */}
                        {epaLoading ? (
                          <span className="text-xs text-gray-300 animate-pulse">loading EPA…</span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {td.teleopEpa != null && (
                              <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-black uppercase tracking-wider">
                                T {td.teleopEpa.toFixed(1)}
                              </span>
                            )}
                            {td.autoEpa != null && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-black uppercase tracking-wider">
                                A {td.autoEpa.toFixed(1)}
                              </span>
                            )}
                            {td.matchCount > 0 && (
                              <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-black uppercase tracking-wider">
                                C {td.avgClimbPoints.toFixed(1)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Star rating — always visible */}
                        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                          <StarRating team={td.team} rating={td.rating} disabled={isEditing} />
                          <button
                            onClick={() => toggleExpand(td.team, td.rating)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4 space-y-3">
                          {/* Match stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Matches</div>
                              <div className="text-xl font-black text-gray-700">{td.matchCount}</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">Teleop EPA</div>
                              <div className="text-xl font-black text-orange-600">
                                {td.teleopEpa != null ? td.teleopEpa.toFixed(1) : '—'}
                              </div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-purple-400">Auto EPA</div>
                              <div className="text-xl font-black text-purple-600">
                                {td.autoEpa != null ? td.autoEpa.toFixed(1) : '—'}
                              </div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-green-400">Avg Climb</div>
                              <div className="text-xl font-black text-green-600">
                                {td.matchCount > 0 ? td.avgClimbPoints.toFixed(1) : '—'}
                              </div>
                            </div>
                          </div>

                          {/* Exact rating input */}
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                              Exact Rating (1-5)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              step={0.1}
                              value={localRating}
                              onChange={e => setLocalRating(e.target.value)}
                              onBlur={() => {
                                if (localRating === '') {
                                  handleRatingChange(td.team, null);
                                  return;
                                }

                                const num = parseFloat(localRating);
                                if (!isNaN(num)) {
                                  const clamped = Math.min(5, Math.max(1, num));
                                  handleRatingChange(td.team, clamped);
                                }
                              }}
                              placeholder="e.g. 4.5"
                              className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>

                          {/* Notes section */}
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={draftNotes}
                                onChange={e => setDraftNotes(e.target.value)}
                                rows={5}
                                className="w-full border-2 border-blue-100 rounded-xl p-3 text-sm resize-none focus:border-blue-500 outline-none bg-blue-50/20"
                                placeholder="Superscouter notes…"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => commitEdit(td.team)}
                                  disabled={savingTeam === td.team}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                  <Save size={14} />
                                  {savingTeam === td.team ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 flex items-center gap-2"
                                >
                                  <X size={14} /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div
                                className="min-h-[60px] p-3 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => startEditing(td)}
                              >
                                {td.notes || (
                                  <span className="text-gray-400 italic">Click to add notes…</span>
                                )}
                              </div>
                              <button
                                onClick={() => startEditing(td)}
                                className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold"
                              >
                                <Edit3 size={12} /> Edit notes
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            ANALYTICS TAB
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="bg-gray-100 rounded-lg p-2 flex gap-2">
              <button
                onClick={() => setAnalyticsTab('responses')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsTab === 'responses' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
              >
                Responses
              </button>
              <button
                onClick={() => setAnalyticsTab('teamLookup')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsTab === 'teamLookup' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
              >
                Team Lookup
              </button>
              <button
                onClick={() => setAnalyticsTab('schedule')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsTab === 'schedule' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
              >
                Schedule
              </button>
              <button
                onClick={() => setAnalyticsTab('unfinishedAssignments')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsTab === 'unfinishedAssignments' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
              >
                Unfinished
              </button>
            </div>

            <div>
              {analyticsTab === 'responses' && (
                <ResponseViewer selectedCompetition={activeCompetition} />
              )}
              {analyticsTab === 'teamLookup' && (
                <TeamLookup
                  selectedCompetition={activeCompetition}
                  superscoutNotes={scouterNotes}
                  targetTeam={targetTeam}
                />
              )}
              {analyticsTab === 'schedule' && (
                <MatchSchedule selectedCompetition={activeCompetition} />
              )}
              {analyticsTab === 'unfinishedAssignments' && (
                <UnfinishedAssignments selectedCompetition={activeCompetition} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
