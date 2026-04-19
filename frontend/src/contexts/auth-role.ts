export type TokenClaims = {
  admin?: unknown;
  driveTeam?: unknown;
};

export const resolveRoleFromTokenClaims = (
  claims: TokenClaims | undefined | null,
): 'admin' | 'drive' | 'user' => {
  if (claims?.admin) return 'admin';
  if (claims?.driveTeam) return 'drive';
  return 'user';
};
