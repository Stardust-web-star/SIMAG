/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  InboundCarton,
  MeterUnit,
  OutboundRecord,
  WarehouseRack,
} from '../types/warehouse';
import { SimagUser } from '../types/auth';
import { INITIAL_RACKS } from '../data/initialData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const RACKS_COL = 'simag_racks';
const CARTONS_COL = 'simag_cartons';
const METERS_COL = 'simag_meters';
const OUTBOUNDS_COL = 'simag_outbounds';
const USERS_COL = 'simag_users';
const META_COL = 'simag_meta';
const META_DOC_ID = 'warehouse';

export interface WarehouseCloudMeta {
  schemaVersion: number;
  hasRealData: boolean;
  updatedAt: string;
  lastSource?: string;
}

export type CloudSyncConnectionStatus = 'connecting' | 'synced' | 'syncing' | 'error';

export interface CloudSyncStatus {
  status: CloudSyncConnectionStatus;
  message?: string;
  lastSyncedAt?: string;
}

export function toSafeDocId(raw: string): string {
  const sanitized = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
  const trimmed = sanitized.slice(0, 120);
  return trimmed || `doc_${Date.now().toString(36)}`;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as T;
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : val == null ? '' : String(val).trim();
  const nonEmpty = str.length > 0 ? str : fallback;
  return nonEmpty.slice(0, maxLen);
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizePhase(val: unknown): '1 Phasa' | '3 Phasa' {
  const str = String(val || '').toLowerCase();
  if (str.includes('3')) return '3 Phasa';
  return '1 Phasa';
}

function normalizeRack(r: WarehouseRack): WarehouseRack {
  const rawShelves = Array.isArray(r.shelves) && r.shelves.length > 0
    ? r.shelves
    : [1, 2, 3, 4].map(level => ({ level, label: '', cartonCapacity: 16, cartonIds: [] }));
  return {
    id: toSafeDocId(r.id).slice(0, 64),
    name: clampString(r.name, 160, toSafeDocId(r.id)),
    zone: clampString(r.zone, 120, 'Zona Gudang'),
    primaryBrand: clampString(r.primaryBrand, 80, 'Umum'),
    ...(typeof r.brandColor === 'string' && r.brandColor.trim()
      ? { brandColor: clampString(r.brandColor, 32) }
      : {}),
    shelves: [...rawShelves]
      .slice(0, 8)
      .sort((a, b) => Number(a.level) - Number(b.level))
      .map(s => {
        const levelNum = clampNumber(s.level, 1, 8, 1);
        return {
          level: levelNum,
          label:
            levelNum === 1
              ? 'Tingkat 1 (Atas)'
              : levelNum === 4
              ? 'Tingkat 4 (Bawah)'
              : `Tingkat ${levelNum}`,
          cartonCapacity: 16,
          cartonIds: Array.isArray(s.cartonIds) ? s.cartonIds.map(toSafeDocId) : [],
        };
      }),
  };
}

function sanitizeRackForCloud(rack: WarehouseRack, updatedAt: string) {
  const normalized = normalizeRack(rack);
  return stripUndefined({
    id: normalized.id,
    name: normalized.name,
    zone: normalized.zone,
    primaryBrand: normalized.primaryBrand,
    brandColor: normalized.brandColor,
    shelves: normalized.shelves,
    updatedAt: clampString(updatedAt, 64, new Date().toISOString()),
  });
}

function sanitizeCartonForCloud(carton: InboundCarton, updatedAt: string) {
  const safeId = toSafeDocId(carton.id);
  const serials = Array.isArray(carton.meterSerials)
    ? carton.meterSerials
        .map(sn => clampString(sn, 128))
        .filter(Boolean)
        .slice(0, 100)
    : [];
  const computedUnits = clampNumber(carton.unitsCount, 0, 100, serials.length);
  return stripUndefined({
    id: safeId,
    cartonBarcode: clampString(carton.cartonBarcode, 128, safeId),
    brand: clampString(carton.brand, 80, 'Umum'),
    phase: normalizePhase(carton.phase),
    category: clampString(carton.category, 80, 'kWh Meter Prabayar'),
    unitsCount: computedUnits,
    meterSerials: serials,
    rackId: toSafeDocId(carton.rackId || 'RAK-A').slice(0, 64),
    shelfLevel: clampNumber(carton.shelfLevel, 1, 10, 1),
    dateInbound: clampString(carton.dateInbound, 64, new Date().toISOString().slice(0, 16)),
    receivedBy: clampString(carton.receivedBy, 120, 'Petugas Gudang'),
    notes: typeof carton.notes === 'string' ? clampString(carton.notes, 500) : undefined,
    updatedAt: clampString(updatedAt, 64, new Date().toISOString()),
  });
}

function sanitizeMeterForCloud(meter: MeterUnit, updatedAt: string) {
  const statusRaw = String(meter.status || '').toUpperCase();
  const status: MeterUnit['status'] =
    statusRaw === 'DISPATCHED'
      ? 'DISPATCHED'
      : statusRaw === 'QUARANTINE'
      ? 'QUARANTINE'
      : 'AVAILABLE';
  return stripUndefined({
    serialNumber: clampString(meter.serialNumber, 128, `SN-${Date.now()}`),
    brand: clampString(meter.brand, 80, 'Umum'),
    phase: normalizePhase(meter.phase),
    category: clampString(meter.category, 80, 'kWh Meter Prabayar'),
    cartonBarcode: clampString(meter.cartonBarcode, 128, 'BOX-UMUM'),
    rackId: toSafeDocId(meter.rackId || 'RAK-A').slice(0, 64),
    shelfLevel: clampNumber(meter.shelfLevel, 1, 10, 1),
    dateInbound: clampString(meter.dateInbound, 64, new Date().toISOString().slice(0, 16)),
    status,
    dispatchId: typeof meter.dispatchId === 'string' && meter.dispatchId.trim()
      ? clampString(meter.dispatchId, 128)
      : undefined,
    updatedAt: clampString(updatedAt, 64, new Date().toISOString()),
  });
}

function sanitizeOutboundForCloud(record: OutboundRecord, updatedAt: string) {
  const safeId = toSafeDocId(record.id);
  const jenisTransaksi = record.jenisTransaksi === 'GM' ? 'GM' : 'PB';
  return stripUndefined({
    id: safeId,
    tanggal: clampString(record.tanggal, 64, new Date().toISOString().slice(0, 16)),
    jenisTransaksi,
    idPelanggan: clampString(record.idPelanggan, 64),
    noMeter: clampString(record.noMeter, 128),
    nomorAgenda: clampString(record.nomorAgenda, 128),
    nama: clampString(record.nama, 160, 'Pelanggan PLN'),
    tarif: clampString(record.tarif, 32),
    daya: clampNumber(record.daya, 0, 1_000_000, 0),
    snKwhMeter: clampString(record.snKwhMeter, 128, safeId),
    snMcb: clampString(record.snMcb, 128),
    segel: clampString(record.segel, 128),
    kabelTw: clampNumber(record.kabelTw, 0, 100_000, 0),
    petugas: clampString(record.petugas, 120, 'Petugas Yanbung'),
    gmKategori: typeof record.gmKategori === 'string' && record.gmKategori.trim()
      ? clampString(record.gmKategori, 64)
      : undefined,
    gmKeterangan: typeof record.gmKeterangan === 'string' && record.gmKeterangan.trim()
      ? clampString(record.gmKeterangan, 500)
      : undefined,
    noMeterLama: typeof record.noMeterLama === 'string' && record.noMeterLama.trim()
      ? clampString(record.noMeterLama, 128)
      : undefined,
    standMeterLama: typeof record.standMeterLama === 'string' && record.standMeterLama.trim()
      ? clampString(record.standMeterLama, 64)
      : undefined,
    snSegelLama: typeof record.snSegelLama === 'string' && record.snSegelLama.trim()
      ? clampString(record.snSegelLama, 128)
      : undefined,
    meterBrand: typeof record.meterBrand === 'string' && record.meterBrand.trim()
      ? clampString(record.meterBrand, 80)
      : undefined,
    meterCategory: typeof record.meterCategory === 'string' && record.meterCategory.trim()
      ? clampString(record.meterCategory, 80)
      : undefined,
    rackSource: typeof record.rackSource === 'string' && record.rackSource.trim()
      ? clampString(record.rackSource, 120)
      : undefined,
    updatedAt: clampString(updatedAt, 64, new Date().toISOString()),
  });
}

function sanitizeSimagUserForCloud(user: SimagUser) {
  const safeId = toSafeDocId(user.id);
  const validRoles: SimagUser['role'][] = [
    'Administrator',
    'Kepala Gudang',
    'Petugas Gudang',
    'Operator',
  ];
  const role: SimagUser['role'] = validRoles.includes(user.role)
    ? user.role
    : 'Operator';
  const now = new Date().toISOString();
  return stripUndefined({
    id: safeId,
    nip: clampString(user.nip, 32, 'USER'),
    nama: clampString(user.nama, 120, 'Pengguna SIMAG'),
    role,
    passwordHash: clampString(user.passwordHash, 128).padEnd(64, '0'),
    createdAt: clampString(user.createdAt, 64, now),
    updatedAt: clampString(user.updatedAt, 64, now),
    lastLoginAt: typeof user.lastLoginAt === 'string' && user.lastLoginAt.trim()
      ? clampString(user.lastLoginAt, 64)
      : undefined,
  });
}

export function sortRacks(racks: WarehouseRack[]): WarehouseRack[] {
  const order = ['RAK-A', 'RAK-B', 'RAK-C', 'RAK-D'];
  return [...racks]
    .map(normalizeRack)
    .sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id.localeCompare(b.id);
    });
}

export function sortCartons(cartons: InboundCarton[]): InboundCarton[] {
  return [...cartons].sort((a, b) => {
    const cmp = (b.dateInbound || '').localeCompare(a.dateInbound || '');
    if (cmp !== 0) return cmp;
    return b.id.localeCompare(a.id);
  });
}

export function sortOutbounds(outbounds: OutboundRecord[]): OutboundRecord[] {
  return [...outbounds].sort((a, b) => {
    const cmp = (b.tanggal || '').localeCompare(a.tanggal || '');
    if (cmp !== 0) return cmp;
    return b.id.localeCompare(a.id);
  });
}

export function sortMeters(meters: MeterUnit[]): MeterUnit[] {
  return [...meters].sort((a, b) => {
    const cmp = (b.dateInbound || '').localeCompare(a.dateInbound || '');
    if (cmp !== 0) return cmp;
    return a.serialNumber.localeCompare(b.serialNumber);
  });
}

export function hasCustomWarehouseData(data: {
  racks: WarehouseRack[];
  cartons: InboundCarton[];
  meters: MeterUnit[];
  outbounds: OutboundRecord[];
}): boolean {
  if (data.cartons.length > 0 || data.meters.length > 0 || data.outbounds.length > 0) {
    return true;
  }
  return data.racks.some(rack => {
    const def = INITIAL_RACKS.find(d => d.id === rack.id);
    if (!def) return true;
    if (
      rack.name !== def.name ||
      rack.zone !== def.zone ||
      rack.primaryBrand !== def.primaryBrand ||
      (rack.brandColor || '') !== (def.brandColor || '')
    ) {
      return true;
    }
    return rack.shelves.some(s => s.cartonIds && s.cartonIds.length > 0);
  });
}

function getClientSourceTag(): string {
  try {
    return clampString(window.location.host || 'web-client', 120, 'web-client');
  } catch {
    return 'web-client';
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, META_COL, META_DOC_ID));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

async function commitBatchChunks(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
  pathLabel: string
): Promise<void> {
  if (ops.length === 0) return;
  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const slice = ops.slice(i, i + CHUNK_SIZE);
      slice.forEach(fn => fn(batch));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathLabel);
  }
}

export async function seedWarehouseSnapshotToCloud(payload: {
  racks: WarehouseRack[];
  cartons: InboundCarton[];
  meters: MeterUnit[];
  outbounds: OutboundRecord[];
  users?: SimagUser[];
  hasRealData: boolean;
  clearExistingCollections?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();

  if (payload.clearExistingCollections) {
    const [existingCartons, existingMeters, existingOutbounds] = await Promise.all([
      getDocs(collection(db, CARTONS_COL)),
      getDocs(collection(db, METERS_COL)),
      getDocs(collection(db, OUTBOUNDS_COL)),
    ]);
    await commitBatchChunks(
      existingCartons.docs.map(d => b => b.delete(d.ref)),
      CARTONS_COL
    );
    await commitBatchChunks(
      existingMeters.docs.map(d => b => b.delete(d.ref)),
      METERS_COL
    );
    await commitBatchChunks(
      existingOutbounds.docs.map(d => b => b.delete(d.ref)),
      OUTBOUNDS_COL
    );
  }

  await commitBatchChunks(
    payload.racks.map(rack => {
      const sanitized = sanitizeRackForCloud(rack, now);
      return b => b.set(doc(db, RACKS_COL, sanitized.id), sanitized);
    }),
    RACKS_COL
  );

  await commitBatchChunks(
    payload.cartons.map(carton => {
      const sanitized = sanitizeCartonForCloud(carton, now);
      return b => b.set(doc(db, CARTONS_COL, sanitized.id), sanitized);
    }),
    CARTONS_COL
  );

  await commitBatchChunks(
    payload.meters.map(meter => {
      const sanitized = sanitizeMeterForCloud(meter, now);
      const safeSn = toSafeDocId(sanitized.serialNumber);
      return b => b.set(doc(db, METERS_COL, safeSn), sanitized);
    }),
    METERS_COL
  );

  await commitBatchChunks(
    payload.outbounds.map(record => {
      const sanitized = sanitizeOutboundForCloud(record, now);
      return b => b.set(doc(db, OUTBOUNDS_COL, sanitized.id), sanitized);
    }),
    OUTBOUNDS_COL
  );

  if (payload.users && payload.users.length > 0) {
    await commitBatchChunks(
      payload.users.map(user => {
        const sanitized = sanitizeSimagUserForCloud(user);
        return b => b.set(doc(db, USERS_COL, sanitized.id), sanitized);
      }),
      USERS_COL
    );
  }

  const metaRef = doc(db, META_COL, META_DOC_ID);
  try {
    await setDoc(
      metaRef,
      stripUndefined({
        schemaVersion: 1,
        hasRealData: Boolean(payload.hasRealData),
        updatedAt: now,
        lastSource: getClientSourceTag(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${META_COL}/${META_DOC_ID}`);
  }
}

export async function syncInboundToCloud(
  updatedRack: WarehouseRack | undefined,
  newCarton: InboundCarton,
  newUnits: MeterUnit[]
): Promise<void> {
  const now = new Date().toISOString();
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  if (updatedRack) {
    const sanitizedRack = sanitizeRackForCloud(updatedRack, now);
    ops.push(b => b.set(doc(db, RACKS_COL, sanitizedRack.id), sanitizedRack));
  }

  const sanitizedCarton = sanitizeCartonForCloud(newCarton, now);
  ops.push(b => b.set(doc(db, CARTONS_COL, sanitizedCarton.id), sanitizedCarton));

  newUnits.forEach(unit => {
    const sanitizedMeter = sanitizeMeterForCloud(unit, now);
    const safeSn = toSafeDocId(sanitizedMeter.serialNumber);
    ops.push(b => b.set(doc(db, METERS_COL, safeSn), sanitizedMeter));
  });

  ops.push(b =>
    b.set(
      doc(db, META_COL, META_DOC_ID),
      stripUndefined({
        schemaVersion: 1,
        hasRealData: true,
        updatedAt: now,
        lastSource: getClientSourceTag(),
      })
    )
  );

  await commitBatchChunks(ops, `${CARTONS_COL}/${sanitizedCarton.id}`);
}

export async function syncAddUnitsToCartonInCloud(
  updatedCarton: InboundCarton,
  addedUnits: MeterUnit[]
): Promise<void> {
  const now = new Date().toISOString();
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  const sanitizedCarton = sanitizeCartonForCloud(updatedCarton, now);
  ops.push(b => b.set(doc(db, CARTONS_COL, sanitizedCarton.id), sanitizedCarton));

  addedUnits.forEach(unit => {
    const sanitizedMeter = sanitizeMeterForCloud(unit, now);
    const safeSn = toSafeDocId(sanitizedMeter.serialNumber);
    ops.push(b => b.set(doc(db, METERS_COL, safeSn), sanitizedMeter));
  });

  ops.push(b =>
    b.set(
      doc(db, META_COL, META_DOC_ID),
      stripUndefined({
        schemaVersion: 1,
        hasRealData: true,
        updatedAt: now,
        lastSource: getClientSourceTag(),
      })
    )
  );

  await commitBatchChunks(ops, `${CARTONS_COL}/${sanitizedCarton.id}`);
}

export async function syncCartonBrandToCloud(
  updatedCarton: InboundCarton,
  updatedMeters: MeterUnit[]
): Promise<void> {
  const now = new Date().toISOString();
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  const sanitizedCarton = sanitizeCartonForCloud(updatedCarton, now);
  ops.push(b => b.set(doc(db, CARTONS_COL, sanitizedCarton.id), sanitizedCarton));

  updatedMeters.forEach(meter => {
    const sanitizedMeter = sanitizeMeterForCloud(meter, now);
    const safeSn = toSafeDocId(sanitizedMeter.serialNumber);
    ops.push(b => b.set(doc(db, METERS_COL, safeSn), sanitizedMeter));
  });

  ops.push(b =>
    b.set(
      doc(db, META_COL, META_DOC_ID),
      stripUndefined({
        schemaVersion: 1,
        hasRealData: true,
        updatedAt: now,
        lastSource: getClientSourceTag(),
      })
    )
  );

  await commitBatchChunks(ops, `${CARTONS_COL}/${sanitizedCarton.id}`);
}

export async function syncOutboundToCloud(
  updatedMeter: MeterUnit | undefined,
  record: OutboundRecord
): Promise<void> {
  const now = new Date().toISOString();
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  if (updatedMeter) {
    const sanitizedMeter = sanitizeMeterForCloud(updatedMeter, now);
    const safeSn = toSafeDocId(sanitizedMeter.serialNumber);
    ops.push(b => b.set(doc(db, METERS_COL, safeSn), sanitizedMeter));
  }

  const sanitizedOutbound = sanitizeOutboundForCloud(record, now);
  ops.push(b => b.set(doc(db, OUTBOUNDS_COL, sanitizedOutbound.id), sanitizedOutbound));

  ops.push(b =>
    b.set(
      doc(db, META_COL, META_DOC_ID),
      stripUndefined({
        schemaVersion: 1,
        hasRealData: true,
        updatedAt: now,
        lastSource: getClientSourceTag(),
      })
    )
  );

  await commitBatchChunks(ops, `${OUTBOUNDS_COL}/${sanitizedOutbound.id}`);
}

export async function syncMoveCartonToCloud(
  updatedCarton: InboundCarton,
  updatedRacks: WarehouseRack[],
  updatedMeters: MeterUnit[]
): Promise<void> {
  const now = new Date().toISOString();
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  const sanitizedCarton = sanitizeCartonForCloud(updatedCarton, now);
  ops.push(b => b.set(doc(db, CARTONS_COL, sanitizedCarton.id), sanitizedCarton));

  updatedRacks.forEach(rack => {
    const sanitizedRack = sanitizeRackForCloud(rack, now);
    ops.push(b => b.set(doc(db, RACKS_COL, sanitizedRack.id), sanitizedRack));
  });

  updatedMeters.forEach(meter => {
    const sanitizedMeter = sanitizeMeterForCloud(meter, now);
    const safeSn = toSafeDocId(sanitizedMeter.serialNumber);
    ops.push(b => b.set(doc(db, METERS_COL, safeSn), sanitizedMeter));
  });

  ops.push(b =>
    b.set(
      doc(db, META_COL, META_DOC_ID),
      stripUndefined({
        schemaVersion: 1,
        hasRealData: true,
        updatedAt: now,
        lastSource: getClientSourceTag(),
      })
    )
  );

  await commitBatchChunks(ops, `${CARTONS_COL}/${sanitizedCarton.id}`);
}

export async function syncRackToCloud(updatedRack: WarehouseRack): Promise<void> {
  const now = new Date().toISOString();
  const sanitizedRack = sanitizeRackForCloud(updatedRack, now);
  await commitBatchChunks(
    [
      b => b.set(doc(db, RACKS_COL, sanitizedRack.id), sanitizedRack),
      b =>
        b.set(
          doc(db, META_COL, META_DOC_ID),
          stripUndefined({
            schemaVersion: 1,
            hasRealData: true,
            updatedAt: now,
            lastSource: getClientSourceTag(),
          })
        ),
    ],
    `${RACKS_COL}/${sanitizedRack.id}`
  );
}

export async function syncSimagUserUpsertToCloud(user: SimagUser): Promise<void> {
  const sanitized = sanitizeSimagUserForCloud(user);
  try {
    await setDoc(doc(db, USERS_COL, sanitized.id), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${USERS_COL}/${sanitized.id}`);
  }
}

export async function syncSimagUserDeleteFromCloud(userId: string): Promise<void> {
  const safeId = toSafeDocId(userId);
  await commitBatchChunks([b => b.delete(doc(db, USERS_COL, safeId))], `${USERS_COL}/${safeId}`);
}

export interface WarehouseRealtimeCallbacks {
  localInitial: {
    racks: WarehouseRack[];
    cartons: InboundCarton[];
    meters: MeterUnit[];
    outbounds: OutboundRecord[];
    users: SimagUser[];
  };
  onCloudState: (next: {
    racks?: WarehouseRack[];
    cartons?: InboundCarton[];
    meters?: MeterUnit[];
    outbounds?: OutboundRecord[];
    users?: SimagUser[];
  }) => void;
  onStatusChange: (status: CloudSyncConnectionStatus, message?: string) => void;
}

export function subscribeWarehouseTwoWaySync(
  callbacks: WarehouseRealtimeCallbacks
): () => void {
  let racksReady = false;
  let cartonsReady = false;
  let metersReady = false;
  let outboundsReady = false;
  let usersReady = false;
  let metaReady = false;
  let initialReconciled = false;

  let cloudRacks: WarehouseRack[] = [];
  let cloudCartons: InboundCarton[] = [];
  let cloudMeters: MeterUnit[] = [];
  let cloudOutbounds: OutboundRecord[] = [];
  let cloudUsers: SimagUser[] = [];
  let cloudMeta: WarehouseCloudMeta | null = null;

  callbacks.onStatusChange('connecting', 'Menghubungkan sinkronisasi dua arah...');

  const tryReconcileInitial = async () => {
    if (
      initialReconciled ||
      !racksReady ||
      !cartonsReady ||
      !metersReady ||
      !outboundsReady ||
      !usersReady ||
      !metaReady
    ) {
      return;
    }
    initialReconciled = true;

    const firestoreHasRealData =
      cloudMeta?.hasRealData === true ||
      cloudCartons.length > 0 ||
      cloudMeters.length > 0 ||
      cloudOutbounds.length > 0;

    const localHasRealData = hasCustomWarehouseData(callbacks.localInitial);

    if (!firestoreHasRealData && localHasRealData) {
      // Automatically promote this domain's real warehouse inventory to Cloud Firestore
      // so Vercel and AI Studio immediately share the exact same live stock (zero clicks)
      callbacks.onStatusChange('syncing', 'Mengunggah data gudang ke cloud...');
      try {
        const mergedUsers = mergeUsersForSeed(callbacks.localInitial.users, cloudUsers);
        await seedWarehouseSnapshotToCloud({
          racks: callbacks.localInitial.racks,
          cartons: callbacks.localInitial.cartons,
          meters: callbacks.localInitial.meters,
          outbounds: callbacks.localInitial.outbounds,
          users: mergedUsers,
          hasRealData: true,
        });
        callbacks.onStatusChange('synced', 'Tersinkron Otomatis (AI Studio ↔ Vercel)');
      } catch (err) {
        callbacks.onStatusChange('error', 'Gagal unggah awal ke cloud');
      }
      return;
    }

    if (!firestoreHasRealData && cloudRacks.length === 0) {
      // Initialize baseline racks & users cleanly with hasRealData: false so any populated browser can still promote cleanly
      try {
        const mergedUsers = mergeUsersForSeed(callbacks.localInitial.users, cloudUsers);
        await seedWarehouseSnapshotToCloud({
          racks: INITIAL_RACKS,
          cartons: [],
          meters: [],
          outbounds: [],
          users: mergedUsers,
          hasRealData: false,
        });
      } catch {
        // Ignore transient init error
      }
    } else if (cloudUsers.length === 0 && callbacks.localInitial.users.length > 0) {
      // Ensure SIMAG users exist in cloud
      try {
        for (const u of callbacks.localInitial.users) {
          await syncSimagUserUpsertToCloud(u);
        }
      } catch {
        // Ignore transient init error
      }
    }

    // Apply authoritative cloud snapshot if cloud has real data or existing racks
    const nextState: {
      racks?: WarehouseRack[];
      cartons?: InboundCarton[];
      meters?: MeterUnit[];
      outbounds?: OutboundRecord[];
      users?: SimagUser[];
    } = {};

    if (cloudRacks.length > 0) {
      nextState.racks = sortRacks(cloudRacks);
    }
    if (firestoreHasRealData) {
      nextState.cartons = sortCartons(cloudCartons);
      nextState.meters = sortMeters(cloudMeters);
      nextState.outbounds = sortOutbounds(cloudOutbounds);
    }
    if (cloudUsers.length > 0) {
      nextState.users = cloudUsers;
    }

    if (Object.keys(nextState).length > 0) {
      callbacks.onCloudState(nextState);
    }
    callbacks.onStatusChange('synced', 'Tersinkron Otomatis (AI Studio ↔ Vercel)');
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, RACKS_COL),
      snapshot => {
        cloudRacks = snapshot.docs.map(d => d.data() as WarehouseRack);
        racksReady = true;
        if (initialReconciled && cloudRacks.length > 0) {
          callbacks.onCloudState({ racks: sortRacks(cloudRacks) });
          callbacks.onStatusChange('synced', 'Tersinkron Otomatis (AI Studio ↔ Vercel)');
        } else {
          void tryReconcileInitial();
        }
      },
      error => {
        callbacks.onStatusChange('error', 'Koneksi Firestore terganggu');
        handleFirestoreError(error, OperationType.GET, RACKS_COL);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, CARTONS_COL),
      snapshot => {
        cloudCartons = snapshot.docs.map(d => d.data() as InboundCarton);
        cartonsReady = true;
        if (initialReconciled) {
          callbacks.onCloudState({ cartons: sortCartons(cloudCartons) });
          callbacks.onStatusChange('synced', 'Tersinkron Otomatis (AI Studio ↔ Vercel)');
        } else {
          void tryReconcileInitial();
        }
      },
      error => {
        callbacks.onStatusChange('error', 'Koneksi Firestore terganggu');
        handleFirestoreError(error, OperationType.GET, CARTONS_COL);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, METERS_COL),
      snapshot => {
        cloudMeters = snapshot.docs.map(d => d.data() as MeterUnit);
        metersReady = true;
        if (initialReconciled) {
          callbacks.onCloudState({ meters: sortMeters(cloudMeters) });
          callbacks.onStatusChange('synced', 'Tersinkron Otomatis (AI Studio ↔ Vercel)');
        } else {
          void tryReconcileInitial();
        }
      },
      error => {
        callbacks.onStatusChange('error', 'Koneksi Firestore terganggu');
        handleFirestoreError(error, OperationType.GET, METERS_COL);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, OUTBOUNDS_COL),
      snapshot => {
        cloudOutbounds = snapshot.docs.map(d => d.data() as OutboundRecord);
        outboundsReady = true;
        if (initialReconciled) {
          callbacks.onCloudState({ outbounds: sortOutbounds(cloudOutbounds) });
          callbacks.onStatusChange('synced', 'Tersinkron Otomatis (AI Studio ↔ Vercel)');
        } else {
          void tryReconcileInitial();
        }
      },
      error => {
        callbacks.onStatusChange('error', 'Koneksi Firestore terganggu');
        handleFirestoreError(error, OperationType.GET, OUTBOUNDS_COL);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, USERS_COL),
      snapshot => {
        cloudUsers = snapshot.docs.map(d => d.data() as SimagUser);
        usersReady = true;
        if (initialReconciled && cloudUsers.length > 0) {
          callbacks.onCloudState({ users: cloudUsers });
          callbacks.onStatusChange('synced', 'Tersinkron Otomatis (AI Studio ↔ Vercel)');
        } else {
          void tryReconcileInitial();
        }
      },
      error => {
        callbacks.onStatusChange('error', 'Koneksi Firestore terganggu');
        handleFirestoreError(error, OperationType.GET, USERS_COL);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, META_COL, META_DOC_ID),
      snapshot => {
        cloudMeta = snapshot.exists() ? (snapshot.data() as WarehouseCloudMeta) : null;
        metaReady = true;
        void tryReconcileInitial();
      },
      error => {
        callbacks.onStatusChange('error', 'Koneksi Firestore terganggu');
        handleFirestoreError(error, OperationType.GET, `${META_COL}/${META_DOC_ID}`);
      }
    )
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}

function mergeUsersForSeed(localUsers: SimagUser[], cloudUsers: SimagUser[]): SimagUser[] {
  const byNip = new Map<string, SimagUser>();
  cloudUsers.forEach(u => byNip.set(u.nip.trim().toUpperCase(), u));
  localUsers.forEach(u => {
    const key = u.nip.trim().toUpperCase();
    if (!byNip.has(key)) {
      byNip.set(key, u);
    } else {
      const existing = byNip.get(key)!;
      if ((u.updatedAt || '') > (existing.updatedAt || '')) {
        byNip.set(key, u);
      }
    }
  });
  return Array.from(byNip.values());
}

export async function pullWarehouseSnapshotFromCloud(): Promise<{
  racks: WarehouseRack[];
  cartons: InboundCarton[];
  meters: MeterUnit[];
  outbounds: OutboundRecord[];
  users: SimagUser[];
}> {
  const [racksSnap, cartonsSnap, metersSnap, outboundsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, RACKS_COL)).catch(err => handleFirestoreError(err, OperationType.GET, RACKS_COL)),
    getDocs(collection(db, CARTONS_COL)).catch(err => handleFirestoreError(err, OperationType.GET, CARTONS_COL)),
    getDocs(collection(db, METERS_COL)).catch(err => handleFirestoreError(err, OperationType.GET, METERS_COL)),
    getDocs(collection(db, OUTBOUNDS_COL)).catch(err => handleFirestoreError(err, OperationType.GET, OUTBOUNDS_COL)),
    getDocs(collection(db, USERS_COL)).catch(err => handleFirestoreError(err, OperationType.GET, USERS_COL)),
  ]);

  const rawRacks = racksSnap.docs.map(d => d.data() as WarehouseRack);
  return {
    racks: rawRacks.length > 0 ? sortRacks(rawRacks) : INITIAL_RACKS,
    cartons: sortCartons(cartonsSnap.docs.map(d => d.data() as InboundCarton)),
    meters: sortMeters(metersSnap.docs.map(d => d.data() as MeterUnit)),
    outbounds: sortOutbounds(outboundsSnap.docs.map(d => d.data() as OutboundRecord)),
    users: usersSnap.docs.map(d => d.data() as SimagUser),
  };
}
