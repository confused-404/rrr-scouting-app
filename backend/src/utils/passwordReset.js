export const RESET_CODE_TTL_MS = 60 * 60 * 1000;
export const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_LOCKOUT_MS = 15 * 60 * 1000;
export const RESET_DELIVERY_PENDING_MS = 2 * 60 * 1000;

export const GENERIC_RESET_RESPONSE_MESSAGE = 'If an account exists for that email you will receive a code shortly.';
export const INVALID_RESET_CODE_MESSAGE = 'Invalid or expired code';
export const RESET_LOCKED_MESSAGE = 'Too many reset attempts. Request a new code or try again later.';

const normalizeTimestamp = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

export const isResetLockoutActive = (state, now = Date.now()) => {
  const lockedUntil = normalizeTimestamp(state?.resetLockedUntil);
  return lockedUntil !== null && lockedUntil > now;
};

export const isResetRequestCoolingDown = (state, now = Date.now()) => {
  const issuedAt = normalizeTimestamp(state?.resetIssuedAt);
  return issuedAt !== null && (now - issuedAt) < RESET_REQUEST_COOLDOWN_MS;
};

export const isResetCodeExpired = (state, now = Date.now()) => {
  const expiresAt = normalizeTimestamp(state?.resetExpires);
  return expiresAt === null || expiresAt <= now;
};

export const isResetDeliveryPending = (state, now = Date.now()) => {
  const pendingUntil = normalizeTimestamp(state?.resetDeliveryPendingUntil);
  return pendingUntil !== null && pendingUntil > now;
};

export const buildPendingResetDeliveryState = ({ deliveryId, now = Date.now() }) => ({
  resetDeliveryPendingId: deliveryId,
  resetDeliveryPendingUntil: now + RESET_DELIVERY_PENDING_MS,
});

export const buildIssuedResetState = ({ resetCodeHash, resetCodeSalt, now = Date.now() }) => ({
  resetCodeHash,
  resetCodeSalt,
  resetExpires: now + RESET_CODE_TTL_MS,
  resetIssuedAt: now,
  resetAttemptCount: 0,
  resetLastAttemptAt: null,
  resetLockedUntil: null,
  resetDeliveryPendingId: null,
  resetDeliveryPendingUntil: null,
});

export const buildFailedResetAttemptState = (state, now = Date.now()) => {
  const currentAttempts = Number.isInteger(state?.resetAttemptCount) && state.resetAttemptCount > 0
    ? state.resetAttemptCount
    : 0;
  const nextAttemptCount = currentAttempts + 1;
  const lockedUntil = nextAttemptCount >= RESET_MAX_ATTEMPTS
    ? now + RESET_LOCKOUT_MS
    : null;

  return {
    resetAttemptCount: nextAttemptCount,
    resetLastAttemptAt: now,
    resetLockedUntil: lockedUntil,
  };
};

export const buildClearResetState = (deleteField) => ({
  resetCode: deleteField,
  resetCodeHash: deleteField,
  resetCodeSalt: deleteField,
  resetExpires: deleteField,
  resetIssuedAt: deleteField,
  resetAttemptCount: deleteField,
  resetLastAttemptAt: deleteField,
  resetLockedUntil: deleteField,
  resetDeliveryPendingId: deleteField,
  resetDeliveryPendingUntil: deleteField,
});
