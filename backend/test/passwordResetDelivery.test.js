import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPasswordResetDelivery } from '../src/utils/passwordResetDelivery.js';

test('requestPasswordResetDelivery activates reset state before mail succeeds', async () => {
  const operations = [];

  const result = await requestPasswordResetDelivery({
    email: 'scout@example.com',
    now: 1_700_000_000_000,
    reserveDelivery: async ({ deliveryId }) => {
      operations.push(`reserve:${deliveryId}`);
      return true;
    },
    activateDelivery: async ({ deliveryId, issuanceState }) => {
      operations.push(`activate:${deliveryId}`);
      assert.equal(typeof issuanceState.resetCodeHash, 'string');
      assert.equal(typeof issuanceState.resetCodeSalt, 'string');
      assert.equal(issuanceState.resetDeliveryPendingId, null);
      return true;
    },
    clearDeliveryState: async () => {
      operations.push('clear');
    },
    sendMail: async ({ to, subject, text }) => {
      operations.push(`send:${to}`);
      assert.equal(subject, 'Password Reset Code');
      assert.match(text, /Your password reset code is: \d{6}/);
    },
  });

  assert.equal(result.status, 'sent');
  assert.deepEqual(operations, [
    operations[0],
    operations[1],
    'send:scout@example.com',
  ]);
  assert.match(operations[0], /^reserve:/);
  assert.match(operations[1], /^activate:/);
});

test('requestPasswordResetDelivery clears issued state when mail delivery fails', async () => {
  const operations = [];

  const result = await requestPasswordResetDelivery({
    email: 'scout@example.com',
    now: 1_700_000_000_000,
    reserveDelivery: async ({ deliveryId }) => {
      operations.push(`reserve:${deliveryId}`);
      return true;
    },
    activateDelivery: async ({ deliveryId }) => {
      operations.push(`activate:${deliveryId}`);
      return true;
    },
    clearDeliveryState: async ({ deliveryId, issuanceState }) => {
      assert.equal(typeof issuanceState.resetCodeHash, 'string');
      operations.push(`clear:${deliveryId}`);
    },
    sendMail: async () => {
      throw new Error('smtp offline');
    },
  });

  assert.equal(result.status, 'delivery_failed');
  assert.equal((result.error instanceof Error) ? result.error.message : '', 'smtp offline');
  assert.equal(operations.length, 3);
  assert.match(operations[0], /^reserve:/);
  assert.equal(operations[1], operations[0].replace('reserve:', 'activate:'));
  assert.equal(operations[2], operations[0].replace('reserve:', 'clear:'));
});

test('requestPasswordResetDelivery returns blocked when activation loses the reservation race', async () => {
  const operations = [];

  const result = await requestPasswordResetDelivery({
    email: 'scout@example.com',
    now: 1_700_000_000_000,
    reserveDelivery: async ({ deliveryId }) => {
      operations.push(`reserve:${deliveryId}`);
      return true;
    },
    activateDelivery: async ({ deliveryId }) => {
      operations.push(`activate:${deliveryId}`);
      return false;
    },
    clearDeliveryState: async () => {
      operations.push('clear');
    },
    sendMail: async () => {
      operations.push('send');
    },
  });

  assert.equal(result.status, 'blocked');
  assert.deepEqual(operations, [
    operations[0],
    operations[1],
  ]);
});
