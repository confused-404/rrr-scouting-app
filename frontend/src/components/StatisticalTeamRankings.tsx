import { useEffect, useMemo, useState } from 'react';
import { formApi, gameProfileApi, statboticsApi, tbaApi } from '../services/api';
import type { Competition } from '../types/competition.types';
import type { ConfigMetric, GameProfile } from '../types/game-profile.types';
import type { Form, Submission } from '../types/form.types';
import { scoreTeamsForEquation } from '../utils/statisticalRankings';

const normalizeTeam = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.replace(/^frc/i, '').match(/\d+/)?.[0] || null;
};
const numberValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const teamFieldId = (form: Form): number | undefined => typeof form.teamNumberFieldId === 'number'
  && Number.isInteger(form.teamNumberFieldId)
  ? form.teamNumberFieldId
  : form.fields.find((field) => /team|team number|team #/i.test(field.label))?.id;
const fieldMetric = (metric: ConfigMetric) => metric.source === 'scout'
  ? /^form-(.+)-field-(\d+)$/.exec(metric.sourceKey)
  : null;
const aggregate = (values: number[], metric: ConfigMetric) => {
  if (!values.length) return null;
  if (metric.aggregation === 'total') return values.reduce((sum, value) => sum + value, 0);
  if (metric.aggregation === 'latest') return values.at(-1) ?? null;
  if (metric.aggregation === 'success_rate') return values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const StatisticalTeamRankings: React.FC<{ selectedCompetition: Competition | null }> = ({ selectedCompetition }) => {
  const [profiles, setProfiles] = useState<GameProfile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [equationId, setEquationId] = useState('');
  const [forms, setForms] = useState<Form[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [externalValues, setExternalValues] = useState<Record<string, Record<string, number>>>({});
  const [externalStatus, setExternalStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [externalError, setExternalError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const profile = profiles.find((item) => item.id === profileId);
  const equations = profile?.configuration.analysisEquations || [];
  const equation = equations.find((item) => item.id === equationId) || equations[0];
  const metrics = useMemo(() => profile?.configuration.metrics.filter((metric) => metric.destinations.includes('analytics') && (metric.format === 'number' || metric.format === 'percentage')) || [], [profile]);

  useEffect(() => {
    void gameProfileApi.getAll().then((items) => {
      setProfiles(items);
      setProfileId((current) => current || items[0]?.id || '');
    }).catch(() => setError('Unable to load statistical-analysis profiles.'));
  }, []);
  useEffect(() => setEquationId(equations[0]?.id || ''), [profileId, equations.length]);

  useEffect(() => {
    if (!selectedCompetition) { setForms([]); setSubmissions([]); setLoading(false); return; }
    setLoading(true); setError('');
    void (async () => {
      try {
        const loadedForms = await formApi.getFormsByCompetition(selectedCompetition.id);
        const loadedSubmissions = await formApi.getSubmissionsByCompetition(selectedCompetition.id);
        setForms(loadedForms); setSubmissions(loadedSubmissions);
      } catch { setForms([]); setSubmissions([]); setError('Unable to load scouting data for this competition.'); }
      finally { setLoading(false); }
    })();
  }, [selectedCompetition?.id]);

  useEffect(() => {
    const eventKey = selectedCompetition?.eventKey?.trim();
    if (!eventKey || !metrics.some((metric) => metric.source === 'tba' || metric.source === 'statbotics')) {
      setExternalValues({}); setExternalStatus('idle'); setExternalError(''); return;
    }
    let cancelled = false;
    setExternalStatus('loading'); setExternalError('');
    void (async () => {
      const next: Record<string, Record<string, number>> = {};
      const add = (team: string, metricId: string, value: unknown) => {
        const normalized = normalizeTeam(team); const numeric = numberValue(value);
        if (!normalized || numeric === null) return;
        next[normalized] = { ...next[normalized], [metricId]: numeric };
      };
      const tbaMetrics = metrics.filter((metric) => metric.source === 'tba');
      const statboticsMetrics = metrics.filter((metric) => metric.source === 'statbotics');
      const [oprResult, statboticsResult] = await Promise.allSettled([
        tbaMetrics.length ? tbaApi.getEventOPRs(eventKey) : Promise.resolve(null),
        statboticsMetrics.length ? statboticsApi.getTeamEvents({ event: eventKey, limit: 999 }) : Promise.resolve([]),
      ]);
      if (oprResult.status === 'fulfilled' && oprResult.value) {
        const data = oprResult.value as unknown as Record<string, Record<string, number> | undefined>;
        for (const metric of tbaMetrics) {
          const values = metric.sourceKey === 'opr' ? data.oprs : metric.sourceKey === 'dpr' ? data.dprs : metric.sourceKey === 'ccwm' ? data.ccwms : undefined;
          Object.entries(values || {}).forEach(([team, value]) => add(team, metric.id, value));
        }
      }
      if (statboticsResult.status === 'fulfilled') for (const row of statboticsResult.value as Array<Record<string, unknown>>) {
        const epa = row.epa as Record<string, unknown> | undefined;
        const breakdown = epa?.breakdown as Record<string, unknown> | undefined;
        for (const metric of statboticsMetrics) {
          const value = metric.sourceKey === 'epa.total' ? (row.epa_end ?? row.epa ?? epa?.end)
            : metric.sourceKey === 'epa.auto' ? breakdown?.auto_points
              : metric.sourceKey === 'epa.teleop' ? breakdown?.teleop_points
                : metric.sourceKey === 'epa.endgame' ? breakdown?.endgame_points : null;
          add(String(row.team ?? ''), metric.id, value);
        }
      }
      if (cancelled) return;
      const failedSources = [
        oprResult.status === 'rejected' && tbaMetrics.length ? 'TBA' : '',
        statboticsResult.status === 'rejected' && statboticsMetrics.length ? 'Statbotics' : '',
      ].filter(Boolean);
      setExternalValues(next);
      setExternalStatus(failedSources.length ? 'failed' : 'ready');
      setExternalError(failedSources.length ? `${failedSources.join(' and ')} data could not be loaded. Those metrics are excluded from this ranking.` : '');
    })();
    return () => { cancelled = true; };
  }, [selectedCompetition?.eventKey, profileId, metrics]);

  const valuesByTeam = useMemo(() => {
    const values = new Map<string, Record<string, number>>();
    const add = (team: string, metricId: string, value: number) => values.set(team, { ...values.get(team), [metricId]: value });
    const metricsByForm = new Map<string, Array<{ metric: ConfigMetric; fieldId: number }>>();
    for (const metric of metrics) { const match = fieldMetric(metric); if (match) metricsByForm.set(match[1], [...(metricsByForm.get(match[1]) || []), { metric, fieldId: Number(match[2]) }]); }
    const samples = new Map<string, number[]>();
    for (const submission of submissions) {
      const form = forms.find((item) => item.id === submission.formId); const fieldId = form ? teamFieldId(form) : undefined;
      const team = fieldId === undefined ? null : normalizeTeam(submission.data[fieldId]);
      if (!team) continue;
      values.set(team, values.get(team) || {});
      for (const item of metricsByForm.get(submission.formId) || []) {
        const numeric = numberValue(submission.data[item.fieldId]);
        if (numeric !== null) samples.set(`${team}:${item.metric.id}`, [...(samples.get(`${team}:${item.metric.id}`) || []), numeric]);
      }
    }
    for (const metric of metrics) for (const [key, samplesForMetric] of samples) {
      const suffix = `:${metric.id}`; if (!key.endsWith(suffix)) continue;
      const value = aggregate(samplesForMetric, metric); if (value !== null) add(key.slice(0, -suffix.length), metric.id, value);
    }
    for (const [team, metricValues] of Object.entries(externalValues)) if (values.has(team)) for (const [metricId, value] of Object.entries(metricValues)) add(team, metricId, value);
    for (const metric of metrics.filter((item) => item.source === 'admin' && item.sourceKey === 'superscout_rating')) for (const [team, raw] of Object.entries(selectedCompetition?.superscouterNotes || {})) {
      const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as { rating?: unknown }; } catch { return {}; } })() : raw as { rating?: unknown };
      const rating = numberValue(parsed?.rating); if (rating !== null) add(team, metric.id, rating);
    }
    return values;
  }, [externalValues, forms, metrics, selectedCompetition?.superscouterNotes, submissions]);
  const rankings = equation ? scoreTeamsForEquation(equation, valuesByTeam) : [];

  if (!selectedCompetition) return <div className="p-10 text-center text-gray-400">No active competition selected.</div>;
  return <div className="space-y-4"><section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-gray-900">Statistical Team Rankings</h2><p className="mt-1 text-sm text-gray-500">Ranks only teams with scouting data at this competition. Teams without a value for a metric receive no contribution from that metric.</p><div className="mt-4 flex flex-wrap gap-3"><select value={profileId} onChange={(event) => setProfileId(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm">{profiles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.season}</option>)}</select><select value={equation?.id || ''} onChange={(event) => setEquationId(event.target.value)} disabled={!equations.length} className="rounded border border-gray-300 px-3 py-2 text-sm">{equations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div></section>{externalStatus === 'loading' && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Loading TBA and Statbotics metrics. Rankings may change when the data arrives.</p>}{externalStatus === 'failed' && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{externalError}</p>}{loading ? <p className="text-sm text-gray-500">Loading competition data…</p> : error ? <p className="text-sm text-red-700">{error}</p> : !equation ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Create and save an equation in Statistical Analysis before ranking teams.</p> : rankings.length === 0 ? <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">No teams with usable scouting data for this equation yet.</p> : <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"><div className="grid grid-cols-[4rem_1fr_auto_auto] gap-3 border-b bg-gray-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-500"><span>Rank</span><span>Team</span><span>Metrics</span><span>Score</span></div>{rankings.map((row, index) => <div key={row.team} className="grid grid-cols-[4rem_1fr_auto_auto] gap-3 border-b px-5 py-3 text-sm last:border-0"><span className="font-bold text-gray-500">{index + 1}</span><span className="font-semibold text-gray-900">{row.team}</span><span className="text-gray-500">{row.metricCount}/{equation.metricWeights.length}</span><span className="font-bold text-blue-700">{row.score.toFixed(2)}</span></div>)}</section>}</div>;
};
