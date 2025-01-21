// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Replace with your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCVxGCud3eYd2ao0kbrS9AWCmJRPbrcTdA",
    authDomain: "click-clock-fb774.firebaseapp.com",
    projectId: "click-clock-fb774",
    storageBucket: "click-clock-fb774.firebasestorage.app",
    messagingSenderId: "813098656520",
    appId: "1:813098656520:web:384b976689a3d3f3f182bd",
    measurementId: "G-WNBX1TYQEH"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
