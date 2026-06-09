import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

// Liest die Konfig aus den NEXT_PUBLIC_FIREBASE_* Variablen.
// Sind sie nicht gesetzt, bleibt Firebase aus und die App nutzt localStorage.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const cloudEnabled = Boolean(config.apiKey && config.projectId);

let db: Firestore | null = null;

if (cloudEnabled) {
  try {
    const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(config);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase init fehlgeschlagen, nutze localStorage:", e);
    db = null;
  }
}

export { db };
