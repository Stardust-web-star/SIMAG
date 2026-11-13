/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  WarehouseRack, 
  InboundCarton, 
  MeterUnit, 
  OutboundRecord, 
  BRAND_CONFIGS, 
  getBrandConfig,
  MeterBrand 
} from '../types/warehouse';
import { 
  Box, 
  Layers, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Zap
} from 'lucide-react';

interface StatCardsProps {
  racks: WarehouseRack[];
  cartons: InboundCarton[];
  meters: MeterUnit[];
  outbounds: OutboundRecord[];
  onOpenNotifications: () => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  racks,
  cartons,
  meters,
  outbounds,
  onOpenNotifications,
}) => {
  const totalAvailable = meters.filter(m => m.status === 'AVAILABLE').length;
  const availablePrabayar = meters.filter(
    m => m.status === 'AVAILABLE' && !(m.category?.toLowerCase().includes('paska') || m.category?.toLowerCase().includes('pasca'))
  ).length;
  const availablePaskabayar = meters.filter(
    m => m.status === 'AVAILABLE' && (m.category?.toLowerCase().includes('paska') || m.category?.toLowerCase().includes('pasca'))
  ).length;
  const totalCartons = cartons.length;
  const totalOutbound = outbounds.length;

  // Check how many brands are low or empty (only for brands present in warehouse)
  const brands = Array.from(new Set([
    ...(Object.keys(BRAND_CONFIGS) as MeterBrand[]),
    ...meters.map(m => m.brand).filter(Boolean),
  ]));
  const lowStockBrands = brands.filter(b => {
    const brandMeters = meters.filter(m => m.brand === b);
    if (brandMeters.length === 0) return false;
    const available = brandMeters.filter(m => m.status === 'AVAILABLE').length;
    return available <= getBrandConfig(b).minSafetyStock;
  });

  // Calculate total warehouse capacity
  const totalShelfCapacity = racks.reduce(
    (acc, r) => acc + r.shelves.reduce((sAcc, s) => sAcc + s.cartonCapacity, 0),
    0
  );
  const occupancyPercentage = totalShelfCapacity > 0
    ? Math.round((totalCartons / totalShelfCapacity) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
      {/* 1. Total Stok Tersedia */}
      <div className="card-hover-lift bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/90 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg relative overflow-hidden flex flex-col">
        <div className="flex-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              Stok Tersedia di Rak
            </span>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-3xl font-extrabold font-mono text-cyan-600 dark:text-cyan-400 leading-none">
                {totalAvailable}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Unit Meter</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-500/30 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3.5 border-t border-slate-200 dark:border-slate-800/90 pt-2.5 min-h-[38px] flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 whitespace-nowrap" title="kWh Meter Prabayar">
              <span>⚡</span> {availablePrabayar} Pra
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1 whitespace-nowrap" title="kWh Meter Paskabayar">
              <span>🔌</span> {availablePaskabayar} Paska
            </span>
          </div>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px] hidden sm:inline shrink-0">Siap PB/GM</span>
        </div>
      </div>

      {/* 2. Karton / Dus di Rak */}
      <div className="card-hover-lift bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/90 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg relative overflow-hidden flex flex-col">
        <div className="flex-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              Karton Fisik di Rak
            </span>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white leading-none">
                {totalCartons}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">/ {totalShelfCapacity} Dus</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/30 shrink-0">
            <Box className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3.5 border-t border-slate-200 dark:border-slate-800/90 pt-2.5 min-h-[38px] flex flex-col justify-center">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Keterisian Rak Gudang:</span>
            <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{occupancyPercentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                occupancyPercentage > 85 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-cyan-600 dark:bg-cyan-500'
              }`}
              style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Total Pengeluaran Material */}
      <div className="card-hover-lift bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/90 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg relative overflow-hidden flex flex-col">
        <div className="flex-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              Pengeluaran Terdata
            </span>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 leading-none">
                {totalOutbound}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Transaksi</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/30 shrink-0">
            <Send className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3.5 border-t border-slate-200 dark:border-slate-800/90 pt-2.5 min-h-[38px] flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="truncate">Pasang Baru & Ganti Meter</span>
          <span className="font-mono text-amber-700 dark:text-amber-300 shrink-0">
            {outbounds.filter(o => o.jenisTransaksi === 'PB').length} PB • {outbounds.filter(o => o.jenisTransaksi === 'GM').length} GM
          </span>
        </div>
      </div>

      {/* 4. Peringatan Stok Minimum */}
      <div 
        onClick={onOpenNotifications}
        className={`btn-tactile card-hover-lift cursor-pointer rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg relative overflow-hidden flex flex-col border transition-all ${
          lowStockBrands.length > 0
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 hover:bg-amber-100/70 dark:hover:bg-amber-950/30 hover:border-amber-400'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              Batas Stok Minimum
            </span>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className={`text-3xl font-extrabold font-mono leading-none ${lowStockBrands.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {lowStockBrands.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Merek Waspada</span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
            lowStockBrands.length > 0
              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/40 animate-pulse'
              : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
          }`}>
            {lowStockBrands.length > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
        </div>
        <div className="mt-3.5 border-t border-slate-200 dark:border-slate-800/90 pt-2.5 min-h-[38px] flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 truncate">
            {lowStockBrands.length > 0
              ? `${lowStockBrands.slice(0, 2).join(', ')} menipis`
              : 'Semua merek aman'}
          </span>
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline shrink-0">
            Lihat Notif &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};
