import { describe, expect, it } from 'vitest';
import { isPictureFieldValue, submissionValueToText } from './formValues';

describe('formValues', () => {
  it('detects picture field values', () => {
    expect(isPictureFieldValue({ url: 'https://example.com/a.jpg', path: 'uploads/a.jpg' })).toBe(true);
    expect(isPictureFieldValue({ url: 'https://example.com/a.jpg' })).toBe(false);
  });

  it('formats picture values for display', () => {
    expect(submissionValueToText({
      url: 'https://example.com/a.jpg',
      path: 'uploads/a.jpg',
      name: 'robot.jpg',
    })).toBe('robot.jpg (https://example.com/a.jpg)');
  });

  it('formats array values as comma-separated text', () => {
    expect(submissionValueToText([' intake ', 'climb', '', null])).toBe('intake, climb');
  });

  it('formats empty values as empty strings', () => {
    expect(submissionValueToText(undefined)).toBe('');
    expect(submissionValueToText(null)).toBe('');
  });
});
