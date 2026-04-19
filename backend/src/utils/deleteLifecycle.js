const createDeletionError = (message, cause, options = {}) => {
  const error = new Error(message, cause ? { cause } : undefined);
  error.status = options.status || 500;
  error.code = options.code || 'delete-lifecycle-failed';
  error.rollbackFailed = Boolean(options.rollbackFailed);
  return error;
};

export const deleteWithRollback = async ({
  deleteChildren,
  deleteParent,
  restoreChildren,
}) => {
  await deleteChildren();

  try {
    await deleteParent();
  } catch (error) {
    try {
      await restoreChildren();
    } catch (rollbackError) {
      throw createDeletionError(
        'Delete partially succeeded. Manual reconciliation is required.',
        error,
        { rollbackFailed: true },
      );
    }

    throw createDeletionError(
      'Delete could not be completed. All records were restored.',
      error,
    );
  }
};
