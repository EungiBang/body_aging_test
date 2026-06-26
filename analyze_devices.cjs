const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function analyze() {
  const branchesSnap = await getDocs(collection(db, 'branches'));
  const branches = {};
  branchesSnap.forEach(doc => {
    branches[doc.id] = doc.data();
  });

  const devicesSnap = await getDocs(collection(db, 'devices'));
  const devices = [];
  devicesSnap.forEach(doc => {
    devices.push({ id: doc.id, ...doc.data() });
  });

  const regionsSnap = await getDocs(collection(db, 'regions'));
  const regions = {};
  regionsSnap.forEach(doc => {
    regions[doc.id] = doc.data();
  });

  const liteDevicesSnap = await getDocs(collection(db, 'lite_devices'));
  const liteDevices = [];
  liteDevicesSnap.forEach(doc => {
    liteDevices.push({ id: doc.id, ...doc.data() });
  });

  const errorLogsSnap = await getDocs(collection(db, 'error_logs'));
  const errorLogs = [];
  errorLogsSnap.forEach(doc => {
    errorLogs.push({ id: doc.id, ...doc.data() });
  });

  const fs = require('fs');
  fs.writeFileSync('firebase_dump.json', JSON.stringify({regions, branches, devices, liteDevices, errorLogs}, null, 2));
  console.log('Done mapping devices. Saved to firebase_dump.json');
  process.exit(0);
}
analyze();
