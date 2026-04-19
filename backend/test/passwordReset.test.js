import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESET_CODE_TTL_MS,
  RESET_DELIVERY_PENDING_MS,
  RESET_MAX_ATTEMPTS,
  RESET_LOCKOUT_MS,
  RESET_REQUEST_COOLDOWN_MS,
  buildClearResetState,
  buildFailedResetAttemptState,
  buildIssuedResetState,
  buildPendingResetDeliveryState,
  isResetCodeExpired,
  isResetDeliveryPending,
  isResetLockoutActive,
  isResetRequestCoolingDown,
} from '../src/utils/passwordReset.js';

test('buildIssuedResetState initializes a fresh code window', () => {
  const now = 1_700_000_000_000;
  const state = buildIssuedResetState({
    resetCodeHash: 'hash',
    resetCodeSalt: 'salt',
    now,
  });

  assert.equal(state.resetCodeHash, 'hash');
  assert.equal(state.resetCodeSalt, 'salt');
  assert.equal(state.resetExpires, now + RESET_CODE_TTL_MS);
  assert.equal(state.resetIssuedAt, now);
  assert.equal(state.resetAttemptCount, 0);
  assert.equal(state.resetLastAttemptAt, null);
  assert.equal(state.resetLockedUntil, null);
  assert.equal(state.resetDeliveryPendingId, null);
  assert.equal(state.resetDeliveryPendingUntil, null);
});

test('pending delivery helpers only block while a reservation is active', () => {
  const now = 20_000;
  const state = buildPendingResetDeliveryState({
    deliveryId: 'delivery-1',
    now,
  });

  assert.equal(state.resetDeliveryPendingId, 'delivery-1');
  assert.equal(state.resetDeliveryPendingUntil, now + RESET_DELIVERY_PENDING_MS);
  assert.equal(isResetDeliveryPending(state, now), true);
  assert.equal(isResetDeliveryPending(state, now + RESET_DELIVERY_PENDING_MS), false);
});

test('cooldown and expiry helpers reject invalid timestamps', () => {
  assert.equal(isResetRequestCoolingDown({}, 10), false);
  assert.equal(isResetCodeExpired({}, 10), true);
  assert.equal(isResetLockoutActive({}, 10), false);
});

test('isResetRequestCoolingDown only blocks inside the resend window', () => {
  const now = 5_000;
  assert.equal(isResetRequestCoolingDown({ resetIssuedAt: now - 1 }, now), true);
  assert.equal(isResetRequestCoolingDown({ resetIssuedAt: now - RESET_REQUEST_COOLDOWN_MS }, now), false);
});

test('buildFailedResetAttemptState locks after the maximum attempts', () => {
  const now = 10_000;
  const state = buildFailedResetAttemptState({ resetAttemptCount: RESET_MAX_ATTEMPTS - 1 }, now);

  assert.equal(state.resetAttemptCount, RESET_MAX_ATTEMPTS);
  assert.equal(state.resetLastAttemptAt, now);
  assert.equal(state.resetLockedUntil, now + RESET_LOCKOUT_MS);
});

test('buildFailedResetAttemptState increments without lockout before the limit', () => {
  const now = 10_000;
  const state = buildFailedResetAttemptState({ resetAttemptCount: 1 }, now);

  assert.equal(state.resetAttemptCount, 2);
  assert.equal(state.resetLastAttemptAt, now);
  assert.equal(state.resetLockedUntil, null);
});

test('buildClearResetState maps all reset fields to the provided delete sentinel', () => {
  const deleted = Symbol('delete');
  const state = buildClearResetState(deleted);

  assert.deepEqual(state, {
    resetCode: deleted,
    resetCodeHash: deleted,
    resetCodeSalt: deleted,
    resetExpires: deleted,
    resetIssuedAt: deleted,
    resetAttemptCount: deleted,
    resetLastAttemptAt: deleted,
    resetLockedUntil: deleted,
    resetDeliveryPendingId: deleted,
    resetDeliveryPendingUntil: deleted,
  });
});
