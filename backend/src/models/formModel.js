import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

const FORMS_COLLECTION = 'forms';
const SUBMISSIONS_COLLECTION = 'submissions';

// Helper function to convert Firestore timestamp
const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return null;
};

const mapFormDocument = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: convertTimestamp(data.createdAt) || doc.createTime?.toDate().toISOString() || null,
    updatedAt: convertTimestamp(data.updatedAt) || doc.updateTime?.toDate().toISOString() || null,
  };
};

const mapSubmissionDocument = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    timestamp: convertTimestamp(data.timestamp) || doc.createTime?.toDate().toISOString() || null,
    editedAt: data.editedAt ? (convertTimestamp(data.editedAt) || doc.updateTime?.toDate().toISOString() || null) : undefined,
  };
};

export const formModel = {
  // Form CRUD operations
  getAllForms: async () => {
    const snapshot = await db.collection(FORMS_COLLECTION).get();
    return snapshot.docs.map((doc) => mapFormDocument(doc));
  },

  getFormsByCompetition: async (competitionId) => {
    const snapshot = await db.collection(FORMS_COLLECTION)
      .where('competitionId', '==', competitionId)
      .get();

    return snapshot.docs.map((doc) => mapFormDocument(doc));
  },

  getFormById: async (id) => {
    const doc = await db.collection(FORMS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;

    return mapFormDocument(doc);
  },

  createForm: async (formData) => {
    const docRef = await db.collection(FORMS_COLLECTION).add({
      ...formData,
      name: formData.name || 'Untitled Form',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const doc = await docRef.get();
    return mapFormDocument(doc);
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
    return mapFormDocument(updated);
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

    return snapshot.docs.map((doc) => mapSubmissionDocument(doc));
  },

  getSubmissionsByCompetition: async (competitionId) => {
    const snapshot = await db.collection(SUBMISSIONS_COLLECTION)
      .where('competitionId', '==', competitionId)
      .get();

    return snapshot.docs.map((doc) => mapSubmissionDocument(doc));
  },

  getSubmissionById: async (id) => {
    const doc = await db.collection(SUBMISSIONS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;

    return mapSubmissionDocument(doc);
  },

  createSubmission: async (submissionData) => {
    const docRef = await db.collection(SUBMISSIONS_COLLECTION).add({
      ...submissionData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    const doc = await docRef.get();
    return mapSubmissionDocument(doc);
  },

  /**
   * Update an existing submission's data in-place.
   * Only updates the `data` field — preserves formId, competitionId, timestamp, etc.
   * Adds an `editedAt` field to record when the admin last modified it.
   */
  updateSubmission: async (id, newData) => {
    const docRef = db.collection(SUBMISSIONS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return null;

    await docRef.update({
      data: newData,
      editedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return mapSubmissionDocument(updated);
  },

  getAllSubmissions: async () => {
    const snapshot = await db.collection(SUBMISSIONS_COLLECTION).get();
    return snapshot.docs.map((doc) => mapSubmissionDocument(doc));
  },
};
