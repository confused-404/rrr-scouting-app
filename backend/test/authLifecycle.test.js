import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClaimsAndProfile,
  createUserWithProfile,
  deleteUserAndProfile,
} from '../src/utils/authLifecycle.js';

test('createUserWithProfile rolls back auth user when profile write fails', async () => {
  const deletedUids = [];

  await assert.rejects(
    createUserWithProfile({
      email: 'driver@example.com',
      password: 'secret',
      createAuthUser: async () => ({ uid: 'user-1', email: 'driver@example.com' }),
      writeUserProfile: async () => {
        throw new Error('firestore unavailable');
      },
      deleteAuthUser: async (uid) => {
        deletedUids.push(uid);
      },
    }),
    (error) => {
      assert.equal(error.message, 'User creation could not be completed. No account was created.');
      assert.equal(error.rollbackFailed, false);
      return true;
    },
  );

  assert.deepEqual(deletedUids, ['user-1']);
});

test('applyClaimsAndProfile restores previous claims when profile write fails', async () => {
  const claimsHistory = [];

  await assert.rejects(
    applyClaimsAndProfile({
      uid: 'user-2',
      getUser: async () => ({
        uid: 'user-2',
        customClaims: { admin: false, driveTeam: false, existing: 'claim' },
      }),
      setCustomUserClaims: async (_uid, claims) => {
        claimsHistory.push(claims);
      },
      buildClaims: (existingClaims) => ({
        ...existingClaims,
        admin: true,
        driveTeam: false,
      }),
      writeUserProfile: async () => {
        throw new Error('firestore unavailable');
      },
    }),
    (error) => {
      assert.equal(error.message, 'User role update could not be completed. No role change was applied.');
      assert.equal(error.rollbackFailed, false);
      return true;
    },
  );

  assert.deepEqual(claimsHistory, [
    { admin: true, driveTeam: false, existing: 'claim' },
    { admin: false, driveTeam: false, existing: 'claim' },
  ]);
});

test('deleteUserAndProfile restores profile when auth delete fails', async () => {
  const operations = [];
  const originalProfile = {
    email: 'scout@example.com',
    role: 'user',
  };

  await assert.rejects(
    deleteUserAndProfile({
      uid: 'user-3',
      getUserProfile: async () => originalProfile,
      deleteUserProfile: async (uid) => {
        operations.push(`delete-profile:${uid}`);
      },
      restoreUserProfile: async (uid, profile) => {
        operations.push(`restore-profile:${uid}:${profile.email}`);
      },
      deleteAuthUser: async () => {
        throw new Error('auth unavailable');
      },
    }),
    (error) => {
      assert.equal(error.message, 'User deletion could not be completed. No account was removed.');
      assert.equal(error.rollbackFailed, false);
      return true;
    },
  );

  assert.deepEqual(operations, [
    'delete-profile:user-3',
    'restore-profile:user-3:scout@example.com',
  ]);
});
