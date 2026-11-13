/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  OutboundRecord, 
  InboundCarton, 
  MeterUnit, 
  BRAND_CONFIGS, 
  getBrandConfig,
  MeterBrand 
} from '../types/warehouse';
import { 
  FileSpreadsheet, 
  Printer, 
  Filter, 
  Calendar, 
  Search, 
  Download, 
  FileText, 
  CheckCircle,
  Clock,
  Eye
} from 'lucide-react';

interface ReportDashboardProps {
  outbounds: OutboundRecord[];
  cartons: InboundCarton[];
  meters: MeterUnit[];
  onOpenPrintBast: (record: OutboundRecord) => void;
}

export const ReportDashboard: React.FC<ReportDashboardProps> = ({
  outbounds,
  cartons,
  meters,
  onOpenPrintBast,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PB' | 'GM' | 'GM_GANGGUAN' | 'GM_TUA'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter records (memoized)
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const nowMs = Date.now();
    return outbounds.filter((item) => {
      if (typeFilter === 'PB' && item.jenisTransaksi !== 'PB') return false;
      if (typeFilter === 'GM' && item.jenisTransaksi !== 'GM') return false;
      if (typeFilter === 'GM_GANGGUAN' && (item.jenisTransaksi !== 'GM' || item.gmKategori !== 'METER_GANGGUAN')) return false;
      if (typeFilter === 'GM_TUA' && (item.jenisTransaksi !== 'GM' || item.gmKategori !== 'METER_TUA')) return false;

      if (periodFilter !== 'ALL') {
        const itemDate = new Date(item.tanggal.replace(' ', 'T'));
        const diffDays = (nowMs - itemDate.getTime()) / (1000 * 60 * 60 * 24);

        if (periodFilter === 'TODAY' && diffDays > 1) return false;
        if (periodFilter === 'WEEK' && diffDays > 7) return false;
        if (periodFilter === 'MONTH' && diffDays > 30) return false;
      }

      if (q) {
        return (
          item.idPelanggan.toLowerCase().includes(q) ||
          item.nama.toLowerCase().includes(q) ||
          item.noMeter.toLowerCase().includes(q) ||
          item.snKwhMeter.toLowerCase().includes(q) ||
          item.nomorAgenda.toLowerCase().includes(q) ||
          item.petugas.toLowerCase().includes(q) ||
          (item.noMeterLama && item.noMeterLama.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [outbounds, typeFilter, periodFilter, searchQuery]);

  // Calculate statistics for current filtered view (memoized)
  const { countPb, countGmGangguan, countGmTua, totalKabelTw } = useMemo(() => {
    let pb = 0;
    let gmG = 0;
    let gmT = 0;
    let tw = 0;

    for (const r of filteredRecords) {
      if (r.jenisTransaksi === 'PB') pb += 1;
      else if (r.jenisTransaksi === 'GM') {
        if (r.gmKategori === 'METER_GANGGUAN') gmG += 1;
        else if (r.gmKategori === 'METER_TUA') gmT += 1;
      }
      tw += r.kabelTw || 0;
    }

    return { countPb: pb, countGmGangguan: gmG, countGmTua: gmT, totalKabelTw: tw };
  }, [filteredRecords]);

  // Export to Excel function using XLSX
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // 1. Data Pengeluaran Material
    const exportData = filteredRecords.map((r, i) => ({
      'No': i + 1,
      'Tanggal': r.tanggal,
      'Jenis Transaksi': r.jenisTransaksi === 'PB' ? 'Pasang Baru' : 'Ganti Meter',
      'ID Pelanggan': r.idPelanggan,
      'No Meter Baru': r.noMeter,
      'Nomor Agenda': r.nomorAgenda,
      'Nama Pelanggan': r.nama,
      'Tarif': r.tarif,
      'Daya (VA)': r.daya,
      'SN kWh Meter': r.snKwhMeter,
      'SN MCB': r.snMcb,
      'Nomor Segel': r.segel,
      'Kabel TW (m)': r.kabelTw,
      'Petugas': r.petugas,
      'Kategori GM': r.gmKategori === 'METER_GANGGUAN' ? 'Meter Gangguan' : r.gmKategori === 'METER_TUA' ? 'Meter Tua' : '-',
      'Keterangan GM': r.gmKeterangan || '-',
      'No Meter Lama': r.noMeterLama || '-',
      'Stand Meter Lama': r.standMeterLama || '-',
      'Segel Lama': r.snSegelLama || '-',
      'Merek Meter': r.meterBrand || '-',
      'Kategori kWh Meter': r.meterCategory || 'kWh Meter Prabayar',
    }));

    const worksheetOutbound = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheetOutbound, 'Pengeluaran_Material_PLN');

    // 2. Data Stok Gudang per Merek & Kategori (Prabayar & Paskabayar)
    const brands = Array.from(new Set([
      ...(Object.keys(BRAND_CONFIGS) as MeterBrand[]),
      ...meters.map(m => m.brand).filter(Boolean),
    ]));
    const stockData = brands.map(b => {
      const cfg = getBrandConfig(b);
      const available = meters.filter(m => m.brand === b && m.status === 'AVAILABLE').length;
      const praAvailable = meters.filter(m => m.brand === b && m.status === 'AVAILABLE' && !(m.category?.toLowerCase().includes('paska') || m.category?.toLowerCase().includes('pasca'))).length;
      const pascaAvailable = meters.filter(m => m.brand === b && m.status === 'AVAILABLE' && (m.category?.toLowerCase().includes('paska') || m.category?.toLowerCase().includes('pasca'))).length;
      const dispatched = meters.filter(m => m.brand === b && m.status === 'DISPATCHED').length;
      const total = meters.filter(m => m.brand === b).length;
      return {
        'Merek': b,
        'Tersedia (Pcs)': available,
        'Prabayar (Pcs)': praAvailable,
        'Paskabayar (Pcs)': pascaAvailable,
        'Keluar (Pcs)': dispatched,
        'Total (Pcs)': total,
        'Batas Minimum': cfg.minSafetyStock,
        'Status': available <= cfg.minSafetyStock ? 'Peringatan Stok Rendah' : 'Aman',
      };
    });
    const worksheetStock = XLSX.utils.json_to_sheet(stockData);
    XLSX.utils.book_append_sheet(workbook, worksheetStock, 'Rekap_Stok_Gudang');

    // Download file
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Laporan_Material_Gudang_PLN_${dateStr}.xlsx`);
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 card-hover-lift shadow-sm dark:shadow-none">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
            Pasang Baru (PB)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400">{countPb}</span>
            <span className="text-xs text-slate-500">transaksi</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Pemasangan pelanggan baru</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 card-hover-lift shadow-sm dark:shadow-none">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
            Ganti Meter Gangguan
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{countGmGangguan}</span>
            <span className="text-xs text-slate-500">transaksi</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Error periksa / rusak</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 card-hover-lift shadow-sm dark:shadow-none">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
            Ganti Meter Tua
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{countGmTua}</span>
            <span className="text-xs text-slate-500">transaksi</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Peremajaan & re-tera</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 card-hover-lift shadow-sm dark:shadow-none">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
            Kabel Twist Terpakai
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalKabelTw}</span>
            <span className="text-xs text-slate-500">meter</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Panjang TIC/TW terdistribusi</span>
        </div>
      </div>

      {/* Filter and Action Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-xs dark:shadow-none">
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari IDPEL, Nama, SN Meter, Agenda, atau Petugas..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Period Filter */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Waktu</option>
            <option value="TODAY">Hari Ini (24 Jam)</option>
            <option value="WEEK">7 Hari Terakhir</option>
            <option value="MONTH">30 Hari Terakhir</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Jenis Transaksi</option>
            <option value="PB">Pasang Baru (PB)</option>
            <option value="GM">Semua Ganti Meter (GM)</option>
            <option value="GM_GANGGUAN">Ganti Meter - Gangguan</option>
            <option value="GM_TUA">Ganti Meter - Meter Tua</option>
          </select>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="btn-tactile px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Ekspor Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Outbound Records Table */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">No.</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Transaksi</th>
                <th className="py-3 px-3">ID PEL & Agenda</th>
                <th className="py-3 px-3">Pelanggan</th>
                <th className="py-3 px-3">Tarif / Daya</th>
                <th className="py-3 px-3">SN Meter Baru</th>
                <th className="py-3 px-3">SN MCB & Segel</th>
                <th className="py-3 px-3">Kabel TW</th>
                <th className="py-3 px-3">Keterangan GM</th>
                <th className="py-3 px-3">Petugas</th>
                <th className="py-3 px-3 text-right">BAST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-sans">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-500">
                    Tidak ada catatan pengeluaran material pada periode / filter ini.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, index) => {
                  const isGm = item.jenisTransaksi === 'GM';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 font-mono">
                        {index + 1}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {item.tanggal}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.jenisTransaksi === 'PB' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/40">
                            Pasang Baru
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.gmKategori === 'METER_GANGGUAN'
                              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/40'
                              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/40'
                          }`}>
                            GM ({item.gmKategori === 'METER_GANGGUAN' ? 'Gangguan' : 'Meter Tua'})
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono">
                        <div className="font-bold text-slate-900 dark:text-white">{item.idPelanggan}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Agd: {item.nomorAgenda}</div>
                      </td>

                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {item.nama}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                        <span className="text-cyan-700 dark:text-cyan-400 font-bold">{item.tarif}</span> / {item.daya} VA
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <div>{item.snKwhMeter}</div>
                        {item.meterBrand && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{item.meterBrand}</div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div>MCB: {item.snMcb}</div>
                        <div>SGL: {item.segel}</div>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {item.kabelTw} m
                      </td>

                      <td className="py-2.5 px-3 max-w-[180px]">
                        {isGm ? (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
                            <span className="block font-semibold">Lama: {item.noMeterLama || '-'}</span>
                            <span className="text-slate-600 dark:text-slate-400 text-[10px]">{item.gmKeterangan}</span>
                            {item.standMeterLama && (
                              <span className="block text-[10px] text-slate-500">Std: {item.standMeterLama} kWh</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                        {item.petugas}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onOpenPrintBast(item)}
                          className="btn-tactile px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ml-auto border border-slate-300 dark:border-slate-700 cursor-pointer"
                          title="Cetak Berita Acara Serah Terima (BAST)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>BAST</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
