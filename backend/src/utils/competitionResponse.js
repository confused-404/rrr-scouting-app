import { getUserRole } from './authz.js';

const SCOUT_SAFE_FIELDS = Object.freeze([
  'id',
  'name',
  'season',
  'status',
  'startDate',
  'endDate',
  'createdAt',
  'formIds',
  'activeFormIds',
  'scoutingTeams',
  'scoutingAssignments',
  'eventKey',
  'pitMapImageUrl',
  'pitMapImagePath',
]);

const pickFields = (competition, allowedFields) => {
  const serialized = {};

  allowedFields.forEach((field) => {
    if (competition[field] !== undefined) {
      serialized[field] = competition[field];
    }
  });

  return serialized;
};

export const canReadPrivilegedCompetitionFields = (user) => {
  const role = getUserRole(user);
  return role === 'admin' || role === 'drive';
};

export const serializeCompetition = (competition, user) => {
  if (!competition || typeof competition !== 'object') {
    return competition;
  }

  if (canReadPrivilegedCompetitionFields(user)) {
    return competition;
  }

  return pickFields(competition, SCOUT_SAFE_FIELDS);
};

export const serializeCompetitionList = (competitions, user) => (
  Array.isArray(competitions)
    ? competitions.map((competition) => serializeCompetition(competition, user))
    : []
);
