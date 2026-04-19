// Run this from the backend folder like:
//   npm run migrate:normalized-team-numbers
// Add -- --write to apply the updates:
//   npm run migrate:normalized-team-numbers -- --write

import '../src/loadEnv.js';
import { db } from '../src/config/firebase.js';
import { resolveSubmissionNormalizedTeamNumber } from '../src/utils/submissionValidation.js';

const MAX_BATCH_SIZE = 450;
const FORMS_COLLECTION = 'forms';
const SUBMISSIONS_COLLECTION = 'submissions';

const shouldWrite = process.argv.includes('--write');

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

async function migrate() {
  console.log(`Starting normalizedTeamNumber backfill in ${shouldWrite ? 'write' : 'dry-run'} mode...`);

  const [formsSnapshot, submissionsSnapshot] = await Promise.all([
    db.collection(FORMS_COLLECTION).get(),
    db.collection(SUBMISSIONS_COLLECTION).get(),
  ]);

  const formsById = new Map(formsSnapshot.docs.map((doc) => [doc.id, {
    id: doc.id,
    ...doc.data(),
  }]));

  let scanned = 0;
  let missingForms = 0;
  let missingTeamField = 0;
  let unchanged = 0;
  let updated = 0;

  const updates = [];

  for (const submissionDoc of submissionsSnapshot.docs) {
    scanned += 1;

    const submission = submissionDoc.data();
    const form = formsById.get(submission.formId);

    if (!form) {
      missingForms += 1;
      continue;
    }

    const nextNormalizedTeamNumber = resolveSubmissionNormalizedTeamNumber(form, submission.data);

    if (nextNormalizedTeamNumber === null) {
      if (submission.normalizedTeamNumber === undefined || submission.normalizedTeamNumber === null) {
        missingTeamField += 1;
      }
      continue;
    }

    if (submission.normalizedTeamNumber === nextNormalizedTeamNumber) {
      unchanged += 1;
      continue;
    }

    updates.push({
      ref: submissionDoc.ref,
      normalizedTeamNumber: nextNormalizedTeamNumber,
      formId: submission.formId,
    });
  }

  if (shouldWrite && updates.length > 0) {
    for (const batchUpdates of chunk(updates, MAX_BATCH_SIZE)) {
      const batch = db.batch();
      batchUpdates.forEach(({ ref, normalizedTeamNumber }) => {
        batch.update(ref, { normalizedTeamNumber });
      });
      await batch.commit();
    }
    updated = updates.length;
  }

  console.log(`Scanned submissions: ${scanned}`);
  console.log(`Forms missing for submissions: ${missingForms}`);
  console.log(`Submissions without a resolvable team number: ${missingTeamField}`);
  console.log(`Already normalized: ${unchanged}`);
  console.log(`${shouldWrite ? 'Updated' : 'Would update'} submissions: ${updates.length}`);

  if (!shouldWrite && updates.length > 0) {
    console.log('Sample updates:');
    updates.slice(0, 10).forEach(({ ref, normalizedTeamNumber, formId }) => {
      console.log(`- ${ref.id}: form=${formId}, normalizedTeamNumber=${normalizedTeamNumber}`);
    });
    console.log('Run again with --write to apply these updates.');
  }

  if (shouldWrite) {
    console.log(`Backfill complete. Updated submissions: ${updated}`);
  }
}

migrate().catch((error) => {
  console.error('normalizedTeamNumber backfill failed:', error);
  process.exitCode = 1;
});
