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
  return new Date().toISOString();
};

export const competitionModel = {
  getAllCompetitions: async () => {
    const snapshot = await db.collection(COMPETITIONS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: convertTimestamp(data.startDate),
        endDate: convertTimestamp(data.endDate),
        createdAt: convertTimestamp(data.createdAt),
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
        ...data,
        startDate: convertTimestamp(data.startDate),
        endDate: convertTimestamp(data.endDate),
        createdAt: convertTimestamp(data.createdAt),
      };
    });
  },

  getCompetitionById: async (id) => {
    const doc = await db.collection(COMPETITIONS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startDate: convertTimestamp(data.startDate),
      endDate: convertTimestamp(data.endDate),
      createdAt: convertTimestamp(data.createdAt),
    };
  },

  createCompetition: async (competitionData) => {
    const docRef = await db.collection(COMPETITIONS_COLLECTION).add({
      ...competitionData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startDate: convertTimestamp(data.startDate),
      endDate: convertTimestamp(data.endDate),
      createdAt: convertTimestamp(data.createdAt),
    };
  },

  updateCompetition: async (id, competitionData) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    await docRef.update(competitionData);
    
    return competitionModel.getCompetitionById(id);
  },

  deleteCompetition: async (id) => {
    await db.collection(COMPETITIONS_COLLECTION).doc(id).delete();
    return true;
  },
};