import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReadPrivilegedCompetitionFields,
  serializeCompetition,
} from '../src/utils/competitionResponse.js';

const baseCompetition = {
  id: 'comp-1',
  name: 'Regional',
  season: '2026',
  status: 'active',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  createdAt: '2026-04-01T00:00:00.000Z',
  formIds: ['form-1'],
  activeFormIds: ['form-1'],
  eventKey: '2026miket',
  pitMapImageUrl: 'https://example.com/pit-map.jpg',
  superscouterNotes: { '1234': { notes: 'secret', rating: 5 } },
  driveTeamStrategyByTeam: { '1234': { qm1: 'protect left side' } },
  robotBreakTimelineOverrides: { '1234': {} },
  pitLocations: { '1234': 'A1' },
  manualPickLists: [{ id: 'list-1', name: 'Finals' }],
};

test('serializeCompetition strips privileged fields for regular scouts', () => {
  const serialized = serializeCompetition(baseCompetition, { appRole: 'user' });

  assert.equal(serialized.name, 'Regional');
  assert.equal(serialized.pitMapImageUrl, 'https://example.com/pit-map.jpg');
  assert.equal('superscouterNotes' in serialized, false);
  assert.equal('driveTeamStrategyByTeam' in serialized, false);
  assert.equal('robotBreakTimelineOverrides' in serialized, false);
  assert.equal('pitLocations' in serialized, false);
  assert.equal('manualPickLists' in serialized, false);
});

test('serializeCompetition preserves privileged fields for drive-team and admin users', () => {
  assert.equal(canReadPrivilegedCompetitionFields({ appRole: 'drive' }), true);
  assert.equal(canReadPrivilegedCompetitionFields({ appRole: 'admin' }), true);

  const driveSerialized = serializeCompetition(baseCompetition, { appRole: 'drive' });
  const adminSerialized = serializeCompetition(baseCompetition, { admin: true });

  assert.deepEqual(driveSerialized.superscouterNotes, baseCompetition.superscouterNotes);
  assert.deepEqual(adminSerialized.driveTeamStrategyByTeam, baseCompetition.driveTeamStrategyByTeam);
});
