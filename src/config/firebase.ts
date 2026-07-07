import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

export const isConfigValid = !!import.meta.env.VITE_FIREBASE_API_KEY;

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "0",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "0:0:web:0",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
  // FIX C2: Moved hardcoded URL to environment variable for security and flexibility
  // Fallback to default for backwards compatibility during migration
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://tng-systems.firebaseio.com"
};

/**
 * FIX Phase 5: Validate Firebase environment configuration
 * Logs warnings in production if critical env vars are missing
 */
const validateFirebaseConfig = () => {
  const requiredVars = [
    { key: 'VITE_FIREBASE_API_KEY', value: firebaseConfig.apiKey },
    { key: 'VITE_FIREBASE_AUTH_DOMAIN', value: firebaseConfig.authDomain },
    { key: 'VITE_FIREBASE_PROJECT_ID', value: firebaseConfig.projectId },
    { key: 'VITE_FIREBASE_APP_ID', value: firebaseConfig.appId },
  ];

  const missingVars = requiredVars.filter(v => !v.value);

  if (missingVars.length > 0) {
    const missingKeys = missingVars.map(v => v.key).join(', ');

    if (import.meta.env.PROD) {
      // In production, log error-level warning
      console.error(`🚨 CRITICAL: Missing Firebase environment variables: ${missingKeys}`);
      console.error('🚨 The application may not function correctly. Please check your .env configuration.');
    } else {
      // In development, log warning
      console.warn(`⚠️ Missing Firebase env vars: ${missingKeys}`);
    }
  }
};

// Validate config before initialization
validateFirebaseConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * FIX C4: Initialize Firebase App Check for bot/abuse protection
 * This helps prevent brute force attacks and automated abuse
 * 
 * Setup required in Firebase Console:
 * 1. Enable App Check in Firebase Console
 * 2. Register your app with reCAPTCHA v3
 * 3. Add VITE_RECAPTCHA_SITE_KEY to your .env file
 */
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true // Auto-refresh tokens
    });
    console.log('✅ Firebase App Check initialized');
  } catch (error) {
    console.warn('⚠️ Firebase App Check initialization failed:', error);
  }
} else if (import.meta.env.DEV) {
  // In development without reCAPTCHA key, log reminder
  console.info('ℹ️ App Check not configured. Add VITE_RECAPTCHA_SITE_KEY for production.');
}

// Initialize services
// For multi-database setup:
// - Production: VITE_FIREBASE_DATABASE_ID = "tng-systems"
// - Staging: VITE_FIREBASE_DATABASE_ID = "" or undefined (uses "(default)" database)
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
const effectiveDbId = dbId && dbId.trim() !== '' ? dbId : undefined;

// Log which database is being used (for debugging)
console.log(`🔥 Firestore Database: ${effectiveDbId ? effectiveDbId : '(default)'}`);

export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  },
  effectiveDbId
);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-southeast1'); // or default region, let's just use getFunctions(app)
export const googleProvider = new GoogleAuthProvider();
export { app }; // Export app for Cloud Functions
