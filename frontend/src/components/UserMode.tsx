import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Clock, Image as ImageIcon } from 'lucide-react';
import type { FormField as FormFieldType, Form, Submission, SubmissionValue } from '../types/form.types';
import type { Competition } from '../types/competition.types';
import { FormField } from './FormField';
import { formApi } from '../services/api';
import { useAuth } from '../contexts/useAuth';
import { TeamLookup } from './TeamLookup';
import { MatchSchedule } from './MatchSchedule';
import { ScoutingScheduleViewer } from './ScoutingScheduleViewer';
import { evaluateCondition } from '../utils/formConditions';
import { isPictureFieldValue } from '../utils/formValues';

interface UserModeProps {
  selectedCompetition: Competition | null;
}

type UserTab = 'scout' | 'teamLookup' | 'schedule' | 'scoutingSchedule' | 'pitMap';

const USER_MODE_ACTIVE_TAB_STORAGE_KEY = 'userMode.activeTab';

const isUserTab = (value: unknown): value is UserTab => (
  value === 'scout'
  || value === 'teamLookup'
  || value === 'schedule'
  || value === 'scoutingSchedule'
  || value === 'pitMap'
);

const teamFieldRegex = /team|team number|team #/i;

const normalizeTeamNumber = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.toLowerCase().startsWith('frc')) return text.slice(3).trim() || null;
  const digits = text.match(/\d+/)?.[0];
  return digits || null;
};

const resolveTeamFieldId = (form: Form): number | null => {
  if (typeof form.teamNumberFieldId === 'number') return form.teamNumberFieldId;
  return form.fields.find((field) => teamFieldRegex.test(field.label))?.id ?? null;
};

type FieldErrors = Record<number, string>;

export const UserMode: React.FC<UserModeProps> = ({ selectedCompetition }) => {
  const { scouterName } = useAuth();
  const [formFields, setFormFields] = useState<FormFieldType[]>([]);
  const [forms, setForms] = useState<{ id: string; name: string }[]>([]);
  const [competitionForms, setCompetitionForms] = useState<Form[]>([]);
  const [currentForm, setCurrentForm] = useState<Form | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, SubmissionValue>>({});
  const [crossFormValues, setCrossFormValues] = useState<Record<string, unknown>>({});
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingForm, setFetchingForm] = useState(true);
  const [activeTab, setActiveTab] = useState<UserTab>(() => {
    if (typeof window === 'undefined') return 'scout';
    try {
      const raw = sessionStorage.getItem(USER_MODE_ACTIVE_TAB_STORAGE_KEY);
      return isUserTab(raw) ? raw : 'scout';
    } catch {
      return 'scout';
    }
  });
  const [targetTeam, setTargetTeam] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    try {
      sessionStorage.setItem(USER_MODE_ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // Ignore storage failures.
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCompetition) {
      loadForm();
    }
    // clear state when competition changes
    setResponses({});
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetition]);

  const loadForm = async () => {
    if (!selectedCompetition) return;

    setFetchingForm(true);
    try {
      const loaded = await formApi.getFormsByCompetition(selectedCompetition.id);

      const actives = selectedCompetition.activeFormIds ||
        (selectedCompetition.activeFormId ? [selectedCompetition.activeFormId] : []);

      // Filter to only active forms, preserving order
      const activeForms = actives
        .map((id: string) => loaded.find((f: { id: string }) => f.id === id))
        .filter(Boolean) as typeof loaded;

      const formsToShow = activeForms.length > 0 ? activeForms : loaded;
      setCompetitionForms(loaded);
      setForms(formsToShow.map((form) => ({ id: form.id, name: form.name })));

      const defaultId = formsToShow[0]?.id ?? null;
      setSelectedFormId(defaultId);
    } catch (error) {
      console.error('Error loading form:', error);
    } finally {
      setFetchingForm(false);
    }
  };

  // when the selected form id changes we need to fetch its fields
  useEffect(() => {
    const loadFields = async () => {
      if (!selectedFormId) {
        setFormFields([]);
        setCurrentForm(null);
        setCurrentFormId(null);
        setFetchingForm(false);
        return;
      }

      setFetchingForm(true);
      try {
        const form = await formApi.getForm(selectedFormId);
        setFormFields(form.fields || []);
        setCurrentForm(form);
        setCurrentFormId(selectedFormId);
        // clear out any previous responses/errors when switching forms
        setResponses({});
        setErrors({});
      } catch (err) {
        console.error('Error loading form fields:', err);
        setCurrentForm(null);
      } finally {
        setFetchingForm(false);
      }
    };

    loadFields();
  }, [selectedFormId]);

  const currentTeamKey = useMemo(() => {
    if (!currentForm) return null;
    const teamFieldId = resolveTeamFieldId(currentForm);
    if (teamFieldId === null) return null;
    return normalizeTeamNumber(responses[String(teamFieldId)]);
  }, [currentForm, responses]);

  useEffect(() => {
    if (!selectedCompetition || !currentTeamKey || competitionForms.length === 0) {
      setCrossFormValues({});
      return;
    }

    let cancelled = false;

    const loadCrossFormValues = async () => {
      try {
        const values: Record<string, unknown> = {};

        for (const form of competitionForms) {
          if (form.id === currentFormId) continue;

          const teamFieldId = resolveTeamFieldId(form);
          if (teamFieldId === null) continue;

          const submissions = await formApi.getSubmissions(form.id);
          const matching = submissions
            .filter((submission: Submission) => (
              normalizeTeamNumber(submission.data?.[String(teamFieldId)]) === currentTeamKey
            ))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          const latest = matching[0];
          if (!latest) continue;

          Object.entries(latest.data || {}).forEach(([fieldId, value]) => {
            values[`${form.id}:${fieldId}`] = value;
          });
        }

        if (!cancelled) setCrossFormValues(values);
      } catch (error) {
        console.error('Error loading cross-form conditional context:', error);
        if (!cancelled) setCrossFormValues({});
      }
    };

    loadCrossFormValues();

    return () => {
      cancelled = true;
    };
  }, [selectedCompetition?.id, competitionForms, currentTeamKey]);

  // Clear responses for fields that become hidden due to condition changes
  useEffect(() => {
    if (formFields.length === 0 && activeTab === 'scout') return;

    const newResponses = { ...responses };
    let hasChanges = false;

    for (const field of formFields) {
      if (!shouldShowField(field)) {
        const key = String(field.id);
        if (newResponses[key] !== undefined) {
          delete newResponses[key];
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      setResponses(newResponses);
      const newErrors = { ...errors };
      for (const field of formFields) {
        if (!shouldShowField(field) && newErrors[field.id]) {
          delete newErrors[field.id];
        }
      }
      setErrors(newErrors);
    }
  }, [responses, formFields]);

  const handleInputChange = (fieldId: number, value: SubmissionValue) => {
    const key = String(fieldId);
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (fields: FormFieldType[], data: Record<string, SubmissionValue>) => {
    const nextErrors: FieldErrors = {};

    for (const field of fields) {
      if (!shouldShowField(field)) continue;
      if (!field.required) continue;

      const key = String(field.id);
      const value = data[key];

      switch (field.type) {
        case 'text': {
          if (typeof value !== 'string' || value.trim() === '') {
            nextErrors[field.id] = 'This field is required.';
          }
          break;
        }

        case 'number': {
          if (value === '' || value === null || value === undefined) {
            nextErrors[field.id] = 'This field is required.';
            break;
          }
          const n = typeof value === 'number' ? value : Number(value);
          if (Number.isNaN(n)) nextErrors[field.id] = 'Please enter a valid number.';
          break;
        }

        case 'multiple_choice': {
          if (typeof value !== 'string' || value.trim() === '') {
            nextErrors[field.id] = 'Please select an option.';
          }
          break;
        }

        case 'multiple_select': {
          const arr = Array.isArray(value) ? value : [];
          if (arr.length === 0) nextErrors[field.id] = 'Please select at least one option.';
          break;
        }

        case 'ranking': {
          const min = Number.isFinite(field.min) ? Number(field.min) : 1;
          const max = Number.isFinite(field.max) ? Number(field.max) : 10;
          const lo = Math.min(min, max);
          const hi = Math.max(min, max);

          if (value === '' || value === null || value === undefined) {
            nextErrors[field.id] = 'This field is required.';
            break;
          }

          const n = typeof value === 'number' ? value : Number(value);
          if (Number.isNaN(n) || !Number.isInteger(n) || n < lo || n > hi) {
            nextErrors[field.id] = `Rank must be an integer from ${lo} to ${hi}.`;
          }
          break;
        }

        case 'rank_order': {
          const arr = Array.isArray(value) ? value : [];
          const filled = arr.filter((item) => typeof item === 'string' && item.trim() !== '');
          if (filled.length === 0) {
            nextErrors[field.id] = 'Please add at least one ranked option.';
          }
          break;
        }

        case 'picture': {
          const valid = isPictureFieldValue(value);
          if (!valid) {
            nextErrors[field.id] = 'Please upload a picture.';
          }
          break;
        }
      }
    }

    return nextErrors;
  };

  const scrollToField = (fieldId: number) => {
    const el = document.getElementById(`field-${fieldId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const shouldShowField = (field: FormFieldType): boolean => {
    return evaluateCondition(
      field.condition,
      ({ formId, fieldId }) => {
        const resolvedFormId = (!formId || formId === '__current__') ? (currentFormId || '') : formId;

        if (currentFormId && resolvedFormId === currentFormId) {
          const localKey = String(fieldId);
          if (Object.prototype.hasOwnProperty.call(responses, localKey)) {
            return responses[localKey];
          }
          return undefined;
        }

        const key = `${resolvedFormId}:${fieldId}`;
        return crossFormValues[key];
      },
      currentFormId || '',
    );
  };

  const handleSubmit = async () => {
    if (activeTab !== 'scout') return;
    if (!currentFormId || !selectedCompetition) {
      alert('No form available');
      return;
    }

    const nextErrors = validate(formFields, responses);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstId = Number(Object.keys(nextErrors)[0]);
      scrollToField(firstId);
      return;
    }

    setLoading(true);
    try {
      const normalizedResponses: Record<string, SubmissionValue> = { ...responses };

      // Keep rank_order payloads compact and clean before submit.
      formFields.forEach((field) => {
        if (field.type !== 'rank_order') return;
        const key = String(field.id);
        const raw = normalizedResponses[key];
        if (!Array.isArray(raw)) return;
        normalizedResponses[key] = raw
          .map((item) => String(item ?? '').trim())
          .filter((item) => item !== '');
      });

      await formApi.createSubmission(currentFormId, selectedCompetition.id, normalizedResponses);
      setResponses({});
      setErrors({});
      alert('Form submitted successfully!');
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompetition && activeTab === 'scout') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Layout size={48} className="mx-auto mb-4 opacity-50" />
        <p>Please select a competition to view its form</p>
      </div>
    );
  }

  if (fetchingForm && activeTab === 'scout') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12 text-gray-500">
          <p>Loading form...</p>
        </div>
      </div>
    );
  }

  if (formFields.length === 0 && activeTab === 'scout') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12 text-gray-500">
          <Layout size={48} className="mx-auto mb-4 opacity-50" />
          <p>No form available for this competition yet. Check back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* tab navigation */}
      <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          onClick={() => setActiveTab('scout')}
          className={`px-3 py-2.5 rounded-lg grid grid-cols-[14px_1fr_14px] items-center gap-2 font-black text-[11px] uppercase tracking-wide sm:tracking-widest transition-all ${
            activeTab === 'scout'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span aria-hidden="true" />
          <span className="block w-full text-center leading-tight">Scout</span>
          <span aria-hidden="true" />
        </button>
        <button
          onClick={() => setActiveTab('scoutingSchedule')}
          className={`px-3 py-2.5 rounded-lg grid grid-cols-[14px_1fr_14px] items-center gap-2 font-black text-[11px] uppercase tracking-wide sm:tracking-widest transition-all ${
            activeTab === 'scoutingSchedule'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center justify-center"><Clock size={14} /></span>
          <span className="block w-full text-center leading-tight">My Scouting</span>
          <span aria-hidden="true" />
        </button>
        <button
          onClick={() => setActiveTab('teamLookup')}
          className={`px-3 py-2.5 rounded-lg grid grid-cols-[14px_1fr_14px] items-center gap-2 font-black text-[11px] uppercase tracking-wide sm:tracking-widest transition-all ${
            activeTab === 'teamLookup'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span aria-hidden="true" />
          <span className="block w-full text-center leading-tight">Team Lookup</span>
          <span aria-hidden="true" />
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-3 py-2.5 rounded-lg grid grid-cols-[14px_1fr_14px] items-center gap-2 font-black text-[11px] uppercase tracking-wide sm:tracking-widest transition-all ${
            activeTab === 'schedule'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span aria-hidden="true" />
          <span className="block w-full text-center leading-tight">Schedule</span>
          <span aria-hidden="true" />
        </button>
        <button
          onClick={() => setActiveTab('pitMap')}
          className={`px-3 py-2.5 rounded-lg grid grid-cols-[14px_1fr_14px] items-center gap-2 font-black text-[11px] uppercase tracking-wide sm:tracking-widest transition-all ${
            activeTab === 'pitMap'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center justify-center"><ImageIcon size={14} /></span>
          <span className="block w-full text-center leading-tight">Pit Map</span>
          <span aria-hidden="true" />
        </button>
      </div>

      {activeTab === 'scout' ? (
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Submitting for:</strong> {selectedCompetition?.name} ({selectedCompetition?.season})
            </p>
          </div>

          {/* Form selector dropdown — only shown when multiple active forms exist */}
          {forms.length > 1 && (
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Form
              </label>
              <select
                value={selectedFormId ?? ''}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-5 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Submit Form</h2>

            {Object.keys(errors).length > 0 && (
              <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg p-4">
                Please fill out all required fields.
              </div>
            )}

            {formFields.filter(shouldShowField).map((field) => (
              <div key={field.id} id={`field-${field.id}`}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-600 ml-1">*</span>}
                </label>

                <FormField
                  field={field}
                  value={responses[String(field.id)]}
                  onChange={(value) => handleInputChange(field.id, value)}
                  uploadContext={
                    selectedCompetition && currentFormId
                      ? { competitionId: selectedCompetition.id, formId: currentFormId }
                      : undefined
                  }
                />

                {errors[field.id] ? (
                  <p className="mt-1 text-sm text-red-600">{errors[field.id]}</p>
                ) : null}
              </div>
            ))}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      ) : activeTab === 'scoutingSchedule' ? (
        <ScoutingScheduleViewer selectedCompetition={selectedCompetition} scouterName={scouterName} />
      ) : activeTab === 'pitMap' ? (
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Pit Map</h2>
            <p className="text-sm text-gray-500 mt-1">Uploaded by admins for all scouters.</p>
          </div>

          {selectedCompetition?.pitMapImageUrl ? (
            <div className="border border-gray-200 rounded-xl p-2 bg-gray-50">
              <img
                src={selectedCompetition.pitMapImageUrl}
                alt={`Pit map for ${selectedCompetition.name}`}
                className="w-full h-auto max-h-[75vh] object-contain rounded-lg bg-white"
              />
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
              No pit map uploaded yet.
            </div>
          )}
        </div>
      ) : activeTab === 'teamLookup' ? (
        <TeamLookup selectedCompetition={selectedCompetition} targetTeam={targetTeam} />
      ) : (
        <MatchSchedule
          selectedCompetition={selectedCompetition}
          onTeamLookup={(team) => {
            setTargetTeam(team);
            setActiveTab('teamLookup');
          }}
        />
      )}
    </div>
  );
};
