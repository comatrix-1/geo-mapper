import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ------------------------------------------------------------------
// CRITICAL: You must replace this config with your own from Firebase Console!
// 1. Go to console.firebase.google.com
// 2. Create a project
// 3. Register a Web App
// 4. Copy the config below
// 5. Enable Authentication (Google Provider)
// 6. Enable Firestore Database
// ------------------------------------------------------------------
// Debug: Log environment variables
console.log('Firebase Config:', {
  apiKey: !!import.meta.env.VITE_FIREBASE_API_KEY ? '***' : 'MISSING',
  authDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '***' : 'MISSING',
  projectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID ? '***' : 'MISSING',
  storageBucket: !!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? '***' : 'MISSING',
  messagingSenderId: !!import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? '***' : 'MISSING',
  appId: !!import.meta.env.VITE_FIREBASE_APP_ID ? '***' : 'MISSING',
  measurementId: !!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ? '***' : 'MISSING'
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Services
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

// Development mode settings
if (import.meta.env.DEV) {
  // Configure auth emulator if needed
  // connectAuthEmulator(auth, 'http://localhost:9099');
  
  // Configure firestore emulator if needed
  // connectFirestoreEmulator(db, 'localhost', 8080);
}

export { auth, googleProvider, db };

// Log Firebase initialization
console.log('Firebase initialized with app:', app.name);