import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList } from 'lucide-react';
import { formApi, statboticsApi, tbaApi } from '../services/api';
import type { Competition, GeneratedAssignment } from '../types/competition.types';
import type { Form, Submission } from '../types/form.types';

type TbaMatchTeams = {
  red: string[];
  blue: string[];
};

type UnfinishedAssignment = {
  assignment: GeneratedAssignment;
  teamNumber: string | null;
  resolvable: boolean;
  status: 'missing' | 'pending';
};

const matchFieldRegex = /match( number| #|#|num| no\.?|)/i;
const teamFieldRegex = /team( number| #|#|num| no\.?|)/i;

const normalizeTeam = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.toLowerCase().startsWith('frc')) {
    const trimmed = text.replace(/^frc/i, '').trim();
    return trimmed || null;
  }
  const digits = text.match(/\d+/)?.[0];
  return digits || null;
};

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

const parsePosition = (position: string): { alliance: 'red' | 'blue'; slot: number } | null => {
  const m = position.match(/^(red|blue)(\d)$/i);
  if (!m) return null;
  return {
    alliance: m[1].toLowerCase() as 'red' | 'blue',
    slot: parseInt(m[2], 10) - 1,
  };
};

const assignmentKey = (matchNumber: number, teamNumber: string) => `${matchNumber}-${teamNumber}`;

const getFieldId = (form: Form, regex: RegExp): string | null => {
  const field = form.fields.find((f) => regex.test(f.label));
  if (!field) return null;
  return String(field.id);
};

const buildDoneKeySet = (forms: Form[], submissions: Submission[]): Set<string> => {
  const teamFieldByForm = new Map<string, string | null>();
  const matchFieldByForm = new Map<string, string | null>();

  forms.forEach((form) => {
    const teamFieldId = form.teamNumberFieldId != null
      ? String(form.teamNumberFieldId)
      : getFieldId(form, teamFieldRegex);
    const matchFieldId = getFieldId(form, matchFieldRegex);

    teamFieldByForm.set(form.id, teamFieldId);
    matchFieldByForm.set(form.id, matchFieldId);
  });

  const done = new Set<string>();
  submissions.forEach((submission) => {
    const teamFieldId = teamFieldByForm.get(submission.formId);
    const matchFieldId = matchFieldByForm.get(submission.formId);
    if (!teamFieldId || !matchFieldId) return;

    const teamNumber = normalizeTeam(submission.data?.[teamFieldId]);
    const matchNumber = parseMatchNumber(submission.data?.[matchFieldId]);
    if (!teamNumber || matchNumber == null) return;

    done.add(assignmentKey(matchNumber, teamNumber));
  });

  return done;
};

const buildTbaMatchMap = (rows: unknown[]): Map<number, TbaMatchTeams> => {
  const map = new Map<number, TbaMatchTeams>();

  rows.forEach((row) => {
    const data = row as {
      key?: unknown;
      match_number?: unknown;
      alliances?: {
        red?: { team_keys?: unknown[] };
        blue?: { team_keys?: unknown[] };
      };
    };

    const key = typeof data.key === 'string' ? data.key : '';
    if (key && !key.includes('_qm')) return;

    const matchNumber = typeof data.match_number === 'number'
      ? data.match_number
      : (key ? parseMatchNumber(key) : null);

    if (matchNumber == null) return;

    const red = (data.alliances?.red?.team_keys ?? [])
      .map((teamKey) => normalizeTeam(teamKey))
      .filter((team): team is string => Boolean(team));

    const blue = (data.alliances?.blue?.team_keys ?? [])
      .map((teamKey) => normalizeTeam(teamKey))
      .filter((team): team is string => Boolean(team));

    map.set(matchNumber, { red, blue });
  });

  return map;
};

const resolveAssignmentTeam = (
  assignment: GeneratedAssignment,
  tbaMatches: Map<number, TbaMatchTeams>,
): string | null => {
  const parsed = parsePosition(assignment.position);
  if (!parsed) return null;

  const matchTeams = tbaMatches.get(assignment.matchNumber);
  if (!matchTeams) return null;

  const teams = parsed.alliance === 'red' ? matchTeams.red : matchTeams.blue;
  return teams[parsed.slot] ?? null;
};

export const UnfinishedAssignments: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unfinished, setUnfinished] = useState<UnfinishedAssignment[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [liveQualMatch, setLiveQualMatch] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!selectedCompetition) {
        setUnfinished([]);
        setDoneCount(0);
        return;
      }

      const assignments = selectedCompetition.scoutingAssignments ?? [];
      if (assignments.length === 0) {
        setUnfinished([]);
        setDoneCount(0);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [forms, tbaRows, statboticsRows] = await Promise.all([
          formApi.getFormsByCompetition(selectedCompetition.id),
          selectedCompetition.eventKey
            ? tbaApi.getEventMatches(selectedCompetition.eventKey)
            : Promise.resolve([] as unknown[]),
          selectedCompetition.eventKey
            ? statboticsApi.getEventMatches(selectedCompetition.eventKey)
            : Promise.resolve([] as unknown[]),
        ]);

        const submissionLists = await Promise.all(forms.map((form) => formApi.getSubmissions(form.id)));
        const submissions = submissionLists.flat();

        const doneKeys = buildDoneKeySet(forms, submissions);
        const tbaMatches = buildTbaMatchMap(tbaRows);
        const qualRows = statboticsRows
          .map((row) => row as { comp_level?: unknown; key?: unknown; match_number?: unknown; status?: unknown })
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

        const firstOpenQual = qualRows.find((row) => row.status !== 'completed');
        const nextLiveMatch = firstOpenQual?.matchNumber ?? null;
        setLiveQualMatch(nextLiveMatch);

        const unfinishedAssignments: UnfinishedAssignment[] = [];
        let resolvedDoneCount = 0;

        assignments.forEach((assignment) => {
          const status = nextLiveMatch != null && assignment.matchNumber < nextLiveMatch
            ? 'missing'
            : 'pending';
          const teamNumber = resolveAssignmentTeam(assignment, tbaMatches);
          if (!teamNumber) {
            unfinishedAssignments.push({ assignment, teamNumber: null, resolvable: false, status });
            return;
          }

          const key = assignmentKey(assignment.matchNumber, teamNumber);
          const isDone = doneKeys.has(key);

          if (isDone) {
            resolvedDoneCount += 1;
          } else {
            unfinishedAssignments.push({ assignment, teamNumber, resolvable: true, status });
          }
        });

        setDoneCount(resolvedDoneCount);
        setUnfinished(unfinishedAssignments.sort((a, b) => {
          if (a.assignment.matchNumber !== b.assignment.matchNumber) {
            return a.assignment.matchNumber - b.assignment.matchNumber;
          }
          const aPos = a.assignment.position;
          const bPos = b.assignment.position;
          return aPos.localeCompare(bPos);
        }));
      } catch (err) {
        console.error('Error loading unfinished assignments:', err);
        setError('Failed to compute unfinished assignments. Please refresh or try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedCompetition]);

  const totalAssignments = selectedCompetition?.scoutingAssignments?.length ?? 0;

  const unresolvedCount = useMemo(
    () => unfinished.filter((item) => !item.resolvable).length,
    [unfinished],
  );

  const missingCount = useMemo(
    () => unfinished.filter((item) => item.status === 'missing').length,
    [unfinished],
  );

  const pendingCount = useMemo(
    () => unfinished.filter((item) => item.status === 'pending').length,
    [unfinished],
  );

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
        <p>No active competition selected</p>
      </div>
    );
  }

  if (totalAssignments === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
        <p>No scouting assignments generated yet.</p>
        <p className="text-sm text-gray-400">Generate a scouting schedule first in the Scouting Teams tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-lg font-bold text-gray-900">Unfinished Assignments</h3>
        <p className="text-sm text-gray-500 mt-1">
          Completion is based on submission match number + team number compared against scheduled assignments.
        </p>

        {liveQualMatch != null && (
          <p className="text-sm text-gray-500 mt-1">
            Live counter is currently on match {liveQualMatch}. Earlier unfinished matches are marked missing.
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
            <div className="text-xs font-black uppercase tracking-wide text-blue-500">Total</div>
            <div className="text-xl font-black text-blue-700">{totalAssignments}</div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
            <div className="text-xs font-black uppercase tracking-wide text-emerald-500">Done</div>
            <div className="text-xl font-black text-emerald-700">{doneCount}</div>
          </div>
          <div className="rounded-lg bg-rose-50 p-3 border border-rose-100">
            <div className="text-xs font-black uppercase tracking-wide text-rose-500">Missing</div>
            <div className="text-xl font-black text-rose-700">{missingCount}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
            <div className="text-xs font-black uppercase tracking-wide text-amber-500">Pending</div>
            <div className="text-xl font-black text-amber-700">{pendingCount}</div>
          </div>
        </div>

        {unresolvedCount > 0 && (
          <p className="mt-3 text-xs font-semibold text-amber-700">
            {unresolvedCount} unfinished assignments could not resolve a team number from event match data.
          </p>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-400 font-semibold">Loading unfinished assignments...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-start gap-2">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : unfinished.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={20} />
          <span className="font-semibold">All assignments appear completed.</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Match</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">Position</th>
                  <th className="px-4 py-3 text-left">Scouting Team</th>
                  <th className="px-4 py-3 text-left">Scouters</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {unfinished.map((item) => (
                  <tr key={`${item.assignment.matchNumber}-${item.assignment.position}-${item.assignment.teamId}`} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold text-gray-800">{item.assignment.matchNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{item.teamNumber ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-600 uppercase">{item.assignment.position}</td>
                    <td className="px-4 py-3 text-gray-700">{item.assignment.teamName}</td>
                    <td className="px-4 py-3 text-gray-600">{item.assignment.scouts.join(', ') || '—'}</td>
                    <td className="px-4 py-3">
                      {!item.resolvable ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          Team unresolved
                        </span>
                      ) : item.status === 'missing' ? (
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          Missing submission
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          Pending submission
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
