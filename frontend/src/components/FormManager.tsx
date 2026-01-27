import React, { useState, useEffect } from 'react';
import { Trash2, Layout } from 'lucide-react';
import type { FormField as FormFieldType, Form } from '../types/form.types';
import type { Competition } from '../types/competition.types';
import { formApi, competitionApi } from '../services/api';

export const FormManager: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [formFields, setFormFields] = useState<FormFieldType[]>([]);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      loadForm();
    }
  }, [selectedCompetition]);

  const loadCompetitions = async () => {
    try {
      const data = await competitionApi.getAll();
      setCompetitions(data);
      if (data.length > 0 && !selectedCompetition) {
        setSelectedCompetition(data[0]);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  };

  const loadForm = async () => {
    if (!selectedCompetition) return;

    try {
      const forms = await formApi.getFormsByCompetition(selectedCompetition.id);
      if (forms.length > 0) {
        setFormFields(forms[0].fields);
        setCurrentFormId(forms[0].id);
      } else {
        setFormFields([]);
        setCurrentFormId(null);
      }
    } catch (error) {
      console.error('Error loading form:', error);
    }
  };

  const saveForm = async () => {
    if (!selectedCompetition) {
      alert('Please select a competition first');
      return;
    }

    setLoading(true);
    try {
      if (currentFormId) {
        await formApi.updateForm(currentFormId, formFields);
      } else {
        const newForm = await formApi.createForm(selectedCompetition.id, formFields);
        setCurrentFormId(newForm.id);
      }
      alert('Form saved successfully!');
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Error saving form');
    } finally {
      setLoading(false);
    }
  };

  const addField = (type: FormFieldType['type']) => {
    const newField: FormFieldType = {
      id: Date.now(),
      type,
      label: '',
      required: false,
      options: type === 'select' || type === 'radio' ? ['Option 1'] : []
    };
    setFormFields([...formFields, newField]);
  };

  const updateField = (id: number, updates: Partial<FormFieldType>) => {
    setFormFields(formFields.map(field =>
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const deleteField = (id: number) => {
    setFormFields(formFields.filter(field => field.id !== id));
  };

  const addOption = (fieldId: number) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId && field.options) {
        return {
          ...field,
          options: [...field.options, `Option ${field.options.length + 1}`]
        };
      }
      return field;
    }));
  };

  const updateOption = (fieldId: number, optionIndex: number, value: string) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId && field.options) {
        const newOptions = [...field.options];
        newOptions[optionIndex] = value;
        return { ...field, options: newOptions };
      }
      return field;
    }));
  };

  const deleteOption = (fieldId: number, optionIndex: number) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId && field.options) {
        return {
          ...field,
          options: field.options.filter((_, i) => i !== optionIndex)
        };
      }
      return field;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Competition
        </label>
        <select
          value={selectedCompetition?.id || ''}
          onChange={(e) => {
            const comp = competitions.find(c => c.id === e.target.value);
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

      {selectedCompetition && (
        <>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Form Fields</h2>
              <button
                onClick={saveForm}
                disabled={loading || formFields.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Form'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => addField('text')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Text
              </button>
              <button
                onClick={() => addField('textarea')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Long Text
              </button>
              <button
                onClick={() => addField('select')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Dropdown
              </button>
              <button
                onClick={() => addField('radio')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Radio
              </button>
              <button
                onClick={() => addField('checkbox')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Checkbox
              </button>
            </div>
          </div>

          {formFields.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              <Layout size={48} className="mx-auto mb-4 opacity-50" />
              <p>No fields yet. Add some fields to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {formFields.map((field) => (
                <div key={field.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        placeholder="Enter question"
                        className="text-lg font-medium w-full border-b-2 border-gray-200 focus:border-blue-600 outline-none pb-1"
                      />
                    </div>
                    <button
                      onClick={() => deleteField(field.id)}
                      className="ml-4 text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {(field.type === 'select' || field.type === 'radio') && (
                    <div className="space-y-2 mb-4">
                      {field.options?.map((option, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(field.id, i, e.target.value)}
                            className="flex-1 px-3 py-1 border border-gray-300 rounded"
                            placeholder={`Option ${i + 1}`}
                          />
                          {field.options && field.options.length > 1 && (
                            <button
                              onClick={() => deleteOption(field.id, i)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(field.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        + Add option
                      </button>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      className="text-blue-600"
                    />
                    Required
                  </label>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};