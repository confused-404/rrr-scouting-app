import { gameProfileModel } from '../models/gameProfileModel.js';
import { buildCreateGameProfileInput, buildUpdateGameProfileInput } from '../utils/gameProfilePayload.js';

const buildTestDataInput = (payload = {}) => {
  const data = payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.teamNumber !== 'string' || !data.forms || typeof data.forms !== 'object' || !data.metrics || typeof data.metrics !== 'object') {
    const error = new Error('Preview test data must include a team number, forms, and metrics.'); error.status = 400; throw error;
  }
  return { teamNumber: data.teamNumber.trim(), forms: data.forms, metrics: data.metrics };
};

export const gameProfileController = {
  async getAll(req, res) {
    try {
      res.json(await gameProfileModel.getAll());
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const profile = await gameProfileModel.getById(req.params.id);
      if (!profile) return res.status(404).json({ message: 'Game profile not found.' });
      return res.json(profile);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const profile = await gameProfileModel.create(buildCreateGameProfileInput(req.body));
      res.status(201).json(profile);
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const profile = await gameProfileModel.update(req.params.id, buildUpdateGameProfileInput(req.body));
      if (!profile) return res.status(404).json({ message: 'Game profile not found.' });
      return res.json(profile);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  },

  async publish(req, res) {
    try {
      res.json(await gameProfileModel.publish(req.params.id));
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message });
    }
  },

  async lock(req, res) {
    try {
      const profile = await gameProfileModel.lock(req.params.id);
      if (!profile) return res.status(404).json({ message: 'Game profile not found.' });
      return res.json(profile);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  },

  async delete(req, res) {
    try {
      const deleted = await gameProfileModel.delete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Game profile not found.' });
      return res.json({ message: 'Game profile deleted.' });
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  },
  async getTestData(req, res) {
    try { const data = await gameProfileModel.getTestData(req.params.id); if (!data) return res.status(404).json({ message: 'Game profile not found.' }); return res.json(data); } catch (error) { return res.status(error.status || 500).json({ message: error.message }); }
  },
  async setTestData(req, res) {
    try { const data = await gameProfileModel.setTestData(req.params.id, buildTestDataInput(req.body)); if (!data) return res.status(404).json({ message: 'Game profile not found.' }); return res.json(data); } catch (error) { return res.status(error.status || 500).json({ message: error.message }); }
  },
};
