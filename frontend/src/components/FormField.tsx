import React from 'react';
import type { FormField as FormFieldType } from '../types/form.types';

interface FormFieldProps {
  field: FormFieldType;
  value: any;
  onChange: (value: any) => void;
}

export const FormField: React.FC<FormFieldProps> = ({ field, value, onChange }) => {
  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your answer"
        />
      );

    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="Your answer"
        />
      );

    case 'select':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select an option</option>
          {field.options?.map((option, i) => (
            <option key={i} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {field.options?.map((option, i) => (
            <label key={i} className="flex items-center space-x-2">
              <input
                type="radio"
                name={`field-${field.id}`}
                value={option}
                checked={value === option}
                onChange={(e) => onChange(e.target.value)}
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
            onChange={(e) => onChange(e.target.checked)}
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