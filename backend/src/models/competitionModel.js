import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

const COMPETITIONS_COLLECTION = 'competitions';

const convertTimestamp = (timestamp) => {
  if (!timestamp) return new Date().toISOString();
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  // If it's already a string, return it
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString();
};

export const competitionModel = {
  getAllCompetitions: async () => {
    const snapshot = await db.collection(COMPETITIONS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      // console.log('Raw competition data:', data); // Debug log
      return {
        id: doc.id,
        name: data.name,
        season: data.season,
        status: data.status,
        startDate: convertTimestamp(data.startDate),
        endDate: convertTimestamp(data.endDate),
        createdAt: convertTimestamp(data.createdAt),
        activeFormId: data.activeFormId,
      };
    });
  },

  getActiveCompetitions: async () => {
    const snapshot = await db.collection(COMPETITIONS_COLLECTION)
      .where('status', '==', 'active')
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        season: data.season,
        status: data.status,
        startDate: convertTimestamp(data.startDate),
        endDate: convertTimestamp(data.endDate),
        createdAt: convertTimestamp(data.createdAt),
        activeFormId: data.activeFormId,
      };
    });
  },

  getCompetitionById: async (id) => {
    const doc = await db.collection(COMPETITIONS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      season: data.season,
      status: data.status,
      startDate: convertTimestamp(data.startDate),
      endDate: convertTimestamp(data.endDate),
      createdAt: convertTimestamp(data.createdAt),
      activeFormId: data.activeFormId,
    };
  },

  createCompetition: async (competitionData) => {
    const docRef = await db.collection(COMPETITIONS_COLLECTION).add({
      name: competitionData.name,
      season: competitionData.season,
      status: competitionData.status,
      startDate: competitionData.startDate, // Store as string
      endDate: competitionData.endDate, // Store as string
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      season: data.season,
      status: data.status,
      startDate: convertTimestamp(data.startDate),
      endDate: convertTimestamp(data.endDate),
      createdAt: convertTimestamp(data.createdAt),
      activeFormId: data.activeFormId,
    };
  },

  updateCompetition: async (id, competitionData) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    // Build update object with only provided fields
    const updateData = {};
    if (competitionData.name !== undefined) updateData.name = competitionData.name;
    if (competitionData.season !== undefined) updateData.season = competitionData.season;
    if (competitionData.status !== undefined) updateData.status = competitionData.status;
    if (competitionData.startDate !== undefined) updateData.startDate = competitionData.startDate;
    if (competitionData.endDate !== undefined) updateData.endDate = competitionData.endDate;
    if (competitionData.activeFormId !== undefined) updateData.activeFormId = competitionData.activeFormId;
    
    // console.log('Updating competition with:', updateData); // Debug log
    
    await docRef.update(updateData);
    
    return competitionModel.getCompetitionById(id);
  },

  deleteCompetition: async (id) => {
    await db.collection(COMPETITIONS_COLLECTION).doc(id).delete();
    return true;
  },
};