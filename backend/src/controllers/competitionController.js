import { competitionModel } from '../models/competitionModel.js';

export const competitionController = {
  // Get all competitions
  getAllCompetitions: async (req, res) => {
    try {
      const competitions = await competitionModel.getAllCompetitions();
      res.json(competitions);
    } catch (error) {
      console.error('Error in getAllCompetitions:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get active competitions
  getActiveCompetitions: async (req, res) => {
    try {
      const competitions = await competitionModel.getActiveCompetitions();
      res.json(competitions);
    } catch (error) {
      console.error('Error in getActiveCompetitions:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get single competition
  getCompetition: async (req, res) => {
    try {
      const competition = await competitionModel.getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }
      res.json(competition);
    } catch (error) {
      console.error('Error in getCompetition:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Create competition
  createCompetition: async (req, res) => {
    try {
      const { name, season, status, startDate, endDate } = req.body;
      
      if (!name || !season) {
        return res.status(400).json({ message: 'Name and season are required' });
      }

      const newCompetition = await competitionModel.createCompetition({
        name,
        season,
        status: status || 'draft',
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date().toISOString(),
      });
      
      res.status(201).json(newCompetition);
    } catch (error) {
      console.error('Error in createCompetition:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update competition
  updateCompetition: async (req, res) => {
    try {
      const { name, season, status, startDate, endDate, activeFormId } = req.body;
      
      const updatedCompetition = await competitionModel.updateCompetition(req.params.id, {
        ...(name && { name }),
        ...(season && { season }),
        ...(status && { status }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(activeFormId !== undefined && { activeFormId }),
      });
      
      if (!updatedCompetition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      res.json(updatedCompetition);
    } catch (error) {
      console.error('Error in updateCompetition:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Delete competition
  deleteCompetition: async (req, res) => {
    try {
      const deleted = await competitionModel.deleteCompetition(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      res.json({ message: 'Competition deleted successfully' });
    } catch (error) {
      console.error('Error in deleteCompetition:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Add form ID to competition
  addFormId: async (req, res) => {
    try {
      const { formId } = req.body;
      const competitionId = req.params.id;

      if (!formId) {
        return res.status(400).json({ message: 'formId is required' });
      }

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      // Check if formId already exists
      if (competition.formIds.includes(formId)) {
        return res.status(400).json({ message: 'Form ID already exists in this competition' });
      }

      // Add formId to the array
      const updatedFormIds = [...competition.formIds, formId];
      const updatedCompetition = await competitionModel.updateCompetition(competitionId, {
        formIds: updatedFormIds,
      });

      res.json(updatedCompetition);
    } catch (error) {
      console.error('Error in addFormId:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Remove form ID from competition
  removeFormId: async (req, res) => {
    try {
      const { formId } = req.body;
      const competitionId = req.params.id;

      if (!formId) {
        return res.status(400).json({ message: 'formId is required' });
      }

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      // Remove formId from the array
      const updatedFormIds = competition.formIds.filter(id => id !== formId);
      
      // If the removed formId was active, clear activeFormId
      let updateData = { formIds: updatedFormIds };
      if (competition.activeFormId === formId) {
        updateData.activeFormId = null;
      }

      const updatedCompetition = await competitionModel.updateCompetition(competitionId, updateData);

      res.json(updatedCompetition);
    } catch (error) {
      console.error('Error in removeFormId:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Set active form ID for competition
  setActiveFormId: async (req, res) => {
    try {
      const { formId } = req.body;
      const competitionId = req.params.id;

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      // If formId is provided, verify it exists in the formIds array
      if (formId && !competition.formIds.includes(formId)) {
        return res.status(400).json({ message: 'Form ID does not exist in this competition' });
      }

      const updatedCompetition = await competitionModel.updateCompetition(competitionId, {
        activeFormId: formId || null,
      });

      res.json(updatedCompetition);
    } catch (error) {
      console.error('Error in setActiveFormId:', error);
      res.status(500).json({ message: error.message });
    }
  },
};