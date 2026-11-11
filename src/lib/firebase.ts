"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { initAppCheck } from "./appCheck";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let functionsInstance: Functions | null = null;

export function getFirebaseApp(): FirebaseApp {
  return getApp();
}

function getApp(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Copy .env.local.example to .env.local and fill in the values from your Firebase project.",
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
    // Attach App Check before any Firestore/Storage/Functions/Auth call so their
    // requests carry an attestation token. Browser-only + no-ops until a site
    // key is configured (see appCheck.ts).
    initAppCheck(app);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) authInstance = getAuth(getApp());
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getApp());
  return dbInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) storageInstance = getStorage(getApp());
  return storageInstance;
}

/** Callable Cloud Functions client — pinned to the africa-south1 region where
 *  our functions are deployed (see functions/src/globalConfig.ts). */
export function getFunctionsInstance(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(getApp(), "africa-south1");
  }
  return functionsInstance;
}
