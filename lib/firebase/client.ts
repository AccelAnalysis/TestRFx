import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

let emulatorConnected = false;

function firebaseClientConfig(): FirebaseOptions {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) {
    throw new Error(`Firebase web configuration is missing: ${missing.join(", ")}.`);
  }

  return config as FirebaseOptions;
}

export function getFirebaseClientAuth(): Auth {
  const app = getApps().length ? getApp() : initializeApp(firebaseClientConfig());
  const auth = getAuth(app);
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

  if (emulatorHost && typeof window !== "undefined" && !emulatorConnected) {
    connectAuthEmulator(auth, emulatorHost.startsWith("http") ? emulatorHost : `http://${emulatorHost}`, {
      disableWarnings: true,
    });
    emulatorConnected = true;
  }

  return auth;
}
