const VALID_CONDITION_OPERATORS = new Set([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
]);

const normalizeString = (value) => String(value ?? '').trim();
const normalizeLabel = (value) => normalizeString(value).replace(/\s+/g, ' ').toLowerCase();

// Keep the heuristic narrow so arbitrary labels containing "team" do not
// become the team-number field by accident.
const teamFieldRegex = /^team(?:\s*(?:number|num(?:ber)?|no\.?|#))?(?:\s*\([^)]*\))?$/i;

export const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

export const normalizeTeamNumber = (value) => {
  if (value === null || value === undefined) return null;
  const text = normalizeString(value);
  if (!text) return null;
  if (/^frc\d+$/i.test(text)) return text.replace(/^frc/i, '') || null;
  const digits = text.match(/\d+/)?.[0];
  return digits || null;
};

export const resolveTeamNumberFieldId = (form) => {
  if (Number.isInteger(form?.teamNumberFieldId)) {
    return Number(form.teamNumberFieldId);
  }

  return form?.fields?.find((field) => teamFieldRegex.test(normalizeLabel(field.label)))?.id ?? null;
};

const resolvePicturePathPrefix = ({ competitionId, formId, fieldId, ownerUid }) => (
  `form-submissions/${competitionId}/${formId}/${ownerUid}/${fieldId}/`
);

const hasMeaningfulValue = (value) => !(
  value === ''
  || value === null
  || value === undefined
  || (Array.isArray(value) && value.length === 0)
);

const sanitizePictureValue = (value, options) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw createValidationError('Picture fields must be submitted as an object.');
  }

  const url = normalizeString(value.url);
  const path = normalizeString(value.path);
  const name = normalizeString(value.name);
  const contentType = normalizeString(value.contentType);
  const bucket = normalizeString(value.bucket);
  const uploadedAt = normalizeString(value.uploadedAt);
  const size = Number(value.size);

  if (!url || !path) {
    throw createValidationError('Picture fields must include both url and path.');
  }

  if (!Number.isFinite(size) || size <= 0) {
    throw createValidationError('Picture fields must include a valid file size.');
  }

  if (process.env.FIREBASE_STORAGE_BUCKET && bucket && bucket !== process.env.FIREBASE_STORAGE_BUCKET) {
    throw createValidationError('Picture upload bucket does not match server configuration.');
  }

  const allowedOwnerUids = Array.isArray(options?.allowedOwnerUids) ? options.allowedOwnerUids : [];
  const normalizedOwnerUids = allowedOwnerUids.map((uid) => normalizeString(uid)).filter(Boolean);
  const allowedPrefixes = normalizedOwnerUids.map((ownerUid) => resolvePicturePathPrefix({
    competitionId: options.competitionId,
    formId: options.formId,
    fieldId: options.fieldId,
    ownerUid,
  }));

  if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
    throw createValidationError('Picture upload path is outside the allowed submission scope.');
  }

  return {
    url,
    path,
    name,
    contentType,
    size,
    ...(bucket ? { bucket } : {}),
    ...(uploadedAt ? { uploadedAt } : {}),
  };
};

const shouldIncludeField = (field, values, currentFormId, crossFormValues = {}) => {
  if (!field.condition) return true;

  const resolveValue = (referencedFormId, fieldId) => {
    if (referencedFormId === currentFormId) {
      return values[String(fieldId)];
    }

    return crossFormValues[`${referencedFormId}:${fieldId}`];
  };

  const evaluateWithCrossFormSupport = (conditionNode) => {
    if (!conditionNode) return true;

    if (conditionNode.type === 'group') {
      const children = Array.isArray(conditionNode.conditions) ? conditionNode.conditions : [];
      if (children.length === 0) return true;

      if (conditionNode.combinator === 'or') {
        return children.some((child) => evaluateWithCrossFormSupport(child));
      }

      return children.every((child) => evaluateWithCrossFormSupport(child));
    }

    const rawFormId = normalizeString(conditionNode.formId);
    const referencedFormId = (!rawFormId || rawFormId === '__current__') ? currentFormId : rawFormId;
    const dependentValue = resolveValue(referencedFormId, conditionNode.fieldId);

    if (dependentValue === undefined || dependentValue === null || dependentValue === '') {
      return false;
    }

    switch (conditionNode.operator) {
      case 'equals':
        return dependentValue === conditionNode.value;
      case 'not_equals':
        return dependentValue !== conditionNode.value;
      case 'contains':
        if (Array.isArray(dependentValue)) {
          return dependentValue.includes(conditionNode.value);
        }
        return String(dependentValue).includes(String(conditionNode.value));
      case 'not_contains':
        if (Array.isArray(dependentValue)) {
          return !dependentValue.includes(conditionNode.value);
        }
        return !String(dependentValue).includes(String(conditionNode.value));
      default:
        return true;
    }
  };

  return evaluateWithCrossFormSupport(field.condition);
};

export const sanitizeTeamNumberFieldId = (teamNumberFieldId, fields) => {
  if (teamNumberFieldId === null || teamNumberFieldId === undefined || teamNumberFieldId === '') {
    return null;
  }

  const numericFieldId = Number(teamNumberFieldId);
  if (!Number.isInteger(numericFieldId)) {
    throw createValidationError('Team number field must reference a valid numeric field ID.');
  }

  const fieldExists = fields.some((field) => Number(field.id) === numericFieldId);
  if (!fieldExists) {
    throw createValidationError('Team number field must reference an existing field in the form.');
  }

  return numericFieldId;
};

export const validateSubmissionCompetition = (form, competitionId) => {
  if (!form || typeof form !== 'object') {
    throw createValidationError('Form is required.');
  }

  if (!competitionId) {
    throw createValidationError('Competition ID is required.');
  }

  if (form.competitionId !== competitionId) {
    throw createValidationError('Competition ID does not match the selected form.');
  }
};

export const sanitizeSubmissionData = (form, payload, options = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createValidationError('Submission data must be an object.');
  }

  const sanitized = {};
  const crossFormValues = options.crossFormValues || {};
  const allowedOwnerUids = options.allowedOwnerUids || [];

  for (const field of form.fields || []) {
    const key = String(field.id);
    const rawValue = payload[key];

    if (!shouldIncludeField(field, payload, form.id, crossFormValues)) {
      if (hasMeaningfulValue(rawValue)) {
        throw createValidationError(`Field "${field.label}" is not currently available.`);
      }
      continue;
    }

    switch (field.type) {
      case 'text': {
        const text = normalizeString(rawValue);
        if (!text) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }
        sanitized[key] = text;
        break;
      }

      case 'number': {
        if (!hasMeaningfulValue(rawValue)) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }
        const numberValue = Number(rawValue);
        if (!Number.isFinite(numberValue)) {
          throw createValidationError(`Field "${field.label}" must be a valid number.`);
        }
        sanitized[key] = numberValue;
        break;
      }

      case 'ranking': {
        if (!hasMeaningfulValue(rawValue)) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }
        const rankingValue = Number(rawValue);
        if (
          !Number.isInteger(rankingValue)
          || rankingValue < field.min
          || rankingValue > field.max
        ) {
          throw createValidationError(`Field "${field.label}" must be an integer from ${field.min} to ${field.max}.`);
        }
        sanitized[key] = rankingValue;
        break;
      }

      case 'multiple_choice': {
        const choice = normalizeString(rawValue);
        if (!choice) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }
        if (!field.options.includes(choice)) {
          throw createValidationError(`Field "${field.label}" contains an invalid option.`);
        }
        sanitized[key] = choice;
        break;
      }

      case 'multiple_select': {
        const values = Array.isArray(rawValue)
          ? rawValue.map((value) => normalizeString(value)).filter(Boolean)
          : [];

        if (values.length === 0) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }

        const invalid = values.find((value) => !field.options.includes(value));
        if (invalid) {
          throw createValidationError(`Field "${field.label}" contains an invalid option.`);
        }

        sanitized[key] = Array.from(new Set(values));
        break;
      }

      case 'rank_order': {
        const values = Array.isArray(rawValue)
          ? rawValue.map((value) => normalizeString(value)).filter(Boolean)
          : [];

        if (values.length === 0) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }

        const invalid = values.find((value) => !field.options.includes(value));
        if (invalid) {
          throw createValidationError(`Field "${field.label}" contains an invalid ranked option.`);
        }

        sanitized[key] = values;
        break;
      }

      case 'picture': {
        const pictureValue = sanitizePictureValue(rawValue, {
          competitionId: form.competitionId,
          formId: form.id,
          fieldId: field.id,
          allowedOwnerUids,
        });
        if (!pictureValue) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }
        sanitized[key] = pictureValue;
        break;
      }

      default:
        throw createValidationError(`Field "${field.label}" uses an unsupported operator.`);
    }
  }

  return sanitized;
};

export { VALID_CONDITION_OPERATORS };
