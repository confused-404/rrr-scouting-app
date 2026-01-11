import { db } from '../config/firebase.js';

const FORMS_COLLECTION = 'forms';
const SUBMISSIONS_COLLECTION = 'submissions';

export const formModel = {
  // Form CRUD operations
  getAllForms: async () => {
    const snapshot = await db.collection(FORMS_COLLECTION).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    }));
  },
  
  getFormById: async (id) => {
    const doc = await db.collection(FORMS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    };
  },
  
  createForm: async (formData) => {
    const docRef = await db.collection(FORMS_COLLECTION).add({
      ...formData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
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
    return {
      id: updated.id,
      ...updated.data(),
      createdAt: updated.data().createdAt?.toDate().toISOString(),
      updatedAt: updated.data().updatedAt?.toDate().toISOString(),
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
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toISOString(),
    }));
  },
  
  createSubmission: async (submissionData) => {
    const docRef = await db.collection(SUBMISSIONS_COLLECTION).add({
      ...submissionData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    return {
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toISOString(),
    };
  },
  
  getAllSubmissions: async () => {
    const snapshot = await db.collection(SUBMISSIONS_COLLECTION).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toISOString(),
    }));
  }
};

// Need to import admin at the top
import admin from 'firebase-admin';