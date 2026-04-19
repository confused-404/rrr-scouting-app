import { normalizeTeamNumber, resolveTeamNumberFieldId } from './submissionValidation.js';

const getSubmissionTime = (submission) => {
  if (!submission?.timestamp) return 0;

  const timestampMs = new Date(submission.timestamp).getTime();
  return Number.isFinite(timestampMs) ? timestampMs : 0;
};

export const buildCrossFormValuesForTeam = ({
  competitionId,
  currentFormId,
  teamNumber,
  forms,
  submissions,
  referencedFieldsByFormId,
}) => {
  const normalizedTeam = normalizeTeamNumber(teamNumber);
  if (!competitionId || !normalizedTeam) {
    return {};
  }

  const eligibleForms = new Map();
  for (const form of forms || []) {
    if (!form || form.id === currentFormId) continue;

    const teamNumberFieldId = resolveTeamNumberFieldId(form);
    if (teamNumberFieldId === null) continue;

    eligibleForms.set(form.id, {
      form,
      teamNumberFieldId,
    });
  }

  if (eligibleForms.size === 0) {
    return {};
  }

  const requestedReferences = referencedFieldsByFormId instanceof Map
    ? referencedFieldsByFormId
    : new Map();

  const latestSubmissionByFormId = new Map();
  for (const submission of submissions || []) {
    if (!submission || submission.competitionId !== competitionId) continue;

    const formContext = eligibleForms.get(submission.formId);
    if (!formContext) continue;

    const submittedTeamNumber = normalizeTeamNumber(
      submission.data?.[String(formContext.teamNumberFieldId)],
    );
    if (submittedTeamNumber !== normalizedTeam) continue;

    const nextTimestampMs = getSubmissionTime(submission);
    const currentLatest = latestSubmissionByFormId.get(submission.formId);
    const currentTimestampMs = currentLatest ? getSubmissionTime(currentLatest) : -1;

    if (!currentLatest || nextTimestampMs > currentTimestampMs) {
      latestSubmissionByFormId.set(submission.formId, submission);
    }
  }

  const values = {};
  for (const [formId, submission] of latestSubmissionByFormId.entries()) {
    const requestedFieldIds = requestedReferences.get(formId);
    if (!(requestedFieldIds instanceof Set) || requestedFieldIds.size === 0) {
      continue;
    }

    Object.entries(submission.data || {}).forEach(([fieldId, fieldValue]) => {
      if (!requestedFieldIds.has(Number(fieldId))) {
        return;
      }
      values[`${formId}:${fieldId}`] = fieldValue;
    });
  }

  return values;
};
