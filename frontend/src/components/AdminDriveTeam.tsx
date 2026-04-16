import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Competition } from '../types/competition.types';
import { competitionApi, statboticsApi } from '../services/api';

type AdminDriveTeamProps = {
  selectedCompetition: Competition | null;
  onCompetitionUpdate: () => void;
};

const normalizeTeamNumber = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';
  const text = String(raw).trim();
  if (!text) return '';
  if (text.toLowerCase().startsWith('frc')) return text.replace(/^frc/i, '').trim();
  const digits = text.match(/\d+/)?.[0];
  return digits ?? '';
};

export const AdminDriveTeam: React.FC<AdminDriveTeamProps> = ({ selectedCompetition, onCompetitionUpdate }) => {
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pitLocations, setPitLocations] = useState<Record<string, string>>({});
  const [pitDrafts, setPitDrafts] = useState<Record<string, string>>({});
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!selectedCompetition?.pitLocations) {
      setPitLocations({});
      return;
    }
    setPitLocations(selectedCompetition.pitLocations);
  }, [selectedCompetition?.pitLocations]);

  useEffect(() => {
    setPitDrafts((prev) => {
      const next: Record<string, string> = {};
      teams.forEach((team) => {
        next[team] = prev[team] ?? pitLocations[team] ?? '';
      });
      return next;
    });
  }, [teams, pitLocations]);

  useEffect(() => {
    const loadTeams = async () => {
      if (!selectedCompetition?.eventKey) {
        setTeams([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const roster = await statboticsApi.getEventTeams(selectedCompetition.eventKey);
        const parseTeamNumber = (value: unknown): string => {
          if (typeof value === 'string' || typeof value === 'number') {
            return normalizeTeamNumber(value);
          }

          if (value && typeof value === 'object') {
            const row = value as Record<string, unknown>;
            return normalizeTeamNumber(row.team ?? row.team_number ?? row.key ?? row.teamKey ?? row.team_key);
          }

          return '';
        };

        const rosterTeams = Array.isArray(roster)
          ? roster
              .map(parseTeamNumber)
              .filter(Boolean)
          : [];

        const uniqueTeams = Array.from(new Set(rosterTeams)).sort((a, b) => Number(a) - Number(b));

        if (uniqueTeams.length > 0) {
          setTeams(uniqueTeams);
        } else {
          const matches = await statboticsApi.getEventMatches(selectedCompetition.eventKey);
          const matchTeams = Array.isArray(matches)
            ? Array.from(
                new Set(
                  matches.flatMap((match) => {
                    if (!match || typeof match !== 'object') return [];
                    const row = match as Record<string, unknown>;
                    const alliances = row.alliances as Record<string, unknown> | undefined;
                    const red = (row.red ?? alliances?.red ?? row.alliance_red ?? []) as unknown[];
                    const blue = (row.blue ?? alliances?.blue ?? row.alliance_blue ?? []) as unknown[];
                    return [
                      ...Array.isArray(red) ? red.map(parseTeamNumber).filter(Boolean) : [],
                      ...Array.isArray(blue) ? blue.map(parseTeamNumber).filter(Boolean) : [],
                    ];
                  })
                )
              ).sort((a, b) => Number(a) - Number(b))
            : [];
          setTeams(matchTeams);
        }
      } catch {
        setError('Could not load teams for this event.');
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [selectedCompetition?.eventKey, reloadToken]);

  const savePitLocationForTeam = async (team: string) => {
    if (!selectedCompetition?.id) return;

    setSaveError('');
    setSavingTeam(team);

    try {
      const value = (pitDrafts[team] ?? '').trim();
      const nextLocations = { ...pitLocations };

      if (value) {
        nextLocations[team] = value;
      } else {
        delete nextLocations[team];
      }

      await competitionApi.update(selectedCompetition.id, { pitLocations: nextLocations });
      setPitLocations(nextLocations);
      setPitDrafts((prev) => ({ ...prev, [team]: value }));
      onCompetitionUpdate();
    } catch {
      setSaveError('Could not save pit location.');
    } finally {
      setSavingTeam(null);
    }
  };

  if (!selectedCompetition) {
    return <div className="p-10 text-center text-gray-500">No active competition selected.</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Drive Team Pit Locations</h2>
            <p className="text-sm text-gray-500">Assign pit locations for every team in the event.</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            <RefreshCw size={14} />
            Reload Teams
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">Loading teams...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : teams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No teams found for this event.
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => (
              <div key={team} className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Team {team}</div>
                  <div className="text-xs text-gray-500">Current: {pitLocations[team] ?? 'Not assigned'}</div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={pitDrafts[team] ?? ''}
                    onChange={(event) => setPitDrafts((prev) => ({ ...prev, [team]: event.target.value }))}
                    placeholder="A1, B3"
                    className="min-w-[10rem] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => savePitLocationForTeam(team)}
                    disabled={savingTeam === team}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingTeam === team ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {saveError && <div className="mt-3 text-sm text-red-600">{saveError}</div>}
      </div>
    </div>
  );
};
