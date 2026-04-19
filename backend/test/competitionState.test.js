import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeActiveFormIds,
  stripFormFromCompetitionState,
} from '../src/utils/competitionState.js';

test('normalizeActiveFormIds merges legacy and current fields without duplicates', () => {
  assert.deepEqual(
    normalizeActiveFormIds({
      activeFormId: 'form-a',
      activeFormIds: ['form-a', 'form-b', ' form-b '],
    }),
    ['form-a', 'form-b'],
  );
});

test('stripFormFromCompetitionState removes deleted forms from formIds and activeFormIds', () => {
  assert.deepEqual(
    stripFormFromCompetitionState({
      formIds: ['form-a', 'form-b'],
      activeFormIds: ['form-b'],
      activeFormId: 'form-b',
    }, 'form-b'),
    {
      formIds: ['form-a'],
      activeFormIds: [],
    },
  );
});
