/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SimagRole = 'Administrator' | 'Kepala Gudang' | 'Petugas Gudang' | 'Operator';

export interface SimagUser {
  id: string;
  nip: string;
  nama: string;
  role: SimagRole;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface SimagSession {
  userId: string;
  nip: string;
  nama: string;
  role: SimagRole;
  loginAt: string;
  lastActivityAt: number;
}
