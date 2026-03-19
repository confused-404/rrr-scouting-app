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

const sanitizeOptions = (field) => {
  const options = Array.isArray(field.options)
    ? field.options.map((option) => normalizeString(option)).filter(Boolean)
    : [];

  if (options.length === 0) {
    throw createValidationError(`Field "${field.label || field.id}" requires at least one option.`);
  }

  return Array.from(new Set(options));
};

const sanitizeCondition = (condition, fieldIds, currentFieldId) => {
  if (!condition) return undefined;

  const fieldId = Number(condition.fieldId);
  if (!Number.isInteger(fieldId) || !fieldIds.has(fieldId)) {
    throw createValidationError('Conditional logic must target a valid field.');
  }

  if (fieldId === currentFieldId) {
    throw createValidationError('A field cannot depend on itself.');
  }

  if (!VALID_CONDITION_OPERATORS.has(condition.operator)) {
    throw createValidationError('Conditional logic operator is invalid.');
  }

  return {
    fieldId,
    operator: condition.operator,
    value: condition.value,
  };
};

const sanitizeFields = (fields) => {
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

    const condition = sanitizeCondition(field.condition, fieldIds, id);
    if (condition) {
      sanitizedField.condition = condition;
    }

    return sanitizedField;
  });
};

const shouldIncludeField = (field, values) => {
  if (!field.condition) return true;

  const dependentValue = values[String(field.condition.fieldId)];
  if (dependentValue === undefined || dependentValue === null || dependentValue === '') {
    return false;
  }

  switch (field.condition.operator) {
    case 'equals':
      return dependentValue === field.condition.value;
    case 'not_equals':
      return dependentValue !== field.condition.value;
    case 'contains':
      if (Array.isArray(dependentValue)) {
        return dependentValue.includes(field.condition.value);
      }
      return String(dependentValue).includes(String(field.condition.value));
    case 'not_contains':
      if (Array.isArray(dependentValue)) {
        return !dependentValue.includes(field.condition.value);
      }
      return !String(dependentValue).includes(String(field.condition.value));
    default:
      return true;
  }
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
    if (!shouldIncludeField(field, payload)) continue;

    const key = String(field.id);
    const rawValue = payload[key];

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
      // console.log('Getting all forms...');
      const forms = await formModel.getAllForms();
      // console.log('Forms retrieved:', forms.length);
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

      const sanitizedFields = sanitizeFields(fields);

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

  // Update form
  updateForm: async (req, res) => {
    try {
      const { fields, name } = req.body; // Add name

      const sanitizedFields = sanitizeFields(fields);

      const updateData = { fields: sanitizedFields };
      if (name !== undefined) {
        updateData.name = normalizeString(name) || 'Untitled Form';
      }

      const updatedForm = await formModel.updateForm(req.params.id, updateData);

      if (!updatedForm) {
        return res.status(404).json({ message: 'Form not found' });
      }

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

        // remove from activeFormIds if present (supports legacy activeFormId too)
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
  }
};