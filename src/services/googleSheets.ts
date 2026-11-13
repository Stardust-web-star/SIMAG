/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WarehouseRack, InboundCarton, MeterUnit, OutboundRecord, BRAND_CONFIGS, getBrandConfig } from '../types/warehouse';
import { getAccessToken, clearAccessToken } from './googleAuth';

export interface GoogleSheetsSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  updatedAt: string;
}

const DEFAULT_SPREADSHEET_TITLE = 'PLN Gudang - Sistem Stok & Transaksi kWh Meter';
const REQUIRED_SHEETS = [
  'RANGKUMAN_STOK',
  'PENGELUARAN_MATERIAL',
  'PENERIMAAN_KARTON',
  'PETA_LOKASI_RAK',
];

export class GoogleSheetsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSheetsAuthError';
  }
}

async function handleGoogleApiError(res: Response, fallbackPrefix: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const msg = err?.error?.message || res.statusText || 'Unknown error';
  if (res.status === 401) {
    clearAccessToken();
    throw new GoogleSheetsAuthError('Sesi akses Google telah berakhir. Silakan hubungkan kembali akun Google Anda.');
  }
  throw new Error(`${fallbackPrefix}: ${msg}`);
}

/**
 * Searches for an existing spreadsheet with the PLN warehouse title or creates a new one
 */
export async function findOrCreateWarehouseSpreadsheet(): Promise<{ id: string; url: string; title: string }> {
  const token = await getAccessToken();
  if (!token) throw new GoogleSheetsAuthError('Pengguna belum masuk dengan akun Google.');

  // Check Drive API for existing spreadsheet
  const query = encodeURIComponent(`name = '${DEFAULT_SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!searchRes.ok) {
    await handleGoogleApiError(searchRes, 'Gagal mencari Google Sheet');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const file = searchData.files[0];
    return {
      id: file.id,
      url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
      title: file.name
    };
  }

  // Create new Spreadsheet via Sheets API
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: DEFAULT_SPREADSHEET_TITLE,
      },
      sheets: REQUIRED_SHEETS.map(title => ({ properties: { title } }))
    })
  });

  if (!createRes.ok) {
    await handleGoogleApiError(createRes, 'Gagal membuat spreadsheet baru');
  }

  const createdData = await createRes.json();
  return {
    id: createdData.spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${createdData.spreadsheetId}/edit`,
    title: DEFAULT_SPREADSHEET_TITLE
  };
}

/**
 * Ensure all required worksheet tabs exist before writing values
 */
async function ensureWarehouseTabs(spreadsheetId: string, token: string): Promise<void> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!metaRes.ok) {
    await handleGoogleApiError(metaRes, 'Gagal memeriksa struktur tab Google Sheet');
  }

  const metaData = await metaRes.json();
  const existingTitles = new Set<string>(
    (metaData.sheets || []).map((s: any) => s?.properties?.title).filter(Boolean)
  );

  const missingTitles = REQUIRED_SHEETS.filter(title => !existingTitles.has(title));
  if (missingTitles.length === 0) return;

  const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: missingTitles.map(title => ({
        addSheet: { properties: { title } }
      }))
    })
  });

  if (!addRes.ok) {
    await handleGoogleApiError(addRes, 'Gagal menambahkan tab Google Sheet');
  }
}

/**
 * Sync entire inventory and transaction history to Google Sheets
 */
export async function syncWarehouseToGoogleSheets(
  spreadsheetId: string,
  data: {
    racks: WarehouseRack[];
    cartons: InboundCarton[];
    meters: MeterUnit[];
    outbounds: OutboundRecord[];
  }
): Promise<GoogleSheetsSyncResult> {
  const token = await getAccessToken();
  if (!token) throw new GoogleSheetsAuthError('Token akses Google tidak tersedia. Silakan hubungkan akun Google.');

  await ensureWarehouseTabs(spreadsheetId, token);

  // 1. Prepare Summary Data (show brands present in warehouse, canonical order first)
  const presentBrands = new Set<string>([
    ...data.meters.map(m => m.brand).filter(Boolean),
    ...data.cartons.map(c => c.brand).filter(Boolean),
  ]);
  const canonicalOrder = Object.keys(BRAND_CONFIGS);
  const sortedBrands = [
    ...canonicalOrder.filter(b => presentBrands.has(b)),
    ...Array.from(presentBrands).filter(b => !canonicalOrder.includes(b)).sort(),
  ];

  const summaryRows: (string | number)[][] = [
    ['REKAPITULASI STOK MATERIAL KWH METER PLN GUDANG', '', '', '', '', '', `Diperbarui: ${new Date().toLocaleString('id-ID')}`],
    ['Merek kWh Meter', 'Total Diterima (Pcs)', 'Total Keluar (Pcs)', 'Sisa Stok Tersedia', 'Batas Safety Stock', 'Status Stok', 'Lokasi Rak Utama']
  ];

  if (sortedBrands.length === 0) {
    summaryRows.push(['Belum ada stok material', 0, 0, 0, 0, 'KOSONG', '-']);
  } else {
    sortedBrands.forEach(brand => {
      const totalInbound = data.meters.filter(m => m.brand === brand).length;
      const totalOutbound = data.meters.filter(m => m.brand === brand && m.status === 'DISPATCHED').length;
      const available = data.meters.filter(m => m.brand === brand && m.status === 'AVAILABLE').length;
      const config = getBrandConfig(brand);
      const status = available === 0 ? 'HABIS' : available <= config.minSafetyStock ? 'MENDEKATI MINIMUM (ALERT)' : 'AMAN';
      const primaryRack = data.racks.find(r => r.primaryBrand === brand)?.name || '-';

      summaryRows.push([
        brand,
        totalInbound,
        totalOutbound,
        available,
        config.minSafetyStock,
        status,
        primaryRack
      ]);
    });
  }

  // 2. Prepare Outbound Data (20 columns: A through T)
  const outboundRows: (string | number)[][] = [
    [
      'TANGGAL & WAKTU',
      'JENIS TRANSAKSI',
      'ID PELANGGAN',
      'NO METER BARU',
      'NOMOR AGENDA',
      'NAMA PELANGGAN',
      'TARIF',
      'DAYA (VA)',
      'SN KWH METER',
      'SN MCB',
      'NOMOR SEGEL',
      'KABEL TW (METER)',
      'PETUGAS / YANBUNG',
      'KATEGORI GANTI METER',
      'KETERANGAN GANTI METER',
      'NO METER LAMA',
      'STAND METER LAMA',
      'SEGEL LAMA',
      'MEREK METER',
      'KATEGORI KWH METER'
    ]
  ];

  data.outbounds.forEach(item => {
    outboundRows.push([
      item.tanggal,
      item.jenisTransaksi === 'PB' ? 'PASANG BARU (PB)' : 'GANTI METER (GM)',
      item.idPelanggan,
      item.noMeter,
      item.nomorAgenda,
      item.nama,
      item.tarif,
      item.daya,
      item.snKwhMeter,
      item.snMcb,
      item.segel,
      item.kabelTw,
      item.petugas,
      item.gmKategori === 'METER_GANGGUAN' ? 'Meter Gangguan' : item.gmKategori === 'METER_TUA' ? 'Meter Tua (Peremajaan)' : '-',
      item.gmKeterangan || '-',
      item.noMeterLama || '-',
      item.standMeterLama || '-',
      item.snSegelLama || '-',
      item.meterBrand || '-',
      item.meterCategory || 'kWh Meter Prabayar'
    ]);
  });

  // 3. Prepare Inbound Cartons Data (12 columns: A through L)
  const inboundRows: (string | number)[][] = [
    [
      'TANGGAL MASUK',
      'BARCODE KARTON',
      'MEREK',
      'FASE',
      'KATEGORI',
      'JUMLAH KWH / KARTON (PCS)',
      'RENTANG SERIAL NUMBER',
      'LOKASI RAK',
      'TINGKAT RAK',
      'PETUGAS PENERIMA',
      'CATATAN',
      'DAFTAR SN LENGKAP'
    ]
  ];

  data.cartons.forEach(carton => {
    const snRange = carton.meterSerials.length > 0
      ? `${carton.meterSerials[0]} s/d ${carton.meterSerials[carton.meterSerials.length - 1]}`
      : '-';
    inboundRows.push([
      carton.dateInbound,
      carton.cartonBarcode,
      carton.brand,
      carton.phase,
      carton.category,
      carton.unitsCount,
      snRange,
      carton.rackId,
      `Tingkat ${carton.shelfLevel}`,
      carton.receivedBy,
      carton.notes || '-',
      carton.meterSerials.join(', ') || '-'
    ]);
  });

  // 4. Prepare Rack Map Data (8 columns: A through H)
  const rackRows: (string | number)[][] = [
    ['KODE RAK', 'NAMA RAK', 'ZONA', 'TINGKAT', 'KAPASITAS KARTON', 'KARTON TERISI', 'TOTAL METER TERSIMPAN', 'MEREK UTAMA']
  ];

  data.racks.forEach(rack => {
    rack.shelves.forEach(shelf => {
      const cartonsOnShelf = data.cartons.filter(c => c.rackId === rack.id && c.shelfLevel === shelf.level);
      const totalMeters = cartonsOnShelf.reduce((acc, c) => acc + c.unitsCount, 0);
      rackRows.push([
        rack.id,
        rack.name,
        rack.zone,
        shelf.label,
        shelf.cartonCapacity,
        cartonsOnShelf.length,
        totalMeters,
        rack.primaryBrand
      ]);
    });
  });

  // Clear existing sheet values first so stale rows from previous syncs are completely removed
  const clearRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ranges: REQUIRED_SHEETS
    })
  });

  if (!clearRes.ok) {
    await handleGoogleApiError(clearRes, 'Gagal membersihkan data lama Google Sheet');
  }

  // Write fresh values starting at A1 (RAW keeps leading zeros and long SN strings intact without scientific notation)
  const updatePayload = {
    valueInputOption: 'RAW',
    data: [
      {
        range: 'RANGKUMAN_STOK!A1',
        values: summaryRows
      },
      {
        range: 'PENGELUARAN_MATERIAL!A1',
        values: outboundRows
      },
      {
        range: 'PENERIMAAN_KARTON!A1',
        values: inboundRows
      },
      {
        range: 'PETA_LOKASI_RAK!A1',
        values: rackRows
      }
    ]
  };

  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatePayload)
  });

  if (!updateRes.ok) {
    await handleGoogleApiError(updateRes, 'Gagal memperbarui Google Sheet');
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    updatedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
}
