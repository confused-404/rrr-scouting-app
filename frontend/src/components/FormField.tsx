// FormField.tsx
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
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your answer"
        />
      );

    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === '' ? '' : Number(raw));
            }}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          {field.unit ? <span className="text-sm text-gray-600 whitespace-nowrap">{field.unit}</span> : null}
        </div>
      );

    case 'ranking': {
      const min = Number.isFinite(field.min) ? Number(field.min) : 1;
      const max = Number.isFinite(field.max) ? Number(field.max) : 10;
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);

      const current =
        value === undefined || value === null || value === ''
          ? lo
          : Number(value);

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{lo}</span>
            <span className="font-medium text-gray-900">{current}</span>
            <span>{hi}</span>
          </div>

          <input
            type="range"
            min={lo}
            max={hi}
            step={1}
            value={current}
            onChange={(e) => { onChange(Number(e.target.value)); }}
            className="w-full"
            aria-label={field.label}
          />

          <div className="text-xs text-gray-500">Selected: {current}</div>
        </div>
      );
    }

    case 'multiple_choice': {
      const options = field.options ?? [];
      return (
        <div className="space-y-2">
          {options.map((option, i) => (
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
    }

    case 'multiple_select': {
      const options = field.options ?? [];
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {options.map((option, i) => {
            const checked = selected.includes(option);
            return (
              <label key={i} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...selected, option]))
                      : selected.filter((v) => v !== option);
                    onChange(next);
                  }}
                  className="text-blue-600"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    default:
      return null;
  }
};
export default FormField;