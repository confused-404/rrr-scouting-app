import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPasswordResetDelivery } from '../src/utils/passwordResetDelivery.js';

test('requestPasswordResetDelivery finalizes reset state only after mail succeeds', async () => {
  const operations = [];

  const result = await requestPasswordResetDelivery({
    email: 'scout@example.com',
    now: 1_700_000_000_000,
    reserveDelivery: async ({ deliveryId }) => {
      operations.push(`reserve:${deliveryId}`);
      return true;
    },
    finalizeDelivery: async ({ deliveryId, issuanceState }) => {
      operations.push(`finalize:${deliveryId}`);
      assert.equal(typeof issuanceState.resetCodeHash, 'string');
      assert.equal(typeof issuanceState.resetCodeSalt, 'string');
      assert.equal(issuanceState.resetDeliveryPendingId, null);
      return true;
    },
    clearDeliveryReservation: async () => {
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
    'send:scout@example.com',
    operations[2],
  ]);
  assert.match(operations[0], /^reserve:/);
  assert.match(operations[2], /^finalize:/);
});

test('requestPasswordResetDelivery clears reservation when mail delivery fails', async () => {
  const operations = [];

  const result = await requestPasswordResetDelivery({
    email: 'scout@example.com',
    now: 1_700_000_000_000,
    reserveDelivery: async ({ deliveryId }) => {
      operations.push(`reserve:${deliveryId}`);
      return true;
    },
    finalizeDelivery: async () => {
      operations.push('finalize');
      return true;
    },
    clearDeliveryReservation: async ({ deliveryId }) => {
      operations.push(`clear:${deliveryId}`);
    },
    sendMail: async () => {
      throw new Error('smtp offline');
    },
  });

  assert.equal(result.status, 'delivery_failed');
  assert.equal((result.error instanceof Error) ? result.error.message : '', 'smtp offline');
  assert.equal(operations.length, 2);
  assert.match(operations[0], /^reserve:/);
  assert.equal(operations[1], operations[0].replace('reserve:', 'clear:'));
});
