/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  MeterUnit, 
  MeterBrand, 
  getBrandConfig,
  InboundCarton 
} from '../types/warehouse';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Copy, 
  Check, 
  Layers, 
  Box,
  Sliders,
  ExternalLink
} from 'lucide-react';

interface StockListTabProps {
  meters: MeterUnit[];
  cartons: InboundCarton[];
  onSelectForOutbound: (serialNumber: string) => void;
  onLocateInRack: (serialNumber: string) => void;
}

export const StockListTab: React.FC<StockListTabProps> = ({
  meters,
  cartons,
  onSelectForOutbound,
  onLocateInRack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('AVAILABLE');
  const [copiedSn, setCopiedSn] = useState<string | null>(null);

  const handleCopy = (sn: string) => {
    navigator.clipboard.writeText(sn);
    setCopiedSn(sn);
    setTimeout(() => setCopiedSn(null), 2000);
  };

  const { prabayarCount, paskabayarCount, brandStockCounts, brandsWithStock, existingBrands } = useMemo(() => {
    let pra = 0;
    let paska = 0;
    const counts = new Map<MeterBrand, number>();
    const allSeenLower = new Set<string>();
    const allPresentBrands: MeterBrand[] = [];

    for (const m of meters) {
      const b = m.brand?.trim();
      if (b) {
        const lower = b.toLowerCase();
        if (!allSeenLower.has(lower)) {
          allSeenLower.add(lower);
          allPresentBrands.push(b);
        }
      }

      if (m.status === 'AVAILABLE') {
        const isPaska = m.category?.toLowerCase().includes('paska') || m.category?.toLowerCase().includes('pasca');
        if (isPaska) paska += 1;
        else pra += 1;

        if (b) {
          counts.set(b, (counts.get(b) || 0) + 1);
        }
      }
    }

    const availableBrands = Array.from(counts.keys()).filter(
      brand => (counts.get(brand) || 0) > 0
    );

    return {
      prabayarCount: pra,
      paskabayarCount: paska,
      brandStockCounts: counts,
      brandsWithStock: availableBrands,
      existingBrands: allPresentBrands,
    };
  }, [meters]);

  useEffect(() => {
    if (
      filterBrand !== 'ALL' &&
      !existingBrands.some(b => b.toLowerCase() === filterBrand.toLowerCase())
    ) {
      setFilterBrand('ALL');
    }
  }, [existingBrands, filterBrand]);

  const filteredMeters = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return meters.filter(m => {
      if (filterBrand !== 'ALL' && m.brand.trim().toLowerCase() !== filterBrand.toLowerCase()) return false;
      if (filterStatus !== 'ALL' && m.status !== filterStatus) return false;
      if (filterCategory !== 'ALL') {
        const isPaska = m.category?.toLowerCase().includes('paska') || m.category?.toLowerCase().includes('pasca');
        if (filterCategory === 'PRABAYAR' && isPaska) return false;
        if (filterCategory === 'PASKABAYAR' && !isPaska) return false;
      }
      if (q) {
        return (
          m.serialNumber.toLowerCase().includes(q) ||
          m.cartonBarcode.toLowerCase().includes(q) ||
          m.rackId.toLowerCase().includes(q) ||
          (m.category && m.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [meters, filterBrand, filterStatus, filterCategory, searchTerm]);

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Brand Stock Summary Cards: only appears when there is meter stock, hidden when stock is empty */}
      {brandsWithStock.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {brandsWithStock.map(brand => {
            const cfg = getBrandConfig(brand);
            const availableCount = brandStockCounts.get(brand) || 0;
            const isLow = availableCount <= cfg.minSafetyStock;

            return (
              <div
                key={brand}
                onClick={() => setFilterBrand(filterBrand === brand ? 'ALL' : brand)}
                className={`flex-1 min-w-[130px] max-w-full sm:max-w-[240px] cursor-pointer rounded-xl p-2.5 border transition-all text-left btn-tactile card-hover-lift ${
                  filterBrand === brand
                    ? 'bg-cyan-50 dark:bg-slate-800 border-cyan-500 dark:border-cyan-400 shadow-sm dark:shadow-lg dark:shadow-cyan-500/10 ring-1 ring-cyan-500/30 dark:ring-cyan-500/40'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate" title={brand}>
                    {brand}
                  </span>
                  {isLow ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping" title="Stok Menipis" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Stok Aman" />
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-bold font-mono ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                    {availableCount}
                  </span>
                  <span className="text-[10px] text-slate-500">pcs</span>
                </div>

                <div className="text-[9px] text-slate-500 mt-1 flex justify-between">
                  <span>Min: {cfg.minSafetyStock}</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">{cfg.defaultUnitsPerCarton}/dus</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs dark:shadow-none">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari SN kWh Meter, Barcode Dus, atau Rak..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Merek</option>
            {existingBrands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 font-medium"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="PRABAYAR">⚡ kWh Meter Prabayar ({prabayarCount})</option>
            <option value="PASKABAYAR">🔌 kWh Meter Paskabayar ({paskabayarCount})</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="AVAILABLE">Tersedia di Rak</option>
            <option value="DISPATCHED">Sudah Keluar</option>
          </select>

          <span className="text-xs text-slate-600 dark:text-slate-400 font-mono shrink-0 pl-1">
            Total: {filteredMeters.length} unit
          </span>
        </div>
      </div>

      {/* Meter Stock Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">No.</th>
                <th className="py-3 px-4">Serial Number (SN)</th>
                <th className="py-3 px-4">Merek</th>
                <th className="py-3 px-4">Fase & Kategori kWh Meter</th>
                <th className="py-3 px-4">Barcode Karton</th>
                <th className="py-3 px-4">Lokasi Rak</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-sans">
              {filteredMeters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    Tidak ditemukan data kWh meter yang cocok.
                  </td>
                </tr>
              ) : (
                filteredMeters.map((meter, index) => {
                  const cfg = getBrandConfig(meter.brand);
                  const isAvailable = meter.status === 'AVAILABLE';
                  const isPaska = meter.category?.toLowerCase().includes('paska') || meter.category?.toLowerCase().includes('pasca');

                  return (
                    <tr 
                      key={meter.serialNumber} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-slate-500 font-mono">
                        {index + 1}
                      </td>

                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{meter.serialNumber}</span>
                        <button
                          onClick={() => handleCopy(meter.serialNumber)}
                          className="btn-tactile text-slate-400 dark:text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 p-1 rounded cursor-pointer transition-colors"
                          title="Salin Nomor Seri"
                        >
                          {copiedSn === meter.serialNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badgeBg} ${cfg.badgeText}`}>
                          {meter.brand}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{meter.phase}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                            isPaska
                              ? 'bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300'
                              : 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                          }`}>
                            {isPaska ? (
                              <>
                                <span>🔌</span>
                                <span>kWh Meter Paskabayar</span>
                              </>
                            ) : (
                              <>
                                <span>⚡</span>
                                <span>kWh Meter Prabayar</span>
                              </>
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        {meter.cartonBarcode}
                      </td>

                      <td className="py-2.5 px-4">
                        <button
                          onClick={() => onLocateInRack(meter.serialNumber)}
                          className="btn-tactile px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded text-cyan-700 dark:text-cyan-400 font-mono text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Lihat posisi di Visualisasi Rak"
                        >
                          <Layers className="w-3 h-3" />
                          {meter.rackId} / Tk {meter.shelfLevel}
                        </button>
                      </td>

                      <td className="py-2.5 px-4">
                        {isAvailable ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40">
                            Tersedia
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Keluar ({meter.dispatchId})
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {isAvailable ? (
                          <button
                            onClick={() => onSelectForOutbound(meter.serialNumber)}
                            className="btn-tactile px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto shadow-sm transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            Keluarkan
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">Dispatched</span>
                        )}
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
