import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Competition } from '../types/competition.types';
import type { Submission, Form, FormField as FormFieldType, SubmissionValue } from '../types/form.types';
import { formApi } from '../services/api';
import { useAuth } from '../contexts/useAuth';
import { FormField } from './FormField';
import { Filter, X, Download, Edit2, Save, AlertTriangle, ChevronLeft } from 'lucide-react';
import { isPictureFieldValue, submissionValueToText } from '../utils/formValues';
import { ImageLightbox } from './ImageLightbox';
import { evaluateCondition } from '../utils/formConditions';

type ExpandedImageState = {
  url: string;
  alt: string;
  name?: string;
};

type FilterOp = 'contains' | 'equals' | 'gt' | 'lt';
type FieldErrors = Record<number, string>;

const toNumber = (v: unknown) =>
  (v === '' || v === null || v === undefined) ? null : Number(v);

// ─── tiny helpers ────────────────────────────────────────────────────────────

const shouldShowField = (field: FormFieldType, data: Record<string, unknown>, currentFormId: string): boolean => {
  return evaluateCondition(
    field.condition,
    ({ formId, fieldId }) => {
      if (formId && formId !== '__current__' && formId !== currentFormId) return undefined;
      return data[String(fieldId)];
    },
    currentFormId,
  );
};

const validateData = (
  fields: FormFieldType[],
  data: Record<string, unknown>,
  currentFormId: string,
): FieldErrors => {
  const errs: FieldErrors = {};
  for (const field of fields) {
    if (!shouldShowField(field, data, currentFormId)) continue;
    if (!field.required) continue;
    const key = String(field.id);
    const value = data[key];
    switch (field.type) {
      case 'text':
        if (typeof value !== 'string' || !value.trim()) errs[field.id] = 'Required.';
        break;
      case 'number':
        if (value === '' || value === null || value === undefined) errs[field.id] = 'Required.';
        else if (!Number.isFinite(Number(value))) errs[field.id] = 'Must be a number.';
        break;
      case 'multiple_choice':
        if (typeof value !== 'string' || !value.trim()) errs[field.id] = 'Required.';
        break;
      case 'multiple_select':
        if (!Array.isArray(value) || value.length === 0) errs[field.id] = 'Select at least one.';
        break;
      case 'ranking': {
        const lo = Math.min(field.min ?? 1, field.max ?? 10);
        const hi = Math.max(field.min ?? 1, field.max ?? 10);
        const n = Number(value);
        if (!Number.isInteger(n) || n < lo || n > hi) errs[field.id] = `Must be ${lo}–${hi}.`;
        break;
      }
      case 'rank_order': {
        const arr = Array.isArray(value) ? value.filter(Boolean) : [];
        if (arr.length === 0) errs[field.id] = 'Required.';
        break;
      }
      case 'picture': {
        const ok = value && typeof value === 'object' &&
          typeof (value as Record<string, unknown>).url === 'string';
        if (!ok) errs[field.id] = 'Required.';
        break;
      }
    }
  }
  return errs;
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  submission: Submission;
  form: Form;
  onClose: () => void;
  onSaved: (updated: Submission) => void;
  selectedCompetition: Competition | null;
}

const EditModal: React.FC<EditModalProps> = ({
  submission,
  form,
  onClose,
  onSaved,
  selectedCompetition,
}) => {
  // Seed draft from the existing submission data, casting to the right shape
  const [draft, setDraft] = useState<Record<string, SubmissionValue>>(
    () => ({ ...submission.data })
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Keep hidden fields cleared when their conditions become false
  useEffect(() => {
    let changed = false;
    const next = { ...draft };
    for (const field of form.fields) {
      if (!shouldShowField(field, draft, form.id)) {
        const key = String(field.id);
        if (next[key] !== undefined) {
          delete next[key];
          changed = true;
        }
      }
    }
    if (changed) setDraft(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, form.fields]);

  const handleChange = useCallback((fieldId: number, value: SubmissionValue) => {
    setDraft(prev => ({ ...prev, [String(fieldId)]: value }));
    // Clear error for this field on change
    setErrors(prev => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const scrollToField = (fieldId: number) => {
    document.getElementById(`edit-field-${fieldId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSave = async () => {
    const errs = validateData(form.fields, draft, form.id);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      scrollToField(Number(Object.keys(errs)[0]));
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      // Normalise rank_order values before sending
      const normalised = { ...draft };
      for (const field of form.fields) {
        if (field.type === 'rank_order') {
          const key = String(field.id);
          const raw = normalised[key];
          if (Array.isArray(raw)) {
            normalised[key] = raw
              .map(item => String(item ?? '').trim())
              .filter(Boolean);
          }
        }
      }

      const updated = await formApi.updateSubmission(submission.id, normalised);
      onSaved(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Save failed. Please try again.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const visibleFields = form.fields.filter(f => shouldShowField(f, draft, form.id));

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              title="Cancel"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Edit Response</h2>
              <p className="text-xs text-gray-400">
                {new Date(submission.timestamp).toLocaleString()} · ID {submission.id.slice(-8)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Save size={15} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-3 mx-6 mt-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <span>
            You are editing a scouter's submission. Changes are saved directly to this response — no new record is created.
          </span>
        </div>

        {saveError && (
          <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {saveError}
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            Please fix the highlighted fields before saving.
          </div>
        )}

        {/* Form fields */}
        <div className="px-6 py-5 space-y-6">
          {visibleFields.map(field => (
            <div key={field.id} id={`edit-field-${field.id}`}>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              <FormField
                field={field}
                value={draft[String(field.id)]}
                onChange={value => handleChange(field.id, value)}
                uploadContext={
                  selectedCompetition
                    ? { competitionId: selectedCompetition.id, formId: form.id }
                    : undefined
                }
              />

              {errors[field.id] && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">{errors[field.id]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer save button (convenience duplicate) */}
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ResponseViewer ───────────────────────────────────────────────────────────

export const ResponseViewer: React.FC<{ selectedCompetition?: Competition | null }> = ({
  selectedCompetition,
}) => {
  const selectedCompetitionId = selectedCompetition?.id;
  const { isAdmin } = useAuth();

  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filter state
  const [filterFieldId, setFilterFieldId] = useState<number | null>(null);
  const [filterOp, setFilterOp] = useState<FilterOp>('contains');
  const [filterValue, setFilterValue] = useState('');

  // Edit state
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [expandedImage, setExpandedImage] = useState<ExpandedImageState | null>(null);

  useEffect(() => {
    if (selectedCompetition) {
      formApi.getFormsByCompetition(selectedCompetition.id).then(data => {
        setForms(data);
        setFilterFieldId(data[0]?.fields[0]?.id ?? null);
        setLoading(data.length > 0);
        setSelectedForm(data.length > 0 ? data[0] : null);
      });
    }
  }, [selectedCompetition, selectedCompetitionId]);

  useEffect(() => {
    if (selectedForm) {
      formApi.getSubmissions(selectedForm.id)
        .then(subs => { setSubmissions(subs); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [selectedForm]);

  const handleExportCSV = async () => {
    if (!selectedCompetition || !selectedForm) return;
    setIsExporting(true);

    let latestForm: Form = selectedForm;
    let latestSubmissions: Submission[] = [];

    try {
      const latestForms = await formApi.getFormsByCompetition(selectedCompetition.id);
      const matchedForm = latestForms.find((form) => form.id === selectedForm.id);
      if (matchedForm) {
        latestForm = matchedForm;
      }
      latestSubmissions = await formApi.getSubmissions(latestForm.id);
    } catch {
      alert('Failed to load latest data for export. Please try again.');
      setIsExporting(false);
      return;
    }

    if (latestSubmissions.length === 0) {
      alert('No submissions available to export.');
      setIsExporting(false);
      return;
    }

    const teamField = latestForm.fields.find(f => f.label.toLowerCase().includes('team'));
    if (!teamField) {
      alert('No team field found in form. Cannot export analyzed data.');
      setIsExporting(false);
      return;
    }

    const teamGroups: Record<string, Submission[]> = {};
    latestSubmissions.forEach(sub => {
      const teamValue = String((sub.data as Record<string, unknown>)?.[teamField.id] ?? '').trim();
      if (teamValue) {
        if (!teamGroups[teamValue]) teamGroups[teamValue] = [];
        teamGroups[teamValue].push(sub);
      }
    });

    const quantFields = latestForm.fields.filter(f => f.type === 'number' || f.type === 'ranking');
    // Image upload fields are intentionally excluded from CSV exports.
    const qualFields = latestForm.fields.filter(
      f => f.type !== 'number' && f.type !== 'ranking' && f.type !== 'picture'
    );
    const headers = ['Team', ...quantFields.map(f => f.label), ...qualFields.map(f => f.label)];

    const csvRows = Object.entries(teamGroups).map(([team, teamSubs]) => {
      const row: string[] = [team];
      quantFields.forEach(field => {
        const vals = teamSubs
          .map(s => toNumber((s.data as Record<string, unknown>)?.[field.id]))
          .filter((v): v is number => v !== null && !isNaN(v));
        row.push(vals.length === 0 ? '' : (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      });
      qualFields.forEach(field => {
        const values = new Set<string>();
        teamSubs.forEach(sub => {
          const raw = (sub.data as Record<string, unknown>)?.[field.id];
          if (raw !== undefined && raw !== null && raw !== '') values.add(submissionValueToText(raw));
        });
        row.push(Array.from(values).join('; '));
      });
      return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${latestForm.name}_analyzed_data.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  const filteredSubmissions = useMemo(() => {
    if (!selectedForm || !filterFieldId || !filterValue.trim()) return submissions;
    const q = filterValue.trim().toLowerCase();
    return submissions.filter(sub => {
      const raw = (sub.data as Record<string, unknown>)?.[filterFieldId];
      const v = submissionValueToText(raw).toLowerCase();
      if (filterOp === 'gt' || filterOp === 'lt') {
        const numV = toNumber(raw);
        const numQ = toNumber(q);
        if (numV === null || numQ === null) return false;
        return filterOp === 'gt' ? numV > numQ : numV < numQ;
      }
      return filterOp === 'equals' ? v === q : v.includes(q);
    });
  }, [submissions, filterFieldId, filterValue, filterOp, selectedForm]);

  // Called when an edit is saved — update the submission in local state
  const handleSaved = (updated: Submission) => {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setEditingSubmission(null);
  };

  if (!selectedCompetition) {
    return <div className="p-10 text-center text-gray-400">No active competition selected</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      {expandedImage && (
        <ImageLightbox
          imageUrl={expandedImage.url}
          imageAlt={expandedImage.alt}
          imageName={expandedImage.name}
          onClose={() => setExpandedImage(null)}
        />
      )}

      {/* Edit modal */}
      {editingSubmission && selectedForm && (
        <EditModal
          submission={editingSubmission}
          form={selectedForm}
          onClose={() => setEditingSubmission(null)}
          onSaved={handleSaved}
          selectedCompetition={selectedCompetition}
        />
      )}

      {/* Top Selectors */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
            Form
          </label>
          <select
            value={selectedForm?.id || ''}
            onChange={(e) => {
              const nextForm = forms.find((f) => f.id === e.target.value) || null;
              setFilterFieldId(nextForm?.fields[0]?.id ?? null);
              setLoading(Boolean(nextForm));
              setSelectedForm(nextForm);
            }}
            className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500"
          >
            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!selectedForm || isExporting}
          className="w-full md:w-auto px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all"
        >
          <Download size={18} />
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center font-black text-gray-300 animate-pulse tracking-widest uppercase">
          Fetching Data…
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-nowrap gap-2 items-center overflow-x-auto">
            <Filter size={16} className="text-gray-400 flex-shrink-0" />
            <select
              className="w-44 flex-shrink-0 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 font-bold"
              value={filterFieldId || ''}
              onChange={e => setFilterFieldId(Number(e.target.value))}
            >
              {selectedForm?.fields.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <select
              className="w-32 flex-shrink-0 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 font-mono font-bold"
              value={filterOp}
              onChange={e => setFilterOp(e.target.value as FilterOp)}
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="gt">Value &gt;</option>
              <option value="lt">Value &lt;</option>
            </select>
            <input
              placeholder="Search records…"
              value={filterValue}
              onChange={e => setFilterValue(e.target.value)}
              className="min-w-0 flex-1 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            />
            {filterValue && (
              <button onClick={() => setFilterValue('')} className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Submission Cards */}
          <div className="space-y-4">
            {filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed font-bold italic">
                No records match this filter.
              </div>
            ) : (
              filteredSubmissions.map(sub => (
                <div
                  key={sub.id}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all"
                >
                  {/* Card header */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {new Date(sub.timestamp).toLocaleString()}
                      </span>
                      {(sub as Submission & { editedAt?: string }).editedAt && (
                        <span className="text-[9px] font-bold text-amber-500 px-2 py-0.5 bg-amber-50 rounded uppercase">
                          Edited
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-blue-400 px-2 py-0.5 bg-blue-50 rounded uppercase">
                        Verified Entry
                      </span>
                      {/* Edit button — admins only */}
                      {isAdmin && (
                        <button
                          onClick={() => setEditingSubmission(sub)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          title="Edit this response"
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Field values grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {selectedForm?.fields.map(f => {
                      const fieldValue = (sub.data as Record<string, unknown>)?.[f.id];
                      return (
                        <div key={f.id} className="space-y-1">
                          <div className="text-[9px] uppercase font-black text-blue-500 tracking-tighter opacity-70">
                            {f.label}
                          </div>
                          <div className="text-sm font-bold text-gray-800">
                            {isPictureFieldValue(fieldValue) ? (
                              <button
                                type="button"
                                onClick={() => setExpandedImage({
                                  url: fieldValue.url,
                                  alt: f.label,
                                  name: fieldValue.name || 'Uploaded image',
                                })}
                                className="block w-full space-y-2 text-left"
                              >
                                <img
                                  src={fieldValue.url}
                                  alt={f.label}
                                  className="h-28 w-full rounded-lg border border-gray-200 bg-gray-50 object-cover"
                                />
                                <span className="block break-words text-xs font-medium text-blue-600">
                                  {fieldValue.name || 'Click to enlarge image'}
                                </span>
                              </button>
                            ) : (
                              submissionValueToText(fieldValue) || '—'
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
