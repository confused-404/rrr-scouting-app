const APP_ROLES = Object.freeze({
  admin: 'admin',
  drive: 'drive',
  user: 'user',
});

export const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

export const getUserRole = (user) => {
  if (user?.admin === true) return APP_ROLES.admin;
  if (user?.driveTeam === true) return APP_ROLES.drive;
  return APP_ROLES.user;
};

export const hasRequiredRole = (user, allowedRoles) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return false;
  }

  return allowedRoles.includes(getUserRole(user));
};

export const isSetupSecretValid = (providedSecret, expectedSecret) => (
  typeof expectedSecret === 'string'
  && expectedSecret.length > 0
  && typeof providedSecret === 'string'
  && providedSecret === expectedSecret
);

export { APP_ROLES };
