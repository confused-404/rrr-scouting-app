import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { createLogger } from '../utils/logger';

const firebaseLogger = createLogger('firebase');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseKeys.length > 0) {
  firebaseLogger.warn('Firebase config is missing environment values', {
    missingKeys: missingFirebaseKeys,
  });
} else {
  firebaseLogger.info('Firebase config loaded', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
  });
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);