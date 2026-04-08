import type { ConditionOperator, FormCondition, ConditionGroup, ConditionRule } from '../types/form.types';

export type ConditionFieldRef = {
  formId: string;
  fieldId: number;
};

const isObject = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const isConditionOperator = (value: unknown): value is ConditionOperator => (
  value === 'equals' || value === 'not_equals' || value === 'contains' || value === 'not_contains'
);

const normalizeRule = (raw: unknown, fallbackFormId: string): ConditionRule | null => {
  if (!isObject(raw)) return null;
  const fieldId = Number(raw.fieldId);
  if (!Number.isInteger(fieldId)) return null;

  const operator = raw.operator;
  if (!isConditionOperator(operator)) return null;

  return {
    type: 'rule',
    formId: typeof raw.formId === 'string' && raw.formId.trim() ? raw.formId : fallbackFormId,
    fieldId,
    operator,
    value: String(raw.value ?? ''),
  };
};

export const normalizeCondition = (raw: unknown, fallbackFormId: string): FormCondition | null => {
  if (!raw) return null;
  if (!isObject(raw)) return null;

  if (raw.type === 'group') {
    const combinator = raw.combinator === 'or' ? 'or' : 'and';
    const conditionsRaw = Array.isArray(raw.conditions) ? raw.conditions : [];
    const conditions = conditionsRaw
      .map((child) => normalizeCondition(child, fallbackFormId))
      .filter((child): child is FormCondition => child !== null);

    if (conditions.length === 0) return null;

    return {
      type: 'group',
      combinator,
      conditions,
    };
  }

  return normalizeRule(raw, fallbackFormId);
};

export const createDefaultCondition = (reference: ConditionFieldRef): ConditionGroup => ({
  type: 'group',
  combinator: 'and',
  conditions: [
    {
      type: 'rule',
      formId: reference.formId,
      fieldId: reference.fieldId,
      operator: 'equals',
      value: '',
    },
  ],
});

const evaluateRule = (
  rule: ConditionRule,
  getValue: (ref: ConditionFieldRef) => unknown,
): boolean => {
  const formId = rule.formId || '';
  const dependentValue = getValue({ formId, fieldId: rule.fieldId });

  if (dependentValue === undefined || dependentValue === null || dependentValue === '') {
    return false;
  }

  switch (rule.operator) {
    case 'equals':
      return dependentValue === rule.value;
    case 'not_equals':
      return dependentValue !== rule.value;
    case 'contains':
      if (Array.isArray(dependentValue)) {
        return dependentValue.includes(rule.value);
      }
      return String(dependentValue).includes(String(rule.value));
    case 'not_contains':
      if (Array.isArray(dependentValue)) {
        return !dependentValue.includes(rule.value);
      }
      return !String(dependentValue).includes(String(rule.value));
    default:
      return true;
  }
};

export const evaluateCondition = (
  condition: FormCondition | undefined,
  getValue: (ref: ConditionFieldRef) => unknown,
  fallbackFormId: string,
): boolean => {
  if (!condition) return true;

  const normalized = normalizeCondition(condition, fallbackFormId);
  if (!normalized) return true;

  if (normalized.type === 'group') {
    if (normalized.combinator === 'and') {
      return normalized.conditions.every((child) => evaluateCondition(child, getValue, fallbackFormId));
    }
    return normalized.conditions.some((child) => evaluateCondition(child, getValue, fallbackFormId));
  }

  const normalizedRule: ConditionRule = {
    ...normalized,
    formId: normalized.formId || fallbackFormId,
  };
  return evaluateRule(normalizedRule, getValue);
};

export const getConditionReferences = (
  condition: FormCondition | undefined,
  fallbackFormId: string,
): ConditionFieldRef[] => {
  const normalized = normalizeCondition(condition, fallbackFormId);
  if (!normalized) return [];

  if (normalized.type === 'group') {
    return normalized.conditions.flatMap((child) => getConditionReferences(child, fallbackFormId));
  }

  return [{
    formId: normalized.formId || fallbackFormId,
    fieldId: normalized.fieldId,
  }];
};
