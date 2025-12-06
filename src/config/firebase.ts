import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  // FIX C2: Moved hardcoded URL to environment variable for security and flexibility
  // Fallback to default for backwards compatibility during migration
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://tng-systems.firebaseio.com"
};

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
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

