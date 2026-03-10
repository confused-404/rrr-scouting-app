import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const projectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID;
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket:
    (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : undefined),
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);