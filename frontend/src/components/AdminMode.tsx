import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, FileText, BarChart, Users, ClipboardList, Edit3, Save, X, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Trophy, UserCog, Search, Plus } from 'lucide-react';
import { CompetitionManager } from './CompetitionManager';
import { FormManager } from './FormManager';
import { ResponseViewer } from './ResponseViewer';
import { TeamLookup } from './TeamLookup';
import { MatchSchedule, type PinnedScheduleMatch } from './MatchSchedule';
import { UnfinishedAssignments } from './UnfinishedAssignments';
import { ScoutingTeams } from './ScoutingTeams';
import { PickListManager } from './PickListManager';
import { ManageUsers } from './ManageUsers';
import { AdminDriveTeam } from './AdminDriveTeam';
import { authApi, competitionApi, formApi, statboticsApi, tbaApi } from '../services/api';
import { matchesTeamQuery } from '../utils/teamNameSearch';
import type { Competition } from '../types/competition.types';
import type { Form, Submission } from '../types/form.types';

type AdminTab = 'competitions' | 'forms' | 'scoutingTeams' | 'analytics' | 'superscout' | 'driveTeam' | 'picklists' | 'manageUsers';
type AnalyticsTab = 'responses' | 'teamLookup' | 'schedule' | 'unfinishedAssignments';

const ADMIN_ACTIVE_TAB_STORAGE_KEY = 'adminMode.activeTab';
const ADMIN_ANALYTICS_TAB_STORAGE_KEY = 'adminMode.analyticsTab';

const isAdminTab = (value: unknown): value is AdminTab => (
  value === 'competitions'
  || value === 'forms'
  || value === 'scoutingTeams'
  || value === 'analytics'
  || value === 'superscout'
  || value === 'driveTeam'
  || value === 'picklists'
  || value === 'manageUsers'
);

const isAnalyticsTab = (value: unknown): value is AnalyticsTab => (
  value === 'responses'
  || value === 'teamLookup'
  || value === 'schedule'
  || value === 'unfinishedAssignments'
);

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
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return 'competitions';
    try {
      const raw = sessionStorage.getItem(ADMIN_ACTIVE_TAB_STORAGE_KEY);
      return isAdminTab(raw) ? raw : 'competitions';
    } catch {
      return 'competitions';
    }
  });
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>(() => {
    if (typeof window === 'undefined') return 'responses';
    try {
      const raw = sessionStorage.getItem(ADMIN_ANALYTICS_TAB_STORAGE_KEY);
      return isAnalyticsTab(raw) ? raw : 'responses';
    } catch {
      return 'responses';
    }
  });
  const [activeCompetition, setActiveCompetition] = useState<Competition | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(ADMIN_ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // Ignore storage failures.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem(ADMIN_ANALYTICS_TAB_STORAGE_KEY, analyticsTab);
    } catch {
      // Ignore storage failures.
    }
  }, [analyticsTab]);

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
  const [superscoutTeamNames, setSuperscoutTeamNames] = useState<Record<string, string>>({});
  const [pinnedMatches, setPinnedMatches] = useState<PinnedScheduleMatch[]>([]);
  const [pinnedRailOpen, setPinnedRailOpen] = useState(false);
  const [teamBankTeams, setTeamBankTeams] = useState<string[]>([]);
  const [teamBankRailOpen, setTeamBankRailOpen] = useState(false);
  const [teamBankSearch, setTeamBankSearch] = useState('');
  const hasLoadedPinsForCompetition = useRef(false);
  const hasLoadedTeamBankForCompetition = useRef(false);

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

  useEffect(() => {
    hasLoadedPinsForCompetition.current = false;

    if (!activeCompetition?.id) {
      setPinnedMatches([]);
      return;
    }

    const loadPinnedMatches = async () => {
      // Keep legacy local pins as a fallback in case account sync fails.
      const storageKey = `adminPinnedMatches:${activeCompetition.id}`;
      const parseLocalPins = () => {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) return [] as PinnedScheduleMatch[];
          const parsed = JSON.parse(raw) as PinnedScheduleMatch[];
          if (!Array.isArray(parsed)) return [] as PinnedScheduleMatch[];
          return parsed.filter((item) => (
            item
            && typeof item.key === 'string'
            && typeof item.label === 'string'
            && Array.isArray(item.redTeams)
            && Array.isArray(item.blueTeams)
          ));
        } catch {
          return [] as PinnedScheduleMatch[];
        }
      };

      try {
        const accountPins = await authApi.getPinnedMatches(activeCompetition.id);
        if (Array.isArray(accountPins)) {
          setPinnedMatches(accountPins);
        } else {
          setPinnedMatches([]);
        }
      } catch {
        setPinnedMatches(parseLocalPins());
      } finally {
        hasLoadedPinsForCompetition.current = true;
      }
    };

    loadPinnedMatches();
  }, [activeCompetition?.id]);

  useEffect(() => {
    if (!activeCompetition?.id || !hasLoadedPinsForCompetition.current) return;

    const persistPinnedMatches = async () => {
      const storageKey = `adminPinnedMatches:${activeCompetition.id}`;
      try {
        await authApi.savePinnedMatches(activeCompetition.id, pinnedMatches);
        // Keep local copy as backup cache.
        localStorage.setItem(storageKey, JSON.stringify(pinnedMatches));
      } catch {
        // Fallback: still persist locally if account sync fails.
        try {
          localStorage.setItem(storageKey, JSON.stringify(pinnedMatches));
        } catch {
          // Ignore storage failures.
        }
      }
    };

    persistPinnedMatches();
  }, [activeCompetition?.id, pinnedMatches]);

  useEffect(() => {
    hasLoadedTeamBankForCompetition.current = false;

    if (!activeCompetition?.id) {
      setTeamBankTeams([]);
      return;
    }

    const loadTeamBank = async () => {
      try {
        const teams = await authApi.getTeamBank(activeCompetition.id);
        setTeamBankTeams(Array.isArray(teams) ? teams.map((team) => String(team).trim()).filter(Boolean) : []);
      } catch {
        setTeamBankTeams([]);
      } finally {
        hasLoadedTeamBankForCompetition.current = true;
      }
    };

    loadTeamBank();
  }, [activeCompetition?.id]);

  useEffect(() => {
    if (!activeCompetition?.id || !hasLoadedTeamBankForCompetition.current) return;

    const persistTeamBank = async () => {
      try {
        await authApi.saveTeamBank(activeCompetition.id, teamBankTeams);
      } catch {
        // Ignore sync failures here so UI remains responsive.
      }
    };

    persistTeamBank();
  }, [activeCompetition?.id, teamBankTeams]);

  // ── load team names from TBA for name-based search ──────────────────────
  useEffect(() => {
    if (!activeCompetition?.eventKey) {
      setSuperscoutTeamNames({});
      return;
    }
    const loadTeamNames = async () => {
      try {
        const teams = await tbaApi.getEventTeams(activeCompetition.eventKey!) as Array<Record<string, unknown>>;
        const names: Record<string, string> = {};
        for (const t of teams) {
          const num = String(t.team_number ?? '').trim();
          const nick = String(t.nickname ?? '').trim();
          if (num && nick) names[num] = nick;
        }
        setSuperscoutTeamNames(names);
      } catch {
        // Non-critical — search still works by number
      }
    };
    loadTeamNames();
  }, [activeCompetition?.eventKey]);

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
    const q = superscoutSearch.trim();
    if (!q) return rankedTeams;
    return rankedTeams.filter(t => matchesTeamQuery(t.team, superscoutTeamNames[t.team] ?? '', q));
  }, [rankedTeams, superscoutSearch, superscoutTeamNames]);

  const teamBankSuggestions = useMemo(() => {
    const query = teamBankSearch.trim();
    if (!query) return [] as Array<{ team: string; nickname: string }>;

    return Object.entries(superscoutTeamNames)
      .map(([team, nickname]) => ({ team, nickname }))
      .filter((row) => !teamBankTeams.includes(row.team))
      .filter((row) => matchesTeamQuery(row.team, row.nickname, query))
      .sort((a, b) => Number(a.team) - Number(b.team))
      .slice(0, 12);
  }, [superscoutTeamNames, teamBankSearch, teamBankTeams]);

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

  const handleScheduleTeamLookup = (team: string) => {
    setTargetTeam(team);
    const td = superscoutTeams.find(t => t.team === team);
    setScouterNotes(td?.notes ?? '');
    setActiveTab('analytics');
    setAnalyticsTab('teamLookup');
  };

  const handlePinMatch = (match: PinnedScheduleMatch) => {
    setPinnedMatches((prev) => {
      if (prev.some((item) => item.key === match.key)) return prev;
      return [match, ...prev].slice(0, 20);
    });
  };

  const handleUnpinMatch = (matchKey: string) => {
    setPinnedMatches((prev) => prev.filter((item) => item.key !== matchKey));
  };

  const addTeamToBank = (team: string) => {
    setTeamBankTeams((prev) => {
      if (prev.includes(team)) return prev;
      return [...prev, team].sort((a, b) => Number(a) - Number(b));
    });
    setTeamBankSearch('');
  };

  const removeTeamFromBank = (team: string) => {
    setTeamBankTeams((prev) => prev.filter((value) => value !== team));
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
            ['driveTeam', ClipboardList, 'Drive Team'],
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
        {activeTab === 'driveTeam' && (
          <AdminDriveTeam selectedCompetition={activeCompetition} onCompetitionUpdate={handleCompetitionUpdate} />
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
          <div className="relative">
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
                  isAdminMode
                />
              )}
              {analyticsTab === 'schedule' && (
                <MatchSchedule
                  selectedCompetition={activeCompetition}
                  onTeamLookup={handleScheduleTeamLookup}
                  pinnedMatchKeys={pinnedMatches.map((match) => match.key)}
                  onPinMatch={handlePinMatch}
                  onUnpinMatch={handleUnpinMatch}
                />
              )}
              {analyticsTab === 'unfinishedAssignments' && (
                <UnfinishedAssignments selectedCompetition={activeCompetition} />
              )}
            </div>

            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setTeamBankRailOpen((prev) => !prev)}
        className={`hidden xl:flex fixed top-1/2 z-50 -translate-y-1/2 h-12 w-7 items-center justify-center rounded-r-lg bg-white border border-l-0 border-gray-200 shadow-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-[left] duration-300 ease-out ${
          teamBankRailOpen ? 'left-[280px]' : 'left-0'
        }`}
        title={teamBankRailOpen ? 'Hide team bank' : 'Show team bank'}
      >
        {teamBankRailOpen ? <ChevronLeft size={16} className="mx-auto" /> : <ChevronRight size={16} className="mx-auto" />}
      </button>

      <aside
        className={`hidden xl:block fixed left-0 top-1/2 z-40 -translate-y-1/2 w-[280px] transition-transform duration-300 ease-out ${
          teamBankRailOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
        }`}
        aria-hidden={!teamBankRailOpen}
      >
        <div className="bg-white rounded-r-xl border border-gray-100 shadow-sm p-3 max-h-[calc(100vh-7rem)] overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-700">Team Bank</h3>
            {teamBankTeams.length > 0 && (
              <button
                type="button"
                onClick={() => setTeamBankTeams([])}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>

          {!activeCompetition?.eventKey ? (
            <p className="text-xs text-amber-700">
              Set an event key on the active competition to search and add teams.
            </p>
          ) : (
            <div className="mb-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Add Team</label>
              <div className="mt-1 rounded-lg border border-gray-200 bg-white">
                <div className="px-2 py-1.5 border-b border-gray-100">
                  <input
                    type="text"
                    value={teamBankSearch}
                    onChange={(e) => setTeamBankSearch(e.target.value)}
                    placeholder="Search # or name"
                    className="w-full text-sm bg-transparent outline-none"
                  />
                </div>
                {teamBankSearch.trim() && (
                  <div className="max-h-40 overflow-y-auto">
                    {teamBankSuggestions.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-gray-500">No matching teams.</p>
                    ) : (
                      teamBankSuggestions.map((row) => (
                        <div key={row.team} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-gray-50">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-blue-700">{row.team}</div>
                            <div className="text-[11px] text-gray-500 truncate">{row.nickname}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addTeamToBank(row.team)}
                            className="inline-flex items-center justify-center rounded bg-blue-600 text-white h-6 w-6 hover:bg-blue-700"
                            title={`Add team ${row.team}`}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {teamBankTeams.length === 0 ? (
            <p className="text-xs text-gray-500">
              Team bank is empty. Search above and click + to add teams.
            </p>
          ) : (
            <div className="space-y-2 overflow-y-auto pr-1 max-h-[calc(100vh-16rem)]">
              {teamBankTeams.map((team) => (
                <div key={team} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => handleScheduleTeamLookup(team)}
                    className="min-w-0 text-left"
                    title={`Open team ${team} in Team Lookup`}
                  >
                    <div className="text-sm font-black text-blue-700 hover:underline">{team}</div>
                    {superscoutTeamNames[team] && (
                      <div className="text-[11px] text-gray-500 truncate">{superscoutTeamNames[team]}</div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTeamFromBank(team)}
                    className="inline-flex items-center justify-center rounded bg-gray-200 text-gray-600 h-6 w-6 hover:bg-red-100 hover:text-red-700"
                    title={`Remove team ${team}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setPinnedRailOpen((prev) => !prev)}
        className={`hidden xl:flex fixed top-1/2 z-50 -translate-y-1/2 h-12 w-7 items-center justify-center rounded-l-lg bg-white border border-r-0 border-gray-200 shadow-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-[right] duration-300 ease-out ${
          pinnedRailOpen ? 'right-[280px]' : 'right-0'
        }`}
        title={pinnedRailOpen ? 'Hide pinned matches' : 'Show pinned matches'}
      >
        {pinnedRailOpen ? <ChevronRight size={16} className="mx-auto" /> : <ChevronLeft size={16} className="mx-auto" />}
      </button>

      <aside
        className={`hidden xl:block fixed right-0 top-1/2 z-40 -translate-y-1/2 w-[280px] transition-transform duration-300 ease-out ${
          pinnedRailOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={!pinnedRailOpen}
      >
        <div className="bg-white rounded-l-xl border border-gray-100 shadow-sm p-3 max-h-[calc(100vh-7rem)] overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-700">Pinned Matches</h3>
            {pinnedMatches.length > 0 && (
              <button
                type="button"
                onClick={() => setPinnedMatches([])}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>

          {pinnedMatches.length === 0 ? (
            <p className="text-xs text-gray-500">
              Pin matches in Schedule to quick-open team lookups from anywhere in Admin mode.
            </p>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1 max-h-[calc(100vh-11.5rem)]">
              {pinnedMatches.map((match) => (
                <div key={match.key} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs font-black uppercase tracking-wider text-gray-700">{match.label}</div>
                    <button
                      type="button"
                      onClick={() => handleUnpinMatch(match.key)}
                      className="text-[11px] font-semibold text-gray-500 hover:text-red-600"
                    >
                      Unpin
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Red</div>
                      <div className="flex flex-wrap gap-1.5">
                        {match.redTeams.map((team) => (
                          <button
                            key={`desktop-red-${match.key}-${team}`}
                            type="button"
                            onClick={() => handleScheduleTeamLookup(team)}
                            className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200"
                          >
                            {team}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Blue</div>
                      <div className="flex flex-wrap gap-1.5">
                        {match.blueTeams.map((team) => (
                          <button
                            key={`desktop-blue-${match.key}-${team}`}
                            type="button"
                            onClick={() => handleScheduleTeamLookup(team)}
                            className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200"
                          >
                            {team}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
