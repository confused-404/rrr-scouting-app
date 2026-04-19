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
  competitions: {
    'comp-1': {
      name: 'Boise Regional',
      season: '2026',
      status: 'active',
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      createdAt: '2026-03-01T00:00:00.000Z',
      formIds: ['form-a'],
      activeFormIds: ['form-a'],
    },
    'comp-2': {
      name: 'Idaho Offseason',
      season: '2026',
      status: 'draft',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      createdAt: '2026-03-05T00:00:00.000Z',
      formIds: [],
      activeFormIds: [],
    },
  },
  _system: {
    activeCompetition: {
      competitionId: 'comp-1',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  },
}));

const installHarness = () => {
  harness.reset();
  harness.install({
    db,
    auth,
    tokenClaimsByToken,
  });
};

installHarness();
const { default: competitionRoutes } = await import('../src/routes/competitionRoutes.js');
const requestJson = createRouterRequester(competitionRoutes, '/api/competitions');

afterEach(() => {
  installHarness();
});

test('GET /api/competitions/active returns the sentinel-selected competition', async () => {
  const response = await requestJson('/api/competitions/active', {
    token: 'scout-token',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'comp-1');
  assert.equal(response.body.name, 'Boise Regional');
});

test('GET /api/competitions/active fails loudly when multiple active competitions exist without a valid sentinel', async () => {
  installHarness();
  harness.fixture._system.activeCompetition = {
    competitionId: 'missing-comp',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
  harness.fixture.competitions['comp-2'].status = 'active';

  const response = await requestJson('/api/competitions/active', {
    token: 'admin-token',
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.message, 'Multiple active competitions exist. Manual reconciliation is required.');
});

test('PUT /api/competitions/:id rejects invalid statuses', async () => {
  const response = await requestJson('/api/competitions/comp-2', {
    method: 'PUT',
    token: 'admin-token',
    body: {
      status: 'broken',
    },
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /Competition status must be one of/);
});

test('PUT /api/competitions/:id rejects malformed date strings', async () => {
  const response = await requestJson('/api/competitions/comp-2', {
    method: 'PUT',
    token: 'admin-token',
    body: {
      startDate: 'definitely-not-a-date',
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'startDate must be a valid date string.');
});
