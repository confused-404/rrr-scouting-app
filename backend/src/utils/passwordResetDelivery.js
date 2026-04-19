import crypto from 'crypto';
import {
  GENERIC_RESET_RESPONSE_MESSAGE,
  buildIssuedResetState,
} from './passwordReset.js';

const hashResetCode = (code, salt) => (
  crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex')
);

export const requestPasswordResetDelivery = async ({
  email,
  now = Date.now(),
  reserveDelivery,
  activateDelivery,
  clearDeliveryState,
  sendMail,
}) => {
  const currentTimestamp = now;
  const code = crypto.randomInt(100000, 1000000).toString();
  const resetCodeSalt = crypto.randomBytes(16).toString('hex');
  const resetCodeHash = hashResetCode(code, resetCodeSalt);
  const deliveryId = crypto.randomUUID();

  const issuanceState = buildIssuedResetState({
    resetCodeHash,
    resetCodeSalt,
    now: currentTimestamp,
  });

  const reservationStatus = await reserveDelivery({
    deliveryId,
    now: currentTimestamp,
  });

  if (!reservationStatus) {
    return { status: 'blocked', message: GENERIC_RESET_RESPONSE_MESSAGE };
  }

  const activated = await activateDelivery({
    deliveryId,
    issuanceState,
  });

  if (!activated) {
    return { status: 'blocked', message: GENERIC_RESET_RESPONSE_MESSAGE };
  }

  const text = `Your password reset code is: ${code}\n\nThis code will expire in one hour.`;

  try {
    await sendMail({
      to: email,
      subject: 'Password Reset Code',
      text,
    });
  } catch (error) {
    await clearDeliveryState({ deliveryId, issuanceState }).catch(() => {});
    return {
      status: 'delivery_failed',
      message: GENERIC_RESET_RESPONSE_MESSAGE,
      error,
    };
  }

  return { status: 'sent', message: GENERIC_RESET_RESPONSE_MESSAGE };
};
