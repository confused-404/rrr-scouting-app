import { createValidationError } from './submissionValidation.js';

const normalizeString = (value) => String(value ?? '').trim();

const collectRuleReferences = (condition, currentFormId, references) => {
  if (!condition || typeof condition !== 'object') {
    return;
  }

  if (condition.type === 'group') {
    const children = Array.isArray(condition.conditions) ? condition.conditions : [];
    children.forEach((child) => collectRuleReferences(child, currentFormId, references));
    return;
  }

  const rawFormId = normalizeString(condition.formId);
  const referencedFormId = (!rawFormId || rawFormId === '__current__') ? currentFormId : rawFormId;
  if (!referencedFormId || referencedFormId === currentFormId) {
    return;
  }

  const fieldId = Number(condition.fieldId);
  if (!Number.isInteger(fieldId)) {
    return;
  }

  if (!references.has(referencedFormId)) {
    references.set(referencedFormId, new Set());
  }

  references.get(referencedFormId).add(fieldId);
};

export const collectCrossFormFieldReferences = (form) => {
  const references = new Map();
  const currentFormId = normalizeString(form?.id);
  if (!currentFormId) {
    return references;
  }

  const fields = Array.isArray(form?.fields) ? form.fields : [];
  fields.forEach((field) => collectRuleReferences(field?.condition, currentFormId, references));

  return references;
};

export const assertFormAllowsSubmission = (competition, formId) => {
  if (!competition || typeof competition !== 'object') {
    throw createValidationError('Competition not found.');
  }

  const activeFormIds = Array.isArray(competition.activeFormIds)
    ? competition.activeFormIds.filter((value) => typeof value === 'string' && value.trim() !== '')
    : [];

  if (activeFormIds.length === 0 || !activeFormIds.includes(formId)) {
    const error = createValidationError('The selected form is not currently accepting submissions.');
    error.status = 403;
    throw error;
  }

  if (competition.status !== 'active') {
    const error = createValidationError('The selected competition is not currently accepting submissions.');
    error.status = 403;
    throw error;
  }
};
