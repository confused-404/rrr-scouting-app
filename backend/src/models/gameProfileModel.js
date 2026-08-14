import admin from 'firebase-admin';
import { db } from '../config/firebase.js';

const GAME_PROFILES_COLLECTION = 'gameProfiles';
const ACTIVE_PROFILE_STATE_COLLECTION = '_system';
const DEFAULT_CONFIGURATION = { metrics: [], teamLookupCards: [], teamLookupSections: [], pickListModels: [], pickListGroups: [], analysisEquations: [] };
const TEST_DATA_COLLECTION = 'gameProfileTestData';

const normalizeConfiguration = (configuration) => {
  const source = configuration && typeof configuration === 'object' ? configuration : DEFAULT_CONFIGURATION;
  return {
    ...DEFAULT_CONFIGURATION,
    ...source,
    metrics: Array.isArray(source.metrics)
      ? source.metrics.map((metric) => ({
        ...metric,
        visibility: Array.isArray(metric?.visibility) ? metric.visibility : ['scout', 'driveTeam', 'admin'],
        destinations: Array.isArray(metric?.destinations) ? metric.destinations : ['team_lookup'],
      }))
      : [],
    teamLookupCards: Array.isArray(source.teamLookupCards) ? source.teamLookupCards : [],
    teamLookupSections: Array.isArray(source.teamLookupSections) ? source.teamLookupSections : [],
    pickListModels: Array.isArray(source.pickListModels) ? source.pickListModels : [],
    pickListGroups: Array.isArray(source.pickListGroups) ? source.pickListGroups : [],
    analysisEquations: Array.isArray(source.analysisEquations) ? source.analysisEquations : [],
  };
};

const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate().toISOString();
  if (timestamp._seconds) return new Date(timestamp._seconds * 1000).toISOString();
  return typeof timestamp === 'string' ? timestamp : null;
};

const mapGameProfile = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    season: data.season,
    status: data.status || 'draft',
    locked: Boolean(data.locked),
    configuration: normalizeConfiguration(data.configuration),
    createdAt: convertTimestamp(data.createdAt) || doc.createTime?.toDate().toISOString() || null,
    updatedAt: convertTimestamp(data.updatedAt) || doc.updateTime?.toDate().toISOString() || null,
    publishedAt: convertTimestamp(data.publishedAt),
  };
};

const activeProfileStateRef = (season) => db.collection(ACTIVE_PROFILE_STATE_COLLECTION).doc(`gameProfile-${season}`);

export const gameProfileModel = {
  async getAll() {
    const snapshot = await db.collection(GAME_PROFILES_COLLECTION).orderBy('season', 'desc').get();
    return snapshot.docs.map(mapGameProfile);
  },

  async getById(id) {
    const doc = await db.collection(GAME_PROFILES_COLLECTION).doc(id).get();
    return doc.exists ? mapGameProfile(doc) : null;
  },

  async create(input) {
    const docRef = await db.collection(GAME_PROFILES_COLLECTION).add({
      ...input,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return this.getById(docRef.id);
  },

  async update(id, input) {
    const docRef = db.collection(GAME_PROFILES_COLLECTION).doc(id);
    const current = await docRef.get();
    if (!current.exists) return null;
    if (current.data().locked && Object.keys(input).length > 0) {
      const error = new Error('Locked game profiles cannot be changed.');
      error.status = 409;
      throw error;
    }

    await docRef.update({
      ...input,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return this.getById(id);
  },

  async delete(id) {
    const docRef = db.collection(GAME_PROFILES_COLLECTION).doc(id);
    const current = await docRef.get();
    if (!current.exists) return false;
    if (current.data().status !== 'draft') {
      const error = new Error('Only draft game profiles can be deleted.');
      error.status = 409;
      throw error;
    }

    await docRef.delete();
    return true;
  },

  async publish(id) {
    const profileRef = db.collection(GAME_PROFILES_COLLECTION).doc(id);
    const testDataRef = db.collection(TEST_DATA_COLLECTION).doc(id);

    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        const error = new Error('Game profile not found.');
        error.status = 404;
        throw error;
      }

      const season = profileDoc.data().season;
      await transaction.update(profileRef, {
        status: 'published',
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await transaction.set(activeProfileStateRef(season), {
        gameProfileId: id,
        season,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Preview data is intentionally disposable and must never become season data.
      await transaction.delete(testDataRef);
    });

    return this.getById(id);
  },

  async lock(id) {
    const docRef = db.collection(GAME_PROFILES_COLLECTION).doc(id);
    const current = await docRef.get();
    if (!current.exists) return null;
    await docRef.update({ locked: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.getById(id);
  },

  async getTestData(id) {
    const profile = await this.getById(id);
    if (!profile) return null;
    const doc = await db.collection(TEST_DATA_COLLECTION).doc(id).get();
    return doc.exists ? doc.data().data : { teamNumber: '', forms: {}, metrics: {} };
  },

  async setTestData(id, data) {
    const profile = await this.getById(id);
    if (!profile) return null;
    if (profile.status !== 'draft' || profile.locked) {
      const error = new Error('Preview test data can only be changed for an unlocked draft profile.');
      error.status = 409;
      throw error;
    }
    await db.collection(TEST_DATA_COLLECTION).doc(id).set({ data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return data;
  },
};
