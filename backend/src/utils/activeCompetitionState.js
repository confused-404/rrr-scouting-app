export const ACTIVE_COMPETITION_SENTINEL_PATH = '_system/activeCompetition';

export const buildActiveCompetitionSentinel = (
  competitionId,
  nowIso = new Date().toISOString(),
) => ({
  competitionId,
  updatedAt: nowIso,
});
