import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCreateCompetitionInput,
  buildUpdateCompetitionInput,
} from '../src/utils/competitionPayload.js';

test('buildCreateCompetitionInput preserves formIds and activeFormIds', () => {
  const input = buildCreateCompetitionInput({
    name: 'Test Event',
    season: '2026',
    formIds: ['form-a', ' form-b ', '', null],
    activeFormIds: ['active-a'],
  });

  assert.deepEqual(input.formIds, ['form-a', 'form-b']);
  assert.deepEqual(input.activeFormIds, ['active-a']);
});

test('buildCreateCompetitionInput applies defaults for optional fields', () => {
  const input = buildCreateCompetitionInput({
    name: 'Test Event',
    season: '2026',
  });

  assert.equal(input.status, 'draft');
  assert.deepEqual(input.manualPickLists, []);
  assert.deepEqual(input.robotBreakTimelineOverrides, {});
});

test('buildCreateCompetitionInput rejects invalid statuses', () => {
  assert.throws(
    () => buildCreateCompetitionInput({
      name: 'Test Event',
      season: '2026',
      status: 'broken',
    }),
    /Competition status must be one of/,
  );
});

test('buildUpdateCompetitionInput rejects malformed dates', () => {
  assert.throws(
    () => buildUpdateCompetitionInput({
      startDate: 'not-a-date',
    }),
    /startDate must be a valid date string/,
  );
});

test('buildUpdateCompetitionInput keeps explicit empty arrays and null active form', () => {
  const input = buildUpdateCompetitionInput({
    formIds: [],
    activeFormIds: [],
    activeFormId: '',
    pitMapImageUrl: '  ',
  });

  assert.deepEqual(input.formIds, []);
  assert.deepEqual(input.activeFormIds, []);
  assert.equal(input.activeFormId, null);
  assert.equal(input.pitMapImageUrl, '');
});

test('buildUpdateCompetitionInput rejects inline pit-map data URLs', () => {
  assert.throws(
    () => buildUpdateCompetitionInput({
      pitMapImageUrl: 'data:image/jpeg;base64,abc123',
    }),
    /Inline pit-map images are not allowed/,
  );
});
