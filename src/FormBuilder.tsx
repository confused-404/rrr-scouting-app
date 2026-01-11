import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Eye, Layout } from 'lucide-react';

export default function FormBuilderApp() {
  const [mode, setMode] = useState('user'); // 'admin' or 'user'
  const [formFields, setFormFields] = useState([]);
  const [responses, setResponses] = useState({});
  const [submittedData, setSubmittedData] = useState([]);

  // Admin Functions
  const addField = (type) => {
    const newField = {
      id: Date.now(),
      type,
      label: '',
      required: false,
      options: type === 'select' || type === 'radio' ? ['Option 1'] : []
    };
    setFormFields([...formFields, newField]);
  };

  const updateField = (id, updates) => {
    setFormFields(formFields.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const deleteField = (id) => {
    setFormFields(formFields.filter(field => field.id !== id));
  };

  const addOption = (fieldId) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId) {
        return {
          ...field,
          options: [...field.options, `Option ${field.options.length + 1}`]
        };
      }
      return field;
    }));
  };

  const updateOption = (fieldId, optionIndex, value) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId) {
        const newOptions = [...field.options];
        newOptions[optionIndex] = value;
        return { ...field, options: newOptions };
      }
      return field;
    }));
  };

  const deleteOption = (fieldId, optionIndex) => {
    setFormFields(formFields.map(field => {
      if (field.id === fieldId) {
        return {
          ...field,
          options: field.options.filter((_, i) => i !== optionIndex)
        };
      }
      return field;
    }));
  };

  // User Functions
  const handleInputChange = (fieldId, value) => {
    setResponses({ ...responses, [fieldId]: value });
  };

  const handleSubmit = () => {
    const submission = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      data: { ...responses }
    };
    setSubmittedData([...submittedData, submission]);
    setResponses({});
    alert('Form submitted successfully!');
  };

  const renderFormField = (field, isPreview = false) => {
    const value = responses[field.id] || '';

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your answer"
          />
        );
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="4"
            placeholder="Your answer"
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an option</option>
            {field.options.map((option, i) => (
              <option key={i} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options.map((option, i) => (
              <label key={i} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  required={field.required}
                  className="text-blue-600"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleInputChange(field.id, e.target.checked)}
              required={field.required}
              className="text-blue-600"
            />
            <span>Yes</span>
          </label>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Form Builder</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('admin')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  mode === 'admin'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Edit2 size={16} />
                Admin
              </button>
              <button
                onClick={() => setMode('user')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  mode === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Eye size={16} />
                User
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {mode === 'admin' ? (
          /* Admin Mode */
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Add Form Fields</h2>
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
                {formFields.map((field, index) => (
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
                        {field.options.map((option, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(field.id, i, e.target.value)}
                              className="flex-1 px-3 py-1 border border-gray-300 rounded"
                              placeholder={`Option ${i + 1}`}
                            />
                            {field.options.length > 1 && (
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

            {submittedData.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Responses ({submittedData.length})</h2>
                <div className="space-y-4">
                  {submittedData.map((submission) => (
                    <div key={submission.id} className="border-b border-gray-200 pb-4">
                      <p className="text-sm text-gray-500 mb-2">{submission.timestamp}</p>
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
        ) : (
          /* User Mode */
          <div className="bg-white rounded-lg shadow-sm p-6">
            {formFields.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Layout size={48} className="mx-auto mb-4 opacity-50" />
                <p>No form available yet. Check back later!</p>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold mb-6">Submit Form</h2>
                {formFields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-600 ml-1">*</span>}
                    </label>
                    {renderFormField(field)}
                  </div>
                ))}
                <button
                  onClick={handleSubmit}
                  className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-medium"
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}