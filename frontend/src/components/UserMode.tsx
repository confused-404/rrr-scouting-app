import React, { useState, useEffect } from 'react';
import { Layout } from 'lucide-react';
import type { FormField as FormFieldType } from '../types/form.types';
import { FormField } from './FormField';
import { formApi } from '../services/api';

export const UserMode: React.FC = () => {
  const [formFields, setFormFields] = useState<FormFieldType[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadForm();
  }, []);

  const loadForm = async () => {
    try {
      const forms = await formApi.getForms();
      if (forms.length > 0) {
        setFormFields(forms[0].fields);
        setCurrentFormId(forms[0].id);
      }
    } catch (error) {
      console.error('Error loading form:', error);
    }
  };

  const handleInputChange = (fieldId: number, value: any) => {
    setResponses({ ...responses, [fieldId]: value });
  };

  const handleSubmit = async () => {
    if (!currentFormId) {
      alert('No form available');
      return;
    }

    setLoading(true);
    try {
      await formApi.createSubmission(currentFormId, responses);
      setResponses({});
      alert('Form submitted successfully!');
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form');
    } finally {
      setLoading(false);
    }
  };

  if (formFields.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12 text-gray-500">
          <Layout size={48} className="mx-auto mb-4 opacity-50" />
          <p>No form available yet. Check back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold mb-6">Submit Form</h2>
        {formFields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-600 ml-1">*</span>}
            </label>
            <FormField
              field={field}
              value={responses[field.id]}
              onChange={(value) => handleInputChange(field.id, value)}
            />
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