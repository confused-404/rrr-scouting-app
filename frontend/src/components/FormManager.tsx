// FormManager.tsx
import React, { useState, useEffect } from 'react';
import { Trash2, Layout, Plus, Edit2, Star, Check, X } from 'lucide-react';
import type { FormField as FormFieldType, Form } from '../types/form.types';
import type { Competition } from '../types/competition.types';
import { formApi, competitionApi } from '../services/api';

export const FormManager: React.FC = () => {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
    const [forms, setForms] = useState<Form[]>([]);
    const [selectedForm, setSelectedForm] = useState<Form | null>(null);
    const [formFields, setFormFields] = useState<FormFieldType[]>([]);
    const [formName, setFormName] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // For inline name editing
    const [editingFormId, setEditingFormId] = useState<string | null>(null);
    const [editingFormName, setEditingFormName] = useState('');

    // For creation
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newFormName, setNewFormName] = useState('');

    useEffect(() => {
        loadCompetitions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedCompetition) {
            loadForms();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCompetition]);

    const loadCompetitions = async () => {
      try {
        const data = await competitionApi.getAll();
        setCompetitions(data);
        
        if (data.length > 0) {
          // If there's a selected competition, update it with fresh data
          if (selectedCompetition) {
            const updatedSelected = data.find(c => c.id === selectedCompetition.id);
            if (updatedSelected) {
              setSelectedCompetition(updatedSelected);
            } else {
              // Selected competition no longer exists, fall back to first
              setSelectedCompetition(data[0]);
            }
          } else {
            // No selection yet, pick the first one
            setSelectedCompetition(data[0]);
          }
        } else {
          // No competitions available
          setSelectedCompetition(null);
        }
        
        return data; // Return for use in handleSetActiveForm
      } catch (error) {
        console.error('Error loading competitions:', error);
        return [];
      }
    };

    const loadForms = async () => {
        if (!selectedCompetition) return;

        try {
            const data = await formApi.getFormsByCompetition(selectedCompetition.id);
            setForms(data);
            setSelectedForm(null);
            setIsEditing(false);
            setEditingFormId(null);
        } catch (error) {
            console.error('Error loading forms:', error);
        }
    };

    const handleCreateForm = async () => {
        if (!selectedCompetition) {
            alert('Please select a competition first');
            return;
        }

        if (!newFormName.trim()) {
            alert('Please enter a form name');
            return;
        }

        setLoading(true);
        try {
            const newForm = await formApi.createForm(selectedCompetition.id, [], newFormName);
            await loadForms();
            setSelectedForm(newForm);
            setFormFields([]);
            setFormName(newForm.name);
            setIsEditing(true);
            setShowCreateDialog(false);
            setNewFormName('');
        } catch (error) {
            console.error('Error creating form:', error);
            alert('Error creating form');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectForm = (formId: string) => {
        const form = forms.find((f) => f.id === formId);
        if (form) {
            setSelectedForm(form);
            setFormFields([...form.fields]);
            setFormName(form.name);
            setIsEditing(true);
        }
    };

    const handleSaveForm = async () => {
        if (!selectedForm) return;

        setLoading(true);
        try {
            await formApi.updateForm(selectedForm.id, formFields, formName);
            await loadForms();
            alert('Form saved successfully!');
        } catch (error) {
            console.error('Error saving form:', error);
            alert('Error saving form');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteForm = async () => {
        if (!selectedForm) return;

        if (!confirm('Are you sure you want to delete this form? This cannot be undone.')) {
            return;
        }

        setLoading(true);
        try {
            await formApi.deleteForm(selectedForm.id);
            await loadForms();
            setSelectedForm(null);
            setFormFields([]);
            setFormName('');
            setIsEditing(false);
            alert('Form deleted successfully!');
        } catch (error) {
            console.error('Error deleting form:', error);
            alert('Error deleting form');
        } finally {
            setLoading(false);
        }
    };

    const handleSetActiveForm = async (formId: string | null) => {
        if (!selectedCompetition) return;

        setLoading(true);
        try {
            await competitionApi.setActiveForm(selectedCompetition.id, formId);
            await loadCompetitions();
        } catch (error) {
            console.error('Error setting active form:', error);
            alert('Error setting active form');
        } finally {
            setLoading(false);
        }
    };

    const startEditingFormName = (form: Form) => {
        setEditingFormId(form.id);
        setEditingFormName(form.name || '');
    };

    const cancelEditingFormName = () => {
        setEditingFormId(null);
        setEditingFormName('');
    };

    const saveFormName = async (formId: string) => {
        if (!editingFormName.trim()) {
            alert('Form name cannot be empty');
            return;
        }

        setLoading(true);
        try {
            const form = forms.find((f) => f.id === formId);
            if (form) {
                await formApi.updateForm(formId, form.fields, editingFormName);
                await loadForms();
                setEditingFormId(null);
                setEditingFormName('');
            }
        } catch (error) {
            console.error('Error updating form name:', error);
            alert('Error updating form name');
        } finally {
            setLoading(false);
        }
    };

    const addField = (type: FormFieldType['type']) => {
        const base: FormFieldType = {
            id: Date.now(),
            type,
            label: '',
            required: false,
        };

        if (type === 'multiple_choice' || type === 'multiple_select') {
            setFormFields([...formFields, { ...base, options: ['Option 1'] }]);
            return;
        }

        if (type === 'number') {
            setFormFields([...formFields, { ...base, unit: '' }]);
            return;
        }

        if (type === 'ranking') {
            setFormFields([...formFields, { ...base, min: 1, max: 10 }]);
            return;
        }

        setFormFields([...formFields, base]);
    };


    const updateField = (id: number, updates: Partial<FormFieldType>) => {
        setFormFields(formFields.map((field) => (field.id === id ? { ...field, ...updates } : field)));
    };

    const deleteField = (id: number) => {
        setFormFields(formFields.filter((field) => field.id !== id));
    };

    const addOption = (fieldId: number) => {
        setFormFields(
            formFields.map((field) => {
                if (field.id === fieldId) {
                    const existing = field.options ?? [];
                    return { ...field, options: [...existing, `Option ${existing.length + 1}`] };
                }
                return field;
            })
        );
    };

    const updateOption = (fieldId: number, optionIndex: number, value: string) => {
        setFormFields(
            formFields.map((field) => {
                if (field.id === fieldId) {
                    const existing = field.options ?? [];
                    const next = [...existing];
                    next[optionIndex] = value;
                    return { ...field, options: next };
                }
                return field;
            })
        );
    };

    const deleteOption = (fieldId: number, optionIndex: number) => {
        setFormFields(
            formFields.map((field) => {
                if (field.id === fieldId) {
                    const existing = field.options ?? [];
                    return { ...field, options: existing.filter((_, i) => i !== optionIndex) };
                }
                return field;
            })
        );
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

            {/* Create Form Dialog */}
            {showCreateDialog && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Create New Form</h3>
                    <input
                        type="text"
                        value={newFormName}
                        onChange={(e) => setNewFormName(e.target.value)}
                        placeholder="Enter form name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreateForm}
                            disabled={loading || !newFormName.trim()}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                            Create
                        </button>
                        <button
                            onClick={() => {
                                setShowCreateDialog(false);
                                setNewFormName('');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Form Selection & Creation */}
            {selectedCompetition && !showCreateDialog && (
                <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Forms</h3>
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Plus size={18} />
                            Create New Form
                        </button>
                    </div>

                    {forms.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No forms yet. Create one to get started!</p>
                    ) : (
                        <div className="space-y-2">
                            {forms.map((form) => (
                                <div
                                    key={form.id}
                                    className="flex items-center gap-2 p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                                >
                                    {editingFormId === form.id ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editingFormName}
                                                onChange={(e) => setEditingFormName(e.target.value)}
                                                className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => saveFormName(form.id)}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                                                title="Save"
                                            >
                                                <Check size={18} />
                                            </button>
                                            <button
                                                onClick={cancelEditingFormName}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                title="Cancel"
                                            >
                                                <X size={18} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleSelectForm(form.id)}
                                                className="flex-1 text-left flex items-center gap-2"
                                            >
                                                <span className="font-medium">{form.name}</span>
                                                <span className="text-sm text-gray-500">
                                                    ({form.fields.length} field{form.fields.length !== 1 ? 's' : ''})
                                                </span>
                                            </button>

                                            <button
                                                onClick={() => startEditingFormName(form)}
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit name"
                                            >
                                                <Edit2 size={16} />
                                            </button>

                                            <button
                                                onClick={() =>
                                                    handleSetActiveForm(
                                                        selectedCompetition.activeFormId === form.id ? null : form.id
                                                    )
                                                }
                                                className={`p-2 rounded ${selectedCompetition.activeFormId === form.id
                                                    ? 'bg-yellow-100 text-yellow-600'
                                                    : 'text-gray-400 hover:text-yellow-600'
                                                    }`}
                                                title={selectedCompetition.activeFormId === form.id ? 'Active form' : 'Set as active'}
                                            >
                                                <Star size={18} fill={selectedCompetition.activeFormId === form.id ? 'currentColor' : 'none'} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Form Editor */}
            {isEditing && selectedForm && (
                <>
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Form Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter form name"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDeleteForm}
                                    disabled={loading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                                >
                                    Delete Form
                                </button>
                                <button
                                    onClick={handleSaveForm}
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => addField('text')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                + Text
                            </button>
                            <button
                                onClick={() => addField('number')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                + Number
                            </button>
                            <button
                                onClick={() => addField('ranking')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                + Ranking
                            </button>

                            <button
                                onClick={() => addField('multiple_choice')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                + Multiple Choice
                            </button>
                            <button
                                onClick={() => addField('multiple_select')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                + Multiple Select
                            </button>
                        </div>
                    </div>

                    {formFields.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                            <Layout size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No fields yet. Add some fields above!</p>
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
                                        <button onClick={() => deleteField(field.id)} className="ml-4 text-red-600 hover:text-red-700">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>

                                    {/* Unit input for number */}
                                    {field.type === 'number' && (
                                        <div className="mb-4 max-w-xs">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit (optional)</label>
                                            <input
                                                type="text"
                                                value={field.unit ?? ''}
                                                onChange={(e) => updateField(field.id, { unit: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="e.g., lbs, kg, seconds"
                                            />
                                        </div>
                                    )}

                                    {field.type === 'ranking' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-w-md">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
                                                <input
                                                    type="number"
                                                    value={field.min ?? 1}
                                                    onChange={(e) => updateField(field.id, { min: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
                                                <input
                                                    type="number"
                                                    value={field.max ?? 10}
                                                    onChange={(e) => updateField(field.id, { max: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <p className="sm:col-span-2 text-xs text-gray-500">
                                                Users will pick an integer from Min to Max.
                                            </p>
                                        </div>
                                    )}


                                    {/* Options editor */}
                                    {(field.type === 'multiple_choice' || field.type === 'multiple_select') && (
                                        <div className="space-y-2 mb-4">
                                            {(field.options ?? []).map((option, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={option}
                                                        onChange={(e) => updateOption(field.id, i, e.target.value)}
                                                        className="flex-1 px-3 py-1 border border-gray-300 rounded"
                                                        placeholder={`Option ${i + 1}`}
                                                    />
                                                    {(field.options ?? []).length > 1 && (
                                                        <button onClick={() => deleteOption(field.id, i)} className="text-red-600 hover:text-red-700">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button onClick={() => addOption(field.id)} className="text-blue-600 hover:text-blue-700 text-sm">
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
