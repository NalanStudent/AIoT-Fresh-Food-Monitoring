// src/app/services/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSHd7o7eZ3IN5AK9riT0q0ElU3UJLruJA",
  authDomain: "aiot-fresh-monitor.firebaseapp.com",
  projectId: "aiot-fresh-monitor",
  storageBucket: "aiot-fresh-monitor.firebasestorage.app",
  messagingSenderId: "308959309387",
  appId: "1:308959309387:web:32643eedfd35792e1b67ce"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
