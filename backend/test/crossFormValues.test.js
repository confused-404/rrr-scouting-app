import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCrossFormValuesForTeam } from '../src/utils/crossFormValues.js';

test('buildCrossFormValuesForTeam uses the latest submission per eligible form', () => {
  const values = buildCrossFormValuesForTeam({
    competitionId: 'comp-1',
    currentFormId: 'form-a',
    teamNumber: 'frc254',
    forms: [
      {
        id: 'form-a',
        competitionId: 'comp-1',
        teamNumberFieldId: 1,
        fields: [{ id: 1, label: 'Team Number' }],
      },
      {
        id: 'form-b',
        competitionId: 'comp-1',
        teamNumberFieldId: 7,
        fields: [{ id: 7, label: 'Team Number' }, { id: 8, label: 'Cycles' }],
      },
      {
        id: 'form-c',
        competitionId: 'comp-1',
        fields: [{ id: 3, label: 'Team Number' }, { id: 4, label: 'Notes' }],
      },
    ],
    submissions: [
      {
        id: 'sub-1',
        formId: 'form-b',
        competitionId: 'comp-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        data: { '7': '254', '8': 3 },
      },
      {
        id: 'sub-2',
        formId: 'form-b',
        competitionId: 'comp-1',
        timestamp: '2026-01-01T01:00:00.000Z',
        data: { '7': 'Team 254', '8': 5 },
      },
      {
        id: 'sub-3',
        formId: 'form-c',
        competitionId: 'comp-1',
        timestamp: '2026-01-01T02:00:00.000Z',
        data: { '3': 'frc254', '4': 'latest note' },
      },
      {
        id: 'sub-4',
        formId: 'form-c',
        competitionId: 'comp-1',
        timestamp: '2026-01-01T03:00:00.000Z',
        data: { '3': '111', '4': 'wrong team' },
      },
    ],
    referencedFieldsByFormId: new Map([
      ['form-b', new Set([8])],
      ['form-c', new Set([4])],
    ]),
  });

  assert.deepEqual(values, {
    'form-b:8': 5,
    'form-c:4': 'latest note',
  });
});

test('buildCrossFormValuesForTeam ignores ineligible forms and invalid input', () => {
  assert.deepEqual(buildCrossFormValuesForTeam({
    competitionId: 'comp-1',
    currentFormId: 'form-a',
    teamNumber: '',
    forms: [],
    submissions: [],
  }), {});

  assert.deepEqual(buildCrossFormValuesForTeam({
    competitionId: 'comp-1',
    currentFormId: 'form-a',
    teamNumber: '254',
    forms: [
      { id: 'form-a', competitionId: 'comp-1', teamNumberFieldId: 1, fields: [{ id: 1, label: 'Team Number' }] },
      { id: 'form-b', competitionId: 'comp-1', fields: [{ id: 9, label: 'Comments' }] },
    ],
    submissions: [
      {
        id: 'sub-1',
        formId: 'form-b',
        competitionId: 'comp-1',
        timestamp: '2026-01-01T01:00:00.000Z',
        data: { '9': 'ignored' },
      },
    ],
    referencedFieldsByFormId: new Map([['form-b', new Set([9])]]),
  }), {});
});

test('buildCrossFormValuesForTeam omits forms without referenced fields', () => {
  const values = buildCrossFormValuesForTeam({
    competitionId: 'comp-1',
    currentFormId: 'form-a',
    teamNumber: '254',
    forms: [
      {
        id: 'form-b',
        competitionId: 'comp-1',
        teamNumberFieldId: 7,
        fields: [{ id: 7, label: 'Team Number' }, { id: 8, label: 'Cycles' }],
      },
    ],
    submissions: [
      {
        id: 'sub-1',
        formId: 'form-b',
        competitionId: 'comp-1',
        timestamp: '2026-01-01T01:00:00.000Z',
        data: { '7': '254', '8': 4 },
      },
    ],
    referencedFieldsByFormId: new Map(),
  });

  assert.deepEqual(values, {});
});
