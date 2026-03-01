// Run this from the backend folder like:
//   node --env-file=.env.local scripts/migrateActiveForms.js

import admin from "firebase-admin";
import { db } from "../src/config/firebase.js";

async function migrate() {
  try {
    console.log("Starting migration of competition documents...");
    const snapshot = await db.collection("competitions").get();
    let updated = 0;
    // use for..of so we can await each operation and correctly increment
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const legacyId = data.activeFormId;
      const ids = data.activeFormIds;

      if (Array.isArray(ids)) {
        if (legacyId && !ids.includes(legacyId)) {
          const newIds = [...ids, legacyId];
          await doc.ref.update({
            activeFormIds: newIds,
            activeFormId: admin.firestore.FieldValue.delete(),
          });
          console.log(`Merged legacy activeFormId into array for ${doc.id}`);
          updated++;
        }
        continue;
      }

      if (legacyId) {
        await doc.ref.update({
          activeFormIds: [legacyId],
          activeFormId: admin.firestore.FieldValue.delete(),
        });
        console.log(`Migrated ${doc.id}: set activeFormIds to [${legacyId}] and removed activeFormId`);
        updated++;
      }
    }
    console.log(`Migration complete. Documents modified: ${updated}`);
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

migrate();
