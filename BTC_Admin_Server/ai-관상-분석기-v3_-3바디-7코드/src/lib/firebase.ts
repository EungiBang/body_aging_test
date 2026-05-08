import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PhysiognomyReport } from '../services/geminiService';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function updateUserProfile(data: { displayName: string; phoneNumber?: string; birthDate: string; gender: string }) {
  const user = await ensureAuth();
  const userRef = doc(db, 'users', user.uid);
  
  // Check if user document already exists
  const userSnap = await getDoc(userRef);
  
  const profileData: any = {
    ...data,
    uid: user.uid,
    updatedAt: serverTimestamp()
  };

  if (!userSnap.exists()) {
    profileData.createdAt = serverTimestamp();
    await setDoc(userRef, profileData);
  } else {
    await setDoc(userRef, profileData, { merge: true });
  }
}

export async function getUserProfile() {
  if (!auth.currentUser) return null;
  const userRef = doc(db, 'users', auth.currentUser.uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

export async function saveReport(report: PhysiognomyReport, imageThumbnail: string, customer: { displayName: string; birthDate: string; gender: string; phoneNumber?: string }) {
  const user = await ensureAuth();
  const userId = user.uid;
  const reportRef = doc(collection(db, `users/${userId}/reports`));
  const data = {
    ...report,
    userId,
    customer, // Store customer info with the report
    imageThumbnail: imageThumbnail || null,
    createdAt: serverTimestamp()
  };
  
  await setDoc(reportRef, data);
  return reportRef.id;
}

export async function getUserReports() {
  if (!auth.currentUser) throw new Error("로그인이 필요합니다.");
  
  const userId = auth.currentUser.uid;
  const reportsRef = collection(db, `users/${userId}/reports`);
  const q = query(reportsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
