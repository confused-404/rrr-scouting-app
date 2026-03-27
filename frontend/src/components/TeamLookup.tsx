import React, { useEffect, useState, useMemo } from 'react';
import type { Competition } from '../types/competition.types';
import type { Form, Submission, FormField, PictureFieldValue } from '../types/form.types';
import { formApi, tbaApi, statboticsApi } from '../services/api';
import { BarChart3, ClipboardList, Zap } from 'lucide-react';
import { submissionValueToText, isPictureFieldValue } from '../utils/formValues';
import { ImageLightbox } from './ImageLightbox';

// reuse helpers from ResponseViewer
const isQuantitative = (field: FormField) => field.type === 'number' || field.type === 'ranking';
const toNumber = (v: unknown) => (v === '' || v === null || v === undefined) ? null : Number(v);
const teamFieldRegex = /team|team number|team #/i;

const normalizeTeamNumber = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;

  if (text.startsWith('frc')) {
    return text.replace(/^frc/i, '').trim();
  }

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

interface TeamLookupProps {
  selectedCompetition?: Competition | null;
  superscoutNotes?: string;
  targetTeam?: string;
}

export const TeamLookup: React.FC<TeamLookupProps> = ({
  selectedCompetition,
  superscoutNotes,
  targetTeam,
}) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  const [teamQuery, setTeamQuery] = useState('');
  const [teamInfo, setTeamInfo] = useState<unknown | null>(null);
  const [expandedImage, setExpandedImage] = useState<PictureFieldValue | null>(null);

  // Teleop balls state (per-match data)
  const [teleopPerMatch, setTeleopPerMatch] = useState<Array<{ value: number; matchNum: string; isCompleted: boolean }>>([]);
  const [teleopBallsLoading, setTeleopBallsLoading] = useState(false);
  const [teleopBallsError, setTeleopBallsError] = useState('');

  const searchTeam = async (rawTeam: string) => {
    const q = rawTeam.trim();
    if (!q) {
      setTeamInfo(null);
      return;
    }

    if (!/^\d+$/.test(q)) {
      alert('Please enter a numeric team number');
      return;
    }

    try {
      const key = `frc${q}`;
      const data = await tbaApi.getTeam(key);
      setTeamInfo(data);
    } catch (err) {
      console.error('team lookup error', err);
      setTeamInfo(null);
    }

    // Also fetch teleop balls if we have an event key
    await fetchTeleopBalls(q);
  };

  const fetchTeleopBalls = async (teamNum: string) => {
    const eventKey = selectedCompetition?.eventKey?.trim().toLowerCase();
    if (!eventKey || !teamNum) {
      setTeleopPerMatch([]);
      setTeleopBallsError('');
      return;
    }

    setTeleopBallsLoading(true);
    setTeleopBallsError('');
    setTeleopPerMatch([]);

    try {
      // Fetch per-match data
      const rows = await statboticsApi.getTeamMatches({ team: teamNum, event: eventKey, limit: 999 }) as Array<Record<string, unknown>>;
      
      // Extract teleop_points from each match and track completion status
      const matches: Array<{ value: number; matchNum: string; isCompleted: boolean }> = [];
      for (const row of rows) {
        const matchName = String(row.match ?? 'Unknown');
        const status = String(row.status ?? 'Upcoming');
        const epa = (row.epa as Record<string, unknown>) ?? {};
        const breakdown = (epa.breakdown as Record<string, unknown>) ?? {};
        const teleopPoints = typeof breakdown.teleop_points === 'number' ? breakdown.teleop_points : 0;
        const isCompleted = status === 'Completed';
        matches.push({ value: teleopPoints, matchNum: matchName, isCompleted });
      }
      
      // Sort matches numerically by match number (e.g., qm1, qm7, qm17)
      matches.sort((a, b) => {
        const aNum = parseInt(a.matchNum.match(/\d+$/)?.[0] ?? '0', 10);
        const bNum = parseInt(b.matchNum.match(/\d+$/)?.[0] ?? '0', 10);
        return aNum - bNum;
      });
      
      if (matches.length === 0) {
        setTeleopBallsError('No match data found for this team at the current event.');
      } else {
        setTeleopPerMatch(matches);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setTeleopBallsError('No Statbotics data found for this team at the current event.');
      } else {
        setTeleopBallsError('Could not load teleop ball data from Statbotics.');
      }
      setTeleopPerMatch([]);
    } finally {
      setTeleopBallsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompetition) {
      loadAllData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetition?.id]);

  const loadAllData = async () => {
    if (!selectedCompetition) return;
    setLoading(true);
    try {
      const loadedForms = await formApi.getFormsByCompetition(selectedCompetition.id);
      setForms(loadedForms);

      const allSubs: Submission[] = [];
      for (const form of loadedForms) {
        const subs = await formApi.getSubmissions(form.id);
        allSubs.push(...subs);
      }
      setAllSubmissions(allSubs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTeamQuery('');
    setTeamInfo(null);
    setTeleopPerMatch([]);
    setTeleopBallsError('');
  }, [selectedCompetition?.id]);

  const filteredSubs = useMemo(() => {
    const normalizedQuery = normalizeTeamNumber(teamQuery);
    if (!normalizedQuery) return [];

    const matched: Submission[] = [];
    forms.forEach((form) => {
      const teamFieldId = resolveTeamFieldId(form);
      if (teamFieldId === null) return;

      const formSubs = allSubmissions.filter((sub) => sub.formId === form.id);
      formSubs.forEach((sub) => {
        const teamValue = normalizeTeamNumber(sub.data?.[teamFieldId]);
        if (teamValue === normalizedQuery) {
          matched.push(sub);
        }
      });
    });

    return matched;
  }, [allSubmissions, forms, teamQuery]);

  const stats = useMemo(() => {
    const fieldStats: Record<string, { key: string; field: FormField; vals: number[] }> = {};
    forms.forEach(form => {
      const formSubs = filteredSubs.filter((sub) => sub.formId === form.id);
      form.fields.filter(isQuantitative).forEach(field => {
        const statKey = `${form.id}:${field.id}`;
        if (!fieldStats[statKey]) {
          fieldStats[statKey] = { key: statKey, field, vals: [] };
        }
        formSubs.forEach(sub => {
          const val = toNumber(sub.data?.[field.id]);
          if (val !== null && !isNaN(val)) {
            fieldStats[statKey].vals.push(val);
          }
        });
      });
    });
    return Object.values(fieldStats).map(({ key, field, vals }) => {
      const avg = vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
      return { key, field, mean: avg.toFixed(2), count: vals.length };
    });
  }, [forms, filteredSubs]);

  const qualitativeSummary = useMemo(() => {
    const summary: Record<string, { type: FormField['type']; data: unknown }> = {};

    forms.forEach(form => {
      const formSubs = filteredSubs.filter((sub) => sub.formId === form.id);
      form.fields.forEach(field => {
        if (!isQuantitative(field)) {
          const fieldKey = `${form.id}|${field.label}|${field.id}`;

          if (field.type === 'picture') {
            const photos: PictureFieldValue[] = [];
            formSubs.forEach(sub => {
              const val = sub.data?.[field.id];
              if (isPictureFieldValue(val)) {
                photos.push(val);
              }
            });
            summary[fieldKey] = { type: field.type, data: photos };

          } else if (field.type === 'multiple_choice') {
            const counts: Record<string, number> = {};
            formSubs.forEach(sub => {
              const val = sub.data?.[field.id];
              if (val !== undefined && val !== null && val !== '') {
                const key = String(val);
                counts[key] = (counts[key] || 0) + 1;
              }
            });
            summary[fieldKey] = { type: field.type, data: { counts, options: field.options || [], totalResponses: formSubs.length } };

          } else if (field.type === 'multiple_select') {
            const counts: Record<string, number> = {};
            formSubs.forEach(sub => {
              const val = sub.data?.[field.id];
              if (Array.isArray(val)) {
                val.forEach(option => {
                  counts[String(option)] = (counts[String(option)] || 0) + 1;
                });
              }
            });
            summary[fieldKey] = { type: field.type, data: { counts, options: field.options || [], totalResponses: formSubs.length } };

          } else if (field.type === 'rank_order') {
            const counts: Record<string, number> = {};
            formSubs.forEach(sub => {
              const val = sub.data?.[field.id];
              if (Array.isArray(val) && val.length > 0) {
                const compact = val
                  .map((item) => String(item ?? '').trim())
                  .filter((item) => item !== '');
                if (compact.length > 0) {
                  const rankingString = compact.join(' > ');
                  counts[rankingString] = (counts[rankingString] || 0) + 1;
                }
              }
            });
            summary[fieldKey] = { type: field.type, data: { counts, options: field.options || [], totalResponses: formSubs.length } };

          } else {
            const values = new Set<string>();
            formSubs.forEach(sub => {
              const raw = sub.data?.[field.id];
              if (raw !== undefined && raw !== null && raw !== '') {
                const text = submissionValueToText(raw);
                values.add(text);
              }
            });
            summary[fieldKey] = { type: field.type, data: Array.from(values) };
          }
        }
      });
    });
    return summary;
  }, [forms, filteredSubs]);

  const handleSearch = async () => {
    await searchTeam(teamQuery);
  };

  useEffect(() => {
    const incomingTeam = targetTeam?.trim() || '';
    if (!incomingTeam) return;
    if (incomingTeam !== teamQuery.trim()) {
      setTeamQuery(incomingTeam);
    }
    searchTeam(incomingTeam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTeam, selectedCompetition?.eventKey]);

  // Only show notes if the current search query matches the team the notes belong to
  const showNotes = superscoutNotes && teamQuery.trim() === targetTeam?.trim();

  if (!selectedCompetition) return <div className="p-10 text-center text-gray-400">No active competition selected</div>;

  const teamInfoTyped = teamInfo as { nickname?: string; team_number?: number; city?: string; state_prov?: string; country?: string } | null;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {expandedImage && (
        <ImageLightbox
          imageUrl={expandedImage.url}
          imageAlt={expandedImage.name || 'Team photo'}
          imageName={expandedImage.name}
          onClose={() => setExpandedImage(null)}
        />
      )}

      {/* Team search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center">
        <input
          placeholder="Team number..."
          value={teamQuery}
          onChange={e => setTeamQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          className="flex-1 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
        />
        <button onClick={handleSearch} className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all">
          Search
        </button>
      </div>

      {teamInfoTyped && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="font-black text-lg">{teamInfoTyped.nickname || teamInfoTyped.team_number}</div>
          <div className="text-sm text-gray-600">{teamInfoTyped.team_number && `#${teamInfoTyped.team_number}`}</div>
          {teamInfoTyped.city && (
            <div className="text-sm text-gray-600">
              {teamInfoTyped.city}, {teamInfoTyped.state_prov || teamInfoTyped.country}
            </div>
          )}
        </div>
      )}

      {/* ── TELEOP BALLS (Statbotics) ── */}
      {teamQuery.trim() && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-orange-50 border-b border-orange-100">
            <Zap size={16} className="text-orange-500" />
            <span className="font-black text-xs uppercase tracking-widest text-orange-700">
              Teleop EPA Per Match — Statbotics
            </span>
          </div>

          <div className="p-5 space-y-4">
            {!selectedCompetition.eventKey ? (
              <p className="text-sm text-gray-500 italic">
                Set an event key on this competition to enable Statbotics lookups.
              </p>
            ) : teleopBallsLoading ? (
              <p className="text-sm text-gray-400 animate-pulse">Loading teleop data…</p>
            ) : teleopBallsError ? (
              <p className="text-sm text-amber-700">{teleopBallsError}</p>
            ) : teleopPerMatch.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No match data available for this team / event.
              </p>
            ) : (
              <>
                {/* Per-Match Breakdown */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Per-Match Breakdown:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {teleopPerMatch.map((m, idx) => (
                      <div
                        key={idx}
                        className={`border p-2 rounded-lg text-center ${
                          m.isCompleted
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="text-[10px] text-gray-600 font-bold truncate">{m.matchNum}</div>
                        <div className={`text-lg font-black ${m.isCompleted ? 'text-orange-600' : 'text-gray-400'}`}>
                          {m.isCompleted ? m.value.toFixed(1) : '--'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* NEW: Superscouter Notes Section */}
      {showNotes && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-amber-800 font-black uppercase text-xs tracking-widest">
            <ClipboardList size={18} /> Superscouter Insight
          </div>
          <div className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed font-medium">
            {superscoutNotes}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center font-black text-gray-300 animate-pulse tracking-widest uppercase">Fetching Data...</div>
      ) : (
        <>
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.key} className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg border-b-4 border-blue-800">
                <div className="flex items-center gap-2 mb-2 opacity-80 uppercase text-[10px] font-black tracking-widest">
                  <BarChart3 size={14} /> {s.field.label}
                </div>
                <div className="text-3xl font-black">{s.mean}</div>
                <div className="text-[10px] mt-1 opacity-60 font-bold uppercase tracking-tight">
                  Average of {s.count} responses
                </div>
              </div>
            ))}
          </div>

          {/* Qualitative summary */}
          {Object.keys(qualitativeSummary).length > 0 && (
            <div className="space-y-4">
              {Object.entries(qualitativeSummary).map(([fieldKey, summary]) => {
                const [, label] = fieldKey.split('|');

                if (summary.type === 'picture') {
                  const photos = summary.data as PictureFieldValue[];
                  return (
                    <div key={fieldKey} className="bg-white p-4 rounded-lg shadow">
                      <div className="font-black text-sm mb-3">{label}</div>
                      <div className="text-sm text-gray-600 mb-3">
                        {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
                      </div>
                      {photos.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {photos.map((photo, index) => (
                            <div key={index}>
                              <button
                                type="button"
                                onClick={() => setExpandedImage(photo)}
                                className="block w-full overflow-hidden rounded-lg"
                                aria-label={`Expand ${photo.name || `photo ${index + 1}`}`}
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.name || `Photo ${index + 1}`}
                                  className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 text-center py-8">No photos uploaded yet</div>
                      )}
                    </div>
                  );
                } else if (
                  summary.type === 'multiple_choice' ||
                  summary.type === 'multiple_select' ||
                  summary.type === 'rank_order'
                ) {
                  const { counts, options, totalResponses } = summary.data as {
                    counts: Record<string, number>;
                    options: string[];
                    totalResponses: number;
                  };
                  const displayItems =
                    summary.type === 'rank_order'
                      ? Object.keys(counts).sort((a, b) => counts[b] - counts[a])
                      : options;

                  return (
                    <div key={fieldKey} className="bg-white p-4 rounded-lg shadow">
                      <div className="font-black text-sm mb-3">{label}</div>
                      <div className="space-y-2">
                        {displayItems.map((item: string) => {
                          const count = counts[item] || 0;
                          const percentage =
                            totalResponses > 0 ? ((count / totalResponses) * 100).toFixed(1) : '0';

                          return (
                            <div
                              key={item}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2"
                            >
                              <span className="text-sm break-words">{item}</span>
                              <div className="flex items-center gap-2 sm:min-w-[11rem]">
                                <div className="flex-1 sm:flex-none sm:w-24 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-600 min-w-[3rem] text-right">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  const values = summary.data as string[];
                  return (
                    <div key={fieldKey} className="bg-white p-4 rounded-lg shadow">
                      <div className="font-black text-sm mb-2">{label}</div>
                      <div className="text-sm text-gray-600 mb-2">
                        {values.length} unique response{values.length !== 1 ? 's' : ''}
                      </div>
                      <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto">
                        {values.slice(0, 10).map(v => <li key={v}>{v}</li>)}
                        {values.length > 10 && (
                          <li className="text-gray-500">... and {values.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeamLookup;
