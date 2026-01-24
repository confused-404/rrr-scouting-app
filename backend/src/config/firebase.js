import admin from 'firebase-admin';

// Always load service account from environment variable
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (error) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from environment:', error);
  throw new Error('Invalid Firebase service account key in environment variables');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

export const db = admin.firestore();
export const auth = admin.auth();
