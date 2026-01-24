import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account key from environment or local file
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  // Production: Load from environment variable (Vercel)
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from environment:', error);
    throw new Error('Invalid Firebase service account key in environment variables');
  }
} else {
  // Development: Load from local file
  try {
    serviceAccount = JSON.parse(
      readFileSync(join(__dirname, '../../serviceAccountKey.json'), 'utf8')
    );
  } catch (error) {
    console.error('Failed to load serviceAccountKey.json:', error);
    console.error('Please ensure serviceAccountKey.json exists or set FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
    throw error;
  }
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

export const db = admin.firestore();
export const auth = admin.auth();