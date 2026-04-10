import { formModel } from '../models/formModel.js';

const VALID_FIELD_TYPES = new Set([
  'text',
  'number',
  'ranking',
  'rank_order',
  'multiple_choice',
  'multiple_select',
  'picture',
]);

const VALID_CONDITION_OPERATORS = new Set([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
]);

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const normalizeString = (value) => String(value ?? '').trim();

const toLookupKey = (value) => normalizeString(value).toLowerCase();

const sanitizeOptions = (field) => {
  const options = Array.isArray(field.options)
    ? field.options.map((option) => normalizeString(option)).filter(Boolean)
    : [];

  if (options.length === 0) {
    throw createValidationError(`Field "${field.label || field.id}" requires at least one option.`);
  }

  return Array.from(new Set(options));
};

const sanitizeCondition = (condition, context) => {
  if (!condition) return undefined;

  if (condition.type === 'group') {
    const combinator = condition.combinator === 'or' ? 'or' : 'and';
    const rawConditions = Array.isArray(condition.conditions) ? condition.conditions : [];
    if (rawConditions.length === 0) {
      throw createValidationError('Conditional logic groups must contain at least one condition.');
    }

    const sanitizedChildren = rawConditions
      .map((child) => sanitizeCondition(child, context))
      .filter(Boolean);

    if (sanitizedChildren.length === 0) {
      throw createValidationError('Conditional logic groups must contain valid child conditions.');
    }

    return {
      type: 'group',
      combinator,
      conditions: sanitizedChildren,
    };
  }

  const fieldId = Number(condition.fieldId);
  const rawFormId = normalizeString(condition.formId);
  const resolvedFormId = (!rawFormId || rawFormId === '__current__') ? context.currentFormId : rawFormId;

  if (!Number.isInteger(fieldId)) {
    throw createValidationError('Conditional logic must target a valid field ID.');
  }

  const referencesCurrentForm = resolvedFormId === context.currentFormId;

  if (referencesCurrentForm && fieldId === context.currentFieldId) {
    throw createValidationError('A field cannot depend on itself.');
  }

  if (referencesCurrentForm) {
    if (!context.currentFormFieldIds.has(fieldId)) {
      throw createValidationError('Conditional logic must target a valid field in this form.');
    }
  } else {
    const referencedForm = context.formsById.get(resolvedFormId);
    if (!referencedForm) {
      throw createValidationError('Conditional logic references an unknown form.');
    }
    const referencedFieldIds = new Set((referencedForm.fields || []).map((field) => Number(field.id)));
    if (!referencedFieldIds.has(fieldId)) {
      throw createValidationError('Conditional logic references an unknown field in another form.');
    }
  }

  if (!VALID_CONDITION_OPERATORS.has(condition.operator)) {
    throw createValidationError('Conditional logic operator is invalid.');
  }

  const sanitizedRule = {
    type: 'rule',
    fieldId,
    operator: condition.operator,
    value: condition.value,
  };

  if (!referencesCurrentForm) {
    sanitizedRule.formId = resolvedFormId;
  }

  return sanitizedRule;
};

const sanitizeFields = (fields, options = {}) => {
  const currentFormId = options.currentFormId || '__current__';
  const formsById = options.formsById || new Map();

  if (!Array.isArray(fields)) {
    throw createValidationError('Fields array is required.');
  }

  const fieldIds = new Set();
  fields.forEach((field) => {
    const id = Number(field?.id);
    if (!Number.isInteger(id)) {
      throw createValidationError('Each field must have a numeric ID.');
    }

    if (fieldIds.has(id)) {
      throw createValidationError(`Duplicate field ID detected: ${id}`);
    }

    fieldIds.add(id);
  });

  return fields.map((field) => {
    const id = Number(field.id);
    const type = normalizeString(field.type);
    const label = normalizeString(field.label);

    if (!VALID_FIELD_TYPES.has(type)) {
      throw createValidationError(`Unsupported field type: ${field.type}`);
    }

    if (!label) {
      throw createValidationError(`Field ${id} is missing a label.`);
    }

    const sanitizedField = {
      id,
      type,
      label,
      required: Boolean(field.required),
    };

    if (type === 'number') {
      sanitizedField.unit = normalizeString(field.unit);
    }

    if (type === 'ranking') {
      const min = Number.isFinite(Number(field.min)) ? Number(field.min) : 1;
      const max = Number.isFinite(Number(field.max)) ? Number(field.max) : 10;
      if (!Number.isInteger(min) || !Number.isInteger(max) || min === max) {
        throw createValidationError(`Ranking field "${label}" must have different integer min/max values.`);
      }
      sanitizedField.min = Math.min(min, max);
      sanitizedField.max = Math.max(min, max);
    }

    if (type === 'multiple_choice' || type === 'multiple_select' || type === 'rank_order') {
      sanitizedField.options = sanitizeOptions(field);
    }

    const condition = sanitizeCondition(field.condition, {
      currentFormId,
      currentFieldId: id,
      currentFormFieldIds: fieldIds,
      formsById,
    });
    if (condition) {
      sanitizedField.condition = condition;
    }

    return sanitizedField;
  });
};

const cloneConditionForCompetition = (condition, context) => {
  if (!condition) return undefined;

  if (condition.type === 'group') {
    return {
      type: 'group',
      combinator: condition.combinator === 'or' ? 'or' : 'and',
      conditions: (condition.conditions || [])
        .map((child) => cloneConditionForCompetition(child, context))
        .filter(Boolean),
    };
  }

  const rawFormId = normalizeString(condition.formId);
  const referencedFormId = rawFormId || context.sourceForm.id;

  if (referencedFormId === context.sourceForm.id) {
    return {
      type: 'rule',
      fieldId: Number(condition.fieldId),
      operator: condition.operator,
      value: condition.value,
    };
  }

  const sourceReferencedForm = context.sourceFormsById.get(referencedFormId);
  if (!sourceReferencedForm) {
    throw createValidationError('Conditional logic references an unknown source form.');
  }

  const sourceReferencedField = (sourceReferencedForm.fields || []).find(
    (field) => Number(field.id) === Number(condition.fieldId),
  );
  if (!sourceReferencedField) {
    throw createValidationError(`Conditional logic references an unknown field in source form "${sourceReferencedForm.name || referencedFormId}".`);
  }

  const destinationReferencedForm = context.destinationFormsByName.get(toLookupKey(sourceReferencedForm.name));
  if (!destinationReferencedForm) {
    throw createValidationError(`Conditional logic references form "${sourceReferencedForm.name}" which does not exist in the destination competition.`);
  }

  const destinationReferencedField = (destinationReferencedForm.fields || []).find((field) => (
    Number(field.id) === Number(sourceReferencedField.id)
    || (
      toLookupKey(field.label) === toLookupKey(sourceReferencedField.label)
      && normalizeString(field.type) === normalizeString(sourceReferencedField.type)
    )
  ));

  if (!destinationReferencedField) {
    throw createValidationError(
      `Conditional logic references "${sourceReferencedField.label}" in form "${sourceReferencedForm.name}", but no matching question exists in the destination competition.`,
    );
  }

  return {
    type: 'rule',
    formId: destinationReferencedForm.id,
    fieldId: Number(destinationReferencedField.id),
    operator: condition.operator,
    value: condition.value,
  };
};

const cloneFieldsForCompetition = (fields, context) => {
  return (fields || []).map((field) => {
    const clonedField = {
      ...field,
      id: Number(field.id),
      required: Boolean(field.required),
    };

    if (Array.isArray(field.options)) {
      clonedField.options = [...field.options];
    }

    if (field.condition) {
      clonedField.condition = cloneConditionForCompetition(field.condition, context);
    }

    return clonedField;
  });
};

const evaluateConditionForSubmission = (condition, values, currentFormId) => {
  if (!condition) return true;

  if (condition.type === 'group') {
    const children = Array.isArray(condition.conditions) ? condition.conditions : [];
    if (children.length === 0) return true;

    if (condition.combinator === 'or') {
      return children.some((child) => evaluateConditionForSubmission(child, values, currentFormId));
    }
    return children.every((child) => evaluateConditionForSubmission(child, values, currentFormId));
  }

  const rawFormId = normalizeString(condition.formId);
  const referencedFormId = (!rawFormId || rawFormId === '__current__') ? currentFormId : rawFormId;
  if (referencedFormId !== currentFormId) {
    // Submission payload only contains data for one form.
    return false;
  }

  const dependentValue = values[String(condition.fieldId)];
  if (dependentValue === undefined || dependentValue === null || dependentValue === '') {
    return false;
  }

  switch (condition.operator) {
    case 'equals':
      return dependentValue === condition.value;
    case 'not_equals':
      return dependentValue !== condition.value;
    case 'contains':
      if (Array.isArray(dependentValue)) {
        return dependentValue.includes(condition.value);
      }
      return String(dependentValue).includes(String(condition.value));
    case 'not_contains':
      if (Array.isArray(dependentValue)) {
        return !dependentValue.includes(condition.value);
      }
      return !String(dependentValue).includes(String(condition.value));
    default:
      return true;
  }
};

const shouldIncludeField = (field, values, currentFormId) => {
  if (!field.condition) return true;
  return evaluateConditionForSubmission(field.condition, values, currentFormId);
};

const sanitizePictureValue = (value) => {
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

const sanitizeSubmissionData = (form, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createValidationError('Submission data must be an object.');
  }

  const sanitized = {};

  for (const field of form.fields || []) {
    const key = String(field.id);
    const rawValue = payload[key];

    if (!shouldIncludeField(field, payload, form.id)) {
      const hasValue = !(rawValue === '' || rawValue === null || rawValue === undefined || (Array.isArray(rawValue) && rawValue.length === 0));
      if (!hasValue) continue;
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
        if (rawValue === '' || rawValue === null || rawValue === undefined) {
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
        if (rawValue === '' || rawValue === null || rawValue === undefined) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }
        const rankingValue = Number(rawValue);
        if (
          !Number.isInteger(rankingValue)
          || rankingValue < field.min
          || rankingValue > field.max
        ) {
          throw createValidationError(
            `Field "${field.label}" must be an integer from ${field.min} to ${field.max}.`
          );
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
        const pictureValue = sanitizePictureValue(rawValue);
        if (!pictureValue) {
          if (field.required) throw createValidationError(`Field "${field.label}" is required.`);
          break;
        }
        sanitized[key] = pictureValue;
        break;
      }
    }
  }

  return sanitized;
};

export const formController = {
  // Get all forms
  getForms: async (req, res) => {
    try {
      const forms = await formModel.getAllForms();
      res.json(forms);
    } catch (error) {
      console.error('Error in getForms:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get forms by competition
  getFormsByCompetition: async (req, res) => {
    try {
      const forms = await formModel.getFormsByCompetition(req.params.competitionId);
      res.json(forms);
    } catch (error) {
      console.error('Error in getFormsByCompetition:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get single form
  getForm: async (req, res) => {
    try {
      const form = await formModel.getFormById(req.params.id);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }
      res.json(form);
    } catch (error) {
      console.error('Error in getForm:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Create form
  createForm: async (req, res) => {
    try {
      const { fields, competitionId, name } = req.body;

      if (!competitionId) {
        return res.status(400).json({ message: 'Competition ID is required' });
      }

      const competitionForms = await formModel.getFormsByCompetition(competitionId);
      const formsById = new Map(competitionForms.map((form) => [form.id, form]));
      const sanitizedFields = sanitizeFields(fields, {
        currentFormId: '__current__',
        formsById,
      });

      const newForm = await formModel.createForm({
        fields: sanitizedFields,
        competitionId,
        name: normalizeString(name) || 'Untitled Form'
      });

      // Add the form ID to the competition's formIds array
      const { competitionModel } = await import('../models/competitionModel.js');
      const competition = await competitionModel.getCompetitionById(competitionId);

      if (competition) {
        const updatedFormIds = [...(competition.formIds || []), newForm.id];
        await competitionModel.updateCompetition(competitionId, { formIds: updatedFormIds });
      }

      res.status(201).json(newForm);
    } catch (error) {
      console.error('Error in createForm:', error);
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  copyForm: async (req, res) => {
    try {
      const sourceForm = await formModel.getFormById(req.params.id);
      if (!sourceForm) {
        return res.status(404).json({ message: 'Form not found' });
      }

      const destinationCompetitionId = normalizeString(req.body.destinationCompetitionId);
      if (!destinationCompetitionId) {
        return res.status(400).json({ message: 'Destination competition ID is required' });
      }

      const { competitionModel } = await import('../models/competitionModel.js');
      const destinationCompetition = await competitionModel.getCompetitionById(destinationCompetitionId);
      if (!destinationCompetition) {
        return res.status(404).json({ message: 'Destination competition not found' });
      }

      const requestedName = normalizeString(req.body.name);
      const sourceCompetitionForms = await formModel.getFormsByCompetition(sourceForm.competitionId);
      const destinationCompetitionForms = await formModel.getFormsByCompetition(destinationCompetitionId);

      const sourceFormsById = new Map(sourceCompetitionForms.map((form) => [form.id, form]));
      const destinationFormsByName = new Map(
        destinationCompetitionForms.map((form) => [toLookupKey(form.name), form]),
      );

      const clonedFields = cloneFieldsForCompetition(sourceForm.fields, {
        sourceForm,
        sourceFormsById,
        destinationFormsByName,
      });

      const sanitizedFields = sanitizeFields(clonedFields, {
        currentFormId: '__current__',
        formsById: new Map(destinationCompetitionForms.map((form) => [form.id, form])),
      });

      const copiedForm = await formModel.createForm({
        competitionId: destinationCompetitionId,
        name: requestedName || sourceForm.name || 'Untitled Form',
        fields: sanitizedFields,
        teamNumberFieldId: sourceForm.teamNumberFieldId ?? null,
      });

      const updatedFormIds = [...(destinationCompetition.formIds || []), copiedForm.id];
      await competitionModel.updateCompetition(destinationCompetitionId, { formIds: updatedFormIds });

      res.status(201).json(copiedForm);
    } catch (error) {
      console.error('Error in copyForm:', error);
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  // Update form
  updateForm: async (req, res) => {
    try {
      const { fields, name } = req.body;
      const existingForm = await formModel.getFormById(req.params.id);
      if (!existingForm) {
        return res.status(404).json({ message: 'Form not found' });
      }

      const competitionForms = await formModel.getFormsByCompetition(existingForm.competitionId);
      const formsById = new Map(
        competitionForms
          .filter((form) => form.id !== req.params.id)
          .map((form) => [form.id, form])
      );

      const sanitizedFields = sanitizeFields(fields, {
        currentFormId: req.params.id,
        formsById,
      });

      const updateData = { fields: sanitizedFields };
      if (name !== undefined) {
        updateData.name = normalizeString(name) || 'Untitled Form';
      }

      const updatedForm = await formModel.updateForm(req.params.id, updateData);

      res.json(updatedForm);
    } catch (error) {
      console.error('Error in updateForm:', error);
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  // Delete form
  deleteForm: async (req, res) => {
    try {
      const form = await formModel.getFormById(req.params.id);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }

      const deleted = await formModel.deleteForm(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Form not found' });
      }

      // Remove the form ID from the competition's formIds array
      const { competitionModel } = await import('../models/competitionModel.js');
      const competition = await competitionModel.getCompetitionById(form.competitionId);

      if (competition) {
        const updatedFormIds = (competition.formIds || []).filter(id => id !== req.params.id);
        const updateData = { formIds: updatedFormIds };

        let activeIds = competition.activeFormIds || [];
        if (!Array.isArray(activeIds) && competition.activeFormId) {
          activeIds = [competition.activeFormId];
        }
        activeIds = activeIds.filter(id => id !== req.params.id);
        updateData.activeFormIds = activeIds;

        await competitionModel.updateCompetition(form.competitionId, updateData);
      }

      res.json({ message: 'Form deleted successfully' });
    } catch (error) {
      console.error('Error in deleteForm:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get submissions for a form
  getSubmissions: async (req, res) => {
    try {
      const submissions = await formModel.getSubmissions(req.params.id);
      res.json(submissions);
    } catch (error) {
      console.error('Error in getSubmissions:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get submissions by competition
  getSubmissionsByCompetition: async (req, res) => {
    try {
      const submissions = await formModel.getSubmissionsByCompetition(req.params.competitionId);
      res.json(submissions);
    } catch (error) {
      console.error('Error in getSubmissionsByCompetition:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Create submission
  createSubmission: async (req, res) => {
    try {
      const { formId, competitionId, data } = req.body;

      if (!formId || !data) {
        return res.status(400).json({ message: 'Form ID and data are required' });
      }

      if (!competitionId) {
        return res.status(400).json({ message: 'Competition ID is required' });
      }

      const form = await formModel.getFormById(formId);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }

      const sanitizedData = sanitizeSubmissionData(form, data);
      const newSubmission = await formModel.createSubmission({ formId, competitionId, data: sanitizedData });
      res.status(201).json(newSubmission);
    } catch (error) {
      console.error('Error in createSubmission:', error);
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  /**
   * Update an existing submission in-place (admin only).
   * Validates the incoming data against the original form's field definitions,
   * then writes only the `data` field back to Firestore without touching
   * formId, competitionId, or the original timestamp.
   */
  updateSubmission: async (req, res) => {
    try {
      const { id } = req.params;
      const { data } = req.body;

      if (!data) {
        return res.status(400).json({ message: 'Submission data is required' });
      }

      // Fetch the existing submission so we know which form to validate against
      const existingSubmission = await formModel.getSubmissionById(id);
      if (!existingSubmission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      // Load the form to get field definitions for validation
      const form = await formModel.getFormById(existingSubmission.formId);
      if (!form) {
        return res.status(404).json({ message: 'Form definition not found' });
      }

      // Sanitize & validate using the same logic as createSubmission
      const sanitizedData = sanitizeSubmissionData(form, data);

      const updatedSubmission = await formModel.updateSubmission(id, sanitizedData);
      res.json(updatedSubmission);
    } catch (error) {
      console.error('Error in updateSubmission:', error);
      res.status(error.status || 500).json({ message: error.message });
    }
  },
};
