import { db } from '../config/firebase.js';
import { competitionModel } from '../models/competitionModel.js';
import { buildCreateCompetitionInput, buildUpdateCompetitionInput } from '../utils/competitionPayload.js';
import { normalizeActiveFormIds } from '../utils/competitionState.js';

export const competitionController = {
  normalizeSuperscoutTeamKey: (rawTeam) => {
    if (rawTeam === null || rawTeam === undefined) return '';
    const text = String(rawTeam).trim();
    if (!text) return '';
    if (/^frc\d+$/i.test(text)) {
      return text.replace(/^frc/i, '').trim();
    }
    const digits = text.match(/\d+/)?.[0];
    return digits || text;
  },

  normalizeDriveTeamKey: (rawTeam) => {
    if (rawTeam === null || rawTeam === undefined) return '';
    const text = String(rawTeam).trim();
    if (!text) return '';
    if (/^frc\d+$/i.test(text)) {
      return text.replace(/^frc/i, '').trim();
    }
    const digits = text.match(/\d+/)?.[0];
    return digits || text;
  },

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
      const input = buildCreateCompetitionInput(req.body);
      
      if (!input.name || !input.season) {
        return res.status(400).json({ message: 'Name and season are required' });
      }

      const newCompetition = await competitionModel.createCompetition(input);
      
      res.status(201).json(newCompetition);
    } catch (error) {
      console.error('Error in createCompetition:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update competition
  updateCompetition: async (req, res) => {
    try {
      const updatedCompetition = await competitionModel.updateCompetition(
        req.params.id,
        buildUpdateCompetitionInput(req.body),
      );
      
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

      const updatedCompetition = await competitionModel.addFormToCompetition(competitionId, formId);

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

      const updatedCompetition = await competitionModel.removeFormFromCompetition(competitionId, formId);
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

      const updatedCompetition = await competitionModel.toggleActiveFormForCompetition(competitionId, formId);

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
      const normalizedTeamNumber = competitionController.normalizeSuperscoutTeamKey(teamNumber);

      if (!normalizedTeamNumber) {
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
      } else if (notes && typeof notes === 'object') {
        parsedNotes = typeof notes.notes === 'string' ? notes.notes : '';
        parsedRating = typeof notes.rating === 'number' ? notes.rating : null;
      }

      const competitionRef = db.collection('competitions').doc(competitionId);
      await db.runTransaction(async (transaction) => {
        const competitionDoc = await transaction.get(competitionRef);
        if (!competitionDoc.exists) {
          const error = new Error('Competition not found');
          error.status = 404;
          throw error;
        }

        transaction.update(competitionRef, {
          [`superscouterNotes.${normalizedTeamNumber}`]: {
            notes: parsedNotes,
            rating: parsedRating,
          },
        });
      });

      const updatedCompetition = await competitionModel.getCompetitionById(competitionId);
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
      const normalizedTeamNumber = competitionController.normalizeSuperscoutTeamKey(teamNumber);

      if (!normalizedTeamNumber) {
        return res.status(400).json({ message: 'Team number is required' });
      }

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      const superscoutMap = competition.superscouterNotes || {};
      const directRaw = superscoutMap[teamNumber];
      const normalizedRaw = superscoutMap[normalizedTeamNumber];
      const frcRaw = superscoutMap[`frc${normalizedTeamNumber}`];
      const raw = directRaw ?? normalizedRaw ?? frcRaw;

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

      res.json({ teamNumber: normalizedTeamNumber, notes, rating });
    } catch (error) {
      console.error('Error in getSuperscouterNotes:', error);
      res.status(500).json({ message: error.message });
    }
  },

  saveDriveTeamStrategy: async (req, res) => {
    try {
      const { teamNumber, strategy, matchKey } = req.body;
      const competitionId = req.params.id;
      const normalizedTeamNumber = competitionController.normalizeDriveTeamKey(teamNumber);
      const normalizedMatchKey = typeof matchKey === 'string' ? matchKey.trim() : '';

      if (!normalizedTeamNumber) {
        return res.status(400).json({ message: 'Team number is required' });
      }

      if (!normalizedMatchKey) {
        return res.status(400).json({ message: 'Match key is required' });
      }

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      const strategyText = typeof strategy === 'string' ? strategy : '';
      const competitionRef = db.collection('competitions').doc(competitionId);
      await db.runTransaction(async (transaction) => {
        const competitionDoc = await transaction.get(competitionRef);
        if (!competitionDoc.exists) {
          const error = new Error('Competition not found');
          error.status = 404;
          throw error;
        }

        const competitionData = competitionDoc.data() || {};
        const currentByTeam = competitionData.driveTeamStrategyByTeam || {};
        const currentForTeamRaw = currentByTeam[normalizedTeamNumber];

        if (currentForTeamRaw && typeof currentForTeamRaw === 'object' && !Array.isArray(currentForTeamRaw)) {
          transaction.update(competitionRef, {
            [`driveTeamStrategyByTeam.${normalizedTeamNumber}.${normalizedMatchKey}`]: strategyText,
          });
          return;
        }

        if (typeof currentForTeamRaw === 'string' && currentForTeamRaw.length > 0) {
          transaction.update(competitionRef, {
            [`driveTeamStrategyByTeam.${normalizedTeamNumber}`]: {
              default: currentForTeamRaw,
              [normalizedMatchKey]: strategyText,
            },
          });
          return;
        }

        transaction.update(competitionRef, {
          [`driveTeamStrategyByTeam.${normalizedTeamNumber}.${normalizedMatchKey}`]: strategyText,
        });
      });

      const updatedCompetition = await competitionModel.getCompetitionById(competitionId);
      res.json(updatedCompetition);
    } catch (error) {
      console.error('Error in saveDriveTeamStrategy:', error);
      res.status(500).json({ message: error.message });
    }
  },

  getDriveTeamStrategy: async (req, res) => {
    try {
      const { teamNumber, matchKey } = req.query;
      const competitionId = req.params.id;
      const normalizedTeamNumber = competitionController.normalizeDriveTeamKey(teamNumber);
      const normalizedMatchKey = typeof matchKey === 'string' ? matchKey.trim() : '';

      if (!normalizedTeamNumber) {
        return res.status(400).json({ message: 'Team number is required' });
      }

      if (!normalizedMatchKey) {
        return res.status(400).json({ message: 'Match key is required' });
      }

      const competition = await competitionModel.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ message: 'Competition not found' });
      }

      const strategyByTeam = competition.driveTeamStrategyByTeam || {};
      const directRaw = strategyByTeam[teamNumber];
      const normalizedRaw = strategyByTeam[normalizedTeamNumber];
      const frcRaw = strategyByTeam[`frc${normalizedTeamNumber}`];
      const rawTeamBucket = directRaw ?? normalizedRaw ?? frcRaw;

      let strategy = '';

      if (typeof rawTeamBucket === 'string') {
        strategy = rawTeamBucket;
      } else if (rawTeamBucket && typeof rawTeamBucket === 'object') {
        const byMatch = rawTeamBucket;
        const directMatch = byMatch[matchKey];
        const normalizedMatch = byMatch[normalizedMatchKey];
        const fallbackDefault = byMatch.default;
        const selected = directMatch ?? normalizedMatch ?? fallbackDefault;
        strategy = typeof selected === 'string' ? selected : '';
      }

      res.json({ teamNumber: normalizedTeamNumber, strategy });
    } catch (error) {
      console.error('Error in getDriveTeamStrategy:', error);
      res.status(500).json({ message: error.message });
    }
  },
};
