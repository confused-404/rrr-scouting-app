const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

export const normalizeActiveFormIds = (competitionLike) => {
  const activeFormIds = Array.isArray(competitionLike?.activeFormIds)
    ? competitionLike.activeFormIds
    : [];
  const legacyActiveFormId = normalizeString(competitionLike?.activeFormId);

  return Array.from(new Set(
    [
      ...activeFormIds.map((formId) => normalizeString(formId)),
      legacyActiveFormId,
    ].filter(Boolean),
  ));
};

export const stripFormFromCompetitionState = (competitionLike, formId) => {
  const normalizedFormId = normalizeString(formId);
  const nextFormIds = Array.isArray(competitionLike?.formIds)
    ? competitionLike.formIds.filter((currentFormId) => normalizeString(currentFormId) !== normalizedFormId)
    : [];
  const nextActiveFormIds = normalizeActiveFormIds(competitionLike)
    .filter((currentFormId) => currentFormId !== normalizedFormId);

  return {
    formIds: nextFormIds,
    activeFormIds: nextActiveFormIds,
  };
};

