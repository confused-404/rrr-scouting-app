const normalizeString = (value) => String(value ?? '').trim();
const CONFIG_ROLES = new Set(['scout', 'driveTeam', 'admin']);
const METRIC_SOURCES = new Set(['scout', 'tba', 'statbotics', 'admin']);
const METRIC_AGGREGATIONS = new Set(['average', 'total', 'success_rate', 'latest']);
const METRIC_SCOPES = new Set(['current_competition', 'season']);
const METRIC_FORMATS = new Set(['number', 'percentage', 'text', 'image']);
const METRIC_SOURCE_KEYS = {
  scout: new Set(['numeric_field', 'ranking_field', 'multiple_choice_rate']),
  tba: new Set(['ranking', 'opr', 'dpr', 'ccwm']),
  statbotics: new Set(['epa.total', 'epa.auto', 'epa.teleop', 'epa.endgame', 'epa.teleop_per_match']),
  admin: new Set(['superscout_rating', 'superscout_notes', 'drive_team_strategy', 'pit_location', 'robot_reliability']),
};
const METRIC_DESTINATIONS = new Set(['team_lookup', 'automatic_pick_list', 'analytics']);

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

export const createEmptyGameConfiguration = () => ({
  metrics: [],
  teamLookupCards: [],
  teamLookupSections: [],
  pickListModels: [],
  pickListGroups: [],
  analysisEquations: [],
});

const requireId = (value, label) => {
  const id = normalizeString(value);
  if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(id)) {
    throw createValidationError(`${label} must have a valid ID.`);
  }
  return id;
};

const requireLabel = (value, label) => {
  const text = normalizeString(value);
  if (!text || text.length > 100) {
    throw createValidationError(`${label} is required and must be 100 characters or fewer.`);
  }
  return text;
};

const requireChoice = (value, choices, label) => {
  const choice = normalizeString(value);
  if (!choices.has(choice)) throw createValidationError(`${label} is invalid.`);
  return choice;
};

const ensureUniqueIds = (items, label) => {
  const ids = new Set();
  items.forEach((item) => {
    if (ids.has(item.id)) throw createValidationError(`Duplicate ${label} ID detected.`);
    ids.add(item.id);
  });
};

const sanitizeMetrics = (metrics) => {
  const sanitized = metrics.map((metric) => {
    if (!metric || typeof metric !== 'object' || Array.isArray(metric)) {
      throw createValidationError('Each metric must be an object.');
    }
    const source = requireChoice(metric.source, METRIC_SOURCES, 'Metric source');
    const sourceKey = normalizeString(metric.sourceKey);
    if (!METRIC_SOURCE_KEYS[source].has(sourceKey) && !(source === 'scout' && /^form-.+-field-\d+$/.test(sourceKey))) {
      throw createValidationError(`Metric "${normalizeString(metric.label) || normalizeString(metric.id) || 'unknown'}" has an invalid source key: ${sourceKey || '(empty)'}.`);
    }
    if (!Array.isArray(metric.visibility) || !Array.isArray(metric.destinations)) {
      throw createValidationError('Metrics must include visibility and destinations.');
    }
    const visibility = [...new Set(metric.visibility.map((role) => requireChoice(role, CONFIG_ROLES, 'Metric visibility role')))];
    const destinations = [...new Set(metric.destinations.map((destination) => requireChoice(destination, METRIC_DESTINATIONS, 'Metric destination')))];
    return {
      id: requireId(metric.id, 'Metric'),
      label: requireLabel(metric.label, 'Metric label'),
      source,
      sourceKey,
      aggregation: requireChoice(metric.aggregation, METRIC_AGGREGATIONS, 'Metric aggregation'),
      scope: requireChoice(metric.scope, METRIC_SCOPES, 'Metric scope'),
      format: requireChoice(metric.format, METRIC_FORMATS, 'Metric format'),
      visibility,
      destinations,
    };
  });
  ensureUniqueIds(sanitized, 'metric');
  return sanitized;
};

const sanitizeTeamLookupCards = (cards, metricIds) => {
  const sanitized = cards.map((card) => {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      throw createValidationError('Each team lookup card must be an object.');
    }
    if (!Array.isArray(card.metricIds) || !Array.isArray(card.visibility)) {
      throw createValidationError('Team lookup cards must include metrics and visibility.');
    }
    const referencedMetricIds = card.metricIds.map((id) => requireId(id, 'Card metric'));
    if (referencedMetricIds.some((id) => !metricIds.has(id))) {
      throw createValidationError('Team lookup cards can only reference configured metrics.');
    }
    const visibility = [...new Set(card.visibility.map((role) => requireChoice(role, CONFIG_ROLES, 'Card visibility role')))];
    if (visibility.length === 0) throw createValidationError('Team lookup cards must be visible to at least one role.');
    return {
      id: requireId(card.id, 'Team lookup card'),
      label: requireLabel(card.label, 'Team lookup card label'),
      metricIds: [...new Set(referencedMetricIds)],
      visibility,
    };
  });
  ensureUniqueIds(sanitized, 'team lookup card');
  return sanitized;
};

const sanitizeTeamLookupSections = (sections, metricIds) => {
  const sanitized = sections.map((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) throw createValidationError('Each team lookup section must be an object.');
    const kind = requireChoice(section.kind, new Set(['form', 'metric']), 'Team lookup section type');
    const id = requireId(section.id, 'Team lookup section');
    if (kind === 'metric') {
      const metricId = requireId(section.metricId, 'Team lookup section metric');
      if (!metricIds.has(metricId)) throw createValidationError(`Team lookup section "${id}" references an unknown metric: ${metricId}.`);
      return { id, kind, metricId };
    }
    return { id, kind };
  });
  ensureUniqueIds(sanitized, 'team lookup section');
  return sanitized;
};

const sanitizePickListModels = (models, metricIds) => {
  const sanitized = models.map((model) => {
    if (!model || typeof model !== 'object' || Array.isArray(model) || !Array.isArray(model.metricWeights)) {
      throw createValidationError('Each pick-list model must include metric weights.');
    }
    const metricWeights = model.metricWeights.map((entry) => {
      const metricId = requireId(entry?.metricId, 'Pick-list metric');
      const weight = Number(entry?.weight);
      if (!metricIds.has(metricId) || !Number.isFinite(weight) || weight < -100 || weight > 100) {
        throw createValidationError('Pick-list metric weights must reference a configured metric and be between -100 and 100.');
      }
      return { metricId, weight };
    });
    if (new Set(metricWeights.map((entry) => entry.metricId)).size !== metricWeights.length) {
      throw createValidationError('Pick-list models cannot include a metric more than once.');
    }
    return {
      id: requireId(model.id, 'Pick-list model'),
      label: requireLabel(model.label, 'Pick-list model label'),
      scope: requireChoice(model.scope, METRIC_SCOPES, 'Pick-list scope'),
      metricWeights,
    };
  });
  ensureUniqueIds(sanitized, 'pick-list model');
  return sanitized;
};

const sanitizePickListGroups = (groups, metricIds) => {
  const usedMetricIds = new Set();
  const sanitized = groups.map((group) => {
    if (!group || typeof group !== 'object' || Array.isArray(group) || !Array.isArray(group.metricIds)) throw createValidationError('Each pick-list group must include metrics.');
    const metricIdsInGroup = group.metricIds.map((id) => requireId(id, 'Pick-list group metric'));
    if (metricIdsInGroup.some((id) => !metricIds.has(id) || usedMetricIds.has(id))) throw createValidationError('Pick-list groups may only reference each metric once.');
    metricIdsInGroup.forEach((id) => usedMetricIds.add(id));
    return { id: requireId(group.id, 'Pick-list group'), label: requireLabel(group.label, 'Pick-list group label'), metricIds: metricIdsInGroup };
  });
  ensureUniqueIds(sanitized, 'pick-list group');
  return sanitized;
};

const sanitizeAnalysisEquations = (equations, metricIds) => equations.map((equation) => {
  if (!equation || typeof equation !== 'object' || Array.isArray(equation) || !Array.isArray(equation.metricWeights)) throw createValidationError('Each analysis equation must include metric weights.');
  const weightMode = normalizeString(equation?.weightMode || 'normalized');
  if (!['normalized', 'ratio'].includes(weightMode)) throw createValidationError('Analysis equation weight mode is invalid.');
  const metricWeights = equation.metricWeights.map((entry) => {
    const metricId = requireId(entry?.metricId, 'Analysis metric'); const weight = Number(entry?.weight);
    if (!metricIds.has(metricId) || !Number.isFinite(weight) || weight < 0 || (weightMode === 'normalized' && weight > 1)) throw createValidationError(`Analysis metric "${metricId}" has an invalid ${weightMode} weight.`);
    return { metricId, weight };
  });
  if (new Set(metricWeights.map((entry) => entry.metricId)).size !== metricWeights.length) throw createValidationError('Analysis equations cannot include a metric more than once.');
  const total = metricWeights.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightMode === 'normalized' && total > 1.000001) throw createValidationError('Normalized analysis weights cannot total more than 1.');
  return { id: requireId(equation.id, 'Analysis equation'), label: requireLabel(equation.label, 'Analysis equation'), scope: requireChoice(equation.scope, METRIC_SCOPES, 'Analysis equation scope'), metricWeights, weightMode };
});

const sanitizeConfiguration = (value) => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createValidationError('Game configuration must be an object.');
  }

  const keys = Object.keys(createEmptyGameConfiguration());
  for (const key of keys) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      throw createValidationError(`Game configuration "${key}" must be an array.`);
    }
  }
  const metrics = sanitizeMetrics(value.metrics || []);
  const metricIds = new Set(metrics.map((metric) => metric.id));
  return {
    metrics,
    teamLookupCards: sanitizeTeamLookupCards(value.teamLookupCards || [], metricIds),
    teamLookupSections: sanitizeTeamLookupSections(value.teamLookupSections || [], metricIds),
    pickListModels: sanitizePickListModels(value.pickListModels || [], metricIds),
    pickListGroups: sanitizePickListGroups(value.pickListGroups || [], metricIds),
    analysisEquations: sanitizeAnalysisEquations(value.analysisEquations || [], metricIds),
  };
};

export const buildCreateGameProfileInput = (payload = {}) => {
  const name = normalizeString(payload.name);
  const season = normalizeString(payload.season);

  if (!name) throw createValidationError('Game profile name is required.');
  if (!season) throw createValidationError('Season is required.');

  return {
    name,
    season,
    status: 'draft',
    configuration: sanitizeConfiguration(payload.configuration) || createEmptyGameConfiguration(),
  };
};

export const buildUpdateGameProfileInput = (payload = {}) => {
  const update = {};

  if (payload.name !== undefined) {
    const name = normalizeString(payload.name);
    if (!name) throw createValidationError('Game profile name is required.');
    update.name = name;
  }

  if (payload.season !== undefined) {
    const season = normalizeString(payload.season);
    if (!season) throw createValidationError('Season is required.');
    update.season = season;
  }

  if (payload.configuration !== undefined) {
    update.configuration = sanitizeConfiguration(payload.configuration);
  }

  return update;
};
