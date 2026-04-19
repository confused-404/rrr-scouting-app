import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFormAllowsSubmission,
  collectCrossFormFieldReferences,
} from '../src/utils/submissionAccess.js';

test('collectCrossFormFieldReferences returns only foreign conditional dependencies', () => {
  const references = collectCrossFormFieldReferences({
    id: 'form-a',
    fields: [
      {
        id: 1,
        type: 'text',
        label: 'Notes',
        condition: {
          type: 'group',
          combinator: 'and',
          conditions: [
            { type: 'rule', formId: 'form-b', fieldId: 4, operator: 'equals', value: 'yes' },
            { type: 'rule', fieldId: 2, operator: 'equals', value: 'local' },
            { type: 'rule', formId: 'form-c', fieldId: 7, operator: 'contains', value: 'done' },
          ],
        },
      },
    ],
  });

  assert.deepEqual(
    Array.from(references.entries()).map(([formId, fieldIds]) => [formId, Array.from(fieldIds.values())]),
    [
      ['form-b', [4]],
      ['form-c', [7]],
    ],
  );
});

test('assertFormAllowsSubmission rejects inactive forms', () => {
  assert.throws(
    () => assertFormAllowsSubmission({
      status: 'active',
      activeFormIds: ['form-b'],
    }, 'form-a'),
    /not currently accepting submissions/,
  );
});

test('assertFormAllowsSubmission rejects non-active competitions', () => {
  assert.throws(
    () => assertFormAllowsSubmission({
      status: 'draft',
      activeFormIds: ['form-a'],
    }, 'form-a'),
    /competition is not currently accepting submissions/,
  );
});

test('assertFormAllowsSubmission accepts active forms on active competitions', () => {
  assert.doesNotThrow(() => assertFormAllowsSubmission({
    status: 'active',
    activeFormIds: ['form-a', 'form-b'],
  }, 'form-a'));
});
