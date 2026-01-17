import React, { useState, useEffect } from 'react';
import { Trash2, Layout, Plus, Star } from 'lucide-react';
import type { FormField as FormFieldType, Submission, Form } from '../types/form.types';
import type { Competition } from '../types/competition.types';
import { formApi, competitionApi } from '../services/api';

interface AdminModeProps {
  selectedCompetition: Competition | null;
  onRefreshCompetitions?: () => void;
}

export const AdminMode: React.FC<AdminModeProps> = ({ selectedCompetition, onRefreshCompetitions }) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [formFields, setFormFields] = useState<FormFieldType[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    if (selectedCompetition) {
      loadFormsForCompetition();
    }
  }, [selectedCompetition]);

  useEffect(() => {
    if (currentFormId) {
      loadSubmissions(currentFormId);
    }
  }, [currentFormId]);

  const loadFormsForCompetition = async () => {
    if (!selectedCompetition) return;

    try {
      const allForms = await formApi.getFormsByCompetition(selectedCompetition.id);
      setForms(allForms);
      
      if (allForms.length > 0) {
        // Select active form if it exists, otherwise select first form
        const activeForm = allForms.find(f => f.id === selectedCompetition.activeFormId);
        const formToSelect = activeForm || allForms[0];
        setCurrentFormId(formToSelect.id);
        setFormFields(formToSelect.fields);
        setShowNewForm(false);
      } else {
        setCurrentFormId(null);
        setFormFields([]);
        setSubmissions([]);
      }
    } catch (error) {
      console.error('Error loading forms:', error);
    }
  };

  const loadSubmissions = async (formId: string) => {
    try {
      const subs = await formApi.getSubmissions(formId);
      setSubmissions(subs);
    } catch (error) {
      console.error('Error loading submissions:', error);
    }
  };

  const handleCreateNewForm = () => {
    setCurrentFormId(null);
    setFormFields([]);
    setSubmissions([]);
    setShowNewForm(true);
  };

  const handleSelectForm = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setCurrentFormId(formId);
      setFormFields(form.fields);
      setShowNewForm(false);
      loadSubmissions(formId);
    }
  };

  const saveForm = async () => {
    if (!selectedCompetition) {
      alert('Please select a competition first');
      return;
    }

    setLoading(true);
    try {
      if (currentFormId && !showNewForm) {
        // Update existing form
        await formApi.updateForm(currentFormId, formFields);
        alert('Form updated successfully!');
      } else {
        // Create new form
        const newForm = await formApi.createForm(selectedCompetition.id, formFields);
        
        // Add the form to the competition
        await competitionApi.addForm(selectedCompetition.id, newForm.id);
        
        setCurrentFormId(newForm.id);
        setShowNewForm(false);
        
        // Refresh competitions to update formIds
        if (onRefreshCompetitions) {
          onRefreshCompetitions();
        }
        
        alert('Form created and assigned to competition successfully!');
      }
      
      // Reload forms
      await loadFormsForCompetition();
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Error saving form');
    } finally {
      setLoading(false);
    }
  };

  const deleteForm = async (formId: string) => {
    if (!selectedCompetition || !confirm('Are you sure you want to delete this form?')) {
      return;
    }

    try {
      setLoading(true);
      
      // Remove form from competition
      await competitionApi.removeForm(selectedCompetition.id, formId);
      
      // Delete the form
      await formApi.deleteForm(formId);
      
      // Refresh
      if (onRefreshCompetitions) {
        onRefreshCompetitions();
      }
      
      await loadFormsForCompetition();
      alert('Form deleted successfully!');
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('Error deleting form');
    } finally {
      setLoading(false);
    }
  };

  const setActiveForm = async (formId: string) => {
    if (!selectedCompetition) return;

    try {
      await competitionApi.setActiveForm(selectedCompetition.id, formId);
      
      if (onRefreshCompetitions) {
        onRefreshCompetitions();
      }
      
      alert('Active form updated!');
    } catch (error) {
      console.error('Error setting active form:', error);
      alert('Error setting active form');
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

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Layout size={48} className="mx-auto mb-4 opacity-50" />
        <p>Please select a competition to manage its forms</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Managing forms for:</strong> {selectedCompetition.name} ({selectedCompetition.season})
        </p>
      </div>

      {/* Forms List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Forms</h2>
          <button
            onClick={handleCreateNewForm}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <Plus size={16} />
            New Form
          </button>
        </div>

        {forms.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No forms yet. Create one to get started!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forms.map((form) => (
              <div
                key={form.id}
                className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                  currentFormId === form.id && !showNewForm
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleSelectForm(form.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Form - {form.fields.length} field(s)</p>
                    <p className="text-sm text-gray-500">Created: {new Date(form.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedCompetition.activeFormId === form.id && (
                      <Star size={16} className="text-yellow-500 fill-yellow-500" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveForm(form.id);
                      }}
                      className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                        selectedCompetition.activeFormId === form.id
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <Star size={12} />
                      Active
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteForm(form.id);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Editor */}
      {(currentFormId !== null || showNewForm) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {showNewForm ? 'Create New Form' : 'Edit Form'}
            </h2>
            <button
              onClick={saveForm}
              disabled={loading || formFields.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Form'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
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

          {formFields.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center text-gray-500">
              <Layout size={48} className="mx-auto mb-4 opacity-50" />
              <p>No fields yet. Add some fields to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {formFields.map((field) => (
                <div key={field.id} className="bg-gray-50 rounded-lg p-6">
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
        </div>
      )}

      {/* Submissions */}
      {!showNewForm && submissions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Responses ({submissions.length})</h2>
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div key={submission.id} className="border-b border-gray-200 pb-4">
                <p className="text-sm text-gray-500 mb-2">{new Date(submission.timestamp).toLocaleString()}</p>
                {Object.entries(submission.data).map(([fieldId, value]) => {
                  const field = formFields.find(f => f.id === parseInt(fieldId));
                  return field ? (
                    <div key={fieldId} className="mb-2">
                      <p className="font-medium text-sm">{field.label}</p>
                      <p className="text-gray-700">{String(value)}</p>
                    </div>
                  ) : null;
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};