import type { PictureFieldValue } from '../types/form.types';

export const isPictureFieldValue = (value: unknown): value is PictureFieldValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return typeof (value as PictureFieldValue).url === 'string'
    && typeof (value as PictureFieldValue).path === 'string';
};

export const submissionValueToText = (value: unknown): string => {
  if (isPictureFieldValue(value)) {
    if (value.name && value.url) {
      return `${value.name} (${value.url})`;
    }
    return value.url || value.name || '';
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }

  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
};