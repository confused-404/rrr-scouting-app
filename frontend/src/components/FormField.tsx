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
      const ranked: string[] = Array.isArray(value)
        ? value.map((item) => String(item ?? '').trim()).filter((item) => item !== '')
        : [];

      const addOptionToEnd = (option: string) => {
        onChange([...ranked, option]);
      };

      const removeAt = (index: number) => {
        const next = [...ranked];
        next.splice(index, 1);
        onChange(next);
      };

      const moveItem = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= ranked.length || toIndex >= ranked.length) return;

        const next = [...ranked];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onChange(next);
      };

      return (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Options (click to add to end)</p>
            <div className="flex flex-wrap gap-2">
              {options.length > 0 ? options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => addOptionToEnd(option)}
                  className="px-3 py-1.5 text-sm rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  {option}
                </button>
              )) : (
                <p className="text-sm text-gray-500">No options configured for this field.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-3">Ranked List (drag to reorder)</p>
            <div className="space-y-2">
              {ranked.length > 0 ? (
                ranked.map((option, index) => (
                  <div
                    key={`${option}-${index}`}
                    className="flex items-center gap-2 p-2 bg-blue-50 rounded-md border border-blue-100"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(index));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      if (Number.isNaN(from)) return;
                      moveItem(from, index);
                    }}
                  >
                    <span className="w-7 text-sm font-semibold text-gray-700">{index + 1}.</span>
                    <span className="flex-1 text-sm">{option}</span>
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No ranked items yet. Click an option to add one.</p>
              )}

              {ranked.length > 1 && (
                <div
                  className="p-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded-md"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    if (Number.isNaN(from)) return;
                    moveItem(from, ranked.length - 1);
                  }}
                >
                  Drag items onto another row to reorder.
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Options can be reused and added multiple times.</p>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
};
export default FormField;