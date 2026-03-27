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
      if (competitions.length === 0) {
        return res.json(null); // Return null if no active competition
      }
      res.json(competitions[0]); // Return the single active competition
    } catch (error) {
      console.error('Error in getActiveCompetitions:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get the active competition (single)
  getActiveCompetition: async (req, res) => {
    try {
      const competitions = await competitionModel.getActiveCompetitions();
      if (competitions.length === 0) {
        return res.status(404).json({ message: 'No active competition found' });
      }
      res.json(competitions[0]);
    } catch (error) {
      console.error('Error in getActiveCompetition:', error);
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
      const { name, season, status, startDate, endDate, activeFormIds, eventKey, pitMapImageUrl, manualPickLists } = req.body;
      
      if (!name || !season) {
        return res.status(400).json({ message: 'Name and season are required' });
      }

      const newCompetition = await competitionModel.createCompetition({
        name,
        season,
        status: status || 'draft',
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date().toISOString(),
        activeFormIds: activeFormIds || [],
        eventKey,
        pitMapImageUrl: pitMapImageUrl || '',
        manualPickLists: manualPickLists || [],
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
      const { name, season, status, startDate, endDate, activeFormId, activeFormIds, scoutingTeams, scoutingAssignments, eventKey, superscouterNotes, pitMapImageUrl, manualPickLists } = req.body;
      
      const updatedCompetition = await competitionModel.updateCompetition(req.params.id, {
        ...(name && { name }),
        ...(season && { season }),
        ...(status && { status }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(activeFormIds !== undefined && { activeFormIds }),
        ...(activeFormId !== undefined && { activeFormId }),
        ...(scoutingTeams !== undefined && { scoutingTeams }),
        ...(scoutingAssignments !== undefined && { scoutingAssignments }),
        ...(eventKey !== undefined && { eventKey }),
        ...(superscouterNotes !== undefined && { superscouterNotes }),
        ...(pitMapImageUrl !== undefined && { pitMapImageUrl }),
        ...(manualPickLists !== undefined && { manualPickLists }),
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

      if (competition.formIds.includes(formId)) {
        return res.status(400).json({ message: 'Form ID already exists in this competition' });
      }

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

      const updatedFormIds = competition.formIds.filter(id => id !== formId);
      
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

  // Toggle an active form ID for a competition
  setActiveFormId: async (req, res) => {
    try {
      const { formId } = req.body;
      const competitionId = req.params.id;

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      if (formId && !competition.formIds.includes(formId)) {
        return res.status(400).json({ message: 'Form ID does not exist in this competition' });
      }

      let activeIds = competition.activeFormIds || [];
      if (!Array.isArray(activeIds) && competition.activeFormId) {
        activeIds = [competition.activeFormId];
      }

      if (formId) {
        if (activeIds.includes(formId)) {
          activeIds = activeIds.filter(id => id !== formId);
        } else {
          activeIds.push(formId);
        }
      } else {
        activeIds = [];
      }

      const updatedCompetition = await competitionModel.updateCompetition(competitionId, {
        activeFormIds: activeIds,
      });

      res.json(updatedCompetition);
    } catch (error) {
      console.error('Error in setActiveFormId:', error);
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Save superscouter notes (and optionally a rating) for a specific team.
   *
   * The `notes` body field accepts either:
   *   - A plain string (legacy / simple notes)
   *   - A JSON string of the shape { notes: string, rating: number | null }
   *     (sent by the new superscouter UI)
   *
   * Internally we store the parsed object so that `rating` survives round-trips.
   */
  saveSuperscouterNotes: async (req, res) => {
    try {
      const { teamNumber, notes } = req.body;
      const competitionId = req.params.id;

      if (!teamNumber) {
        return res.status(400).json({ message: 'Team number is required' });
      }

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      // Parse payload — accept both plain string and JSON-encoded {notes, rating}
      let parsedNotes = '';
      let parsedRating = null;

      if (typeof notes === 'string') {
        try {
          const obj = JSON.parse(notes);
          if (obj && typeof obj === 'object') {
            parsedNotes = typeof obj.notes === 'string' ? obj.notes : '';
            parsedRating = typeof obj.rating === 'number' ? obj.rating : null;
          } else {
            parsedNotes = notes;
          }
        } catch {
          // Not JSON — treat as plain notes string
          parsedNotes = notes;
        }
      }

      // Merge into existing superscouter notes map
      const updatedNotes = { ...(competition.superscouterNotes || {}) };
      updatedNotes[teamNumber] = { notes: parsedNotes, rating: parsedRating };

      const updatedCompetition = await competitionModel.updateCompetition(competitionId, {
        superscouterNotes: updatedNotes,
      });

      res.json(updatedCompetition);
    } catch (error) {
      console.error('Error in saveSuperscouterNotes:', error);
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Get superscouter notes for a specific team.
   * Returns { teamNumber, notes, rating } to the client.
   */
  getSuperscouterNotes: async (req, res) => {
    try {
      const { teamNumber } = req.query;
      const competitionId = req.params.id;

      if (!teamNumber) {
        return res.status(400).json({ message: 'Team number is required' });
      }

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      const raw = competition.superscouterNotes?.[teamNumber];

      // Normalise — handle legacy plain-string storage and new object storage
      let notes = '';
      let rating = null;

      if (typeof raw === 'string') {
        // Could be a JSON string from new UI or a legacy plain string
        try {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object') {
            notes = typeof obj.notes === 'string' ? obj.notes : '';
            rating = typeof obj.rating === 'number' ? obj.rating : null;
          } else {
            notes = raw;
          }
        } catch {
          notes = raw;
        }
      } else if (raw && typeof raw === 'object') {
        const obj = raw;
        notes = typeof obj.notes === 'string' ? obj.notes : '';
        rating = typeof obj.rating === 'number' ? obj.rating : null;
      }

      res.json({ teamNumber, notes, rating });
    } catch (error) {
      console.error('Error in getSuperscouterNotes:', error);
      res.status(500).json({ message: error.message });
    }
  },
};
