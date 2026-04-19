const VALID_COMPETITION_STATUSES = new Set(['draft', 'active', 'completed', 'archived']);

const createPayloadError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const normalizeIsoDate = (value, fallbackValue, fieldName) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallbackValue;
  }

  const normalized = value.trim();
  if (Number.isNaN(Date.parse(normalized))) {
    throw createPayloadError(`${fieldName} must be a valid date string.`);
  }

  return normalized;
};

const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeStoredImageUrl = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return '';
  }

  if (/^data:/i.test(normalized)) {
    const error = new Error('Inline pit-map images are not allowed. Upload the image to storage first.');
    error.status = 400;
    throw error;
  }

  return normalized;
};

const normalizeCompetitionStatus = (value, fallbackValue) => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return fallbackValue;
  }

  if (!VALID_COMPETITION_STATUSES.has(normalized)) {
    throw createPayloadError(`Competition status must be one of: ${Array.from(VALID_COMPETITION_STATUSES).join(', ')}.`);
  }

  return normalized;
};

const ensureStringArray = (value) => (
  Array.isArray(value)
    ? value
      .map((entry) => normalizeString(entry))
      .filter(Boolean)
    : []
);

export const buildCreateCompetitionInput = (payload) => {
  const nowIso = new Date().toISOString();
  const formIds = ensureStringArray(payload.formIds);
  const activeFormIds = ensureStringArray(payload.activeFormIds);

  return {
    name: normalizeString(payload.name),
    season: normalizeString(payload.season),
    status: normalizeCompetitionStatus(payload.status, 'draft'),
    startDate: normalizeIsoDate(payload.startDate, nowIso, 'startDate'),
    endDate: normalizeIsoDate(payload.endDate, nowIso, 'endDate'),
    formIds,
    activeFormIds,
    eventKey: normalizeString(payload.eventKey) || undefined,
    pitMapImageUrl: normalizeStoredImageUrl(payload.pitMapImageUrl),
    pitMapImagePath: normalizeString(payload.pitMapImagePath),
    pitLocations: payload.pitLocations && typeof payload.pitLocations === 'object' ? payload.pitLocations : {},
    manualPickLists: Array.isArray(payload.manualPickLists) ? payload.manualPickLists : [],
    robotBreakTimelineOverrides: payload.robotBreakTimelineOverrides && typeof payload.robotBreakTimelineOverrides === 'object'
      ? payload.robotBreakTimelineOverrides
      : {},
  };
};

export const buildUpdateCompetitionInput = (payload) => {
  const nextPayload = {};

  if (payload.name !== undefined) nextPayload.name = normalizeString(payload.name);
  if (payload.season !== undefined) nextPayload.season = normalizeString(payload.season);
  if (payload.status !== undefined) nextPayload.status = normalizeCompetitionStatus(payload.status, null);
  if (payload.startDate !== undefined) nextPayload.startDate = normalizeIsoDate(payload.startDate, null, 'startDate');
  if (payload.endDate !== undefined) nextPayload.endDate = normalizeIsoDate(payload.endDate, null, 'endDate');
  if (payload.formIds !== undefined) nextPayload.formIds = ensureStringArray(payload.formIds);
  if (payload.activeFormIds !== undefined) nextPayload.activeFormIds = ensureStringArray(payload.activeFormIds);
  if (payload.activeFormId !== undefined) nextPayload.activeFormId = normalizeString(payload.activeFormId) || null;
  if (payload.scoutingTeams !== undefined) nextPayload.scoutingTeams = Array.isArray(payload.scoutingTeams) ? payload.scoutingTeams : [];
  if (payload.scoutingAssignments !== undefined) nextPayload.scoutingAssignments = Array.isArray(payload.scoutingAssignments) ? payload.scoutingAssignments : [];
  if (payload.eventKey !== undefined) nextPayload.eventKey = normalizeString(payload.eventKey) || '';
  if (payload.superscouterNotes !== undefined) nextPayload.superscouterNotes = payload.superscouterNotes && typeof payload.superscouterNotes === 'object' ? payload.superscouterNotes : {};
  if (payload.driveTeamStrategyByTeam !== undefined) {
    nextPayload.driveTeamStrategyByTeam = payload.driveTeamStrategyByTeam && typeof payload.driveTeamStrategyByTeam === 'object'
      ? payload.driveTeamStrategyByTeam
      : {};
  }
  if (payload.robotBreakTimelineOverrides !== undefined) {
    nextPayload.robotBreakTimelineOverrides = payload.robotBreakTimelineOverrides && typeof payload.robotBreakTimelineOverrides === 'object'
      ? payload.robotBreakTimelineOverrides
      : {};
  }
  if (payload.pitMapImageUrl !== undefined) nextPayload.pitMapImageUrl = normalizeStoredImageUrl(payload.pitMapImageUrl);
  if (payload.pitMapImagePath !== undefined) nextPayload.pitMapImagePath = normalizeString(payload.pitMapImagePath);
  if (payload.pitLocations !== undefined) nextPayload.pitLocations = payload.pitLocations && typeof payload.pitLocations === 'object' ? payload.pitLocations : {};
  if (payload.manualPickLists !== undefined) nextPayload.manualPickLists = Array.isArray(payload.manualPickLists) ? payload.manualPickLists : [];

  return nextPayload;
};

export { VALID_COMPETITION_STATUSES };
