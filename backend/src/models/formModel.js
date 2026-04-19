import { db } from '../config/firebase.js';
import admin from 'firebase-admin';
import { stripFormFromCompetitionState } from '../utils/competitionState.js';
import { deleteWithRollback } from '../utils/deleteLifecycle.js';

const FORMS_COLLECTION = 'forms';
const SUBMISSIONS_COLLECTION = 'submissions';
const COMPETITIONS_COLLECTION = 'competitions';
const MAX_BATCH_SIZE = 450;

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

const restoreDocuments = async (documents) => {
  for (let index = 0; index < documents.length; index += MAX_BATCH_SIZE) {
    const batch = db.batch();
    documents.slice(index, index + MAX_BATCH_SIZE).forEach(({ ref, data }) => {
      batch.set(ref, data);
    });
    await batch.commit();
  }
};

const deleteDocuments = async (docs) => {
  for (let index = 0; index < docs.length; index += MAX_BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(index, index + MAX_BATCH_SIZE).forEach((snapshotDoc) => {
      batch.delete(snapshotDoc.ref);
    });
    await batch.commit();
  }
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

  createFormForCompetition: async (formData) => {
    const competitionId = formData?.competitionId;
    if (!competitionId) {
      const error = new Error('Competition ID is required');
      error.status = 400;
      throw error;
    }

    const formRef = db.collection(FORMS_COLLECTION).doc();
    const competitionRef = db.collection(COMPETITIONS_COLLECTION).doc(competitionId);

    await db.runTransaction(async (transaction) => {
      const competitionDoc = await transaction.get(competitionRef);
      if (!competitionDoc.exists) {
        const error = new Error('Competition not found');
        error.status = 404;
        throw error;
      }

      transaction.set(formRef, {
        ...formData,
        name: formData.name || 'Untitled Form',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(competitionRef, {
        formIds: admin.firestore.FieldValue.arrayUnion(formRef.id),
      });
    });

    const doc = await formRef.get();
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
    const [formDoc, submissionsSnapshot] = await Promise.all([
      db.collection(FORMS_COLLECTION).doc(id).get(),
      db.collection(SUBMISSIONS_COLLECTION).where('formId', '==', id).get(),
    ]);

    if (!formDoc.exists) {
      return false;
    }

    const formData = formDoc.data();
    const competitionRef = db.collection(COMPETITIONS_COLLECTION).doc(formData.competitionId);
    const submissionRecords = submissionsSnapshot.docs.map((doc) => ({
      ref: doc.ref,
      data: doc.data(),
    }));

    await deleteWithRollback({
      deleteChildren: async () => {
        await deleteDocuments(submissionsSnapshot.docs);
      },
      deleteParent: async () => {
        await db.runTransaction(async (transaction) => {
          const currentFormDoc = await transaction.get(formDoc.ref);
          if (!currentFormDoc.exists) {
            return;
          }

          const currentCompetitionDoc = await transaction.get(competitionRef);
          if (currentCompetitionDoc.exists) {
            transaction.update(competitionRef, stripFormFromCompetitionState(currentCompetitionDoc.data(), id));
          }

          transaction.delete(formDoc.ref);
        });
      },
      restoreChildren: async () => {
        await restoreDocuments(submissionRecords);
      },
    });

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

  getSubmissionsByCompetitionAndTeam: async (competitionId, normalizedTeamNumber) => {
    const normalizedTeam = String(normalizedTeamNumber ?? '').trim();
    if (!competitionId || !normalizedTeam) {
      return [];
    }

    const snapshot = await db.collection(SUBMISSIONS_COLLECTION)
      .where('competitionId', '==', competitionId)
      .where('normalizedTeamNumber', '==', normalizedTeam)
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
   * Preserves formId, competitionId, timestamp, etc.
   * Adds an `editedAt` field to record when the admin last modified it.
   */
  updateSubmission: async (id, updateData) => {
    const docRef = db.collection(SUBMISSIONS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return null;

    await docRef.update({
      ...updateData,
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
