import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFirestoreHarness,
  createRouterRequester,
  ensureBackendTestEnv,
} from '../support/routerHarness.js';

ensureBackendTestEnv();
process.env.INITIAL_ADMIN_SETUP_SECRET = 'setup-secret';

const { auth, db } = await import('../src/config/firebase.js');
const { default: authRoutes } = await import('../src/routes/authRoutes.js');

const tokenClaimsByToken = new Map([
  ['admin-token', { uid: 'admin-1', email: 'admin@example.com', admin: true }],
  ['scout-token', { uid: 'scout-1', email: 'scout@example.com' }],
]);

const harness = createFirestoreHarness(() => ({
  users: {
    'admin-1': {
      email: 'admin@example.com',
      role: 'admin',
      scouterName: 'Lead Scout',
    },
    'user-2': {
      email: 'driver@example.com',
      role: 'drive',
      scouterName: 'Driver',
    },
  },
  _rateLimits: {},
  _system: {},
}));

const installHarness = (options = {}) => {
  harness.reset();
  harness.install({
    db,
    auth,
    tokenClaimsByToken,
    authOverrides: {
      listUsers: async () => ({
        users: options.authUsers || [
          { uid: 'admin-1', email: 'admin@example.com', customClaims: { admin: true } },
          { uid: 'user-2', email: 'driver@example.com', customClaims: { driveTeam: true } },
          { uid: 'user-3', email: 'scout@example.com', customClaims: {} },
        ],
        pageToken: undefined,
      }),
      getUserByEmail: async (email) => {
        if (email === 'new-admin@example.com') {
          return { uid: 'user-new-admin', email };
        }
        throw new Error('user not found');
      },
      getUser: async (uid) => ({ uid, customClaims: {} }),
      setCustomUserClaims: async () => undefined,
    },
  });
};

installHarness();
const requestJson = createRouterRequester(authRoutes, '/api/auth');

afterEach(() => {
  installHarness();
});

test('GET /api/auth/users returns merged auth and firestore data for admins', async () => {
  const response = await requestJson('/api/auth/users', {
    token: 'admin-token',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [
    { uid: 'admin-1', email: 'admin@example.com', role: 'admin', scouterName: 'Lead Scout' },
    { uid: 'user-2', email: 'driver@example.com', role: 'drive', scouterName: 'Driver' },
    { uid: 'user-3', email: 'scout@example.com', role: 'user', scouterName: null },
  ]);
});

test('GET /api/auth/users rejects non-admin callers', async () => {
  const response = await requestJson('/api/auth/users', {
    token: 'scout-token',
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { message: 'Forbidden' });
});

test('POST /api/auth/initialize-admin provisions the first admin when the setup secret is valid', async () => {
  installHarness({
    authUsers: [{ uid: 'user-9', email: 'scout@example.com', customClaims: {} }],
  });
  harness.fixture.users = {};

  const response = await requestJson('/api/auth/initialize-admin', {
    method: 'POST',
    headers: { 'x-setup-secret': 'setup-secret' },
    body: { email: 'new-admin@example.com' },
  });

  assert.equal(response.status, 200);
  assert.match(response.body.message, /new-admin@example\.com is now an admin/);
  assert.equal(harness.fixture.users['user-new-admin'].role, 'admin');
  assert.equal(harness.fixture._system.initialAdminSetup.status, 'completed');
  assert.equal(harness.fixture._system.initialAdminSetup.uid, 'user-new-admin');
});

test('POST /api/auth/client-logs accepts forwarded client warnings and errors', async () => {
  const response = await requestJson('/api/auth/client-logs', {
    method: 'POST',
    body: {
      sessionId: 'session-1',
      timestamp: '2026-04-29T20:14:43.824Z',
      level: 'error',
      scope: 'api',
      message: 'API request failed',
      context: {
        requestId: 'req-123',
        token: 'secret-token',
      },
      url: 'https://app.example.com/scout',
      userAgent: 'Mozilla/5.0',
    },
  });

  assert.equal(response.status, 204);
});
