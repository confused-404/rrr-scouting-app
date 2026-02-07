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
  | 'includes';

type Stats = {
  count: number;
  mean: number | null;
  median: number | null;
  mode: number | null;
};

interface ResponseViewerProps {
  competitionId?: string;
  onFormSelect?: (id: string | null) => void;
}

// --- Helper Logic (Restored) ---
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
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const freq = new Map<number, number>();
  nums.forEach(n => freq.set(n, (freq.get(n) ?? 0) + 1));
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
    case 'text': return 'contains';
    case 'multiple_choice': return 'equals';
    case 'multiple_select': return 'includes';
    default: return 'equals';
  }
}

function normalizeString(v: any): string {
  return String(v ?? '').trim();
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ competitionId, onFormSelect }) => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterFieldId, setFilterFieldId] = useState<number | null>(null);
  const [filterOp, setFilterOp] = useState<FilterOp>('contains');
  const [filterValue, setFilterValue] = useState<string>('');

  useEffect(() => {
    const loadComps = async () => {
      const data = await competitionApi.getAll();
      setCompetitions(data);
      if (competitionId) {
        const comp = data.find(c => c.id === competitionId);
        if (comp) setSelectedCompetition(comp);
      }
    };
    loadComps();
  }, [competitionId]);

  useEffect(() => {
    if (selectedCompetition) {
      const loadForms = async () => {
        setLoading(true);
        const data = await formApi.getFormsByCompetition(selectedCompetition.id);
        setForms(data);
        if (data.length > 0) setSelectedForm(data[0]);
        setLoading(false);
      };
      loadForms();
    }
    setSubmissions([]);
    setFilterFieldId(null);
    setFilterValue('');
  }, [selectedCompetition]);

  useEffect(() => {
    onFormSelect?.(selectedForm?.id || null);
    if (selectedForm) {
      const loadSubs = async () => {
        const subs = await formApi.getSubmissions(selectedForm.id);
        setSubmissions(subs);
      };
      loadSubs();
      if (selectedForm.fields.length > 0) {
        setFilterFieldId(selectedForm.fields[0].id);
        setFilterOp(getDefaultOp(selectedForm.fields[0]));
      }
    }
  }, [selectedForm, onFormSelect]);

  const availableOps = useMemo((): FilterOp[] => {
    const f = selectedForm?.fields.find(f => f.id === filterFieldId);
    if (!f) return ['contains'];
    switch (f.type) {
      case 'text': return ['contains', 'equals', 'starts_with', 'ends_with'];
      case 'multiple_choice': return ['equals'];
      case 'multiple_select': return ['includes'];
      case 'number':
      case 'ranking': return ['equals', 'gt', 'gte', 'lt', 'lte'];
      default: return ['equals'];
    }
  }, [selectedForm, filterFieldId]);

  const filteredSubmissions = useMemo(() => {
    if (!selectedForm || !filterFieldId) return submissions;
    const raw = filterValue.trim();
    if (raw === '') return submissions;

    const field = selectedForm.fields.find(f => f.id === filterFieldId);
    if (!field) return submissions;

    return submissions.filter((sub) => {
      const v = sub.data?.[String(field.id)];
      switch (field.type) {
        case 'text':
        case 'multiple_choice': {
          const s = normalizeString(v).toLowerCase();
          const q = raw.toLowerCase();
          if (filterOp === 'equals') return s === q;
          if (filterOp === 'starts_with') return s.startsWith(q);
          if (filterOp === 'ends_with') return s.endsWith(q);
          return s.includes(q);
        }
        case 'multiple_select': {
          const arr = Array.isArray(v) ? v : [];
          return arr.some(item => normalizeString(item).toLowerCase().includes(raw.toLowerCase()));
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
        default: return true;
      }
    });
  }, [submissions, selectedForm, filterFieldId, filterOp, filterValue]);

  const quantitativeStats = useMemo(() => {
    if (!selectedForm) return [];
    return selectedForm.fields.filter(isQuantitative).map(field => {
      const nums = filteredSubmissions.map(s => toNumberOrNull(s.data?.[field.id])).filter((n): n is number => n !== null);
      return {
        field,
        stats: { count: nums.length, mean: mean(nums), median: median(nums), mode: mode(nums) }
      };
    });
  }, [selectedForm, filteredSubmissions]);

  const formatNum = (n: number | null) => (n === null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(2));

  return (
    <div className="space-y-6">
      {/* Selection Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Competition</label>
          <select
            value={selectedCompetition?.id || ''}
            onChange={(e) => setSelectedCompetition(competitions.find(c => c.id === e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {competitions.map(comp => (
              <option key={comp.id} value={comp.id}>{comp.name} ({comp.season})</option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Form</label>
          <select
            value={selectedForm?.id || ''}
            onChange={(e) => setSelectedForm(forms.find(f => f.id === e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {forms.map(form => (
              <option key={form.id} value={form.id}>{form.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-lg">Loading...</div>
      ) : !selectedForm ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-lg">Select a form to view responses</div>
      ) : (
        <>
          {/* Filtering UI (Restored) */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Field</label>
                <select
                  value={filterFieldId ?? ''}
                  onChange={(e) => setFilterFieldId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {selectedForm.fields.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-2">Operator</label>
                <select
                  value={filterOp}
                  onChange={(e) => setFilterOp(e.target.value as FilterOp)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {availableOps.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
                <input
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Type to filter..."
                />
              </div>
              <button onClick={() => setFilterValue('')} className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200">Clear</button>
            </div>
            <p className="mt-3 text-sm text-gray-600">Showing <b>{filteredSubmissions.length}</b> / {submissions.length} submissions</p>
          </div>

          {/* Stats Summary (Restored) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Quantitative Summary (filtered)</h2>
            {quantitativeStats.length === 0 ? (
              <p className="text-gray-500 text-sm">No numeric fields on this form.</p>
            ) : (
              <div className="space-y-4">
                {quantitativeStats.map(({ field, stats }) => (
                  <div key={field.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between mb-3">
                      <span className="font-medium text-gray-900">{field.label}</span>
                      <span className="text-sm text-gray-500">n = {stats.count}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <div className="text-gray-500 text-xs">Mean</div>
                        <div className="font-bold">{formatNum(stats.mean)}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <div className="text-gray-500 text-xs">Median</div>
                        <div className="font-bold">{formatNum(stats.median)}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <div className="text-gray-500 text-xs">Mode</div>
                        <div className="font-bold">{formatNum(stats.mode)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submissions List (Restored Card View) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Submissions ({filteredSubmissions.length})</h2>
            <div className="space-y-4">
              {filteredSubmissions.map((submission) => (
                <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-3 uppercase font-bold tracking-wider">
                    {new Date(submission.timestamp).toLocaleString()}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
                    {selectedForm.fields.map((field) => {
                      const v = submission.data?.[String(field.id)];
                      return (
                        <div key={field.id} className="border-l-2 border-blue-500 pl-3">
                          <p className="text-xs font-bold text-gray-500 uppercase">{field.label}</p>
                          <p className="text-gray-900">{v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};