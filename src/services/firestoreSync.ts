/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  DocumentReference,
} from 'firebase/firestore';
import { db, auth } from './firebaseClient';
import {
  WarehouseRack,
  InboundCarton,
  MeterUnit,
  OutboundRecord,
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

export interface FirestoreErrorInfo {
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
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
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

export interface CloudSyncStatus {
  status: 'disconnected' | 'connecting' | 'synced' | 'syncing' | 'error';
  message?: string;
  lastSyncedAt?: string;
}

export interface CloudWarehousePayload {
  racks: WarehouseRack[];
  cartons: InboundCarton[];
  meters: MeterUnit[];
  outbounds: OutboundRecord[];
  simagUsers: SimagUser[];
  lastSyncedAt: string;
}

const ADMIN_EMAIL = 'fikiilham56@gmail.com';
const COL_META = 'warehouse_meta';
const COL_RACKS = 'warehouse_racks';
const COL_CARTONS = 'warehouse_cartons';
const COL_METERS = 'warehouse_meters';
const COL_OUTBOUNDS = 'warehouse_outbounds';
const COL_USERS = 'simag_users';
const CLOUD_SYNCED_FLAG = 'pln_cloud_synced_once_v1';

// Tracks known cloud document timestamps & ownerUids so updates preserve immutables
const knownDocsCache = new Map<string, { ownerUid: string; serverCreatedAt: unknown }>();
let currentMetaResetVersion = 0;

export function toSafeDocId(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `doc_${Date.now()}`;
}

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

function stripCloudMeta<T extends Record<string, any>>(data: T): T {
  const copy = { ...data };
  delete copy.ownerUid;
  delete copy.serverCreatedAt;
  delete copy.serverUpdatedAt;
  return copy as T;
}

function isBootstrapAdmin(user: User): boolean {
  return Boolean(user.emailVerified && user.email === ADMIN_EMAIL);
}

function buildCollectionQuery(colName: string, user: User) {
  if (isBootstrapAdmin(user)) {
    return collection(db, colName);
  }
  return query(collection(db, colName), where('ownerUid', '==', user.uid));
}

function hasCustomizedRacks(racks: WarehouseRack[]): boolean {
  if (racks.length !== INITIAL_RACKS.length) return true;
  return racks.some(rack => {
    const initial = INITIAL_RACKS.find(ir => ir.id === rack.id);
    if (!initial) return true;
    return (
      rack.name !== initial.name ||
      rack.zone !== initial.zone ||
      rack.primaryBrand !== initial.primaryBrand ||
      (rack.brandColor || '') !== (initial.brandColor || '') ||
      rack.shelves.some(s => s.cartonIds.length > 0)
    );
  });
}

function normalizeRacksList(racks: WarehouseRack[]): WarehouseRack[] {
  const source = racks.length > 0 ? racks : INITIAL_RACKS;
  return [...source]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(r => ({
      ...r,
      shelves: [...r.shelves]
        .sort((a, b) => a.level - b.level)
        .map(s => ({
          ...s,
          label:
            s.level === 1
              ? 'Tingkat 1 (Atas)'
              : s.level === 4
              ? 'Tingkat 4 (Bawah)'
              : `Tingkat ${s.level}`,
          cartonCapacity: 16,
        })),
    }));
}

type BatchOp =
  | { type: 'set'; ref: DocumentReference; data: Record<string, any> }
  | { type: 'update'; ref: DocumentReference; data: Record<string, any> }
  | { type: 'delete'; ref: DocumentReference };

async function commitBatchedOps(ops: BatchOp[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const slice = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of slice) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

function formatRackDoc(rack: WarehouseRack, ownerUid: string, isNew: boolean): Record<string, any> {
  const payload = stripUndefined({
    id: toSafeDocId(rack.id),
    name: rack.name.slice(0, 120),
    zone: rack.zone.slice(0, 120),
    primaryBrand: rack.primaryBrand.slice(0, 100),
    brandColor: rack.brandColor ? rack.brandColor.slice(0, 32) : undefined,
    shelves: rack.shelves.map(s => ({
      level: Number(s.level),
      label: String(s.label),
      cartonCapacity: Number(s.cartonCapacity || 16),
      cartonIds: Array.isArray(s.cartonIds) ? s.cartonIds.map(toSafeDocId) : [],
    })),
  });
  if (!isNew) {
    return {
      name: payload.name,
      zone: payload.zone,
      primaryBrand: payload.primaryBrand,
      ...(payload.brandColor !== undefined ? { brandColor: payload.brandColor } : {}),
      shelves: payload.shelves,
      serverUpdatedAt: serverTimestamp(),
    };
  }
  return {
    ...payload,
    ownerUid,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };
}

function formatCartonDoc(carton: InboundCarton, ownerUid: string, isNew: boolean): Record<string, any> {
  const id = toSafeDocId(carton.id);
  const payload = stripUndefined({
    id,
    cartonBarcode: carton.cartonBarcode.slice(0, 128),
    brand: carton.brand.slice(0, 100),
    phase: carton.phase,
    category: String(carton.category).slice(0, 80),
    unitsCount: Number(carton.unitsCount),
    meterSerials: carton.meterSerials.slice(0, 100),
    rackId: carton.rackId.slice(0, 64),
    shelfLevel: Number(carton.shelfLevel),
    dateInbound: carton.dateInbound.slice(0, 64),
    receivedBy: carton.receivedBy.slice(0, 120),
    notes: carton.notes ? carton.notes.slice(0, 500) : undefined,
  });
  if (!isNew) {
    return {
      brand: payload.brand,
      unitsCount: payload.unitsCount,
      meterSerials: payload.meterSerials,
      rackId: payload.rackId,
      shelfLevel: payload.shelfLevel,
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      serverUpdatedAt: serverTimestamp(),
    };
  }
  return {
    ...payload,
    ownerUid,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };
}

function formatMeterDoc(meter: MeterUnit, ownerUid: string, isNew: boolean): Record<string, any> {
  const payload = stripUndefined({
    serialNumber: meter.serialNumber.slice(0, 128),
    brand: meter.brand.slice(0, 100),
    phase: meter.phase,
    category: String(meter.category).slice(0, 80),
    cartonBarcode: meter.cartonBarcode.slice(0, 128),
    rackId: meter.rackId.slice(0, 64),
    shelfLevel: Number(meter.shelfLevel),
    dateInbound: meter.dateInbound.slice(0, 64),
    status: meter.status,
    dispatchId: meter.dispatchId ? toSafeDocId(meter.dispatchId) : undefined,
  });
  if (!isNew) {
    return {
      brand: payload.brand,
      rackId: payload.rackId,
      shelfLevel: payload.shelfLevel,
      status: payload.status,
      ...(payload.dispatchId !== undefined ? { dispatchId: payload.dispatchId } : {}),
      serverUpdatedAt: serverTimestamp(),
    };
  }
  return {
    ...payload,
    ownerUid,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };
}

function formatOutboundDoc(record: OutboundRecord, ownerUid: string): Record<string, any> {
  return stripUndefined({
    id: toSafeDocId(record.id),
    tanggal: record.tanggal.slice(0, 64),
    jenisTransaksi: record.jenisTransaksi,
    idPelanggan: String(record.idPelanggan || '').slice(0, 64),
    noMeter: String(record.noMeter || '').slice(0, 128),
    nomorAgenda: String(record.nomorAgenda || '').slice(0, 128),
    nama: String(record.nama || '').slice(0, 160),
    tarif: String(record.tarif || '').slice(0, 32),
    daya: Number(record.daya || 0),
    snKwhMeter: record.snKwhMeter.slice(0, 128),
    snMcb: String(record.snMcb || '').slice(0, 128),
    segel: String(record.segel || '').slice(0, 128),
    kabelTw: Number(record.kabelTw || 0),
    petugas: record.petugas.slice(0, 120),
    gmKategori: record.gmKategori ? String(record.gmKategori).slice(0, 64) : undefined,
    gmKeterangan: record.gmKeterangan ? record.gmKeterangan.slice(0, 500) : undefined,
    noMeterLama: record.noMeterLama ? record.noMeterLama.slice(0, 128) : undefined,
    standMeterLama: record.standMeterLama ? record.standMeterLama.slice(0, 64) : undefined,
    snSegelLama: record.snSegelLama ? record.snSegelLama.slice(0, 128) : undefined,
    meterBrand: record.meterBrand ? String(record.meterBrand).slice(0, 100) : undefined,
    meterCategory: record.meterCategory ? String(record.meterCategory).slice(0, 80) : undefined,
    rackSource: record.rackSource ? record.rackSource.slice(0, 120) : undefined,
    ownerUid,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

function formatSimagUserDoc(u: SimagUser, ownerUid: string, isNew: boolean): Record<string, any> {
  const id = toSafeDocId(u.id);
  const payload = stripUndefined({
    id,
    nip: u.nip.slice(0, 32),
    nama: u.nama.slice(0, 120),
    role: u.role,
    passwordHash: u.passwordHash.slice(0, 128),
    createdAt: u.createdAt.slice(0, 64),
    updatedAt: u.updatedAt.slice(0, 64),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.slice(0, 64) : undefined,
  });
  if (!isNew) {
    return {
      nama: payload.nama,
      role: payload.role,
      passwordHash: payload.passwordHash,
      updatedAt: payload.updatedAt,
      ...(payload.lastLoginAt !== undefined ? { lastLoginAt: payload.lastLoginAt } : {}),
      serverUpdatedAt: serverTimestamp(),
    };
  }
  return {
    ...payload,
    ownerUid,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };
}

function upsertDocOp(
  colName: string,
  docId: string,
  createPayload: Record<string, any>,
  updatePayload: Record<string, any>
): BatchOp {
  const safeId = toSafeDocId(docId);
  const cacheKey = `${colName}/${safeId}`;
  const ref = doc(db, colName, safeId);
  if (knownDocsCache.has(cacheKey)) {
    return { type: 'update', ref, data: updatePayload };
  }
  return { type: 'set', ref, data: createPayload };
}

export async function forceUploadLocalToCloud(
  user: User,
  snapshot: {
    racks: WarehouseRack[];
    cartons: InboundCarton[];
    meters: MeterUnit[];
    outbounds: OutboundRecord[];
    simagUsers: SimagUser[];
  },
  resetVersion = Math.max(1, currentMetaResetVersion)
): Promise<void> {
  const ops: BatchOp[] = [];
  const metaRef = doc(db, COL_META, 'state');
  const metaExists = knownDocsCache.has(`${COL_META}/state`);

  if (metaExists) {
    ops.push({
      type: 'update',
      ref: metaRef,
      data: {
        initialized: true,
        resetVersion,
        updatedBy: user.email || user.uid,
        serverUpdatedAt: serverTimestamp(),
      },
    });
  } else {
    ops.push({
      type: 'set',
      ref: metaRef,
      data: {
        initialized: true,
        resetVersion,
        ownerUid: user.uid,
        updatedBy: user.email || user.uid,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      },
    });
  }

  for (const rack of snapshot.racks) {
    const id = toSafeDocId(rack.id);
    ops.push(
      upsertDocOp(
        COL_RACKS,
        id,
        formatRackDoc(rack, user.uid, true),
        formatRackDoc(rack, user.uid, false)
      )
    );
  }

  for (const carton of snapshot.cartons) {
    const id = toSafeDocId(carton.id);
    ops.push(
      upsertDocOp(
        COL_CARTONS,
        id,
        formatCartonDoc(carton, user.uid, true),
        formatCartonDoc(carton, user.uid, false)
      )
    );
  }

  for (const meter of snapshot.meters) {
    const id = toSafeDocId(meter.serialNumber);
    ops.push(
      upsertDocOp(
        COL_METERS,
        id,
        formatMeterDoc(meter, user.uid, true),
        formatMeterDoc(meter, user.uid, false)
      )
    );
  }

  for (const outbound of snapshot.outbounds) {
    const id = toSafeDocId(outbound.id);
    if (!knownDocsCache.has(`${COL_OUTBOUNDS}/${id}`)) {
      ops.push({
        type: 'set',
        ref: doc(db, COL_OUTBOUNDS, id),
        data: formatOutboundDoc(outbound, user.uid),
      });
    }
  }

  for (const simagUser of snapshot.simagUsers) {
    const id = toSafeDocId(simagUser.id);
    ops.push(
      upsertDocOp(
        COL_USERS,
        id,
        formatSimagUserDoc(simagUser, user.uid, true),
        formatSimagUserDoc(simagUser, user.uid, false)
      )
    );
  }

  try {
    await commitBatchedOps(ops);
    currentMetaResetVersion = resetVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COL_META);
  }
}

export async function bootstrapAndSubscribeWarehouse(
  user: User,
  getLocalSnapshot: () => {
    racks: WarehouseRack[];
    cartons: InboundCarton[];
    meters: MeterUnit[];
    outbounds: OutboundRecord[];
    simagUsers: SimagUser[];
  },
  onCloudData: (payload: CloudWarehousePayload) => void,
  onStatusChange: (status: CloudSyncStatus) => void
): Promise<() => void> {
  onStatusChange({ status: 'connecting', message: 'Menghubungkan sinkronisasi cloud dua arah...' });

  let metaSnap;
  try {
    metaSnap = await getDoc(doc(db, COL_META, 'state'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${COL_META}/state`);
  }

  if (metaSnap.exists()) {
    const mData = metaSnap.data();
    knownDocsCache.set(`${COL_META}/state`, {
      ownerUid: mData.ownerUid,
      serverCreatedAt: mData.serverCreatedAt,
    });
    currentMetaResetVersion = Number(mData.resetVersion || 0);
  } else {
    currentMetaResetVersion = 0;
  }

  const fetchCollection = async <T extends Record<string, any>>(colName: string): Promise<T[]> => {
    try {
      const snap = await getDocs(buildCollectionQuery(colName, user));
      const items: T[] = [];
      snap.forEach(d => {
        const raw = d.data();
        knownDocsCache.set(`${colName}/${d.id}`, {
          ownerUid: raw.ownerUid,
          serverCreatedAt: raw.serverCreatedAt,
        });
        items.push(stripCloudMeta(raw) as T);
      });
      return items;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colName);
    }
  };

  const [cloudRacks, cloudCartons, cloudMeters, cloudOutbounds, cloudUsers] = await Promise.all([
    fetchCollection<WarehouseRack>(COL_RACKS),
    fetchCollection<InboundCarton>(COL_CARTONS),
    fetchCollection<MeterUnit>(COL_METERS),
    fetchCollection<OutboundRecord>(COL_OUTBOUNDS),
    fetchCollection<SimagUser>(COL_USERS),
  ]);

  const localSnap = getLocalSnapshot();
  const cloudHasInventory =
    cloudCartons.length > 0 || cloudMeters.length > 0 || cloudOutbounds.length > 0;
  const localHasInventory =
    localSnap.cartons.length > 0 ||
    localSnap.meters.length > 0 ||
    localSnap.outbounds.length > 0;
  const localHasCustomization =
    localHasInventory ||
    hasCustomizedRacks(localSnap.racks) ||
    localSnap.simagUsers.length > 2;

  if (!cloudHasInventory && currentMetaResetVersion === 0 && localHasCustomization) {
    // Cloud is empty & never explicitly reset, while this browser (e.g. Vercel with 30 meters) has real data -> promote to cloud!
    await forceUploadLocalToCloud(user, localSnap, 1);
    localStorage.setItem(CLOUD_SYNCED_FLAG, 'true');
  } else if (!metaSnap.exists()) {
    // Initialize empty cloud racks + default users without blocking a later browser that might hold 30 meters (resetVersion = 0)
    await forceUploadLocalToCloud(
      user,
      {
        racks: cloudRacks.length > 0 ? cloudRacks : localSnap.racks,
        cartons: localSnap.cartons,
        meters: localSnap.meters,
        outbounds: localSnap.outbounds,
        simagUsers: cloudUsers.length > 0 ? cloudUsers : localSnap.simagUsers,
      },
      localHasInventory ? 1 : 0
    );
    localStorage.setItem(CLOUD_SYNCED_FLAG, 'true');
  } else if (
    cloudHasInventory &&
    localHasInventory &&
    localStorage.getItem(CLOUD_SYNCED_FLAG) !== 'true'
  ) {
    // First-time connection on a browser that already created different local records before cloud existed -> non-destructive merge of missing IDs
    const cloudCartonIds = new Set(cloudCartons.map(c => toSafeDocId(c.id)));
    const cloudMeterSns = new Set(cloudMeters.map(m => m.serialNumber));
    const cloudOutboundIds = new Set(cloudOutbounds.map(o => toSafeDocId(o.id)));
    const cloudUserIds = new Set(cloudUsers.map(u => toSafeDocId(u.id)));

    const missingCartons = localSnap.cartons.filter(c => !cloudCartonIds.has(toSafeDocId(c.id)));
    const missingMeters = localSnap.meters.filter(m => !cloudMeterSns.has(m.serialNumber));
    const missingOutbounds = localSnap.outbounds.filter(o => !cloudOutboundIds.has(toSafeDocId(o.id)));
    const missingUsers = localSnap.simagUsers.filter(u => !cloudUserIds.has(toSafeDocId(u.id)));

    if (
      missingCartons.length > 0 ||
      missingMeters.length > 0 ||
      missingOutbounds.length > 0 ||
      missingUsers.length > 0
    ) {
      // Merge cartonIds into existing cloud racks
      const mergedRacks = (cloudRacks.length > 0 ? cloudRacks : localSnap.racks).map(r => ({
        ...r,
        shelves: r.shelves.map(s => {
          const addedIds = missingCartons
            .filter(c => c.rackId === r.id && c.shelfLevel === s.level)
            .map(c => c.id);
          return {
            ...s,
            cartonIds: Array.from(new Set([...s.cartonIds, ...addedIds])),
          };
        }),
      }));

      await forceUploadLocalToCloud(
        user,
        {
          racks: mergedRacks,
          cartons: missingCartons,
          meters: missingMeters,
          outbounds: missingOutbounds,
          simagUsers: missingUsers,
        },
        Math.max(1, currentMetaResetVersion)
      );
    }
    localStorage.setItem(CLOUD_SYNCED_FLAG, 'true');
  } else {
    localStorage.setItem(CLOUD_SYNCED_FLAG, 'true');
  }

  // Live state mirror for debounced snapshot emissions
  const liveState = {
    racks: normalizeRacksList(cloudRacks.length > 0 ? cloudRacks : localSnap.racks),
    cartons: cloudCartons,
    meters: cloudMeters,
    outbounds: cloudOutbounds,
    simagUsers: cloudUsers.length > 0 ? cloudUsers : localSnap.simagUsers,
  };

  let emitTimer: number | null = null;
  let disposed = false;

  const scheduleEmit = () => {
    if (disposed) return;
    if (emitTimer) window.clearTimeout(emitTimer);
    emitTimer = window.setTimeout(() => {
      if (disposed) return;
      const nowTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      onCloudData({
        racks: normalizeRacksList(liveState.racks),
        cartons: [...liveState.cartons].sort((a, b) => b.dateInbound.localeCompare(a.dateInbound)),
        meters: [...liveState.meters],
        outbounds: [...liveState.outbounds].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
        simagUsers: [...liveState.simagUsers].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        lastSyncedAt: nowTime,
      });
      onStatusChange({
        status: 'synced',
        message: 'Sinkronisasi dua arah aktif (Google AI Studio ⇄ Vercel)',
        lastSyncedAt: nowTime,
      });
    }, 50);
  };

  const unsubMeta = onSnapshot(
    doc(db, COL_META, 'state'),
    snap => {
      if (snap.exists()) {
        const d = snap.data();
        knownDocsCache.set(`${COL_META}/state`, {
          ownerUid: d.ownerUid,
          serverCreatedAt: d.serverCreatedAt,
        });
        currentMetaResetVersion = Number(d.resetVersion || 0);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, `${COL_META}/state`);
    }
  );

  const unsubRacks = onSnapshot(
    buildCollectionQuery(COL_RACKS, user),
    snap => {
      const next: WarehouseRack[] = [];
      snap.forEach(d => {
        const raw = d.data();
        knownDocsCache.set(`${COL_RACKS}/${d.id}`, {
          ownerUid: raw.ownerUid,
          serverCreatedAt: raw.serverCreatedAt,
        });
        next.push(stripCloudMeta(raw) as WarehouseRack);
      });
      if (next.length > 0) {
        liveState.racks = normalizeRacksList(next);
        scheduleEmit();
      }
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, COL_RACKS);
    }
  );

  const unsubCartons = onSnapshot(
    buildCollectionQuery(COL_CARTONS, user),
    snap => {
      const next: InboundCarton[] = [];
      snap.forEach(d => {
        const raw = d.data();
        knownDocsCache.set(`${COL_CARTONS}/${d.id}`, {
          ownerUid: raw.ownerUid,
          serverCreatedAt: raw.serverCreatedAt,
        });
        next.push(stripCloudMeta(raw) as InboundCarton);
      });
      liveState.cartons = next;
      scheduleEmit();
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, COL_CARTONS);
    }
  );

  const unsubMeters = onSnapshot(
    buildCollectionQuery(COL_METERS, user),
    snap => {
      const next: MeterUnit[] = [];
      snap.forEach(d => {
        const raw = d.data();
        knownDocsCache.set(`${COL_METERS}/${d.id}`, {
          ownerUid: raw.ownerUid,
          serverCreatedAt: raw.serverCreatedAt,
        });
        next.push(stripCloudMeta(raw) as MeterUnit);
      });
      liveState.meters = next;
      scheduleEmit();
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, COL_METERS);
    }
  );

  const unsubOutbounds = onSnapshot(
    buildCollectionQuery(COL_OUTBOUNDS, user),
    snap => {
      const next: OutboundRecord[] = [];
      snap.forEach(d => {
        const raw = d.data();
        knownDocsCache.set(`${COL_OUTBOUNDS}/${d.id}`, {
          ownerUid: raw.ownerUid,
          serverCreatedAt: raw.serverCreatedAt,
        });
        next.push(stripCloudMeta(raw) as OutboundRecord);
      });
      liveState.outbounds = next;
      scheduleEmit();
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, COL_OUTBOUNDS);
    }
  );

  const unsubUsers = onSnapshot(
    buildCollectionQuery(COL_USERS, user),
    snap => {
      const next: SimagUser[] = [];
      snap.forEach(d => {
        const raw = d.data();
        knownDocsCache.set(`${COL_USERS}/${d.id}`, {
          ownerUid: raw.ownerUid,
          serverCreatedAt: raw.serverCreatedAt,
        });
        next.push(stripCloudMeta(raw) as SimagUser);
      });
      if (next.length > 0) {
        liveState.simagUsers = next;
        scheduleEmit();
      }
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, COL_USERS);
    }
  );

  return () => {
    disposed = true;
    if (emitTimer) window.clearTimeout(emitTimer);
    unsubMeta();
    unsubRacks();
    unsubCartons();
    unsubMeters();
    unsubOutbounds();
    unsubUsers();
  };
}

export async function pushInboundToCloud(
  user: User,
  newCarton: InboundCarton,
  newUnits: MeterUnit[],
  updatedRack: WarehouseRack | undefined
): Promise<void> {
  const ops: BatchOp[] = [];
  const cartonId = toSafeDocId(newCarton.id);

  ops.push({
    type: 'set',
    ref: doc(db, COL_CARTONS, cartonId),
    data: formatCartonDoc(newCarton, user.uid, true),
  });

  for (const unit of newUnits) {
    const meterId = toSafeDocId(unit.serialNumber);
    ops.push({
      type: 'set',
      ref: doc(db, COL_METERS, meterId),
      data: formatMeterDoc(unit, user.uid, true),
    });
  }

  if (updatedRack) {
    ops.push(
      upsertDocOp(
        COL_RACKS,
        updatedRack.id,
        formatRackDoc(updatedRack, user.uid, true),
        formatRackDoc(updatedRack, user.uid, false)
      )
    );
  }

  try {
    await commitBatchedOps(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COL_CARTONS}/${cartonId}`);
  }
}

export async function pushAddUnitsToCartonToCloud(
  user: User,
  updatedCarton: InboundCarton,
  newUnits: MeterUnit[]
): Promise<void> {
  const ops: BatchOp[] = [
    upsertDocOp(
      COL_CARTONS,
      updatedCarton.id,
      formatCartonDoc(updatedCarton, user.uid, true),
      formatCartonDoc(updatedCarton, user.uid, false)
    ),
  ];

  for (const unit of newUnits) {
    const meterId = toSafeDocId(unit.serialNumber);
    ops.push({
      type: 'set',
      ref: doc(db, COL_METERS, meterId),
      data: formatMeterDoc(unit, user.uid, true),
    });
  }

  try {
    await commitBatchedOps(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COL_CARTONS}/${updatedCarton.id}`);
  }
}

export async function pushUpdateCartonBrandToCloud(
  user: User,
  updatedCarton: InboundCarton,
  updatedMeters: MeterUnit[]
): Promise<void> {
  const ops: BatchOp[] = [
    upsertDocOp(
      COL_CARTONS,
      updatedCarton.id,
      formatCartonDoc(updatedCarton, user.uid, true),
      formatCartonDoc(updatedCarton, user.uid, false)
    ),
  ];

  for (const m of updatedMeters) {
    ops.push(
      upsertDocOp(
        COL_METERS,
        m.serialNumber,
        formatMeterDoc(m, user.uid, true),
        formatMeterDoc(m, user.uid, false)
      )
    );
  }

  try {
    await commitBatchedOps(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COL_CARTONS}/${updatedCarton.id}`);
  }
}

export async function pushOutboundToCloud(
  user: User,
  record: OutboundRecord,
  updatedMeter: MeterUnit | undefined
): Promise<void> {
  const outboundId = toSafeDocId(record.id);
  const ops: BatchOp[] = [
    {
      type: 'set',
      ref: doc(db, COL_OUTBOUNDS, outboundId),
      data: formatOutboundDoc(record, user.uid),
    },
  ];

  if (updatedMeter) {
    ops.push(
      upsertDocOp(
        COL_METERS,
        updatedMeter.serialNumber,
        formatMeterDoc(updatedMeter, user.uid, true),
        formatMeterDoc(updatedMeter, user.uid, false)
      )
    );
  }

  try {
    await commitBatchedOps(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COL_OUTBOUNDS}/${outboundId}`);
  }
}

export async function pushMoveCartonToCloud(
  user: User,
  updatedCarton: InboundCarton,
  updatedMeters: MeterUnit[],
  affectedRacks: WarehouseRack[]
): Promise<void> {
  const ops: BatchOp[] = [
    upsertDocOp(
      COL_CARTONS,
      updatedCarton.id,
      formatCartonDoc(updatedCarton, user.uid, true),
      formatCartonDoc(updatedCarton, user.uid, false)
    ),
  ];

  for (const m of updatedMeters) {
    ops.push(
      upsertDocOp(
        COL_METERS,
        m.serialNumber,
        formatMeterDoc(m, user.uid, true),
        formatMeterDoc(m, user.uid, false)
      )
    );
  }

  for (const r of affectedRacks) {
    ops.push(
      upsertDocOp(
        COL_RACKS,
        r.id,
        formatRackDoc(r, user.uid, true),
        formatRackDoc(r, user.uid, false)
      )
    );
  }

  try {
    await commitBatchedOps(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COL_CARTONS}/${updatedCarton.id}`);
  }
}

export async function pushUpdateRackToCloud(
  user: User,
  updatedRack: WarehouseRack
): Promise<void> {
  const rackId = toSafeDocId(updatedRack.id);
  const op = upsertDocOp(
    COL_RACKS,
    rackId,
    formatRackDoc(updatedRack, user.uid, true),
    formatRackDoc(updatedRack, user.uid, false)
  );
  try {
    await commitBatchedOps([op]);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COL_RACKS}/${rackId}`);
  }
}

export async function pushResetWarehouseToCloud(
  user: User,
  initialRacks: WarehouseRack[],
  cartonIds: string[],
  meterSerials: string[],
  outboundIds: string[]
): Promise<void> {
  const ops: BatchOp[] = [];
  const nextVersion = currentMetaResetVersion + 1;
  const metaRef = doc(db, COL_META, 'state');

  if (knownDocsCache.has(`${COL_META}/state`)) {
    ops.push({
      type: 'update',
      ref: metaRef,
      data: {
        initialized: true,
        resetVersion: nextVersion,
        updatedBy: user.email || user.uid,
        serverUpdatedAt: serverTimestamp(),
      },
    });
  } else {
    ops.push({
      type: 'set',
      ref: metaRef,
      data: {
        initialized: true,
        resetVersion: nextVersion,
        ownerUid: user.uid,
        updatedBy: user.email || user.uid,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      },
    });
  }

  for (const id of cartonIds) {
    ops.push({ type: 'delete', ref: doc(db, COL_CARTONS, toSafeDocId(id)) });
  }
  for (const sn of meterSerials) {
    ops.push({ type: 'delete', ref: doc(db, COL_METERS, toSafeDocId(sn)) });
  }
  for (const id of outboundIds) {
    ops.push({ type: 'delete', ref: doc(db, COL_OUTBOUNDS, toSafeDocId(id)) });
  }
  for (const r of initialRacks) {
    ops.push(
      upsertDocOp(
        COL_RACKS,
        r.id,
        formatRackDoc(r, user.uid, true),
        formatRackDoc(r, user.uid, false)
      )
    );
  }

  try {
    await commitBatchedOps(ops);
    currentMetaResetVersion = nextVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COL_META);
  }
}

export async function pushUpsertSimagUserToCloud(
  user: User,
  simagUser: SimagUser
): Promise<void> {
  const id = toSafeDocId(simagUser.id);
  const op = upsertDocOp(
    COL_USERS,
    id,
    formatSimagUserDoc(simagUser, user.uid, true),
    formatSimagUserDoc(simagUser, user.uid, false)
  );
  try {
    await commitBatchedOps([op]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COL_USERS}/${id}`);
  }
}

export async function pushDeleteSimagUserFromCloud(simagUserId: string): Promise<void> {
  const id = toSafeDocId(simagUserId);
  try {
    await commitBatchedOps([{ type: 'delete', ref: doc(db, COL_USERS, id) }]);
    knownDocsCache.delete(`${COL_USERS}/${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COL_USERS}/${id}`);
  }
}

export async function pushSimagUserLoginTimeToCloud(
  user: User,
  simagUser: SimagUser
): Promise<void> {
  const id = toSafeDocId(simagUser.id);
  const cacheKey = `${COL_USERS}/${id}`;
  if (!knownDocsCache.has(cacheKey)) return;
  try {
    await updateDoc(doc(db, COL_USERS, id), {
      lastLoginAt: simagUser.lastLoginAt || simagUser.updatedAt,
      serverUpdatedAt: serverTimestamp(),
    });
  } catch {
    // Non-critical login timestamp update
  }
}
