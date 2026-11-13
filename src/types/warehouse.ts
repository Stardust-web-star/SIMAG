/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type KnownMeterBrand = 
  | 'Melcoinda'
  | 'Itron'
  | 'Hexing'
  | 'Sanxing'
  | 'Smart / Star'
  | 'Fuji Dharma Electric'
  | 'Actaris'
  | 'Wasion';

export type MeterBrand = KnownMeterBrand | (string & {});

export type MeterPhase = '1 Phasa' | '3 Phasa';
export type MeterCategory = 
  | 'kWh Meter Prabayar' 
  | 'kWh Meter Paskabayar' 
  | 'Prabayar (Token/Smart)' 
  | 'Pascabayar' 
  | 'AMI (Smart Meter)';

export const formatMeterCategory = (cat?: string): 'kWh Meter Prabayar' | 'kWh Meter Paskabayar' => {
  if (!cat) return 'kWh Meter Prabayar';
  const lower = cat.toLowerCase();
  if (lower.includes('paska') || lower.includes('pasca')) {
    return 'kWh Meter Paskabayar';
  }
  return 'kWh Meter Prabayar';
};

export interface BrandConfig {
  name: string;
  defaultUnitsPerCarton: number;
  color: string;
  badgeBg: string;
  badgeText: string;
  minSafetyStock: number;
}

export const BRAND_CONFIGS: Record<KnownMeterBrand, BrandConfig> = {
  'Melcoinda': {
    name: 'Melcoinda',
    defaultUnitsPerCarton: 10,
    color: '#0284c7', // Sky
    badgeBg: 'bg-sky-100 border-sky-300 dark:bg-sky-500/20 dark:border-sky-500/40',
    badgeText: 'text-sky-700 dark:text-sky-400',
    minSafetyStock: 30,
  },
  'Itron': {
    name: 'Itron',
    defaultUnitsPerCarton: 10,
    color: '#059669', // Emerald
    badgeBg: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/20 dark:border-emerald-500/40',
    badgeText: 'text-emerald-700 dark:text-emerald-400',
    minSafetyStock: 25,
  },
  'Hexing': {
    name: 'Hexing',
    defaultUnitsPerCarton: 10,
    color: '#d97706', // Amber
    badgeBg: 'bg-amber-100 border-amber-300 dark:bg-amber-500/20 dark:border-amber-500/40',
    badgeText: 'text-amber-800 dark:text-amber-400',
    minSafetyStock: 25,
  },
  'Sanxing': {
    name: 'Sanxing',
    defaultUnitsPerCarton: 10,
    color: '#8b5cf6', // Violet
    badgeBg: 'bg-violet-100 border-violet-300 dark:bg-violet-500/20 dark:border-violet-500/40',
    badgeText: 'text-violet-700 dark:text-violet-400',
    minSafetyStock: 20,
  },
  'Smart / Star': {
    name: 'Smart / Star',
    defaultUnitsPerCarton: 10,
    color: '#ec4899', // Pink
    badgeBg: 'bg-pink-100 border-pink-300 dark:bg-pink-500/20 dark:border-pink-500/40',
    badgeText: 'text-pink-700 dark:text-pink-400',
    minSafetyStock: 20,
  },
  'Fuji Dharma Electric': {
    name: 'Fuji Dharma Electric',
    defaultUnitsPerCarton: 10,
    color: '#06b6d4', // Cyan
    badgeBg: 'bg-cyan-100 border-cyan-300 dark:bg-cyan-500/20 dark:border-cyan-500/40',
    badgeText: 'text-cyan-700 dark:text-cyan-400',
    minSafetyStock: 24,
  },
  'Actaris': {
    name: 'Actaris',
    defaultUnitsPerCarton: 10,
    color: '#64748b', // Slate
    badgeBg: 'bg-slate-200 border-slate-300 dark:bg-slate-500/20 dark:border-slate-500/40',
    badgeText: 'text-slate-700 dark:text-slate-400',
    minSafetyStock: 15,
  },
  'Wasion': {
    name: 'Wasion',
    defaultUnitsPerCarton: 10,
    color: '#10b981', // Teal
    badgeBg: 'bg-teal-100 border-teal-300 dark:bg-teal-500/20 dark:border-teal-500/40',
    badgeText: 'text-teal-700 dark:text-teal-400',
    minSafetyStock: 20,
  },
};

export const getBrandConfig = (brand: string): BrandConfig => {
  const normalized = (brand || '').trim();
  const matchedKey = (Object.keys(BRAND_CONFIGS) as KnownMeterBrand[]).find(
    k => k.toLowerCase() === normalized.toLowerCase()
  );
  if (matchedKey) return BRAND_CONFIGS[matchedKey];

  return {
    name: normalized || 'Lainnya',
    defaultUnitsPerCarton: 10,
    color: '#06b6d4',
    badgeBg: 'bg-cyan-100 border-cyan-300 dark:bg-cyan-500/20 dark:border-cyan-500/40',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    minSafetyStock: 20,
  };
};

export type MeterStatus = 'AVAILABLE' | 'DISPATCHED' | 'QUARANTINE';

export interface MeterUnit {
  serialNumber: string;
  brand: MeterBrand;
  phase: MeterPhase;
  category: MeterCategory;
  cartonBarcode: string;
  rackId: string;
  shelfLevel: number; // 1 to 4
  dateInbound: string;
  status: MeterStatus;
  dispatchId?: string;
}

export interface InboundCarton {
  id: string;
  cartonBarcode: string;
  brand: MeterBrand;
  phase: MeterPhase;
  category: MeterCategory;
  unitsCount: number;
  meterSerials: string[];
  rackId: string;
  shelfLevel: number;
  dateInbound: string;
  receivedBy: string;
  notes?: string;
}

export type OutboundType = 'PB' | 'GM';
export type GantiMeterCategory = 'METER_GANGGUAN' | 'METER_TUA';

export interface OutboundRecord {
  id: string;
  tanggal: string; // ISO or YYYY-MM-DD HH:mm
  jenisTransaksi: OutboundType; // PB (Pasang Baru) or GM (Ganti Meter)
  idPelanggan: string; // 12 digit ID Pel
  noMeter: string; // Nomor Meter Baru
  nomorAgenda: string;
  nama: string;
  tarif: string; // e.g., R1, R1M, R2, R3, B1, B2, I1, etc.
  daya: number; // 450, 900, 1300, 2200, 3500, 4400, 5500, etc.
  snKwhMeter: string;
  snMcb: string;
  segel: string;
  kabelTw: number; // in meters
  petugas: string; // Petugas Yanbung / Vendor
  
  // Specific fields for Ganti Meter (GM)
  gmKategori?: GantiMeterCategory;
  gmKeterangan?: string; // Reason / symptom e.g. "Error Periksa", "Display Mati", "Jadwal Tera Usia > 10 Th"
  noMeterLama?: string;
  standMeterLama?: string; // Stand akhir kWh
  snSegelLama?: string;

  // Metadata
  meterBrand?: MeterBrand;
  meterCategory?: MeterCategory;
  rackSource?: string;
}

export interface RackShelf {
  level: number; // 1, 2, 3, 4
  label: string; // "Tingkat 1 (Atas)", "Tingkat 2", etc.
  cartonCapacity: number; // e.g. 6 cartons per shelf
  cartonIds: string[]; // List of InboundCarton IDs currently placed
}

export interface WarehouseRack {
  id: string; // 'RAK-A', 'RAK-B', etc.
  name: string; // 'Rak Melcoinda A1', etc.
  zone: string; // 'Zona Barat', 'Zona Timur'
  primaryBrand: string;
  brandColor?: string; // Custom hex color code for the primary brand badge and rack accents
  shelves: RackShelf[];
}

export interface StockAlert {
  id: string;
  type: 'LOW_STOCK' | 'EMPTY_STOCK' | 'RACK_FULL' | 'TRANSACTION';
  brand?: MeterBrand;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: 'info' | 'warning' | 'critical';
}
