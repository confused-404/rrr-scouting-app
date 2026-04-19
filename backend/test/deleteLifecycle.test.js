import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteWithRollback } from '../src/utils/deleteLifecycle.js';

test('deleteWithRollback restores children when parent delete fails', async () => {
  const operations = [];

  await assert.rejects(
    deleteWithRollback({
      deleteChildren: async () => {
        operations.push('delete-children');
      },
      deleteParent: async () => {
        operations.push('delete-parent');
        throw new Error('parent delete failed');
      },
      restoreChildren: async () => {
        operations.push('restore-children');
      },
    }),
    (error) => {
      assert.equal(error.message, 'Delete could not be completed. All records were restored.');
      assert.equal(error.rollbackFailed, false);
      return true;
    },
  );

  assert.deepEqual(operations, [
    'delete-children',
    'delete-parent',
    'restore-children',
  ]);
});

test('deleteWithRollback raises a manual-reconciliation error when rollback also fails', async () => {
  await assert.rejects(
    deleteWithRollback({
      deleteChildren: async () => {},
      deleteParent: async () => {
        throw new Error('parent delete failed');
      },
      restoreChildren: async () => {
        throw new Error('restore failed');
      },
    }),
    (error) => {
      assert.equal(error.message, 'Delete partially succeeded. Manual reconciliation is required.');
      assert.equal(error.rollbackFailed, true);
      return true;
    },
  );
});

test('deleteWithRollback restores children when child deletion fails part-way through', async () => {
  const operations = [];

  await assert.rejects(
    deleteWithRollback({
      deleteChildren: async () => {
        operations.push('delete-children');
        throw new Error('child batch failed');
      },
      deleteParent: async () => {
        operations.push('delete-parent');
      },
      restoreChildren: async () => {
        operations.push('restore-children');
      },
    }),
    (error) => {
      assert.equal(error.message, 'Delete could not be completed. All records were restored.');
      assert.equal(error.rollbackFailed, false);
      return true;
    },
  );

  assert.deepEqual(operations, [
    'delete-children',
    'restore-children',
  ]);
});
