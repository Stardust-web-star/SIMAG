/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth } from './firebaseClient';

export { auth };

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export class CloudAutoAuthDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudAutoAuthDisabledError';
  }
}

// Clean Firebase Auth provider without Google Workspace Drive/Sheets scopes
// so manual Google Sign-In fallback never gets blocked by Sheets OAuth consent screens.
const cloudProvider = new GoogleAuthProvider();
cloudProvider.setCustomParameters({ prompt: 'select_account' });

// Full provider with Google Sheets & Drive scopes when syncing spreadsheets
const sheetsProvider = new GoogleAuthProvider();
SCOPES.forEach(scope => sheetsProvider.addScope(scope));
sheetsProvider.setCustomParameters({ prompt: 'consent' });

// In-memory token caching for Google Sheets API (MANDATORY: Never store in localStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;
let autoSessionPromise: Promise<User> | null = null;

function formatGoogleAuthError(error: any): Error {
  const code = error?.code || '';
  if (code === 'auth/unauthorized-domain') {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'domain ini';
    return new Error(
      `Domain "${currentHost}" belum terdaftar di Firebase Authorized Domains. Tambahkan "${currentHost}" di Firebase Console → Authentication → Settings → Authorized domains.`
    );
  }
  if (code === 'auth/popup-blocked') {
    return new Error(
      'Popup login Google diblokir oleh browser. Silakan izinkan pop-up untuk situs ini lalu coba lagi.'
    );
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return new Error('Login Google dibatalkan sebelum selesai.');
  }
  return error instanceof Error ? error : new Error('Gagal masuk dengan akun Google.');
}

export const initAuth = (
  onAuthSuccess?: (user: User, hasSheetsToken: boolean) => void,
  onAuthSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, Boolean(cachedAccessToken));
      }
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthSignedOut) onAuthSignedOut();
    }
  });
};

/**
 * Ensures an automatic background Firebase Cloud session exists with ZERO user clicks.
 * Preserves any existing persisted Google session (e.g. fikiilham56@gmail.com on Vercel)
 * and silently establishes an anonymous cloud session if none is active yet.
 */
export const ensureAutoCloudSession = async (): Promise<User> => {
  if (autoSessionPromise) {
    return autoSessionPromise;
  }

  autoSessionPromise = (async () => {
    await auth.authStateReady();
    if (auth.currentUser) {
      return auth.currentUser;
    }

    try {
      isSigningIn = true;
      const result = await signInAnonymously(auth);
      return result.user;
    } catch (error: any) {
      const code = error?.code || '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        throw new CloudAutoAuthDisabledError(
          'Login Anonymous belum diaktifkan di Firebase Console. Aktifkan 1 kali provider "Anonymous" di Firebase Authentication agar sinkronisasi otomatis Google AI Studio ⇄ Vercel berjalan tanpa klik tombol apapun.'
        );
      }
      throw formatGoogleAuthError(error);
    } finally {
      isSigningIn = false;
      autoSessionPromise = null;
    }
  })();

  return autoSessionPromise;
};

/**
 * 1-click Google Sign-In fallback for Firebase Cloud Two-Way Sync.
 */
export const googleCloudSignIn = async (): Promise<{ user: User; hasSheetsToken: boolean }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, cloudProvider);
    return { user: result.user, hasSheetsToken: Boolean(cachedAccessToken) };
  } catch (error: any) {
    console.error('Google Cloud Sign In error:', error);
    throw formatGoogleAuthError(error);
  } finally {
    isSigningIn = false;
  }
};

/**
 * Google Sign-In with Google Sheets & Drive OAuth scopes for spreadsheet auto-sync.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, sheetsProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sheets Sign In error:', error);
    throw formatGoogleAuthError(error);
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const hasCachedSheetsToken = (): boolean => {
  return Boolean(cachedAccessToken);
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
};

/**
 * Disconnects Google account / Sheets token and immediately restores silent auto-cloud sync if enabled.
 */
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    await ensureAutoCloudSession();
  } catch {
    // Fallback gracefully if Anonymous provider is not yet enabled
  }
};
