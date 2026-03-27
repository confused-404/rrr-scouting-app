import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, ListOrdered, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { competitionApi, formApi, statboticsApi, tbaApi } from '../services/api';
import type { Competition, ManualPickList } from '../types/competition.types';
import type { Form, Submission } from '../types/form.types';

type AutoSource = 'tba' | 'statbotics';

type AutoRankedTeam = {
  team: string;
  value: number;
  sourceLabel: string;
};

type TeamAggregate = {
  team: string;
  quantitative: Record<string, number[]>;
  qualitative: Record<string, string[]>;
  submissionCount: number;
};

type CategoryRanking = {
  team: string;
  submissionCount: number;
  hitCount: number;
  hitRate: number;
  topValue: string;
};

type PickListTab = 'manual' | 'automatic';
type QuantAggregateMode = 'average' | 'total' | 'max';
type SortDirection = 'desc' | 'asc';

type QuantitativeAutoRow = {
  team: string;
  submissionCount: number;
  value: number;
};

const teamFieldRegex = /team|team number|team #/i;

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

const toFiniteNumber = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const emptyManualList = (): ManualPickList => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: `Pick List ${new Date().toLocaleTimeString()}`,
  firstPickRankings: [],
  secondPickRankings: [],
  thirdPickRankings: [],
});

const parseStatboticsEPA = (row: any): number | null => {
  const candidates = [row?.epa_end, row?.epa_start, row?.epa_pre, row?.epa, row?.norm_epa];
  for (const value of candidates) {
    const n = toFiniteNumber(value);
    if (n !== null) return n;
  }
  if (row?.epa && typeof row.epa === 'object') {
    const nested = [row.epa?.end, row.epa?.start, row.epa?.pre, row.epa?.norm];
    for (const value of nested) {
      const n = toFiniteNumber(value);
      if (n !== null) return n;
    }
  }
  return null;
};

export const PickListManager: React.FC<{
  selectedCompetition?: Competition | null;
  onCompetitionUpdate?: () => void;
  onTeamSelect?: (team: string) => void;
}> = ({ selectedCompetition, onCompetitionUpdate, onTeamSelect }) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [, setLoadingData] = useState(false);

  const [autoSource, setAutoSource] = useState<AutoSource>('tba');
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoRankings, setAutoRankings] = useState<AutoRankedTeam[]>([]);
  const [autoError, setAutoError] = useState('');

  const [manualLists, setManualLists] = useState<ManualPickList[]>([]);
  const [selectedManualId, setSelectedManualId] = useState<string>('');
  const [draftInputs, setDraftInputs] = useState<{ first: string; second: string; third: string }>({
    first: '',
    second: '',
    third: '',
  });
  const [savingManual, setSavingManual] = useState(false);

  const [selectedQualCategory, setSelectedQualCategory] = useState('');
  const [activePickListTab, setActivePickListTab] = useState<PickListTab>('manual');
  const [selectedQuantField, setSelectedQuantField] = useState('');
  const [quantAggregateMode, setQuantAggregateMode] = useState<QuantAggregateMode>('average');
  const [quantSortDirection, setQuantSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (!selectedCompetition) return;
    setManualLists(selectedCompetition.manualPickLists || []);
    setSelectedManualId((selectedCompetition.manualPickLists || [])[0]?.id || '');
  }, [selectedCompetition?.id, selectedCompetition?.manualPickLists]);

  useEffect(() => {
    const loadSubmissionData = async () => {
      if (!selectedCompetition) return;

      setLoadingData(true);
      try {
        const loadedForms = await formApi.getFormsByCompetition(selectedCompetition.id);
        setForms(loadedForms);

        const formSubs = await Promise.all(loadedForms.map((f) => formApi.getSubmissions(f.id)));
        setSubmissions(formSubs.flat());
      } catch (error) {
        console.error('Error loading pick-list submission data:', error);
        setForms([]);
        setSubmissions([]);
      } finally {
        setLoadingData(false);
      }
    };

    loadSubmissionData();
  }, [selectedCompetition?.id]);

  const teamAggregates = useMemo(() => {
    const byTeam = new Map<string, TeamAggregate>();

    for (const form of forms) {
      const teamFieldId = resolveTeamFieldId(form);
      if (teamFieldId === null) continue;

      const formSubs = submissions.filter((sub) => sub.formId === form.id);
      for (const sub of formSubs) {
        const team = normalizeTeamNumber(sub.data?.[teamFieldId]);
        if (!team) continue;

        if (!byTeam.has(team)) {
          byTeam.set(team, {
            team,
            quantitative: {},
            qualitative: {},
            submissionCount: 0,
          });
        }

        const agg = byTeam.get(team)!;
        agg.submissionCount += 1;

        for (const field of form.fields) {
          const value = sub.data?.[field.id];

          if (field.type === 'number' || field.type === 'ranking') {
            const n = toFiniteNumber(value);
            if (n !== null) {
              if (!agg.quantitative[field.label]) agg.quantitative[field.label] = [];
              agg.quantitative[field.label].push(n);
            }
          }

          if (field.type === 'multiple_choice' || field.type === 'multiple_select' || field.type === 'rank_order' || field.type === 'text') {
            if (!agg.qualitative[field.label]) agg.qualitative[field.label] = [];

            if (Array.isArray(value)) {
              value.forEach((item) => {
                const text = String(item).trim();
                if (text) agg.qualitative[field.label].push(text);
              });
            } else {
              const text = String(value ?? '').trim();
              if (text) agg.qualitative[field.label].push(text);
            }
          }
        }
      }
    }

    return Array.from(byTeam.values());
  }, [forms, submissions]);

  const qualitativeCategories = useMemo(() => {
    const set = new Set<string>();
    teamAggregates.forEach((team) => {
      Object.keys(team.qualitative).forEach((key) => set.add(key));
    });
    return Array.from(set).sort();
  }, [teamAggregates]);

  const quantitativeFieldOptions = useMemo(() => {
    const set = new Set<string>();
    teamAggregates.forEach((team) => {
      Object.keys(team.quantitative).forEach((key) => set.add(key));
    });
    return Array.from(set).sort();
  }, [teamAggregates]);

  useEffect(() => {
    if (!selectedQualCategory && qualitativeCategories.length > 0) {
      setSelectedQualCategory(qualitativeCategories[0]);
    }
    if (selectedQualCategory && !qualitativeCategories.includes(selectedQualCategory)) {
      setSelectedQualCategory(qualitativeCategories[0] || '');
    }
  }, [qualitativeCategories, selectedQualCategory]);

  useEffect(() => {
    if (!selectedQuantField && quantitativeFieldOptions.length > 0) {
      setSelectedQuantField(quantitativeFieldOptions[0]);
    }
    if (selectedQuantField && !quantitativeFieldOptions.includes(selectedQuantField)) {
      setSelectedQuantField(quantitativeFieldOptions[0] || '');
    }
  }, [quantitativeFieldOptions, selectedQuantField]);

  const qualitativeRankings = useMemo(() => {
    if (!selectedQualCategory) return [] as CategoryRanking[];

    const rows: CategoryRanking[] = teamAggregates
      .map((team) => {
        const values = team.qualitative[selectedQualCategory] || [];
        if (team.submissionCount === 0) return null;

        const counts: Record<string, number> = {};
        values.forEach((v) => {
          counts[v] = (counts[v] || 0) + 1;
        });

        const hitCount = values.length;
        const hitRate = hitCount / team.submissionCount;
        const topValue = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '—';

        return {
          team: team.team,
          submissionCount: team.submissionCount,
          hitCount,
          hitRate,
          topValue,
        };
      })
      .filter(Boolean) as CategoryRanking[];

    rows.sort((a, b) => b.hitRate - a.hitRate || b.hitCount - a.hitCount);
    return rows;
  }, [selectedQualCategory, teamAggregates]);

  const quantitativeAutoRankings = useMemo(() => {
    if (!selectedQuantField) return [] as QuantitativeAutoRow[];

    const rows: QuantitativeAutoRow[] = teamAggregates
      .map((team) => {
        const values = team.quantitative[selectedQuantField] || [];
        if (values.length === 0) return null;

        let value = 0;
        if (quantAggregateMode === 'total') {
          value = values.reduce((sum, n) => sum + n, 0);
        } else if (quantAggregateMode === 'max') {
          value = Math.max(...values);
        } else {
          value = values.reduce((sum, n) => sum + n, 0) / values.length;
        }

        return {
          team: team.team,
          submissionCount: team.submissionCount,
          value,
        };
      })
      .filter(Boolean) as QuantitativeAutoRow[];

    rows.sort((a, b) => {
      const direction = quantSortDirection === 'desc' ? 1 : -1;
      const byValue = direction * (b.value - a.value);
      if (byValue !== 0) return byValue;
      return direction * (b.submissionCount - a.submissionCount);
    });

    return rows;
  }, [quantAggregateMode, quantSortDirection, selectedQuantField, teamAggregates]);

  const selectedManualList = useMemo(
    () => manualLists.find((list) => list.id === selectedManualId) || null,
    [manualLists, selectedManualId]
  );

  const updateManualList = (id: string, updater: (list: ManualPickList) => ManualPickList) => {
    setManualLists((prev) => prev.map((list) => (list.id === id ? updater(list) : list)));
  };

  const addToRound = (round: 'first' | 'second' | 'third') => {
    if (!selectedManualList) return;

    const value = draftInputs[round].trim();
    if (!value) return;

    updateManualList(selectedManualList.id, (list) => {
      if (round === 'first') return { ...list, firstPickRankings: [...list.firstPickRankings, value] };
      if (round === 'second') return { ...list, secondPickRankings: [...list.secondPickRankings, value] };
      return { ...list, thirdPickRankings: [...list.thirdPickRankings, value] };
    });

    setDraftInputs((prev) => ({ ...prev, [round]: '' }));
  };

  const removeFromRound = (round: 'first' | 'second' | 'third', index: number) => {
    if (!selectedManualList) return;

    updateManualList(selectedManualList.id, (list) => {
      const next =
        round === 'first'
          ? [...list.firstPickRankings]
          : round === 'second'
          ? [...list.secondPickRankings]
          : [...list.thirdPickRankings];
      next.splice(index, 1);

      if (round === 'first') return { ...list, firstPickRankings: next };
      if (round === 'second') return { ...list, secondPickRankings: next };
      return { ...list, thirdPickRankings: next };
    });
  };

  const handleTeamSelect = (team: string) => {
    if (!onTeamSelect) return;
    const normalized = normalizeTeamNumber(team);
    onTeamSelect(normalized || team.trim());
  };

  const fetchAutomaticRankings = async () => {
    if (!selectedCompetition?.eventKey) {
      setAutoError('Set an event key in competition settings first.');
      setAutoRankings([]);
      return;
    }

    setAutoLoading(true);
    setAutoError('');
    try {
      if (autoSource === 'statbotics') {
        const rows = await statboticsApi.getTeamEvents({ event: selectedCompetition.eventKey, limit: 999 });

        const rankings = (rows || [])
          .map((row: any) => {
            const epa = parseStatboticsEPA(row);
            const team = normalizeTeamNumber(row?.team);
            if (epa === null || !team) return null;
            return { team, value: epa, sourceLabel: 'EPA' };
          })
          .filter(Boolean) as AutoRankedTeam[];

        rankings.sort((a, b) => b.value - a.value);
        setAutoRankings(rankings);
      } else {
        const data = await tbaApi.getEventOPRs(selectedCompetition.eventKey);
        const oprs = data?.oprs || {};

        const rankings = Object.entries(oprs)
          .map(([teamKey, value]) => {
            const team = normalizeTeamNumber(teamKey);
            const n = toFiniteNumber(value);
            if (!team || n === null) return null;
            return { team, value: n, sourceLabel: 'OPR (TBA)' };
          })
          .filter(Boolean) as AutoRankedTeam[];

        rankings.sort((a, b) => b.value - a.value);
        setAutoRankings(rankings);
      }
    } catch (error) {
      console.error('Error fetching automatic rankings:', error);
      setAutoError('Could not fetch automatic rankings right now.');
      setAutoRankings([]);
    } finally {
      setAutoLoading(false);
    }
  };

  const saveManualLists = async () => {
    if (!selectedCompetition) return;

    setSavingManual(true);
    try {
      await competitionApi.update(selectedCompetition.id, { manualPickLists: manualLists });
      if (onCompetitionUpdate) onCompetitionUpdate();
      alert('Manual pick lists saved.');
    } catch (error) {
      console.error('Error saving manual pick lists:', error);
      alert('Failed to save manual pick lists.');
    } finally {
      setSavingManual(false);
    }
  };

  if (!selectedCompetition) {
    return <div className="p-10 text-center text-gray-400">No active competition selected</div>;
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">Pick Lists</h2>
        <p className="text-sm text-gray-500 mt-1">Switch between manual rankings and automatic ranking tools.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActivePickListTab('manual')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
            activePickListTab === 'manual'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Manual Pick Lists
        </button>
        <button
          onClick={() => setActivePickListTab('automatic')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
            activePickListTab === 'automatic'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Automatic Pick Lists
        </button>
      </div>

      {activePickListTab === 'automatic' && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <BarChart3 size={18} />
              Automatic Pick List
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={autoSource}
                onChange={(e) => setAutoSource(e.target.value as AutoSource)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="tba">The Blue Alliance (OPR)</option>
                <option value="statbotics">Statbotics (EPA fallback)</option>
              </select>
              <button
                onClick={fetchAutomaticRankings}
                disabled={autoLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCcw size={16} />
                {autoLoading ? 'Loading...' : 'Generate'}
              </button>
              {selectedCompetition.eventKey ? (
                <span className="text-xs text-gray-500">Event: {selectedCompetition.eventKey}</span>
              ) : (
                <span className="text-xs text-red-600">No event key set on this competition.</span>
              )}
            </div>

            {autoError && <p className="text-sm text-red-600">{autoError}</p>}

            {autoRankings.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-left">Team</th>
                      <th className="px-3 py-2 text-left">{autoRankings[0].sourceLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoRankings.slice(0, 50).map((row, idx) => (
                      <tr key={`${row.team}-${idx}`} className="border-t border-gray-100">
                        <td className="px-3 py-2">#{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold">
                          <button
                            type="button"
                            onClick={() => handleTeamSelect(row.team)}
                            className="text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {row.team}
                          </button>
                        </td>
                        <td className="px-3 py-2">{row.value.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <ClipboardList size={18} />
              Quantitative Auto Pick List
            </div>

            {quantitativeFieldOptions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-gray-600">Metric</label>
                <select
                  value={selectedQuantField}
                  onChange={(e) => setSelectedQuantField(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {quantitativeFieldOptions.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>

                <label className="text-sm text-gray-600">Aggregate</label>
                <select
                  value={quantAggregateMode}
                  onChange={(e) => setQuantAggregateMode(e.target.value as QuantAggregateMode)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="average">Average</option>
                  <option value="total">Total</option>
                  <option value="max">Max</option>
                </select>

                <label className="text-sm text-gray-600">Sort</label>
                <select
                  value={quantSortDirection}
                  onChange={(e) => setQuantSortDirection(e.target.value as SortDirection)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="desc">High to Low</option>
                  <option value="asc">Low to High</option>
                </select>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No quantitative fields found in submissions yet.</p>
            )}

            {selectedQuantField && quantitativeAutoRankings.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-left">Team</th>
                      <th className="px-3 py-2 text-left">Value</th>
                      <th className="px-3 py-2 text-left">Submissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quantitativeAutoRankings.map((row, idx) => (
                      <tr key={`${row.team}-${idx}`} className="border-t border-gray-100">
                        <td className="px-3 py-2">#{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold">
                          <button
                            type="button"
                            onClick={() => handleTeamSelect(row.team)}
                            className="text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {row.team}
                          </button>
                        </td>
                        <td className="px-3 py-2">{row.value.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.submissionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <ClipboardList size={18} />
              Qualitative Categories
            </div>

            {qualitativeCategories.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-gray-600">Category</label>
                <select
                  value={selectedQualCategory}
                  onChange={(e) => setSelectedQualCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {qualitativeCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No qualitative categories found in submissions.</p>
            )}

            {selectedQualCategory && qualitativeRankings.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-left">Team</th>
                      <th className="px-3 py-2 text-left">Frequency</th>
                      <th className="px-3 py-2 text-left">Top Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualitativeRankings.map((row, idx) => (
                      <tr key={row.team} className="border-t border-gray-100">
                        <td className="px-3 py-2">#{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold">
                          <button
                            type="button"
                            onClick={() => handleTeamSelect(row.team)}
                            className="text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {row.team}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {(row.hitRate * 100).toFixed(1)}% ({row.hitCount}/{row.submissionCount})
                        </td>
                        <td className="px-3 py-2">{row.topValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activePickListTab === 'manual' && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <ListOrdered size={18} />
              Manual Pick Lists
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const created = emptyManualList();
                  setManualLists((prev) => [...prev, created]);
                  setSelectedManualId(created.id);
                }}
                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center gap-2 text-sm"
              >
                <Plus size={14} /> New List
              </button>
              <button
                onClick={saveManualLists}
                disabled={savingManual}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                <Save size={14} /> {savingManual ? 'Saving...' : 'Save Lists'}
              </button>
            </div>
          </div>

          {manualLists.length === 0 ? (
            <div className="text-sm text-gray-500">No manual pick lists yet. Create one to start ranking.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {manualLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedManualId(list.id)}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      selectedManualId === list.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {list.name}
                  </button>
                ))}
              </div>

              {selectedManualList && (
                <div className="space-y-4 border border-gray-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={selectedManualList.name}
                      onChange={(e) =>
                        updateManualList(selectedManualList.id, (list) => ({ ...list, name: e.target.value }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[220px]"
                    />
                    <button
                      onClick={() => {
                        setManualLists((prev) => prev.filter((list) => list.id !== selectedManualList.id));
                        setSelectedManualId((prev) => (prev === selectedManualList.id ? '' : prev));
                      }}
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-2 text-sm"
                    >
                      <Trash2 size={14} /> Delete List
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[
                      { key: 'first', label: 'First Pick', values: selectedManualList.firstPickRankings },
                      { key: 'second', label: 'Second Pick', values: selectedManualList.secondPickRankings },
                      { key: 'third', label: 'Third Pick', values: selectedManualList.thirdPickRankings },
                    ].map((section) => (
                      <div key={section.key} className="border border-gray-200 rounded-lg p-3">
                        <h4 className="font-semibold text-gray-800 mb-2">{section.label}</h4>
                        <div className="flex gap-2 mb-3">
                          <input
                            value={draftInputs[section.key as 'first' | 'second' | 'third']}
                            onChange={(e) =>
                              setDraftInputs((prev) => ({ ...prev, [section.key]: e.target.value }))
                            }
                            placeholder="Team number"
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => addToRound(section.key as 'first' | 'second' | 'third')}
                            className="px-2.5 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                          >
                            Add
                          </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {section.values.map((team, index) => (
                            <div key={`${team}-${index}`} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => handleTeamSelect(team)}
                                className="text-left text-blue-700 hover:text-blue-900 hover:underline"
                              >
                                #{index + 1} Team {team}
                              </button>
                              <button
                                onClick={() => removeFromRound(section.key as 'first' | 'second' | 'third', index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          {section.values.length === 0 && <p className="text-xs text-gray-500">No teams ranked yet.</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Duplicate teams are allowed across first, second, and third pick rankings.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
