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

    case 'rank_order': {
      const options = field.options ?? [];
      const selectedOptions: string[] = Array.isArray(value) ? value : [];

      const toggleOption = (option: string) => {
        if (selectedOptions.includes(option)) {
          // Remove option
          onChange(selectedOptions.filter(o => o !== option));
        } else {
          // Add option at the end
          onChange([...selectedOptions, option]);
        }
      };

      const moveUp = (index: number) => {
        if (index === 0) return;
        const newOrder = [...selectedOptions];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        onChange(newOrder);
      };

      const moveDown = (index: number) => {
        if (index === selectedOptions.length - 1) return;
        const newOrder = [...selectedOptions];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        onChange(newOrder);
      };

      return (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-3">First, select the locations/paths that apply to this robot:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.length > 0 ? options.map((option) => (
                <label key={option} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={() => toggleOption(option)}
                    className="text-blue-600"
                  />
                  <span>{option}</span>
                </label>
              )) : (
                <p className="text-sm text-gray-500">No options configured for this field.</p>
              )}
            </div>
          </div>

          {selectedOptions.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-3">Now rank them from most preferred (top) to least preferred (bottom):</p>
              <div className="space-y-2">
                {selectedOptions.map((option, index) => (
                  <div key={option} className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                    <span className="text-sm font-medium text-blue-700 w-6">{index + 1}.</span>
                    <span className="flex-1">{option}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === selectedOptions.length - 1}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
};
export default FormField;