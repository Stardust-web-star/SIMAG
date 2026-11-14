/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SimagRole, SimagSession, SimagUser } from '../types/auth';

const USERS_STORAGE_KEY = 'pln_simag_users_v1';
const SEEDED_FLAG_KEY = 'pln_simag_users_seeded_v1';
const SESSION_STORAGE_KEY = 'pln_simag_session_v1';

export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 menit

/**
 * Pure-JS SHA-256 hex digest so password hashing works reliably in any browser context
 * without ever persisting plaintext passwords.
 */
function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(`SIMAG_PLN_SALT::${message}`);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = bytes.length * 8;
  const withOneLen = bytes.length + 1;
  const padZeroLen = (64 - ((withOneLen + 8) % 64)) % 64;
  const totalLen = withOneLen + padZeroLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const W = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
      const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map(w => w.toString(16).padStart(8, '0'))
    .join('');
}

function buildDefaultUsers(): SimagUser[] {
  const now = new Date().toISOString();
  const defaultHash = sha256Hex('admin123');
  return [
    {
      id: 'usr-9925045ZY',
      nip: '9925045ZY',
      nama: 'Administrator Gudang',
      role: 'Administrator',
      passwordHash: defaultHash,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr-962200ABN',
      nip: '962200ABN',
      nama: 'Kepala Gudang PLN',
      role: 'Kepala Gudang',
      passwordHash: defaultHash,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function saveUsers(users: SimagUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function overwriteLocalSimagUsers(users: SimagUser[]): void {
  if (Array.isArray(users) && users.length > 0) {
    saveUsers(users);
    localStorage.setItem(SEEDED_FLAG_KEY, 'true');
  }
}

export function ensureSeededUsers(): SimagUser[] {
  const alreadySeeded = localStorage.getItem(SEEDED_FLAG_KEY) === 'true';
  const raw = localStorage.getItem(USERS_STORAGE_KEY);

  if (raw) {
    try {
      const parsed: SimagUser[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!alreadySeeded) {
          localStorage.setItem(SEEDED_FLAG_KEY, 'true');
        }
        return parsed;
      }
    } catch {
      // Fallback to re-seed if corrupted
    }
  }

  const defaults = buildDefaultUsers();
  saveUsers(defaults);
  localStorage.setItem(SEEDED_FLAG_KEY, 'true');
  return defaults;
}

export function getSimagUsers(): SimagUser[] {
  return ensureSeededUsers();
}

export function authenticateSimagUser(
  nipInput: string,
  passwordInput: string
): { ok: true; session: SimagSession; users: SimagUser[] } | { ok: false; error: string } {
  const normalizedNip = nipInput.trim().toUpperCase();
  if (!normalizedNip) {
    return { ok: false, error: 'Silakan masukkan NIP / User ID Anda.' };
  }
  if (!passwordInput) {
    return { ok: false, error: 'Silakan masukkan Password Anda.' };
  }

  const users = ensureSeededUsers();
  const matched = users.find(u => u.nip.trim().toUpperCase() === normalizedNip);
  if (!matched) {
    return { ok: false, error: 'NIP / User ID tidak terdaftar di sistem SIMAG.' };
  }

  const inputHash = sha256Hex(passwordInput);
  if (matched.passwordHash !== inputHash) {
    return { ok: false, error: 'Password yang Anda masukkan tidak sesuai.' };
  }

  const nowIso = new Date().toISOString();
  const updatedUsers = users.map(u =>
    u.id === matched.id ? { ...u, lastLoginAt: nowIso } : u
  );
  saveUsers(updatedUsers);

  const session: SimagSession = {
    userId: matched.id,
    nip: matched.nip,
    nama: matched.nama,
    role: matched.role,
    loginAt: nowIso,
    lastActivityAt: Date.now(),
  };
  localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

  return { ok: true, session, users: updatedUsers };
}

export function getActiveSimagSession(): {
  session: SimagSession | null;
  expiredByInactivity: boolean;
} {
  // Ensure any legacy localStorage session is cleared so closing a tab always logs out
  localStorage.removeItem(SESSION_STORAGE_KEY);

  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return { session: null, expiredByInactivity: false };
  }

  try {
    const parsed: SimagSession = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.nip || typeof parsed.lastActivityAt !== 'number') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return { session: null, expiredByInactivity: false };
    }

    // Verify user still exists in directory
    const users = ensureSeededUsers();
    const stillExists = users.find(u => u.id === parsed.userId);
    if (!stillExists) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return { session: null, expiredByInactivity: false };
    }

    if (Date.now() - parsed.lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return { session: null, expiredByInactivity: true };
    }

    const syncedSession: SimagSession = {
      ...parsed,
      nip: stillExists.nip,
      nama: stillExists.nama,
      role: stillExists.role,
    };
    return { session: syncedSession, expiredByInactivity: false };
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return { session: null, expiredByInactivity: false };
  }
}

export function touchSimagSessionActivity(timestamp = Date.now()): void {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed: SimagSession = JSON.parse(raw);
    parsed.lastActivityAt = timestamp;
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore malformed session
  }
}

export function logoutSimagSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function createSimagUser(
  actor: SimagSession,
  input: { nip: string; nama: string; role: SimagRole; password: string }
): { ok: true; users: SimagUser[]; created: SimagUser } | { ok: false; error: string } {
  const nip = input.nip.trim().toUpperCase();
  const nama = input.nama.trim();
  const password = input.password;

  if (!nip) {
    return { ok: false, error: 'NIP / User ID wajib diisi.' };
  }
  if (!/^[A-Z0-9._-]{4,24}$/.test(nip)) {
    return { ok: false, error: 'NIP / User ID harus 4–24 karakter (huruf, angka, titik, atau strip).' };
  }
  if (!nama) {
    return { ok: false, error: 'Nama lengkap user wajib diisi.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password minimal harus 6 karakter.' };
  }
  if (actor.role !== 'Administrator' && input.role === 'Administrator') {
    return { ok: false, error: 'Hanya Administrator yang dapat menambahkan akun Administrator.' };
  }
  if (actor.role !== 'Administrator' && actor.role !== 'Kepala Gudang') {
    return { ok: false, error: 'Role Anda tidak memiliki izin untuk menambahkan user.' };
  }

  const users = ensureSeededUsers();
  if (users.some(u => u.nip.trim().toUpperCase() === nip)) {
    return { ok: false, error: `NIP "${nip}" sudah terdaftar pada sistem.` };
  }

  const now = new Date().toISOString();
  const created: SimagUser = {
    id: `usr-${nip}-${Date.now().toString(36)}`,
    nip,
    nama,
    role: input.role,
    passwordHash: sha256Hex(password),
    createdAt: now,
    updatedAt: now,
  };

  const nextUsers = [...users, created];
  saveUsers(nextUsers);
  return { ok: true, users: nextUsers, created };
}

export function changeSimagUserPassword(
  actor: SimagSession,
  targetUserId: string,
  newPassword: string
): { ok: true; users: SimagUser[] } | { ok: false; error: string } {
  if (newPassword.length < 6) {
    return { ok: false, error: 'Password baru minimal harus 6 karakter.' };
  }

  const users = ensureSeededUsers();
  const target = users.find(u => u.id === targetUserId);
  if (!target) {
    return { ok: false, error: 'User tidak ditemukan.' };
  }

  const isSelf = actor.userId === target.id;
  if (!isSelf) {
    if (actor.role !== 'Administrator' && actor.role !== 'Kepala Gudang') {
      return { ok: false, error: 'Anda tidak memiliki izin mengubah password user lain.' };
    }
    if (actor.role !== 'Administrator' && target.role === 'Administrator') {
      return { ok: false, error: 'Hanya Administrator yang dapat mengganti password akun Administrator.' };
    }
  }

  const now = new Date().toISOString();
  const newHash = sha256Hex(newPassword);
  const nextUsers = users.map(u =>
    u.id === targetUserId ? { ...u, passwordHash: newHash, updatedAt: now } : u
  );
  saveUsers(nextUsers);
  return { ok: true, users: nextUsers };
}

export function deleteSimagUser(
  actor: SimagSession,
  targetUserId: string
): { ok: true; users: SimagUser[] } | { ok: false; error: string } {
  if (actor.userId === targetUserId) {
    return { ok: false, error: 'Anda tidak dapat menghapus akun yang sedang aktif digunakan.' };
  }

  const users = ensureSeededUsers();
  const target = users.find(u => u.id === targetUserId);
  if (!target) {
    return { ok: false, error: 'User tidak ditemukan.' };
  }

  if (actor.role !== 'Administrator' && actor.role !== 'Kepala Gudang') {
    return { ok: false, error: 'Anda tidak memiliki izin untuk menghapus user.' };
  }
  if (actor.role !== 'Administrator' && target.role === 'Administrator') {
    return { ok: false, error: 'Hanya Administrator yang dapat menghapus akun Administrator.' };
  }

  if (target.role === 'Administrator') {
    const adminCount = users.filter(u => u.role === 'Administrator').length;
    if (adminCount <= 1) {
      return { ok: false, error: 'Minimal harus terdapat satu akun Administrator aktif.' };
    }
  }

  const nextUsers = users.filter(u => u.id !== targetUserId);
  saveUsers(nextUsers);
  return { ok: true, users: nextUsers };
}
