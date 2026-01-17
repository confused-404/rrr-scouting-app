import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

const FORMS_COLLECTION = 'forms';
const SUBMISSIONS_COLLECTION = 'submissions';

// Helper function to convert Firestore timestamp
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

export const formModel = {
  // Form CRUD operations
  getAllForms: async () => {
    const snapshot = await db.collection(FORMS_COLLECTION).get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      };
    });
  },

  getFormsByCompetition: async (competitionId) => {
    const snapshot = await db.collection(FORMS_COLLECTION)
      .where('competitionId', '==', competitionId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      };
    });
  },
  
  getFormById: async (id) => {
    const doc = await db.collection(FORMS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  },
  
  createForm: async (formData) => {
    const docRef = await db.collection(FORMS_COLLECTION).add({
      ...formData,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  },
  
  updateForm: async (id, formData) => {
    const docRef = db.collection(FORMS_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    await docRef.update({
      ...formData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const updated = await docRef.get();
    const data = updated.data();
    return {
      id: updated.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  },
  
  deleteForm: async (id) => {
    await db.collection(FORMS_COLLECTION).doc(id).delete();
    return true;
  },
  
  // Submission operations
  getSubmissions: async (formId) => {
    const snapshot = await db.collection(SUBMISSIONS_COLLECTION)
      .where('formId', '==', formId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: convertTimestamp(data.timestamp),
      };
    });
  },

  getSubmissionsByCompetition: async (competitionId) => {
    const snapshot = await db.collection(SUBMISSIONS_COLLECTION)
      .where('competitionId', '==', competitionId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: convertTimestamp(data.timestamp),
      };
    });
  },
  
  createSubmission: async (submissionData) => {
    const docRef = await db.collection(SUBMISSIONS_COLLECTION).add({
      ...submissionData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: convertTimestamp(data.timestamp),
    };
  },
  
  getAllSubmissions: async () => {
    const snapshot = await db.collection(SUBMISSIONS_COLLECTION).get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: convertTimestamp(data.timestamp),
      };
    });
  }
};