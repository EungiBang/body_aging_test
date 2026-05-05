import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0150517299",
  appId: "1:956526317530:web:bec8dceedfce29e52dfae3",
  apiKey: "AIzaSyCDJ-1MaCTlduQPqowwXRo7PBW0gBYasLs",
  authDomain: "gen-lang-client-0150517299.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-7438736e-bdac-4efd-8b91-800d4e373fe1");

async function resetLimits() {
  try {
    console.log("Fetching branches...");
    const branchesRef = collection(db, 'branches');
    const snapshot = await getDocs(branchesRef);
    
    if (snapshot.empty) {
      console.log("No branches found.");
      process.exit(0);
    }

    const promises = [];
    snapshot.forEach(branchDoc => {
      console.log(`Updating branch: ${branchDoc.id}`);
      const promise = setDoc(branchDoc.ref, {
        kfaceDailyLimit: 0,
        ktarotDailyLimit: 0
      }, { merge: true });
      promises.push(promise);
    });

    await Promise.all(promises);
    console.log("Successfully reset limits to 0 for all branches.");
    process.exit(0);
  } catch (error) {
    console.error("Error resetting limits:", error);
    process.exit(1);
  }
}

resetLimits();
