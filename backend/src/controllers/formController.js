import { formModel } from '../models/formModel.js';

export const formController = {
  // Get all forms
  getForms: async (req, res) => {
    try {
      console.log('Getting all forms...');
      const forms = await formModel.getAllForms();
      console.log('Forms retrieved:', forms.length);
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
      const { fields, competitionId } = req.body;
      
      if (!fields || !Array.isArray(fields)) {
        return res.status(400).json({ message: 'Fields array is required' });
      }

      if (!competitionId) {
        return res.status(400).json({ message: 'Competition ID is required' });
      }

      const newForm = await formModel.createForm({ fields, competitionId });
      res.status(201).json(newForm);
    } catch (error) {
      console.error('Error in createForm:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update form
  updateForm: async (req, res) => {
    try {
      const { fields } = req.body;
      
      if (!fields || !Array.isArray(fields)) {
        return res.status(400).json({ message: 'Fields array is required' });
      }

      const updatedForm = await formModel.updateForm(req.params.id, { fields });
      
      if (!updatedForm) {
        return res.status(404).json({ message: 'Form not found' });
      }

      res.json(updatedForm);
    } catch (error) {
      console.error('Error in updateForm:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Delete form
  deleteForm: async (req, res) => {
    try {
      const deleted = await formModel.deleteForm(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Form not found' });
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

      const newSubmission = await formModel.createSubmission({ formId, competitionId, data });
      res.status(201).json(newSubmission);
    } catch (error) {
      console.error('Error in createSubmission:', error);
      res.status(500).json({ message: error.message });
    }
  }
};