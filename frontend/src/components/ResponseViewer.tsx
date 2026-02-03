import React, { useEffect, useMemo, useState } from 'react';
import type { Competition } from '../types/competition.types';
import type { Submission, Form, FormField } from '../types/form.types';
import { competitionApi, formApi } from '../services/api';

type FilterOp =
  | 'equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'includes'; // for multiple_select

type Stats = {
  count: number;
  mean: number | null;
  median: number | null;
  mode: number | null; // simplest v1: single mode (first highest-frequency)
};

function isQuantitative(field: FormField) {
  return field.type === 'number' || field.type === 'ranking';
}

function toNumberOrNull(v: any): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  let sum = 0;
  for (const n of nums) sum += n;
  return sum / nums.length;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const freq = new Map<number, number>();
  for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);

  let bestVal: number | null = null;
  let bestCount = -1;

  for (const [val, count] of freq.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestVal = val;
    }
  }

  return bestVal;
}

function getDefaultOp(field: FormField): FilterOp {
  switch (field.type) {
    case 'text':
      return 'contains';
    case 'multiple_choice':
      return 'equals';
    case 'multiple_select':
      return 'includes';
    case 'number':
    case 'ranking':
      return 'equals';
    default:
      return 'equals';
  }
}

function normalizeString(v: any): string {
  return String(v ?? '').trim();
}

export const ResponseViewer: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);

  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtering UI state
  const [filterFieldId, setFilterFieldId] = useState<number | null>(null);
  const [filterOp, setFilterOp] = useState<FilterOp>('contains');
  const [filterValue, setFilterValue] = useState<string>('');

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      loadForms();
    }
    // reset when competition changes
    setSelectedForm(null);
    setSubmissions([]);
    setFilterFieldId(null);
    setFilterValue('');
  }, [selectedCompetition]);

  useEffect(() => {
    if (selectedForm) {
      loadSubmissions();
      // reset filter defaults when form changes
      if (selectedForm.fields.length > 0) {
        setFilterFieldId(selectedForm.fields[0].id);
        setFilterOp(getDefaultOp(selectedForm.fields[0]));
      } else {
        setFilterFieldId(null);
      }
      setFilterValue('');
    } else {
      setSubmissions([]);
    }
  }, [selectedForm]);

  const loadCompetitions = async () => {
    try {
      const data = await competitionApi.getAll();
      setCompetitions(data);
      if (data.length > 0) setSelectedCompetition(data[0]);
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  };

  const loadForms = async () => {
    if (!selectedCompetition) return;

    setLoading(true);
    try {
      const data = await formApi.getFormsByCompetition(selectedCompetition.id);
      setForms(data);
      if (data.length > 0) setSelectedForm(data[0]);
      else setSelectedForm(null);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async () => {
    if (!selectedForm) return;

    setLoading(true);
    try {
      const subs = await formApi.getSubmissions(selectedForm.id);
      setSubmissions(subs);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedFilterField = useMemo(() => {
    if (!selectedForm || filterFieldId === null) return null;
    return selectedForm.fields.find((f) => f.id === filterFieldId) ?? null;
  }, [selectedForm, filterFieldId]);

  const availableOps = useMemo((): FilterOp[] => {
    const f = selectedFilterField;
    if (!f) return ['contains'];

    switch (f.type) {
      case 'text':
        return ['contains', 'equals', 'starts_with', 'ends_with'];
      case 'multiple_choice':
        return ['equals'];
      case 'multiple_select':
        return ['includes'];
      case 'number':
      case 'ranking':
        return ['equals', 'gt', 'gte', 'lt', 'lte'];
      default:
        return ['equals'];
    }
  }, [selectedFilterField]);

  // keep op valid when field changes
  useEffect(() => {
    if (!selectedFilterField) return;
    const ops = availableOps;
    if (!ops.includes(filterOp)) {
      setFilterOp(getDefaultOp(selectedFilterField));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilterField]);

  const filteredSubmissions = useMemo(() => {
    if (!selectedForm || !selectedFilterField) return submissions;

    const raw = filterValue.trim();
    if (raw === '') return submissions;

    const fieldKey = String(selectedFilterField.id);

    return submissions.filter((sub) => {
      const v = sub.data?.[fieldKey];

      switch (selectedFilterField.type) {
        case 'text': {
          const s = normalizeString(v);
          const q = raw;
          if (filterOp === 'equals') return s === q;
          if (filterOp === 'starts_with') return s.startsWith(q);
          if (filterOp === 'ends_with') return s.endsWith(q);
          return s.includes(q); // contains
        }

        case 'multiple_choice': {
          return normalizeString(v) === raw;
        }

        case 'multiple_select': {
          const arr: string[] = Array.isArray(v) ? v : [];
          return arr.includes(raw);
        }

        case 'number':
        case 'ranking': {
          const n = toNumberOrNull(v);
          const q = toNumberOrNull(raw);
          if (n === null || q === null) return false;

          if (filterOp === 'equals') return n === q;
          if (filterOp === 'gt') return n > q;
          if (filterOp === 'gte') return n >= q;
          if (filterOp === 'lt') return n < q;
          if (filterOp === 'lte') return n <= q;
          return false;
        }

        default:
          return true;
      }
    });
  }, [submissions, selectedForm, selectedFilterField, filterOp, filterValue]);

  const quantitativeStats = useMemo(() => {
    if (!selectedForm) return [];

    const fields = selectedForm.fields.filter(isQuantitative);

    return fields.map((field) => {
      const nums: number[] = [];

      for (const sub of filteredSubmissions) {
        const v = sub.data?.[String(field.id)];
        const n = toNumberOrNull(v);
        if (n !== null) nums.push(n);
      }

      const s: Stats = {
        count: nums.length,
        mean: mean(nums),
        median: median(nums),
        mode: mode(nums),
      };

      return { field, stats: s };
    });
  }, [selectedForm, filteredSubmissions]);

  const formatNum = (n: number | null) => {
    if (n === null) return '—';
    // keep it readable (no graphs)
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Competition Selection */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Competition</label>
        <select
          value={selectedCompetition?.id || ''}
          onChange={(e) => {
            const comp = competitions.find((c) => c.id === e.target.value);
            setSelectedCompetition(comp || null);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {competitions.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.name} ({comp.season}) - {comp.status}
            </option>
          ))}
        </select>
      </div>

      {/* Form Selection */}
      {selectedCompetition && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Form</label>
          {forms.length === 0 ? (
            <p className="text-gray-500 text-sm">No forms available for this competition</p>
          ) : (
            <select
              value={selectedForm?.id || ''}
              onChange={(e) => {
                const form = forms.find((f) => f.id === e.target.value);
                setSelectedForm(form || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name} ({form.fields.length} field{form.fields.length !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Loading / empty */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <p>Loading…</p>
        </div>
      ) : !selectedForm ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <p>Select a form to view responses</p>
        </div>
      ) : (
        <>
          {/* Filter controls */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Field</label>
                <select
                  value={filterFieldId ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setFilterFieldId(Number.isFinite(id) ? id : null);
                    const f = selectedForm.fields.find((x) => x.id === id);
                    if (f) setFilterOp(getDefaultOp(f));
                    setFilterValue('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {selectedForm.fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label || `(Untitled #${f.id})`} — {f.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-2">Operator</label>
                <select
                  value={filterOp}
                  onChange={(e) => setFilterOp(e.target.value as FilterOp)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableOps.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
                <input
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder={
                    selectedFilterField?.type === 'multiple_select'
                      ? 'e.g. "Defense"'
                      : selectedFilterField?.type === 'number' || selectedFilterField?.type === 'ranking'
                      ? 'e.g. 5'
                      : 'Type to filter'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={() => setFilterValue('')}
                className="md:w-28 px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
              >
                Clear
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Showing <span className="font-medium">{filteredSubmissions.length}</span> / {submissions.length}{' '}
              submissions
            </p>
          </div>

          {/* Quantitative stats */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Quantitative Summary (filtered)</h2>

            {quantitativeStats.length === 0 ? (
              <p className="text-gray-500">No number/ranking fields on this form.</p>
            ) : (
              <div className="space-y-3">
                {quantitativeStats.map(({ field, stats }) => (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{field.label || `(Untitled #${field.id})`}</p>
                        <p className="text-sm text-gray-500">
                          {field.type}
                          {field.type === 'number' && field.unit ? ` (${field.unit})` : ''}
                        </p>
                      </div>
                      <div className="text-sm text-gray-600">
                        n = <span className="font-medium text-gray-900">{stats.count}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-md p-3">
                        <div className="text-gray-500">Mean</div>
                        <div className="font-semibold text-gray-900">{formatNum(stats.mean)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-md p-3">
                        <div className="text-gray-500">Median</div>
                        <div className="font-semibold text-gray-900">{formatNum(stats.median)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-md p-3">
                        <div className="text-gray-500">Mode</div>
                        <div className="font-semibold text-gray-900">{formatNum(stats.mode)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submissions list */}
          {filteredSubmissions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              <p>No submissions match this filter.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">
                Submissions ({filteredSubmissions.length})
              </h2>

              <div className="space-y-4">
                {filteredSubmissions.map((submission) => (
                  <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-3">
                      Submitted: {new Date(submission.timestamp).toLocaleString()}
                    </p>

                    <div className="space-y-2">
                      {selectedForm.fields.map((field) => {
                        const v = submission.data?.[String(field.id)];
                        const display =
                          v === undefined || v === null || v === ''
                            ? '—'
                            : Array.isArray(v)
                            ? v.join(', ')
                            : String(v);

                        return (
                          <div key={field.id} className="border-l-2 border-blue-500 pl-3">
                            <p className="font-medium text-sm text-gray-700">{field.label}</p>
                            <p className="text-gray-900">{display}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
