import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTeamNumber,
  resolveTeamNumberFieldId,
  resolveSubmissionNormalizedTeamNumber,
  sanitizeSubmissionData,
  sanitizeTeamNumberFieldId,
  validateSubmissionCompetition,
} from '../src/utils/submissionValidation.js';

test('sanitizeSubmissionData rejects values for hidden conditional fields', () => {
  const form = {
    id: 'form-a',
    competitionId: 'comp-1',
    fields: [
      { id: 1, type: 'multiple_choice', label: 'Mode', required: true, options: ['Auto', 'Teleop'] },
      {
        id: 2,
        type: 'text',
        label: 'Auto Notes',
        required: false,
        condition: { type: 'rule', fieldId: 1, operator: 'equals', value: 'Auto' },
      },
    ],
  };

  assert.throws(
    () => sanitizeSubmissionData(form, { 1: 'Teleop', 2: 'Injected' }),
    /not currently available/,
  );
});

test('sanitizeSubmissionData accepts visible conditional fields', () => {
  const form = {
    id: 'form-a',
    competitionId: 'comp-1',
    fields: [
      { id: 1, type: 'multiple_choice', label: 'Mode', required: true, options: ['Auto', 'Teleop'] },
      {
        id: 2,
        type: 'text',
        label: 'Auto Notes',
        required: true,
        condition: { type: 'rule', fieldId: 1, operator: 'equals', value: 'Auto' },
      },
    ],
  };

  assert.deepEqual(
    sanitizeSubmissionData(form, { 1: 'Auto', 2: ' Scored 3 ' }),
    { '1': 'Auto', '2': 'Scored 3' },
  );
});

test('sanitizeSubmissionData preserves picture submissions with explicit ownerUid', () => {
  const form = {
    id: 'form-a',
    competitionId: 'comp-1',
    fields: [
      { id: 1, type: 'picture', label: 'Robot Photo', required: true },
    ],
  };

  const pictureValue = {
    url: 'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/form-submissions%2Fcomp-1%2Fform-a%2Fuser-123%2F1%2F1700000000000-abc-photo.jpg?alt=media&token=abc',
    path: 'form-submissions/comp-1/form-a/user-123/1/1700000000000-abc-photo.jpg',
    name: 'photo.jpg',
    contentType: 'image/jpeg',
    size: 12345,
    ownerUid: 'user-123',
    bucket: 'test-bucket',
  };

  assert.deepEqual(
    sanitizeSubmissionData(form, { 1: pictureValue }, { allowedOwnerUids: ['user-123'] }),
    { '1': pictureValue },
  );
});

test('sanitizeSubmissionData rejects picture submissions with non-storage urls', () => {
  const form = {
    id: 'form-a',
    competitionId: 'comp-1',
    fields: [
      { id: 1, type: 'picture', label: 'Robot Photo', required: true },
    ],
  };

  assert.throws(
    () => sanitizeSubmissionData(form, {
      1: {
        url: 'https://evil.example.com/tracker.jpg',
        path: 'form-submissions/comp-1/form-a/user-123/1/1700000000000-abc-photo.jpg',
        name: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 12345,
        ownerUid: 'user-123',
        bucket: 'test-bucket',
      },
    }, { allowedOwnerUids: ['user-123'] }),
    /valid Firebase Storage download URL/,
  );
});

test('sanitizeSubmissionData rejects picture submissions when url path does not match storage path', () => {
  const form = {
    id: 'form-a',
    competitionId: 'comp-1',
    fields: [
      { id: 1, type: 'picture', label: 'Robot Photo', required: true },
    ],
  };

  assert.throws(
    () => sanitizeSubmissionData(form, {
      1: {
        url: 'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/form-submissions%2Fcomp-1%2Fform-a%2Fuser-123%2F1%2Fanother-photo.jpg?alt=media&token=abc',
        path: 'form-submissions/comp-1/form-a/user-123/1/1700000000000-abc-photo.jpg',
        name: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 12345,
        ownerUid: 'user-123',
        bucket: 'test-bucket',
      },
    }, { allowedOwnerUids: ['user-123'] }),
    /does not match the submitted storage path/,
  );
});

test('resolveTeamNumberFieldId uses explicit teamNumberFieldId before label matching', () => {
  assert.equal(resolveTeamNumberFieldId({
    teamNumberFieldId: 7,
    fields: [{ id: 1, label: 'Team Number' }],
  }), 7);
});

test('resolveTeamNumberFieldId only matches explicit team-number labels', () => {
  assert.equal(resolveTeamNumberFieldId({
    fields: [
      { id: 1, label: 'Opponent Team' },
      { id: 2, label: 'Team Captain' },
      { id: 3, label: 'Team Number (FRC)' },
    ],
  }), 3);
});

test('resolveTeamNumberFieldId returns null for ambiguous team labels', () => {
  assert.equal(resolveTeamNumberFieldId({
    fields: [
      { id: 1, label: 'Opponent Team' },
      { id: 2, label: 'Team Captain' },
      { id: 3, label: 'Alliance Team' },
    ],
  }), null);
});

test('normalizeTeamNumber strips frc prefix and other text', () => {
  assert.equal(normalizeTeamNumber('frc254'), '254');
  assert.equal(normalizeTeamNumber('Team 1678 Citrus'), '1678');
});

test('resolveSubmissionNormalizedTeamNumber derives the normalized team from the configured field', () => {
  assert.equal(resolveSubmissionNormalizedTeamNumber({
    fields: [{ id: 4, label: 'Team Number' }],
  }, {
    '4': 'frc1678',
  }), '1678');

  assert.equal(resolveSubmissionNormalizedTeamNumber({
    fields: [{ id: 4, label: 'Comments' }],
  }, {
    '4': 'ignored',
  }), null);
});

test('validateSubmissionCompetition rejects mismatched competitions', () => {
  assert.throws(
    () => validateSubmissionCompetition({ competitionId: 'comp-a' }, 'comp-b'),
    /does not match/,
  );
});

test('sanitizeTeamNumberFieldId requires the referenced field to exist', () => {
  assert.throws(
    () => sanitizeTeamNumberFieldId(99, [{ id: 1 }]),
    /must reference an existing field/,
  );
});

test('sanitizeSubmissionData rejects duplicate rank_order options', () => {
  const form = {
    id: 'form-a',
    competitionId: 'comp-1',
    fields: [
      { id: 1, type: 'rank_order', label: 'Priority', required: true, options: ['A', 'B', 'C'] },
    ],
  };

  assert.throws(
    () => sanitizeSubmissionData(form, { 1: ['A', 'A', 'B'] }),
    /cannot contain duplicate ranked options/,
  );
});

test('sanitizeSubmissionData requires rank_order fields to rank every option', () => {
  const form = {
    id: 'form-a',
    competitionId: 'comp-1',
    fields: [
      { id: 1, type: 'rank_order', label: 'Priority', required: true, options: ['A', 'B', 'C'] },
    ],
  };

  assert.throws(
    () => sanitizeSubmissionData(form, { 1: ['A', 'B'] }),
    /must rank every configured option exactly once/,
  );
});
