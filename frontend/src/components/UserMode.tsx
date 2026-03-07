import React, { useState, useEffect } from 'react';
import { Layout, Clock } from 'lucide-react';
import type { FormField as FormFieldType } from '../types/form.types';
import type { Competition } from '../types/competition.types';
import { FormField } from './FormField';
import { formApi } from '../services/api';
import { TeamLookup } from './TeamLookup';
import { MatchSchedule } from './MatchSchedule';
import { ScoutingScheduleViewer } from './ScoutingScheduleViewer';

interface UserModeProps {
  selectedCompetition: Competition | null;
}

type UserTab = 'scout' | 'teamLookup' | 'schedule' | 'scoutingSchedule';

type FieldErrors = Record<number, string>;

export const UserMode: React.FC<UserModeProps> = ({ selectedCompetition }) => {
  const [formFields, setFormFields] = useState<FormFieldType[]>([]);
  const [forms, setForms] = useState<{ id: string; name: string }[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingForm, setFetchingForm] = useState(true);
  const [activeTab, setActiveTab] = useState<UserTab>('scout');

  const [errors, setErrors] = useState<FieldErrors>({});

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
      console.log('loaded:', loaded);
      console.log('activeForms:', activeForms);
      console.log('formsToShow:', formsToShow);
      setForms(formsToShow);

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
        setCurrentFormId(null);
        setFetchingForm(false);
        return;
      }

      setFetchingForm(true);
      try {
        const form = await formApi.getForm(selectedFormId);
        setFormFields(form.fields || []);
        setCurrentFormId(selectedFormId);
        // clear out any previous responses/errors when switching forms
        setResponses({});
        setErrors({});
      } catch (err) {
        console.error('Error loading form fields:', err);
      } finally {
        setFetchingForm(false);
      }
    };

    loadFields();
  }, [selectedFormId]);

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

  const handleInputChange = (fieldId: number, value: any) => {
    const key = String(fieldId);
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (fields: FormFieldType[], data: Record<string, any>) => {
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

        default:
          break;
      }
    }

    return nextErrors;
  };

  const scrollToField = (fieldId: number) => {
    const el = document.getElementById(`field-${fieldId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const shouldShowField = (field: FormFieldType): boolean => {
    if (!field.condition) return true;

    const { fieldId, operator, value } = field.condition;
    const dependentValue = responses[String(fieldId)];

    if (dependentValue === undefined || dependentValue === null || dependentValue === '') {
      return false;
    }

    switch (operator) {
      case 'equals':
        return dependentValue === value;
      case 'not_equals':
        return dependentValue !== value;
      case 'contains':
        if (Array.isArray(dependentValue)) {
          return dependentValue.includes(value);
        }
        return String(dependentValue).includes(String(value));
      case 'not_contains':
        if (Array.isArray(dependentValue)) {
          return !dependentValue.includes(value);
        }
        return !String(dependentValue).includes(String(value));
      default:
        return true;
    }
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
      await formApi.createSubmission(currentFormId, selectedCompetition.id, responses);
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

  if (formFields.length === 0) {
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
      <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100 flex gap-2">
        <button
          onClick={() => setActiveTab('scout')}
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'scout'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Scout
        </button>
        <button
          onClick={() => setActiveTab('scoutingSchedule')}
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'scoutingSchedule'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Clock size={14} />
          My Scouting
        </button>
        <button
          onClick={() => setActiveTab('teamLookup')}
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'teamLookup'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Team Lookup
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'schedule'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Schedule
        </button>
      </div>

      {activeTab === 'scout' ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Submitting for:</strong> {selectedCompetition?.name} ({selectedCompetition?.season})
            </p>
          </div>

          {/* Form selector dropdown — only shown when multiple active forms exist */}
          {forms.length > 1 && (
            <div className="mb-6">
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

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-6">Submit Form</h2>

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
        <ScoutingScheduleViewer selectedCompetition={selectedCompetition} />
      ) : activeTab === 'teamLookup' ? (
        <TeamLookup selectedCompetition={selectedCompetition} />
      ) : (
        <MatchSchedule selectedCompetition={selectedCompetition} />
      )}
    </div>
  );
};