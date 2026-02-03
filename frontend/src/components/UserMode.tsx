import React, { useState, useEffect } from 'react';
import { Layout } from 'lucide-react';
import type { FormField as FormFieldType } from '../types/form.types';
import type { Competition } from '../types/competition.types';
import { FormField } from './FormField';
import { formApi } from '../services/api';

interface UserModeProps {
  selectedCompetition: Competition | null;
}

type FieldErrors = Record<number, string>;

export const UserMode: React.FC<UserModeProps> = ({ selectedCompetition }) => {
  const [formFields, setFormFields] = useState<FormFieldType[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingForm, setFetchingForm] = useState(true);

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
      const forms = await formApi.getFormsByCompetition(selectedCompetition.id);

      if (forms.length > 0) {
        const fields = forms[0].fields;
        setFormFields(fields);
        setCurrentFormId(forms[0].id);

        setResponses((prev) => {
          const next = { ...prev };

          for (const f of fields) {
            if (f.type === 'ranking') {
              const key = String(f.id);
              const existing = next[key];

              if (existing === undefined || existing === null || existing === '') {
                const { lo } = getRankingBounds(f);
                next[key] = lo;
              }
            }
          }

          return next;
        });
      } else {
        setFormFields([]);
        setCurrentFormId(null);
        setResponses({});
      }
    } catch (error) {
      console.error('Error loading form:', error);
    } finally {
      setFetchingForm(false);
    }
  };


  const handleInputChange = (fieldId: number, value: any) => {
    const key = String(fieldId);
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const getRankingBounds = (field: FormFieldType) => {
    const min = Number.isFinite(field.min) ? Number(field.min) : 1;
    const max = Number.isFinite(field.max) ? Number(field.max) : 10;
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  };


  const validate = (fields: FormFieldType[], data: Record<string, any>) => {
    const nextErrors: FieldErrors = {};

    for (const field of fields) {
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

  const handleSubmit = async () => {
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

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Layout size={48} className="mx-auto mb-4 opacity-50" />
        <p>Please select a competition to view its form</p>
      </div>
    );
  }

  if (fetchingForm) {
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
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Submitting for:</strong> {selectedCompetition.name} ({selectedCompetition.season})
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold mb-6">Submit Form</h2>

        {Object.keys(errors).length > 0 && (
          <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg p-4">
            Please fill out all required fields.
          </div>
        )}

        {formFields.map((field) => (
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
  );
};
