/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  WarehouseRack, 
  InboundCarton, 
  MeterUnit, 
  getBrandConfig,
  MeterBrand 
} from '../types/warehouse';
import { 
  Layers, 
  Box, 
  Search, 
  Info, 
  ChevronRight, 
  ArrowRightLeft, 
  Check, 
  Sparkles,
  MapPin,
  Maximize2,
  Pencil,
  X,
  Sliders,
  Settings,
  Palette,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const BRAND_COLOR_PALETTE = [
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink Rose', hex: '#ec4899' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Crimson', hex: '#e11d48' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Lime', hex: '#65a30d' },
  { name: 'Slate', hex: '#64748b' },
];

interface RackVisualizerProps {
  racks: WarehouseRack[];
  cartons: InboundCarton[];
  meters: MeterUnit[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMoveCarton: (cartonId: string, targetRackId: string, targetLevel: number) => void;
  onSelectCartonForOutbound?: (serialNumber: string) => void;
  onUpdateRack?: (updatedRack: WarehouseRack) => void;
  onOpenInboundForSlot?: (rackId: string, level: number, slotNumber: number) => void;
  onAddUnitsToCarton?: (cartonId: string, newUnits: MeterUnit[]) => void;
  onUpdateCartonBrand?: (cartonId: string, newBrand: MeterBrand) => void;
}

export const RackVisualizer: React.FC<RackVisualizerProps> = ({
  racks,
  cartons,
  meters,
  searchQuery,
  onSearchChange,
  onMoveCarton,
  onSelectCartonForOutbound,
  onUpdateRack,
  onOpenInboundForSlot,
  onAddUnitsToCarton,
  onUpdateCartonBrand,
}) => {
  const [selectedShelf, setSelectedShelf] = useState<{ rackId: string; level: number } | null>({
    rackId: 'RAK-A',
    level: 1,
  });
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');
  const [moveModalCartonId, setMoveModalCartonId] = useState<string | null>(null);
  const [targetMoveRack, setTargetMoveRack] = useState<string>('RAK-A');
  const [targetMoveLevel, setTargetMoveLevel] = useState<number>(1);

  // Inspect & top-up existing carton modal state
  const [inspectCartonId, setInspectCartonId] = useState<string | null>(null);
  const [inspectSlotNumber, setInspectSlotNumber] = useState<number | null>(null);
  const [editCartonBrand, setEditCartonBrand] = useState<string>('');
  const [addStartSn, setAddStartSn] = useState<string>('');
  const [addUnitsCount, setAddUnitsCount] = useState<number>(1);
  const [addSerials, setAddSerials] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);

  // Rack renaming & color customization states
  const [editModalRack, setEditModalRack] = useState<WarehouseRack | null>(null);
  const [editingRackId, setEditingRackId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editZone, setEditZone] = useState<string>('');
  const [editBrand, setEditBrand] = useState<string>('Melcoinda');
  const [editBrandColor, setEditBrandColor] = useState<string>('#0284c7');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Close RackVisualizer modals cleanly on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (inspectCartonId) setInspectCartonId(null);
      else if (moveModalCartonId) setMoveModalCartonId(null);
      else if (editModalRack) setEditModalRack(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectCartonId, moveModalCartonId, editModalRack]);

  const recomputeAddSerials = (baseSn: string, count: number) => {
    if (!baseSn.trim() || count <= 0) {
      setAddSerials([]);
      return;
    }
    const clean = baseSn.trim();
    const match = clean.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const startNum = BigInt(numStr);
      const len = numStr.length;
      const list: string[] = [];
      for (let i = 0; i < count; i++) {
        const nextNum = (startNum + BigInt(i)).toString().padStart(len, '0');
        list.push(`${prefix}${nextNum}`);
      }
      setAddSerials(list);
    } else {
      const list = Array.from({ length: count }).map((_, i) => `${clean}-${i + 1}`);
      setAddSerials(list);
    }
  };

  const getNextSerialSuggestion = (lastSn?: string): string => {
    if (!lastSn) return '';
    const match = lastSn.trim().match(/^(.*?)(\d+)$/);
    if (!match) return '';
    const prefix = match[1];
    const numStr = match[2];
    const nextNum = (BigInt(numStr) + BigInt(1)).toString().padStart(numStr.length, '0');
    return `${prefix}${nextNum}`;
  };

  const handleOpenInspectCarton = (carton: InboundCarton, slotNum?: number) => {
    const remaining = Math.max(0, 10 - carton.unitsCount);
    const defaultAddQty = remaining > 0 ? remaining : 1;
    setInspectCartonId(carton.id);
    setInspectSlotNumber(slotNum ?? null);
    setEditCartonBrand(carton.brand || '');
    setAddUnitsCount(defaultAddQty);
    setAddStartSn('');
    setAddSerials([]);
    setAddError(null);
  };

  const handleStartInlineEdit = (rack: WarehouseRack) => {
    setEditingRackId(rack.id);
    setEditName(rack.name);
  };

  const handleSaveInlineEdit = (rack: WarehouseRack) => {
    if (editName.trim() && onUpdateRack) {
      const newName = editName.trim();
      onUpdateRack({
        ...rack,
        name: newName,
      });
      setToastMessage(`Nama rak ${rack.id} berhasil diubah menjadi: "${newName}"`);
      setTimeout(() => setToastMessage(null), 4000);
    }
    setEditingRackId(null);
  };

  const handleOpenEditModal = (rack: WarehouseRack) => {
    setEditModalRack(rack);
    setEditName(rack.name);
    setEditZone(rack.zone);
    setEditBrand(rack.primaryBrand || 'Melcoinda');
    const defaultColor = rack.brandColor || getBrandConfig(rack.primaryBrand).color;
    setEditBrandColor(defaultColor);
  };

  const handleSaveModalEdit = () => {
    if (editModalRack && editName.trim() && onUpdateRack) {
      const newName = editName.trim();
      const newBrand = editBrand.trim() || editModalRack.primaryBrand;
      onUpdateRack({
        ...editModalRack,
        name: newName,
        zone: editZone.trim() || editModalRack.zone,
        primaryBrand: newBrand,
        brandColor: editBrandColor,
      });
      setToastMessage(`Pengaturan rak ${editModalRack.id} berhasil disimpan: "${newName}" (Dedikasi: ${newBrand})`);
      setTimeout(() => setToastMessage(null), 4000);
    }
    setEditModalRack(null);
  };

  // Precompute lookup maps for fast O(1) shelf/carton/meter rendering
  const { cartonsByShelf, metersByCarton, meterBySerial, rackUnitTotals } = useMemo(() => {
    const cByShelf = new Map<string, InboundCarton[]>();
    const rUnitTotals = new Map<string, number>();

    for (const c of cartons) {
      const key = `${c.rackId}::${c.shelfLevel}`;
      const list = cByShelf.get(key);
      if (list) list.push(c);
      else cByShelf.set(key, [c]);

      rUnitTotals.set(c.rackId, (rUnitTotals.get(c.rackId) || 0) + c.unitsCount);
    }

    const mByCarton = new Map<string, MeterUnit[]>();
    const mBySerial = new Map<string, MeterUnit>();
    for (const m of meters) {
      mBySerial.set(m.serialNumber, m);
      const list = mByCarton.get(m.cartonBarcode);
      if (list) list.push(m);
      else mByCarton.set(m.cartonBarcode, [m]);
    }

    return {
      cartonsByShelf: cByShelf,
      metersByCarton: mByCarton,
      meterBySerial: mBySerial,
      rackUnitTotals: rUnitTotals,
    };
  }, [cartons, meters]);

  // Available brands in Filter Merek: only brands that actually exist in racks or cartons
  const availableBrandFilters = useMemo(() => {
    const seenLower = new Set<string>();
    const list: string[] = [];
    const addBrand = (raw?: string) => {
      const b = raw?.trim();
      if (!b) return;
      const lower = b.toLowerCase();
      if (seenLower.has(lower)) return;
      seenLower.add(lower);
      list.push(b);
    };
    racks.forEach(r => addBrand(r.primaryBrand));
    cartons.forEach(c => addBrand(c.brand));
    return list;
  }, [racks, cartons]);

  // Reset selected filter to ALL if that brand no longer exists
  useEffect(() => {
    if (
      selectedBrandFilter !== 'ALL' &&
      !availableBrandFilters.some(b => b.toLowerCase() === selectedBrandFilter.toLowerCase())
    ) {
      setSelectedBrandFilter('ALL');
    }
  }, [availableBrandFilters, selectedBrandFilter]);

  // Filter racks
  const filteredRacks = useMemo(() => {
    if (selectedBrandFilter === 'ALL') return racks;
    const target = selectedBrandFilter.toLowerCase();
    return racks.filter(r =>
      r.primaryBrand?.trim().toLowerCase() === target ||
      cartons.some(c => c.rackId === r.id && c.brand?.trim().toLowerCase() === target)
    );
  }, [racks, cartons, selectedBrandFilter]);

  // Calculate shelf stats in O(1)
  const getShelfCartons = (rackId: string, level: number) => {
    return cartonsByShelf.get(`${rackId}::${level}`) || [];
  };

  const getShelfMeters = (rackId: string, level: number) => {
    const shelfCartons = getShelfCartons(rackId, level);
    const result: MeterUnit[] = [];
    for (const c of shelfCartons) {
      const cMeters = metersByCarton.get(c.cartonBarcode);
      if (cMeters) {
        for (const m of cMeters) {
          if (m.rackId === rackId && m.shelfLevel === level) {
            result.push(m);
          }
        }
      }
    }
    return result;
  };

  // Determine if shelf matches search query
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const doesShelfMatchSearch = (rackId: string, level: number): boolean => {
    if (!normalizedQuery) return false;
    const shelfCartons = getShelfCartons(rackId, level);
    if (shelfCartons.some(c =>
      c.cartonBarcode.toLowerCase().includes(normalizedQuery) ||
      c.id.toLowerCase().includes(normalizedQuery) ||
      (c.category && c.category.toLowerCase().includes(normalizedQuery))
    )) {
      return true;
    }
    const shelfMeters = getShelfMeters(rackId, level);
    return shelfMeters.some(m =>
      m.serialNumber.toLowerCase().includes(normalizedQuery) ||
      (m.category && m.category.toLowerCase().includes(normalizedQuery))
    );
  };

  const activeShelfData = useMemo(() => {
    if (!selectedShelf) return null;
    const rack = racks.find(r => r.id === selectedShelf.rackId);
    const shelf = rack?.shelves.find(s => s.level === selectedShelf.level);
    return {
      rack,
      shelf,
      cartons: getShelfCartons(selectedShelf.rackId, selectedShelf.level),
      meters: getShelfMeters(selectedShelf.rackId, selectedShelf.level),
    };
  }, [selectedShelf, racks, cartonsByShelf, metersByCarton]);

  const inspectedCarton = useMemo(() => {
    if (!inspectCartonId) return null;
    return cartons.find(c => c.id === inspectCartonId) || null;
  }, [inspectCartonId, cartons]);

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs dark:shadow-none">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Search serial or carton */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari SN kWh Meter / Barcode Karton untuk lacak rak..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Brand Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 shrink-0 hidden sm:inline">Filter Merek:</span>
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Semua Dedikasi Rak</option>
              {availableBrandFilters.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Tersedia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Penuh (&gt;80%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 ring-2 ring-cyan-500/30 dark:ring-cyan-400/30"></span>
            <span>Hasil Lacak</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Racks + Selected Shelf Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Racks Layout (Visual Warehouse Elevation) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRacks.map((rack) => {
              const brandCfg = getBrandConfig(rack.primaryBrand);
              const rackColor = rack.brandColor || brandCfg.color;

              return (
                <div 
                  key={rack.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-lg flex flex-col justify-between relative overflow-hidden card-hover-lift"
                  style={{
                    borderTop: `3px solid ${rackColor}`,
                  }}
                >
                  {/* Rack Header with Editable Name */}
                  <div className="mb-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                    {editingRackId === rack.id ? (
                      /* Active Inline Editing Box */
                      <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border-2 border-cyan-500 shadow-xl space-y-2.5 animate-scale-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                            <Pencil className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                            Ketik Nama Baru untuk <span className="font-mono text-slate-900 dark:text-white underline">{rack.id}</span>:
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">Enter = Simpan • Esc = Batal</span>
                        </div>

                        {/* Input Row - Full Width */}
                        <div className="relative">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineEdit(rack);
                              if (e.key === 'Escape') setEditingRackId(null);
                            }}
                            placeholder={`Ketik nama baru untuk ${rack.id}...`}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white text-xs sm:text-sm font-bold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 font-sans"
                            autoFocus
                          />
                          {editName && (
                            <button
                              type="button"
                              onClick={() => setEditName('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-white p-1"
                              title="Hapus teks"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Action Buttons Row - Neat and never cropped */}
                        <div className="flex items-center justify-end gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setEditingRackId(null)}
                            className="btn-tactile px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-300 dark:border-slate-700 shrink-0"
                            title="Batal edit nama"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Batal</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveInlineEdit(rack)}
                            className="btn-tactile px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-900/20 dark:shadow-emerald-950 cursor-pointer shrink-0"
                            title="Simpan Nama Baru"
                          >
                            <Check className="w-4 h-4" />
                            <span>Simpan</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Header View */
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-mono text-xs font-bold shrink-0">
                              {rack.id}
                            </span>

                            <h4
                              onClick={() => handleStartInlineEdit(rack)}
                              className="font-bold text-slate-900 dark:text-white text-sm hover:text-cyan-600 dark:hover:text-cyan-300 cursor-pointer transition-colors truncate max-w-[200px] sm:max-w-[280px]"
                              title="Klik teks untuk langsung ketik nama baru"
                            >
                              {rack.name}
                            </h4>

                            {/* Explicit Ubah Nama Button */}
                            <button
                              onClick={() => handleStartInlineEdit(rack)}
                              className="btn-tactile px-2 py-0.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/80 dark:hover:bg-cyan-900 border border-cyan-300 dark:border-cyan-500/40 hover:border-cyan-500 dark:hover:border-cyan-400 text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-200 text-[11px] font-semibold flex items-center gap-1 transition-all shadow-xs cursor-pointer shrink-0"
                              title="Ketik sendiri nama baru untuk rak ini"
                            >
                              <Pencil className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                              <span>Ubah Nama</span>
                            </button>

                            {/* Settings / Detail Modal Button */}
                            <button
                              onClick={() => handleOpenEditModal(rack)}
                              className="btn-tactile p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent transition-colors cursor-pointer shrink-0"
                              title="Pengaturan detail zona, dedikasi merek & warna"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span>{rack.zone}</span>
                            <span>•</span>
                            <span>Dedikasi: {rack.primaryBrand}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => handleOpenEditModal(rack)}
                          title="Klik untuk ubah merek dedikasi & warna rak"
                          style={{
                            backgroundColor: `${rackColor}20`,
                            borderColor: `${rackColor}60`,
                            color: rackColor,
                          }}
                          className="btn-tactile px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 hover:ring-2 hover:ring-slate-400/30 dark:hover:ring-white/20 transition-all cursor-pointer shadow-xs"
                        >
                          {rack.primaryBrand}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Physical Shelves (Levels 4, 3, 2, 1 stacked vertically) */}
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-950/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/70">
                    {/* Render from top to bottom: Level 1 (Atas) down to Level 4 (Bawah) */}
                    {[...rack.shelves].sort((a, b) => a.level - b.level).map((shelf) => {
                      const shelfCartons = getShelfCartons(rack.id, shelf.level);
                      const isSelected = selectedShelf?.rackId === rack.id && selectedShelf?.level === shelf.level;
                      const isSearchMatch = doesShelfMatchSearch(rack.id, shelf.level);
                      const occupancyPct = Math.round((shelfCartons.length / shelf.cartonCapacity) * 100);
                      const isFull = occupancyPct >= 100;
                      const isHigh = occupancyPct >= 80;

                      return (
                        <div
                          key={shelf.level}
                          onClick={() => setSelectedShelf({ rackId: rack.id, level: shelf.level })}
                          className={`cursor-pointer rounded-lg p-2.5 transition-colors duration-150 border relative ${
                            isSelected
                              ? 'bg-cyan-50/90 dark:bg-cyan-950/50 border-cyan-500 dark:border-cyan-400 ring-2 ring-cyan-500/25 dark:ring-cyan-500/30 shadow-sm dark:shadow-md dark:shadow-cyan-950/40'
                              : isSearchMatch
                              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 dark:border-amber-400 ring-2 ring-amber-400/30 animate-pulse'
                              : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              Tingkat {shelf.level} ({shelf.level === 1 ? 'Atas' : shelf.level === 4 ? 'Bawah' : 'Tengah'})
                            </span>
                            <span className={`text-[11px] font-mono ${isFull ? 'text-rose-600 dark:text-rose-400 font-bold' : isHigh ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                              {shelfCartons.length}/{shelf.cartonCapacity} Dus
                            </span>
                          </div>

                          {/* Visual carton slots (16 dus per tingkat - setiap dus bisa diklik untuk diisi/dikelola) */}
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 sm:gap-1.5 my-1">
                            {Array.from({ length: shelf.cartonCapacity }).map((_, slotIdx) => {
                              const carton = shelfCartons[slotIdx];
                              if (carton) {
                                const cBrandCfg = getBrandConfig(carton.brand);
                                const canTopUp = carton.unitsCount < 10;
                                return (
                                  <button
                                    key={slotIdx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedShelf({ rackId: rack.id, level: shelf.level });
                                      handleOpenInspectCarton(carton, slotIdx + 1);
                                    }}
                                    title={
                                      canTopUp
                                        ? `Dus #${slotIdx + 1}: ${carton.cartonBarcode} (${carton.unitsCount}/10 pcs) - Klik untuk isi / detail dus`
                                        : `Dus #${slotIdx + 1}: ${carton.cartonBarcode} (${carton.brand} - ${carton.unitsCount} pcs) - Klik untuk lihat isi dus`
                                    }
                                    className="btn-tactile h-8 rounded-md flex flex-col items-center justify-center text-[8px] sm:text-[9px] font-mono border shadow-sm transition-all hover:brightness-110 hover:ring-2 hover:ring-cyan-500/70 dark:hover:ring-cyan-400/70 cursor-pointer relative"
                                    style={{
                                      backgroundColor: `${cBrandCfg.color}25`,
                                      borderColor: `${cBrandCfg.color}70`,
                                      color: cBrandCfg.color,
                                    }}
                                  >
                                    <Box className="w-3 h-3" />
                                    <span className="font-bold leading-none mt-0.5">{carton.unitsCount}p</span>
                                    {canTopUp && (
                                      <span
                                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold text-[8px] flex items-center justify-center shadow"
                                        title="Masih bisa ditambah isi meter"
                                      >
                                        +
                                      </span>
                                    )}
                                  </button>
                                );
                              } else {
                                return (
                                  <button
                                    key={slotIdx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedShelf({ rackId: rack.id, level: shelf.level });
                                      onOpenInboundForSlot?.(rack.id, shelf.level, slotIdx + 1);
                                    }}
                                    className="btn-tactile group h-8 rounded-md border border-dashed border-slate-300 dark:border-slate-700/80 bg-slate-100/70 dark:bg-slate-950/50 hover:border-cyan-500 dark:hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/35 hover:text-cyan-700 dark:hover:text-cyan-300 flex flex-col items-center justify-center text-[8px] sm:text-[9px] text-slate-500 font-mono cursor-pointer transition-colors"
                                    title={`Klik untuk mengisi Slot Dus #${slotIdx + 1} (${rack.id} • Tingkat ${shelf.level})`}
                                  >
                                    <Plus className="w-2.5 h-2.5 opacity-55 group-hover:opacity-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-opacity" />
                                    <span className="leading-none">Kosong</span>
                                  </button>
                                );
                              }
                            })}
                          </div>

                          {/* Occupancy Progress Bar */}
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isFull ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                            />
                          </div>

                          {isSearchMatch && (
                            <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 font-bold text-[9px] px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              DITEMUKAN
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick Rack Summary */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                    <span>Total Muatan:</span>
                    <span className="font-mono text-cyan-700 dark:text-cyan-400 font-semibold">
                      {rackUnitTotals.get(rack.id) || 0} Pcs Unit
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Shelf Inspector (Right Sidebar) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-xl sticky top-4">
            {activeShelfData?.shelf ? (
              <div key={`${selectedShelf?.rackId}-${selectedShelf?.level}`} className="space-y-4 animate-fade-in">
                {/* Inspector Header */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 uppercase tracking-wider font-semibold">
                      Detail Lokasi Fisik Rak
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 break-words">
                      {activeShelfData.rack?.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tingkat {activeShelfData.shelf.level} • {activeShelfData.shelf.label}
                      </p>
                      {activeShelfData.rack && (
                        <span 
                          style={{
                            backgroundColor: `${activeShelfData.rack.brandColor || getBrandConfig(activeShelfData.rack.primaryBrand).color}20`,
                            borderColor: `${activeShelfData.rack.brandColor || getBrandConfig(activeShelfData.rack.primaryBrand).color}60`,
                            color: activeShelfData.rack.brandColor || getBrandConfig(activeShelfData.rack.primaryBrand).color,
                          }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        >
                          {activeShelfData.rack.primaryBrand}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Kapasitas Dus:</span>
                    <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                      {activeShelfData.cartons.length} / {activeShelfData.shelf.cartonCapacity}
                    </p>
                  </div>
                </div>

                {/* Carton List in Shelf */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Karton di Tingkat Ini:
                    </h4>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-normal shrink-0">
                      {activeShelfData.meters.filter(m => m.status === 'AVAILABLE').length} Unit Siap Pakai
                    </span>
                  </div>

                  {activeShelfData.cartons.length > 0 &&
                    activeShelfData.cartons.length < activeShelfData.shelf.cartonCapacity &&
                    activeShelfData.rack && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenInboundForSlot?.(
                            activeShelfData.rack!.id,
                            activeShelfData.shelf!.level,
                            activeShelfData.cartons.length + 1
                          )
                        }
                        className="btn-tactile w-full mb-3 py-2 px-3 rounded-xl border border-dashed border-cyan-500/60 dark:border-cyan-500/50 bg-cyan-50 dark:bg-cyan-950/30 hover:bg-cyan-100/80 dark:hover:bg-cyan-950/60 hover:border-cyan-600 dark:hover:border-cyan-400 text-cyan-800 dark:text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Isi Slot Dus Kosong (#{activeShelfData.cartons.length + 1})</span>
                      </button>
                    )}

                  {activeShelfData.cartons.length === 0 ? (
                    <div className="py-7 text-center bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800/80 px-4">
                      <Box className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-600 dark:text-slate-400">Tingkat rak ini masih kosong.</p>
                      <p className="text-[11px] text-slate-500 mt-1 mb-3">
                        Klik salah satu kotak "Kosong" pada rak atau tombol di bawah untuk langsung mengisi dus.
                      </p>
                      {activeShelfData.rack && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenInboundForSlot?.(
                              activeShelfData.rack!.id,
                              activeShelfData.shelf!.level,
                              1
                            )
                          }
                          className="btn-tactile px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-md shadow-cyan-900/20 dark:shadow-cyan-950/60 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Isi Dus di Tingkat Ini</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto overflow-x-hidden pr-1">
                      {activeShelfData.cartons.map((carton, cIdx) => {
                        const brandCfg = getBrandConfig(carton.brand);
                        const availableUnits = carton.meterSerials.filter(sn =>
                          meterBySerial.get(sn)?.status === 'AVAILABLE'
                        );

                        return (
                          <div 
                            key={carton.id} 
                            className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-2.5 overflow-hidden"
                          >
                            {/* Top Row: Slot & Brand on left, Action buttons neatly pinned right */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded shrink-0">
                                  Dus #{cIdx + 1}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border truncate max-w-[140px] ${brandCfg.badgeBg} ${brandCfg.badgeText}`}>
                                  {carton.brand}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenInspectCarton(carton, cIdx + 1)}
                                  title={carton.unitsCount < 10 ? 'Tambah / Isi kWh Meter ke Dus' : 'Lihat detail isi dus'}
                                  className={`btn-tactile px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                                    carton.unitsCount < 10
                                      ? 'bg-cyan-50 dark:bg-cyan-600/20 hover:bg-cyan-100 dark:hover:bg-cyan-600/35 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40'
                                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                                  }`}
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>{carton.unitsCount < 10 ? 'Isi' : 'Detail'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMoveModalCartonId(carton.id);
                                    setTargetMoveRack(carton.rackId);
                                    setTargetMoveLevel(carton.shelfLevel);
                                  }}
                                  title="Pindah ke rak / tingkat lain"
                                  className="btn-tactile p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-400 border border-slate-300 dark:border-slate-700/80 text-xs transition-colors flex items-center justify-center cursor-pointer"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Barcode Row - full width so long barcodes never clip or push buttons */}
                            <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-lg px-2.5 py-1.5">
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 block leading-none mb-0.5">
                                Barcode Karton
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white break-all block leading-snug">
                                {carton.cartonBarcode}
                              </span>
                            </div>

                            {/* Category & Phase Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border inline-flex items-center gap-1 ${
                                (carton.category?.toLowerCase().includes('paska') || carton.category?.toLowerCase().includes('pasca'))
                                  ? 'bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300'
                                  : 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                              }`}>
                                {(carton.category?.toLowerCase().includes('paska') || carton.category?.toLowerCase().includes('pasca'))
                                  ? '🔌 kWh Meter Paskabayar'
                                  : '⚡ kWh Meter Prabayar'}
                              </span>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded">
                                {carton.phase}
                              </span>
                            </div>

                            {/* Summary info */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
                              <div>
                                <span className="text-slate-500 block text-[10px]">Isi Karton:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{carton.unitsCount} Unit Meter</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">Sisa Tersedia:</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{availableUnits.length} Unit</span>
                              </div>
                            </div>

                            {/* Serial numbers preview */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                  Daftar Nomor Seri ({carton.meterSerials.length} SN):
                                </span>
                                <span className="text-slate-500">Klik SN untuk Outbound</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto overflow-x-hidden pr-1">
                                {carton.meterSerials.map((sn) => {
                                  const meter = meterBySerial.get(sn);
                                  const isDispatched = meter?.status === 'DISPATCHED';

                                  return (
                                    <button
                                      key={sn}
                                      type="button"
                                      disabled={isDispatched}
                                      onClick={() => {
                                        if (!isDispatched && onSelectCartonForOutbound) {
                                          onSelectCartonForOutbound(sn);
                                        }
                                      }}
                                      title={isDispatched ? 'Sudah dikeluarkan' : 'Klik untuk pilih SN ini di form pengeluaran'}
                                      className={`btn-tactile text-[10px] font-mono px-2 py-1 rounded-md max-w-full break-all text-left transition-colors ${
                                        isDispatched
                                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 line-through cursor-not-allowed'
                                          : 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-700/80 hover:bg-cyan-50 dark:hover:bg-cyan-950 hover:border-cyan-500 cursor-pointer'
                                      }`}
                                    >
                                      {sn}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Pilih salah satu tingkat rak untuk melihat detail muatan.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Move Carton Modal */}
      {moveModalCartonId && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setMoveModalCartonId(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl animate-scale-in">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              Pindah Lokasi Fisik Karton
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Pindahkan kardus <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{moveModalCartonId}</span> ke rak dan tingkat lain.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Rak Tujuan:</label>
                <select
                  value={targetMoveRack}
                  onChange={(e) => setTargetMoveRack(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {racks.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.id} - {r.name} ({r.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Tingkat (Level):</label>
                <select
                  value={targetMoveLevel}
                  onChange={(e) => setTargetMoveLevel(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value={1}>Tingkat 1 (Atas)</option>
                  <option value={2}>Tingkat 2</option>
                  <option value={3}>Tingkat 3</option>
                  <option value={4}>Tingkat 4 (Bawah)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMoveModalCartonId(null)}
                className="btn-tactile px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onMoveCarton(moveModalCartonId, targetMoveRack, targetMoveLevel);
                  setMoveModalCartonId(null);
                }}
                className="btn-tactile px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Simpan Perpindahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rack Modal (Full Detail Dialog) */}
      {editModalRack && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setEditModalRack(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Ubah Nama & Pengaturan Rak
                    <span className="font-mono text-cyan-700 dark:text-cyan-400 text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                      {editModalRack.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ketik sendiri nama baru dan sesuaikan lokasi fisik rak di gudang
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalRack(null)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:rotate-90 transition-all duration-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Rack ID selector in modal to easily switch between racks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pilih Rak yang Ingin Diubah Namanya:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {racks.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleOpenEditModal(r)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editModalRack.id === r.id
                          ? 'bg-cyan-600 text-white border-cyan-500 dark:border-cyan-400 shadow-md'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                      }`}
                    >
                      {r.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Rak Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>Ketik Nama Baru Rak (Bebas Ketik):</span>
                  <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-normal">Wajib diisi</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Rak Utama Melcoinda 1 Phasa"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white font-semibold text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 font-sans"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Nama ini akan langsung tersimpan dan tampil pada visualisasi rak, kartu stok, dan Google Sheets.
                </p>
              </div>

              {/* Zona / Lorong */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Lokasi Zona / Lorong Gudang:
                </label>
                <input
                  type="text"
                  value={editZone}
                  onChange={(e) => setEditZone(e.target.value)}
                  placeholder="Contoh: Zona Barat (Lorong 1)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl px-3.5 py-2 focus:outline-none"
                />
              </div>

              {/* Primary Brand - Custom Text Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Merek Dedikasi Utama:
                  </label>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Bisa diketik bebas</span>
                </div>
                <input
                  type="text"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  placeholder="Ketik nama merek dedikasi (misal: Melcoinda, Itron, Campuran)..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Atur Warna Merek Dedikasi Utama */}
              <div className="bg-slate-50 dark:bg-slate-950/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Atur Warna Merek Dedikasi Utama:</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">{editBrandColor}</span>
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300 dark:border-white/30 shadow-xs shrink-0"
                      style={{ backgroundColor: editBrandColor }}
                    />
                  </div>
                </div>

                {/* Color Palette Presets */}
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {BRAND_COLOR_PALETTE.map((c) => {
                    const isSelected = editBrandColor.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setEditBrandColor(c.hex)}
                        title={`${c.name} (${c.hex})`}
                        className={`h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          isSelected 
                            ? 'ring-2 ring-slate-900 dark:ring-white scale-105 border-white shadow-md' 
                            : 'border-transparent hover:scale-105 hover:border-slate-400 dark:hover:border-white/50'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>

                {/* Native Color Picker & Hex Input for Full Freedom */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <label className="text-[11px] text-slate-600 dark:text-slate-400 shrink-0">Pilih Warna Bebas:</label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      value={editBrandColor}
                      onChange={(e) => setEditBrandColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-300 dark:border-slate-700 p-0.5"
                      title="Buka pemilih warna (Color Picker)"
                    />
                    <input
                      type="text"
                      value={editBrandColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('#') && val.length <= 7) {
                          setEditBrandColor(val);
                        } else if (!val.startsWith('#') && val.length <= 6) {
                          setEditBrandColor('#' + val);
                        }
                      }}
                      placeholder="#0284c7"
                      className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 uppercase"
                    />
                    <span className="text-[10px] text-slate-500 hidden sm:inline">
                      Warna ini digunakan untuk label dedikasi dan aksen rak
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              <div 
                className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs transition-all"
                style={{ borderTop: `3px solid ${editBrandColor}` }}
              >
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                  Preview Tampilan Rak:
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-mono font-bold text-xs">
                      {editModalRack.id}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {editName.trim() || editModalRack.name}
                    </span>
                  </div>
                  <span 
                    style={{
                      backgroundColor: `${editBrandColor}20`,
                      borderColor: `${editBrandColor}60`,
                      color: editBrandColor,
                    }}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs"
                  >
                    {editBrand.trim() || 'Dedikasi'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  📍 {editZone.trim() || editModalRack.zone} • Dedikasi: {editBrand.trim() || 'Umum'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditModalRack(null)}
                className="btn-tactile px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveModalEdit}
                className="btn-tactile px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/20 dark:shadow-emerald-950 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect / Fill Existing Carton Modal */}
      {inspectedCarton && (() => {
        const remainingSlots = Math.max(0, 10 - inspectedCarton.unitsCount);
        const brandCfg = getBrandConfig(inspectedCarton.brand);
        const lastSn = inspectedCarton.meterSerials[inspectedCarton.meterSerials.length - 1];
        const nextSnSuggestion = getNextSerialSuggestion(lastSn);
        const availableCount = inspectedCarton.meterSerials.filter(
          sn => meterBySerial.get(sn)?.status === 'AVAILABLE'
        ).length;

        const handleSubmitAddUnits = (e: React.FormEvent) => {
          e.preventDefault();
          setAddError(null);

          if (remainingSlots <= 0) {
            setAddError('Kapasitas dus ini sudah penuh (maksimal 10 unit kWh meter).');
            return;
          }
          if (addSerials.length === 0) {
            setAddError('Ketik Nomor Seri (SN) awal atau klik Generate SN terlebih dahulu.');
            return;
          }
          if (addSerials.length > remainingSlots) {
            setAddError(`Maksimal hanya bisa menambah ${remainingSlots} unit lagi ke dus ini.`);
            return;
          }

          const duplicates = addSerials.filter(sn => meterBySerial.has(sn));
          if (duplicates.length > 0) {
            setAddError(`SN berikut sudah terdaftar di gudang: ${duplicates.slice(0, 3).join(', ')}`);
            return;
          }

          const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
          const newUnits: MeterUnit[] = addSerials.map(sn => ({
            serialNumber: sn,
            brand: inspectedCarton.brand,
            phase: inspectedCarton.phase,
            category: inspectedCarton.category,
            cartonBarcode: inspectedCarton.cartonBarcode,
            rackId: inspectedCarton.rackId,
            shelfLevel: inspectedCarton.shelfLevel,
            dateInbound: nowStr,
            status: 'AVAILABLE',
          }));

          onAddUnitsToCarton?.(inspectedCarton.id, newUnits);
          setToastMessage(
            `${newUnits.length} unit ditambahkan ke dus ${inspectedCarton.cartonBarcode} (${inspectedCarton.unitsCount + newUnits.length}/10 unit)`
          );
          setTimeout(() => setToastMessage(null), 4000);
          setAddStartSn('');
          setAddSerials([]);
          const nextRemaining = Math.max(1, remainingSlots - newUnits.length);
          setAddUnitsCount(nextRemaining);
        };

        return (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setInspectCartonId(null); }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                    style={{
                      backgroundColor: `${brandCfg.color}20`,
                      borderColor: `${brandCfg.color}60`,
                      color: brandCfg.color,
                    }}
                  >
                    <Box className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base font-mono truncate">
                        {inspectSlotNumber ? `Slot #${inspectSlotNumber} • ` : ''}
                        {inspectedCarton.cartonBarcode}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${brandCfg.badgeBg} ${brandCfg.badgeText}`}>
                        {inspectedCarton.brand}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {inspectedCarton.rackId} • Tingkat {inspectedCarton.shelfLevel} ({inspectedCarton.shelfLevel === 1 ? 'Atas' : inspectedCarton.shelfLevel === 4 ? 'Bawah' : 'Tengah'}) • {inspectedCarton.phase}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectCartonId(null)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:rotate-90 transition-all duration-200 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Terisi di Dus</span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                      {inspectedCarton.unitsCount} / 10 Unit
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Siap Pakai</span>
                    <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {availableCount} Unit
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Sisa Ruang Dus</span>
                    <span className={`text-sm font-bold font-mono ${remainingSlots > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                      {remainingSlots} Unit
                    </span>
                  </div>
                </div>

                {/* Ubah Merek kWh Meter */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmedBrand = editCartonBrand.trim();
                    if (!trimmedBrand || trimmedBrand === inspectedCarton.brand) return;
                    onUpdateCartonBrand?.(inspectedCarton.id, trimmedBrand);
                    setToastMessage(
                      `Merek kWh meter dus ${inspectedCarton.cartonBarcode} diubah menjadi "${trimmedBrand}"`
                    );
                    setTimeout(() => setToastMessage(null), 4000);
                  }}
                  className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Ubah Merek kWh Meter</span>
                    </label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Saat ini: <strong className="text-cyan-700 dark:text-cyan-300">{inspectedCarton.brand}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editCartonBrand}
                      onChange={(e) => setEditCartonBrand(e.target.value)}
                      placeholder="Ketik merek baru (misal: Melcoinda, Itron, Hexing, Smartmeter)..."
                      className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={!editCartonBrand.trim() || editCartonBrand.trim() === inspectedCarton.brand}
                      className="btn-tactile px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Merek</span>
                    </button>
                  </div>
                </form>

                {/* Add / Fill more units form if carton < 10 */}
                {remainingSlots > 0 ? (
                  <form onSubmit={handleSubmitAddUnits} className="bg-cyan-50/50 dark:bg-slate-950/70 border border-cyan-300 dark:border-cyan-500/35 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        Isi / Tambah kWh Meter ke Dus Ini
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                        Maks +{remainingSlots} Unit
                      </span>
                    </div>

                    {addError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <span>{addError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Jumlah Ditambah:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={remainingSlots}
                          value={addUnitsCount}
                          onChange={(e) => {
                            const val = Math.min(remainingSlots, Math.max(1, parseInt(e.target.value) || 1));
                            setAddUnitsCount(val);
                            if (addStartSn) recomputeAddSerials(addStartSn, val);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Nomor Seri (SN) Awal:
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={addStartSn}
                            onChange={(e) => {
                              setAddStartSn(e.target.value);
                              recomputeAddSerials(e.target.value, addUnitsCount);
                            }}
                            placeholder="Ketik SN awal (auto-increment)"
                            className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500"
                          />
                          {nextSnSuggestion && (
                            <button
                              type="button"
                              onClick={() => {
                                setAddStartSn(nextSnSuggestion);
                                recomputeAddSerials(nextSnSuggestion, addUnitsCount);
                              }}
                              title={`Lanjutkan dari SN terakhir (${lastSn})`}
                              className="btn-tactile px-2.5 py-2 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950 dark:hover:bg-cyan-900 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60 rounded-xl text-[11px] font-semibold shrink-0 cursor-pointer"
                            >
                              Lanjut SN
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const seed = Math.floor(10000000 + Math.random() * 90000000);
                              const bLower = inspectedCarton.brand.toLowerCase();
                              const sn = bLower.includes('mel') ? `32${seed}` : bLower.includes('itr') ? `45${seed}` : `14${seed}`;
                              setAddStartSn(sn);
                              recomputeAddSerials(sn, addUnitsCount);
                            }}
                            className="btn-tactile px-2.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-semibold shrink-0 cursor-pointer"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>

                    {addSerials.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Akan ditambahkan ({addSerials.length} unit):</span>
                          <span className="font-mono text-cyan-700 dark:text-cyan-300">
                            {addSerials[0]} &rarr; {addSerials[addSerials.length - 1]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          {addSerials.map((sn) => (
                            <span
                              key={sn}
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-300"
                            >
                              +{sn}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="btn-tactile px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-900/20 dark:shadow-cyan-950/60 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Tambahkan ke Dus
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Kapasitas dus ini sudah terisi penuh (10/10 kWh meter).</span>
                  </div>
                )}

                {/* Existing SNs inside this carton */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Daftar SN di Dalam Dus ({inspectedCarton.meterSerials.length})
                    </h4>
                    <span className="text-[10px] text-slate-500">Klik SN tersedia untuk Outbound</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800">
                    {inspectedCarton.meterSerials.map((sn, idx) => {
                      const meter = meterBySerial.get(sn);
                      const isDispatched = meter?.status === 'DISPATCHED';
                      return (
                        <button
                          key={sn}
                          type="button"
                          disabled={isDispatched}
                          onClick={() => {
                            if (!isDispatched && onSelectCartonForOutbound) {
                              setInspectCartonId(null);
                              onSelectCartonForOutbound(sn);
                            }
                          }}
                          title={isDispatched ? 'Sudah dikeluarkan' : 'Klik untuk keluarkan SN ini (Outbound)'}
                          className={`btn-tactile text-[11px] font-mono px-2.5 py-1 rounded-lg transition-colors ${
                            isDispatched
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 line-through cursor-not-allowed'
                              : 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950 hover:border-cyan-500 cursor-pointer'
                          }`}
                        >
                          #{idx + 1} {sn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMoveModalCartonId(inspectedCarton.id);
                    setTargetMoveRack(inspectedCarton.rackId);
                    setTargetMoveLevel(inspectedCarton.shelfLevel);
                    setInspectCartonId(null);
                  }}
                  className="btn-tactile px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Pindah Rak / Tingkat
                </button>
                <button
                  type="button"
                  onClick={() => setInspectCartonId(null)}
                  className="btn-tactile px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Save Toast */}
      {toastMessage && (
        <div className="fixed bottom-16 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-toast-in">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
