import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_ROLES,
  extractBearerToken,
  getUserRole,
  hasRequiredRole,
  isSetupSecretValid,
} from '../src/utils/authz.js';

test('extractBearerToken returns null for invalid headers', () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken('Token abc'), null);
});

test('extractBearerToken returns the token for bearer headers', () => {
  assert.equal(extractBearerToken('Bearer token-123'), 'token-123');
  assert.equal(extractBearerToken('bearer   token-456   '), 'token-456');
});

test('getUserRole resolves custom claims into app roles', () => {
  assert.equal(getUserRole({ admin: true }), APP_ROLES.admin);
  assert.equal(getUserRole({ driveTeam: true }), APP_ROLES.drive);
  assert.equal(getUserRole({}), APP_ROLES.user);
});

test('hasRequiredRole only permits explicitly allowed roles', () => {
  assert.equal(hasRequiredRole({ admin: true }, ['admin']), true);
  assert.equal(hasRequiredRole({ driveTeam: true }, ['admin']), false);
  assert.equal(hasRequiredRole({}, ['admin', 'drive']), false);
});

test('isSetupSecretValid requires an exact configured match', () => {
  assert.equal(isSetupSecretValid('expected', 'expected'), true);
  assert.equal(isSetupSecretValid('wrong', 'expected'), false);
  assert.equal(isSetupSecretValid('expected', ''), false);
});
