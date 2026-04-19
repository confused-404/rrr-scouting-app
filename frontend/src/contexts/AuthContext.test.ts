import { describe, expect, it } from 'vitest';
import { resolveRoleFromTokenClaims } from './auth-role';

describe('resolveRoleFromTokenClaims', () => {
  it('prefers admin claims', () => {
    expect(resolveRoleFromTokenClaims({ admin: true, driveTeam: true })).toBe('admin');
  });

  it('falls back to drive claims', () => {
    expect(resolveRoleFromTokenClaims({ driveTeam: true })).toBe('drive');
  });

  it('defaults to user when no claims are present', () => {
    expect(resolveRoleFromTokenClaims({})).toBe('user');
    expect(resolveRoleFromTokenClaims(null)).toBe('user');
  });
});
