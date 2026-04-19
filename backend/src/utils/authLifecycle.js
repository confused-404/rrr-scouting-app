const createLifecycleError = (message, cause, options = {}) => {
  const error = new Error(message, cause ? { cause } : undefined);
  error.status = options.status || 500;
  error.code = options.code || 'auth-lifecycle-failed';
  error.rollbackFailed = Boolean(options.rollbackFailed);
  return error;
};

export const createUserWithProfile = async ({
  email,
  password,
  createAuthUser,
  writeUserProfile,
  deleteAuthUser,
}) => {
  const userRecord = await createAuthUser({ email, password });

  try {
    await writeUserProfile(userRecord);
    return userRecord;
  } catch (error) {
    try {
      await deleteAuthUser(userRecord.uid);
    } catch (rollbackError) {
      throw createLifecycleError(
        'User creation partially succeeded. Manual cleanup is required.',
        error,
        { rollbackFailed: true },
      );
    }

    throw createLifecycleError(
      'User creation could not be completed. No account was created.',
      error,
    );
  }
};

export const applyClaimsAndProfile = async ({
  uid,
  getUser,
  setCustomUserClaims,
  writeUserProfile,
  buildClaims,
}) => {
  const userRecord = await getUser(uid);
  const previousClaims = userRecord.customClaims || {};
  const nextClaims = buildClaims(previousClaims);

  await setCustomUserClaims(uid, nextClaims);

  try {
    await writeUserProfile(userRecord);
    return userRecord;
  } catch (error) {
    try {
      await setCustomUserClaims(uid, previousClaims);
    } catch (rollbackError) {
      throw createLifecycleError(
        'User role update partially succeeded. Manual reconciliation is required.',
        error,
        { rollbackFailed: true },
      );
    }

    throw createLifecycleError(
      'User role update could not be completed. No role change was applied.',
      error,
    );
  }
};

export const deleteUserAndProfile = async ({
  uid,
  getUserProfile,
  deleteUserProfile,
  restoreUserProfile,
  deleteAuthUser,
}) => {
  const existingProfile = await getUserProfile(uid);

  try {
    await deleteUserProfile(uid);
  } catch (error) {
    throw createLifecycleError(
      'User deletion could not remove the application profile.',
      error,
    );
  }

  try {
    await deleteAuthUser(uid);
  } catch (error) {
    try {
      if (existingProfile) {
        await restoreUserProfile(uid, existingProfile);
      }
    } catch (rollbackError) {
      throw createLifecycleError(
        'User deletion partially succeeded. Manual reconciliation is required.',
        error,
        { rollbackFailed: true },
      );
    }

    throw createLifecycleError(
      'User deletion could not be completed. No account was removed.',
      error,
    );
  }
};
