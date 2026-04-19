import { db } from '../config/firebase.js';
import admin from 'firebase-admin';
import { normalizeActiveFormIds, stripFormFromCompetitionState } from '../utils/competitionState.js';
import { deleteWithRollback } from '../utils/deleteLifecycle.js';
import { ACTIVE_COMPETITION_SENTINEL_PATH, buildActiveCompetitionSentinel } from '../utils/activeCompetitionState.js';

const COMPETITIONS_COLLECTION = 'competitions';
const FORMS_COLLECTION = 'forms';
const SUBMISSIONS_COLLECTION = 'submissions';
const MAX_BATCH_SIZE = 450;
const activeCompetitionRef = db.doc(ACTIVE_COMPETITION_SENTINEL_PATH);

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

const mapCompetitionDocument = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    season: data.season,
    status: data.status,
    startDate: convertTimestamp(data.startDate),
    endDate: convertTimestamp(data.endDate),
    createdAt: convertTimestamp(data.createdAt),
    formIds: data.formIds || [],
    activeFormIds: normalizeActiveFormIds(data),
    scoutingTeams: data.scoutingTeams || [],
    scoutingAssignments: data.scoutingAssignments || [],
    eventKey: data.eventKey,
    superscouterNotes: data.superscouterNotes || {},
    driveTeamStrategyByTeam: data.driveTeamStrategyByTeam || {},
    robotBreakTimelineOverrides: data.robotBreakTimelineOverrides || {},
    pitMapImageUrl: data.pitMapImageUrl || '',
    pitMapImagePath: data.pitMapImagePath || '',
    pitLocations: data.pitLocations || {},
    manualPickLists: data.manualPickLists || [],
  };
};

const mapActiveCompetitionDocument = (doc) => {
  const data = doc.data();
  const createdAt = convertTimestamp(data.createdAt)
    || doc.createTime?.toDate().toISOString()
    || '1970-01-01T00:00:00.000Z';

  return {
    ...mapCompetitionDocument(doc),
    startDate: convertTimestamp(data.startDate) || new Date().toISOString(),
    endDate: convertTimestamp(data.endDate) || new Date().toISOString(),
    createdAt,
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

export const competitionModel = {
  getAllCompetitions: async () => {
    const snapshot = await db.collection(COMPETITIONS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => mapCompetitionDocument(doc));
  },

  getActiveCompetitions: async () => {
    const sentinelDoc = await activeCompetitionRef.get();
    const sentinelCompetitionId = sentinelDoc.exists ? sentinelDoc.data()?.competitionId : null;

    if (typeof sentinelCompetitionId === 'string' && sentinelCompetitionId) {
      const activeDoc = await db.collection(COMPETITIONS_COLLECTION).doc(sentinelCompetitionId).get();
      if (activeDoc.exists && activeDoc.data()?.status === 'active') {
        return [mapActiveCompetitionDocument(activeDoc)];
      }
    }

    const snapshot = await db.collection(COMPETITIONS_COLLECTION)
      .where('status', '==', 'active')
      .get();

    if (snapshot.docs.length > 1) {
      const error = new Error('Multiple active competitions exist. Manual reconciliation is required.');
      error.status = 409;
      throw error;
    }

    return snapshot.docs.map((doc) => mapActiveCompetitionDocument(doc));
  },

  getCompetitionById: async (id) => {
    const doc = await db.collection(COMPETITIONS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;

    return mapCompetitionDocument(doc);
  },

  createCompetition: async (competitionData) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc();
    const competitionDocument = {
      name: competitionData.name,
      season: competitionData.season,
      status: competitionData.status,
      startDate: competitionData.startDate,
      endDate: competitionData.endDate,
      formIds: competitionData.formIds || [],
      activeFormIds: normalizeActiveFormIds(competitionData),
      scoutingTeams: competitionData.scoutingTeams || [],
      scoutingAssignments: competitionData.scoutingAssignments || [],
      eventKey: competitionData.eventKey,
      superscouterNotes: competitionData.superscouterNotes || {},
      driveTeamStrategyByTeam: competitionData.driveTeamStrategyByTeam || {},
      robotBreakTimelineOverrides: competitionData.robotBreakTimelineOverrides || {},
      pitMapImageUrl: competitionData.pitMapImageUrl || '',
      pitMapImagePath: competitionData.pitMapImagePath || '',
      pitLocations: competitionData.pitLocations || {},
      manualPickLists: competitionData.manualPickLists || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (competitionData.status === 'active') {
      await db.runTransaction(async (transaction) => {
        const sentinelDoc = await transaction.get(activeCompetitionRef);
        const currentActiveId = sentinelDoc.exists ? sentinelDoc.data()?.competitionId : null;

        if (typeof currentActiveId === 'string' && currentActiveId) {
          const currentActiveRef = db.collection(COMPETITIONS_COLLECTION).doc(currentActiveId);
          const currentActiveDoc = await transaction.get(currentActiveRef);
          if (currentActiveDoc.exists) {
            transaction.update(currentActiveRef, { status: 'draft' });
          }
        }

        transaction.set(docRef, competitionDocument);
        transaction.set(activeCompetitionRef, buildActiveCompetitionSentinel(docRef.id));
      });
    } else {
      await docRef.set(competitionDocument);
    }
    
    const doc = await docRef.get();
    return mapCompetitionDocument(doc);
  },

  updateCompetition: async (id, competitionData) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    // If setting status to active, deactivate all other competitions
    // Build update object with only provided fields
    const updateData = {};
    if (competitionData.name !== undefined) updateData.name = competitionData.name;
    if (competitionData.season !== undefined) updateData.season = competitionData.season;
    if (competitionData.status !== undefined) updateData.status = competitionData.status;
    if (competitionData.startDate !== undefined) updateData.startDate = competitionData.startDate;
    if (competitionData.endDate !== undefined) updateData.endDate = competitionData.endDate;
    if (competitionData.formIds !== undefined) updateData.formIds = competitionData.formIds;
    if (competitionData.activeFormIds !== undefined) {
      updateData.activeFormIds = normalizeActiveFormIds(competitionData);
    } else if (competitionData.activeFormId !== undefined) {
      // backwards compatibility
      updateData.activeFormIds = normalizeActiveFormIds(competitionData);
    }
    if (competitionData.scoutingTeams !== undefined) updateData.scoutingTeams = competitionData.scoutingTeams;
    if (competitionData.scoutingAssignments !== undefined) updateData.scoutingAssignments = competitionData.scoutingAssignments;
    if (competitionData.eventKey !== undefined) updateData.eventKey = competitionData.eventKey;
    if (competitionData.superscouterNotes !== undefined) updateData.superscouterNotes = competitionData.superscouterNotes;
    if (competitionData.driveTeamStrategyByTeam !== undefined) updateData.driveTeamStrategyByTeam = competitionData.driveTeamStrategyByTeam;
    if (competitionData.robotBreakTimelineOverrides !== undefined) updateData.robotBreakTimelineOverrides = competitionData.robotBreakTimelineOverrides;
    if (competitionData.pitMapImageUrl !== undefined) updateData.pitMapImageUrl = competitionData.pitMapImageUrl;
    if (competitionData.pitMapImagePath !== undefined) updateData.pitMapImagePath = competitionData.pitMapImagePath;
    if (competitionData.pitLocations !== undefined) updateData.pitLocations = competitionData.pitLocations;
    if (competitionData.manualPickLists !== undefined) updateData.manualPickLists = competitionData.manualPickLists;
    
    if (competitionData.status === 'active') {
      await db.runTransaction(async (transaction) => {
        const sentinelDoc = await transaction.get(activeCompetitionRef);
        const currentActiveId = sentinelDoc.exists ? sentinelDoc.data()?.competitionId : null;

        if (typeof currentActiveId === 'string' && currentActiveId && currentActiveId !== id) {
          const currentActiveRef = db.collection(COMPETITIONS_COLLECTION).doc(currentActiveId);
          const currentActiveDoc = await transaction.get(currentActiveRef);
          if (currentActiveDoc.exists) {
            transaction.update(currentActiveRef, { status: 'draft' });
          }
        }

        transaction.update(docRef, updateData);
        transaction.set(activeCompetitionRef, buildActiveCompetitionSentinel(id));
      });
    } else {
      await db.runTransaction(async (transaction) => {
        const sentinelDoc = await transaction.get(activeCompetitionRef);
        const currentActiveId = sentinelDoc.exists ? sentinelDoc.data()?.competitionId : null;

        transaction.update(docRef, updateData);

        if (
          competitionData.status !== undefined
          && competitionData.status !== 'active'
          && currentActiveId === id
        ) {
          transaction.delete(activeCompetitionRef);
        }
      });
    }
    
    return competitionModel.getCompetitionById(id);
  },

  addFormToCompetition: async (competitionId, formId) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(competitionId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        const error = new Error('Competition not found');
        error.status = 404;
        throw error;
      }

      transaction.update(docRef, {
        formIds: admin.firestore.FieldValue.arrayUnion(formId),
      });
    });

    return competitionModel.getCompetitionById(competitionId);
  },

  removeFormFromCompetition: async (competitionId, formId) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(competitionId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        const error = new Error('Competition not found');
        error.status = 404;
        throw error;
      }

      const nextState = stripFormFromCompetitionState(doc.data(), formId);
      transaction.update(docRef, nextState);
    });

    return competitionModel.getCompetitionById(competitionId);
  },

  toggleActiveFormForCompetition: async (competitionId, formId) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(competitionId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        const error = new Error('Competition not found');
        error.status = 404;
        throw error;
      }

      const data = doc.data();
      const formIds = Array.isArray(data.formIds) ? data.formIds : [];
      if (formId && !formIds.includes(formId)) {
        const error = new Error('Form ID does not exist in this competition');
        error.status = 400;
        throw error;
      }

      let activeFormIds = normalizeActiveFormIds(data);
      if (formId) {
        activeFormIds = activeFormIds.includes(formId)
          ? activeFormIds.filter((currentFormId) => currentFormId !== formId)
          : [...activeFormIds, formId];
      } else {
        activeFormIds = [];
      }

      transaction.update(docRef, { activeFormIds });
    });

    return competitionModel.getCompetitionById(competitionId);
  },

  deleteCompetition: async (id) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return false;

    const [formsSnapshot, submissionsSnapshot] = await Promise.all([
      db.collection(FORMS_COLLECTION).where('competitionId', '==', id).get(),
      db.collection(SUBMISSIONS_COLLECTION).where('competitionId', '==', id).get(),
    ]);

    const formRecords = formsSnapshot.docs.map((snapshotDoc) => ({
      ref: snapshotDoc.ref,
      data: snapshotDoc.data(),
    }));
    const submissionRecords = submissionsSnapshot.docs.map((snapshotDoc) => ({
      ref: snapshotDoc.ref,
      data: snapshotDoc.data(),
    }));

    await deleteWithRollback({
      deleteChildren: async () => {
        await deleteDocuments(submissionsSnapshot.docs);
        await deleteDocuments(formsSnapshot.docs);
      },
      deleteParent: async () => {
        await db.runTransaction(async (transaction) => {
          const sentinelDoc = await transaction.get(activeCompetitionRef);
          const currentActiveId = sentinelDoc.exists ? sentinelDoc.data()?.competitionId : null;

          if (currentActiveId === id) {
            transaction.delete(activeCompetitionRef);
          }

          transaction.delete(docRef);
        });
      },
      restoreChildren: async () => {
        await restoreDocuments(formRecords);
        await restoreDocuments(submissionRecords);
      },
    });

    return true;
  },
};
