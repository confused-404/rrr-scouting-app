import { formModel } from '../models/formModel.js';

export const formController = {
  // Get all forms
  getForms: (req, res) => {
    const forms = formModel.getAllForms();
    res.json(forms);
  },

  // Get single form
  getForm: (req, res) => {
    const form = formModel.getFormById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }
    res.json(form);
  },

  // Create form
  createForm: (req, res) => {
    const { fields } = req.body;
    
    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ message: 'Fields array is required' });
    }

    const newForm = formModel.createForm({ fields });
    res.status(201).json(newForm);
  },

  // Update form
  updateForm: (req, res) => {
    const { fields } = req.body;
    
    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ message: 'Fields array is required' });
    }

    const updatedForm = formModel.updateForm(req.params.id, { fields });
    
    if (!updatedForm) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json(updatedForm);
  },

  // Delete form
  deleteForm: (req, res) => {
    const deleted = formModel.deleteForm(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json({ message: 'Form deleted successfully' });
  },

  // Get submissions for a form
  getSubmissions: (req, res) => {
    const submissions = formModel.getSubmissions(req.params.id);
    res.json(submissions);
  },

  // Create submission
  createSubmission: (req, res) => {
    const { formId, data } = req.body;
    
    if (!formId || !data) {
      return res.status(400).json({ message: 'Form ID and data are required' });
    }

    const form = formModel.getFormById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const newSubmission = formModel.createSubmission({ formId, data });
    res.status(201).json(newSubmission);
  }
};