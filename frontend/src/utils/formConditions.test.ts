import { describe, expect, it } from 'vitest';
import {
  createDefaultCondition,
  evaluateCondition,
  getConditionReferences,
  normalizeCondition,
} from './formConditions';

describe('formConditions', () => {
  it('normalizes invalid conditions to null', () => {
    expect(normalizeCondition({ fieldId: 'x' }, 'current-form')).toBeNull();
  });

  it('creates a default condition group for a field reference', () => {
    expect(createDefaultCondition({ formId: 'form-a', fieldId: 7 })).toEqual({
      type: 'group',
      combinator: 'and',
      conditions: [
        {
          type: 'rule',
          formId: 'form-a',
          fieldId: 7,
          operator: 'equals',
          value: '',
        },
      ],
    });
  });

  it('evaluates grouped cross-form conditions', () => {
    const condition = {
      type: 'group' as const,
      combinator: 'and' as const,
      conditions: [
        { type: 'rule' as const, formId: 'form-a', fieldId: 1, operator: 'equals' as const, value: 'yes' },
        { type: 'rule' as const, formId: 'form-b', fieldId: 2, operator: 'contains' as const, value: 'fast' },
      ],
    };

    const result = evaluateCondition(
      condition,
      ({ formId, fieldId }) => {
        if (formId === 'form-a' && fieldId === 1) return 'yes';
        if (formId === 'form-b' && fieldId === 2) return ['fast', 'reliable'];
        return undefined;
      },
      'current-form',
    );

    expect(result).toBe(true);
  });

  it('returns normalized condition references', () => {
    const refs = getConditionReferences({
      type: 'group',
      combinator: 'or',
      conditions: [
        { type: 'rule', fieldId: 1, operator: 'equals', value: 'x' },
        { type: 'rule', formId: 'form-b', fieldId: 2, operator: 'not_equals', value: 'y' },
      ],
    }, 'form-a');

    expect(refs).toEqual([
      { formId: 'form-a', fieldId: 1 },
      { formId: 'form-b', fieldId: 2 },
    ]);
  });
});
