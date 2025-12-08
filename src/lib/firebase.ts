import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function initDb() {
  if (!getApps().length) initializeApp(firebaseConfig as any)
  return getFirestore()
}

// Scouting entries (collection)
export async function addScoutingEntry(entry: any) {
  const db = initDb()
  await addDoc(collection(db, 'scoutingData'), { ...entry })
}

export async function getAllScoutingEntries(): Promise<any[]> {
  const db = initDb()
  const snaps = await getDocs(collection(db, 'scoutingData'))
  return snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

export function subscribeScoutingEntries(cb: (rows: any[]) => void) {
  const db = initDb()
  const unsub = onSnapshot(collection(db, 'scoutingData'), (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
  })
  return unsub
}

// Generic small document store under collection 'appData'
export async function setAppDoc(id: string, value: any) {
  const db = initDb()
  await setDoc(doc(db, 'appData', id), { value, updatedAt: serverTimestamp() })
}

export async function getAppDoc(id: string): Promise<any | null> {
  const db = initDb()
  const snap = await getDoc(doc(db, 'appData', id))
  if (!snap.exists()) return null
  return (snap.data() as any).value ?? null
}

export function subscribeAppDoc(id: string, cb: (val: any) => void) {
  const db = initDb()
  const unsub = onSnapshot(doc(db, 'appData', id), (snap) => {
    cb(snap.exists() ? (snap.data() as any).value : null)
  })
  return unsub
}

export async function addMultipleScoutingEntries(entries: any[]) {
  // simple helper to add many entries (concurrent)
  await Promise.all(entries.map(e => addScoutingEntry(e)))
}

export default {
  addScoutingEntry,
  getAllScoutingEntries,
  subscribeScoutingEntries,
  setAppDoc,
  getAppDoc,
  subscribeAppDoc,
  addMultipleScoutingEntries,
}
