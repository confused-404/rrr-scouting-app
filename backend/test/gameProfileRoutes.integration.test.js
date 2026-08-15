import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFirestoreHarness,
  createRouterRequester,
  ensureBackendTestEnv,
} from '../support/routerHarness.js';

ensureBackendTestEnv();

const { auth, db } = await import('../src/config/firebase.js');

const tokenClaimsByToken = new Map([
  ['admin-token', { uid: 'admin-1', email: 'admin@example.com', admin: true }],
  ['scout-token', { uid: 'scout-1', email: 'scout@example.com' }],
]);

const harness = createFirestoreHarness(() => ({
  gameProfiles: {
    'profile-2026': {
      name: '2026 REBUILT',
      season: '2026',
      status: 'draft',
      configuration: { metrics: [], teamLookupCards: [], pickListModels: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
}));

const installHarness = () => harness.install({ db, auth, tokenClaimsByToken });
installHarness();

const { default: gameProfileRoutes } = await import('../src/routes/gameProfileRoutes.js');
const requestJson = createRouterRequester(gameProfileRoutes, '/api/game-profiles');

afterEach(() => {
  harness.reset();
  installHarness();
});

test('game profile routes allow admins to create and publish a season profile', async () => {
  const created = await requestJson('/api/game-profiles', {
    method: 'POST',
    token: 'admin-token',
    body: { name: '2027 Game', season: '2027' },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.name, '2027 Game');
  assert.equal(created.body.status, 'draft');
  assert.deepEqual(created.body.configuration, { metrics: [], teamLookupCards: [], teamLookupSections: [], pickListModels: [], pickListGroups: [], analysisEquations: [] });

  const published = await requestJson(`/api/game-profiles/${created.body.id}/publish`, {
    method: 'POST',
    token: 'admin-token',
  });

  assert.equal(published.status, 200);
  assert.equal(published.body.status, 'published');
  assert.equal(harness.fixture._system['gameProfile-2027'].gameProfileId, created.body.id);
});

test('game profile routes reject non-admin access', async () => {
  const response = await requestJson('/api/game-profiles', {
    token: 'scout-token',
  });

  assert.equal(response.status, 403);
});

test('game profile routes validate required creation fields', async () => {
  const response = await requestJson('/api/game-profiles', {
    method: 'POST',
    token: 'admin-token',
    body: { name: '', season: '2027' },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Game profile name is required.');
});

test('preview test data is admin-only, isolated, and deleted when publishing', async () => {
  const denied = await requestJson('/api/game-profiles/profile-2026/test-data', { token: 'scout-token' });
  assert.equal(denied.status, 403);

  const saved = await requestJson('/api/game-profiles/profile-2026/test-data', {
    method: 'PUT', token: 'admin-token', body: { data: { teamNumber: '3006', forms: { formA: { 1: 'test' } }, metrics: { note: 'draft only' } } },
  });
  assert.equal(saved.status, 200);
  assert.equal(harness.fixture.gameProfileTestData['profile-2026'].data.teamNumber, '3006');

  const published = await requestJson('/api/game-profiles/profile-2026/publish', { method: 'POST', token: 'admin-token' });
  assert.equal(published.status, 200);
  assert.equal(harness.fixture.gameProfileTestData['profile-2026'], undefined);
});

test('game profile routes let admins edit and delete drafts but protect published profiles', async () => {
  const updated = await requestJson('/api/game-profiles/profile-2026', {
    method: 'PUT',
    token: 'admin-token',
    body: { name: 'Updated Profile', season: '2027' },
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.season, '2027');

  const deleted = await requestJson('/api/game-profiles/profile-2026', {
    method: 'DELETE',
    token: 'admin-token',
  });

  assert.equal(deleted.status, 200);
  assert.equal(harness.fixture.gameProfiles['profile-2026'], undefined);
});

test('game profile routes validate metric, card, and pick-list configuration together', async () => {
  const configuration = {
    metrics: [{
      id: 'total-epa',
      label: 'Total EPA',
      source: 'statbotics',
      sourceKey: 'epa.total',
      aggregation: 'average',
      scope: 'current_competition',
      format: 'number',
      visibility: ['scout', 'driveTeam', 'admin'],
      destinations: ['team_lookup', 'automatic_pick_list', 'analytics'],
    }],
    teamLookupCards: [{
      id: 'performance',
      label: 'Performance',
      metricIds: ['total-epa'],
      visibility: ['scout', 'driveTeam'],
    }],
    pickListModels: [{
      id: 'selection',
      label: 'Alliance Selection',
      scope: 'current_competition',
      metricWeights: [{ metricId: 'total-epa', weight: 1 }],
    }],
    pickListGroups: [{ id: 'statbotics', label: 'Statbotics Data', metricIds: ['total-epa'] }],
    analysisEquations: [{ id: 'score', label: 'Team Score', scope: 'current_competition', metricWeights: [{ metricId: 'total-epa', weight: 1 }] }],
  };

  const response = await requestJson('/api/game-profiles/profile-2026', {
    method: 'PUT',
    token: 'admin-token',
    body: { configuration },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.configuration, {
    ...configuration,
    teamLookupSections: [],
    analysisEquations: configuration.analysisEquations.map((equation) => ({ ...equation, weightMode: 'normalized' })),
  });

  const invalid = await requestJson('/api/game-profiles/profile-2026', {
    method: 'PUT',
    token: 'admin-token',
    body: {
      configuration: {
        ...configuration,
        teamLookupCards: [{ ...configuration.teamLookupCards[0], metricIds: ['missing-metric'] }],
      },
    },
  });

  assert.equal(invalid.status, 400);
  assert.match(invalid.body.message, /configured metrics/);
});
