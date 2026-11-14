/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  signInWithPopup,
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

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));

// In-memory token caching for Google Sheets API (MANDATORY: Never store in localStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

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

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google Auth.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    if (error?.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'domain ini';
      throw new Error(
        `Domain "${currentHost}" belum terdaftar di Firebase Authorized Domains. Tambahkan "${currentHost}" di Firebase Console → Authentication → Settings → Authorized domains agar sinkronisasi dua arah aktif di domain ini.`
      );
    }
    throw error;
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

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
