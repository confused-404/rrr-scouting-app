import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRouterRequester,
  ensureBackendTestEnv,
} from '../support/routerHarness.js';

ensureBackendTestEnv();

const { auth } = await import('../src/config/firebase.js');
const { default: tbaRoutes } = await import('../src/routes/tbaRoutes.js');

const tokenClaimsByToken = new Map([
  ['scout-token', { uid: 'scout-1', email: 'scout@example.com' }],
]);

const installHarness = () => {
  mock.restoreAll();
  mock.method(auth, 'verifyIdToken', async (token) => {
    const claims = tokenClaimsByToken.get(token);
    if (!claims) {
      const error = new Error('invalid token');
      error.code = 'auth/argument-error';
      throw error;
    }
    return claims;
  });
};

installHarness();
const requestJson = createRouterRequester(tbaRoutes, '/api/tba');

afterEach(() => {
  installHarness();
});

test('GET /api/tba/status returns 504 when the upstream request times out', async () => {
  mock.method(global, 'fetch', async (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  }));

  const response = await requestJson('/api/tba/status', {
    token: 'scout-token',
  });

  assert.equal(response.status, 504);
  assert.deepEqual(response.body, { message: 'Upstream request timed out' });
});
