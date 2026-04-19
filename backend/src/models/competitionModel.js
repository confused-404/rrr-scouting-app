import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

const COMPETITIONS_COLLECTION = 'competitions';
const FORMS_COLLECTION = 'forms';
const SUBMISSIONS_COLLECTION = 'submissions';
const MAX_BATCH_SIZE = 450;

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
        formIds: data.formIds || [],
        activeFormIds: data.activeFormIds || (data.activeFormId ? [data.activeFormId] : []),
        scoutingTeams: data.scoutingTeams || [],
        scoutingAssignments: data.scoutingAssignments || [],
        eventKey: data.eventKey,
        superscouterNotes: data.superscouterNotes || {},
        driveTeamStrategyByTeam: data.driveTeamStrategyByTeam || {},
        robotBreakTimelineOverrides: data.robotBreakTimelineOverrides || {},
        pitMapImageUrl: data.pitMapImageUrl || '',
        pitLocations: data.pitLocations || {},
        manualPickLists: data.manualPickLists || [],
      };
    });
  },

  getActiveCompetitions: async () => {
    const snapshot = await db.collection(COMPETITIONS_COLLECTION)
      .where('status', '==', 'active')
      .get();
    
    const competitions = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = convertTimestamp(data.createdAt)
        || doc.createTime?.toDate().toISOString()
        || '1970-01-01T00:00:00.000Z';

      return {
        id: doc.id,
        name: data.name,
        season: data.season,
        status: data.status,
        startDate: convertTimestamp(data.startDate) || new Date().toISOString(),
        endDate: convertTimestamp(data.endDate) || new Date().toISOString(),
        createdAt,
        formIds: data.formIds || [],
        activeFormIds: data.activeFormIds || (data.activeFormId ? [data.activeFormId] : []),
        scoutingTeams: data.scoutingTeams || [],
        scoutingAssignments: data.scoutingAssignments || [],
        eventKey: data.eventKey,
        superscouterNotes: data.superscouterNotes || {},
        driveTeamStrategyByTeam: data.driveTeamStrategyByTeam || {},
        robotBreakTimelineOverrides: data.robotBreakTimelineOverrides || {},
        pitMapImageUrl: data.pitMapImageUrl || '',
        pitLocations: data.pitLocations || {},
        manualPickLists: data.manualPickLists || [],
      };
    });

    return competitions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
      formIds: data.formIds || [],
      activeFormIds: data.activeFormIds || (data.activeFormId ? [data.activeFormId] : []),
      scoutingTeams: data.scoutingTeams || [],
      scoutingAssignments: data.scoutingAssignments || [],
      eventKey: data.eventKey,
      superscouterNotes: data.superscouterNotes || {},
      driveTeamStrategyByTeam: data.driveTeamStrategyByTeam || {},
      robotBreakTimelineOverrides: data.robotBreakTimelineOverrides || {},
      pitMapImageUrl: data.pitMapImageUrl || '',
      pitLocations: data.pitLocations || {},
      manualPickLists: data.manualPickLists || [],
    };
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
      activeFormIds: competitionData.activeFormIds || (competitionData.activeFormId ? [competitionData.activeFormId] : []),
      scoutingTeams: competitionData.scoutingTeams || [],
      scoutingAssignments: competitionData.scoutingAssignments || [],
      eventKey: competitionData.eventKey,
      superscouterNotes: competitionData.superscouterNotes || {},
      driveTeamStrategyByTeam: competitionData.driveTeamStrategyByTeam || {},
      robotBreakTimelineOverrides: competitionData.robotBreakTimelineOverrides || {},
      pitMapImageUrl: competitionData.pitMapImageUrl || '',
      pitLocations: competitionData.pitLocations || {},
      manualPickLists: competitionData.manualPickLists || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (competitionData.status === 'active') {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(
          db.collection(COMPETITIONS_COLLECTION).where('status', '==', 'active'),
        );

        snapshot.docs.forEach((activeCompetitionDoc) => {
          transaction.update(activeCompetitionDoc.ref, { status: 'draft' });
        });

        transaction.set(docRef, competitionDocument);
      });
    } else {
      await docRef.set(competitionDocument);
    }
    
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
      formIds: data.formIds || [],
      activeFormIds: data.activeFormIds || (data.activeFormId ? [data.activeFormId] : []),
      scoutingTeams: data.scoutingTeams || [],
      scoutingAssignments: data.scoutingAssignments || [],
      eventKey: data.eventKey,
      superscouterNotes: data.superscouterNotes || {},
      driveTeamStrategyByTeam: data.driveTeamStrategyByTeam || {},
      robotBreakTimelineOverrides: data.robotBreakTimelineOverrides || {},
      pitMapImageUrl: data.pitMapImageUrl || '',
      pitLocations: data.pitLocations || {},
      manualPickLists: data.manualPickLists || [],
    };
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
      updateData.activeFormIds = competitionData.activeFormIds;
    } else if (competitionData.activeFormId !== undefined) {
      // backwards compatibility
      updateData.activeFormIds = competitionData.activeFormId ? [competitionData.activeFormId] : [];
    }
    if (competitionData.scoutingTeams !== undefined) updateData.scoutingTeams = competitionData.scoutingTeams;
    if (competitionData.scoutingAssignments !== undefined) updateData.scoutingAssignments = competitionData.scoutingAssignments;
    if (competitionData.eventKey !== undefined) updateData.eventKey = competitionData.eventKey;
    if (competitionData.superscouterNotes !== undefined) updateData.superscouterNotes = competitionData.superscouterNotes;
    if (competitionData.driveTeamStrategyByTeam !== undefined) updateData.driveTeamStrategyByTeam = competitionData.driveTeamStrategyByTeam;
    if (competitionData.robotBreakTimelineOverrides !== undefined) updateData.robotBreakTimelineOverrides = competitionData.robotBreakTimelineOverrides;
    if (competitionData.pitMapImageUrl !== undefined) updateData.pitMapImageUrl = competitionData.pitMapImageUrl;
    if (competitionData.pitLocations !== undefined) updateData.pitLocations = competitionData.pitLocations;
    if (competitionData.manualPickLists !== undefined) updateData.manualPickLists = competitionData.manualPickLists;
    
    if (competitionData.status === 'active') {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(
          db.collection(COMPETITIONS_COLLECTION).where('status', '==', 'active'),
        );

        snapshot.docs.forEach((activeCompetitionDoc) => {
          if (activeCompetitionDoc.id !== id) {
            transaction.update(activeCompetitionDoc.ref, { status: 'draft' });
          }
        });

        transaction.update(docRef, updateData);
      });
    } else {
      await docRef.update(updateData);
    }
    
    return competitionModel.getCompetitionById(id);
  },

  deleteCompetition: async (id) => {
    const docRef = db.collection(COMPETITIONS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return false;

    const deleteSnapshotDocuments = async (snapshot) => {
      const docs = snapshot.docs;

      for (let index = 0; index < docs.length; index += MAX_BATCH_SIZE) {
        const batch = db.batch();
        docs.slice(index, index + MAX_BATCH_SIZE).forEach((snapshotDoc) => {
          batch.delete(snapshotDoc.ref);
        });
        await batch.commit();
      }
    };

    const [formsSnapshot, submissionsSnapshot] = await Promise.all([
      db.collection(FORMS_COLLECTION).where('competitionId', '==', id).get(),
      db.collection(SUBMISSIONS_COLLECTION).where('competitionId', '==', id).get(),
    ]);

    await deleteSnapshotDocuments(submissionsSnapshot);
    await deleteSnapshotDocuments(formsSnapshot);
    await docRef.delete();
    return true;
  },
};
