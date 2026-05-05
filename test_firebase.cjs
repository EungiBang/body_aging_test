
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007",
  measurementId: "G-MXNRB45TC4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFetch() {
  console.log('Testing Regions...');
  try { await getDocs(collection(db, 'regions')); console.log('Regions OK'); } catch(e) { console.error('Regions error:', e); }

  console.log('Testing Branches...');
  try { await getDocs(collection(db, 'branches')); console.log('Branches OK'); } catch(e) { console.error('Branches error:', e); }

  console.log('Testing Devices...');
  try { await getDocs(collection(db, 'devices')); console.log('Devices OK'); } catch(e) { console.error('Devices error:', e); }

  console.log('Testing System Settings...');
  try { await getDoc(doc(db, 'system_settings', 'config')); console.log('Settings OK'); } catch(e) { console.error('Settings error:', e); }

  console.log('Testing Admin Users...');
  try { await getDocs(collection(db, 'admin_users')); console.log('Admins OK'); } catch(e) { console.error('Admins error:', e); }

  console.log('Testing Dashboard Stats...');
  try { 
    const q = query(collection(db, 'stats'), orderBy('date', 'desc'), limit(14));
    await getDocs(q); 
    console.log('Stats OK'); 
  } catch(e) { 
    console.error('Stats error:', e.message); 
  }
  
  process.exit(0);
}

testFetch();
