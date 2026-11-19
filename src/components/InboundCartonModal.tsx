/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MeterBrand, 
  MeterPhase, 
  MeterCategory, 
  getBrandConfig, 
  WarehouseRack, 
  InboundCarton, 
  MeterUnit,
  resolveShelfSlots
} from '../types/warehouse';
import { 
  X, 
  Box, 
  Camera, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Barcode, 
  Info,
  Zap,
  Radio
} from 'lucide-react';
import { soundEffects, vibratePhone } from '../services/notificationService';
import { hardwareScannerService } from '../services/hardwareScannerService';

interface InboundCartonModalProps {
  isOpen: boolean;
  onClose: () => void;
  racks: WarehouseRack[];
  existingCartons: InboundCarton[];
  existingMeters: MeterUnit[];
  onSaveInbound: (carton: InboundCarton, units: MeterUnit[]) => void;
  onOpenScanner: (callback: (scannedText: string) => void) => void;
  initialRackId?: string;
  initialLevel?: number;
  initialSlotNumber?: number;
}

export const InboundCartonModal: React.FC<InboundCartonModalProps> = ({
  isOpen,
  onClose,
  racks,
  existingCartons,
  existingMeters,
  onSaveInbound,
  onOpenScanner,
  initialRackId,
  initialLevel,
  initialSlotNumber,
}) => {
  const [cartonBarcode, setCartonBarcode] = useState('');
  const [targetRackId, setTargetRackId] = useState<string>(() => racks[0]?.id || 'RAK-A');
  const [brand, setBrand] = useState<MeterBrand>(() => {
    const initialRack = racks.find(r => r.id === (racks[0]?.id || 'RAK-A')) || racks[0];
    return initialRack?.primaryBrand || 'Melcoinda';
  });
  const [isBrandManuallyEdited, setIsBrandManuallyEdited] = useState<boolean>(false);
  const [phase, setPhase] = useState<MeterPhase>('1 Phasa');
  const [category, setCategory] = useState<MeterCategory>('kWh Meter Prabayar');
  const [unitsCount, setUnitsCount] = useState<number>(10);
  const [startSerial, setStartSerial] = useState<string>('');
  const [generatedSerials, setGeneratedSerials] = useState<string[]>([]);
  const [targetLevel, setTargetLevel] = useState<number>(1);
  const [targetSlotNumber, setTargetSlotNumber] = useState<number | null>(1);
  const [receivedBy, setReceivedBy] = useState<string>('Acho');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pickBestSlotForShelf = (rackId: string, level: number, preferredSlot?: number | null): number | null => {
    const rack = racks.find(r => r.id === rackId);
    const shelf = rack?.shelves.find(s => s.level === level);
    const cap = shelf?.cartonCapacity || 16;
    const shelfCartons = existingCartons.filter(c => c.rackId === rackId && c.shelfLevel === level);
    const resolved = resolveShelfSlots(shelfCartons, cap);
    if (preferredSlot && preferredSlot >= 1 && preferredSlot <= cap) {
      const target = resolved.find(s => s.slotNumber === preferredSlot);
      if (target && !target.carton) return preferredSlot;
    }
    const firstEmpty = resolved.find(s => !s.carton);
    return firstEmpty ? firstEmpty.slotNumber : null;
  };

  // Sync target rack, shelf level, slot number, brand dedication, and reset fields whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const resolvedRackId = initialRackId || racks[0]?.id || 'RAK-A';
      const resolvedLevel = initialLevel ?? 1;
      const currentRack = racks.find(r => r.id === resolvedRackId) || racks[0];
      if (currentRack) {
        setTargetRackId(currentRack.id);
        setBrand(currentRack.primaryBrand || 'Melcoinda');
        const defaultQty = Math.min(10, getBrandConfig(currentRack.primaryBrand).defaultUnitsPerCarton || 10);
        setUnitsCount(defaultQty);
      } else {
        setTargetRackId(resolvedRackId);
        setUnitsCount(10);
      }
      setTargetLevel(resolvedLevel);
      setTargetSlotNumber(pickBestSlotForShelf(resolvedRackId, resolvedLevel, initialSlotNumber));
      setIsBrandManuallyEdited(false);
      setCartonBarcode('');
      setStartSerial('');
      setGeneratedSerials([]);
      setNotes('');
      setErrorMsg(null);
    }
  }, [isOpen, initialRackId, initialLevel, initialSlotNumber]);

  // When rack changes and user hasn't manually typed a brand yet, adjust brand to match rack dedication
  const handleRackChange = (newRackId: string) => {
    setTargetRackId(newRackId);
    setTargetSlotNumber(prev => pickBestSlotForShelf(newRackId, targetLevel, prev));
    if (!isBrandManuallyEdited) {
      const matchedRack = racks.find(r => r.id === newRackId);
      if (matchedRack?.primaryBrand) {
        setBrand(matchedRack.primaryBrand);
        const defaultQty = getBrandConfig(matchedRack.primaryBrand).defaultUnitsPerCarton || 10;
        setUnitsCount(defaultQty);
        if (startSerial) {
          recomputeSerials(startSerial, defaultQty);
        }
      }
    }
  };

  const handleLevelChange = (newLevel: number) => {
    setTargetLevel(newLevel);
    setTargetSlotNumber(prev => pickBestSlotForShelf(targetRackId, newLevel, prev));
  };

  // Recompute consecutive serial numbers
  const recomputeSerials = (baseSn: string, count: number) => {
    if (!baseSn.trim()) {
      setGeneratedSerials([]);
      return;
    }

    const clean = baseSn.trim();
    // Try to extract numeric tail
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
      setGeneratedSerials(list);
    } else {
      // Fallback single or indexed
      const list = Array.from({ length: count }).map((_, i) => `${clean}-${i + 1}`);
      setGeneratedSerials(list);
    }
  };

  // Handle scanned carton barcode
  const handleScannedBarcode = (decoded: string) => {
    setCartonBarcode(decoded);

    // Smart detect brand from barcode prefix (max 10 kWh meter per karton)
    let detectedBrand: MeterBrand = brand;
    let detectedQty = 10;
    let matchedPrefix = false;

    const lower = decoded.toLowerCase();
    if (lower.includes('itr') || lower.includes('itron')) {
      detectedBrand = 'Itron';
      matchedPrefix = true;
    } else if (lower.includes('mel') || lower.includes('melcoinda')) {
      detectedBrand = 'Melcoinda';
      matchedPrefix = true;
    } else if (lower.includes('hex') || lower.includes('hexing')) {
      detectedBrand = 'Hexing';
      matchedPrefix = true;
    } else if (lower.includes('snx') || lower.includes('sanxing')) {
      detectedBrand = 'Sanxing';
      matchedPrefix = true;
    } else if (lower.includes('str') || lower.includes('smart') || lower.includes('star')) {
      detectedBrand = 'Smart / Star';
      matchedPrefix = true;
    } else if (lower.includes('fde') || lower.includes('fuji')) {
      detectedBrand = 'Fuji Dharma Electric';
      matchedPrefix = true;
    }

    if (matchedPrefix) {
      setBrand(detectedBrand);
      setIsBrandManuallyEdited(true);
    }
    setUnitsCount(detectedQty);

    // Suggest start serial if not yet set
    if (!startSerial) {
      const randomSeed = Math.floor(10000000 + Math.random() * 90000000);
      const bLower = detectedBrand.toLowerCase();
      const suggestedSn = bLower.includes('mel') ? `32${randomSeed}` : bLower.includes('itr') ? `45${randomSeed}` : `14${randomSeed}`;
      setStartSerial(suggestedSn);
      recomputeSerials(suggestedSn, detectedQty);
    }
  };

  // Listen for Kassen KS-606 hardware scanner trigger
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = hardwareScannerService.subscribe(({ code }) => {
      if (!cartonBarcode.trim()) {
        handleScannedBarcode(code);
      } else {
        setStartSerial(code);
        recomputeSerials(code, unitsCount);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, cartonBarcode, unitsCount]);

  // Check target shelf capacity & resolve all 16 visual slots
  const targetRack = racks.find(r => r.id === targetRackId);
  const targetShelf = targetRack?.shelves.find(s => s.level === targetLevel);
  const shelfCapacity = targetShelf?.cartonCapacity || 16;
  const currentCartonsInShelf = existingCartons.filter(c => c.rackId === targetRackId && c.shelfLevel === targetLevel);
  const resolvedShelfSlots = resolveShelfSlots(currentCartonsInShelf, shelfCapacity);
  const isShelfFull = currentCartonsInShelf.length >= shelfCapacity;
  const activeSlotObj = targetSlotNumber ? resolvedShelfSlots.find(s => s.slotNumber === targetSlotNumber) : null;
  const isSelectedSlotTaken = Boolean(activeSlotObj?.carton);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!cartonBarcode.trim()) {
      setErrorMsg('Barcode / Nomor Karton wajib diisi atau dipindai.');
      return;
    }

    if (existingCartons.some(c => c.cartonBarcode.toLowerCase() === cartonBarcode.trim().toLowerCase())) {
      setErrorMsg('Nomor Barcode Karton ini sudah pernah terdaftar di sistem gudang.');
      return;
    }

    if (generatedSerials.length === 0) {
      setErrorMsg('Nomor Seri (SN) kWh Meter dalam karton belum ditentukan.');
      return;
    }

    if (generatedSerials.length > 10) {
      setErrorMsg('Kapasitas 1 karton maksimal berisi 10 unit kWh meter.');
      return;
    }

    // Check for duplicate meter serial numbers in warehouse
    const duplicates = generatedSerials.filter(sn => existingMeters.some(m => m.serialNumber === sn));
    if (duplicates.length > 0) {
      setErrorMsg(`Terdapat SN kWh meter yang sudah ada di sistem: ${duplicates.slice(0, 3).join(', ')}...`);
      return;
    }

    if (isShelfFull) {
      setErrorMsg(`Tingkat ${targetLevel} pada ${targetRack?.name} sudah penuh (${targetShelf?.cartonCapacity} dus). Silakan pilih tingkat atau rak lain.`);
      return;
    }

    if (!targetSlotNumber || isSelectedSlotTaken) {
      setErrorMsg('Silakan pilih posisi slot dus yang masih kosong pada tingkat rak ini.');
      return;
    }

    const resolvedBrand = brand.trim() || targetRack?.primaryBrand || '';
    if (!resolvedBrand) {
      setErrorMsg('Merek kWh Meter wajib diisi.');
      return;
    }

    const brandCode = resolvedBrand.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'KWH';
    const cartonId = `CTN-${brandCode}-${Date.now().toString().slice(-4)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newCarton: InboundCarton = {
      id: cartonId,
      cartonBarcode: cartonBarcode.trim(),
      brand: resolvedBrand,
      phase,
      category,
      unitsCount: generatedSerials.length,
      meterSerials: generatedSerials,
      rackId: targetRackId,
      shelfLevel: targetLevel,
      slotNumber: targetSlotNumber,
      dateInbound: nowStr,
      receivedBy: receivedBy.trim(),
      notes: notes.trim(),
    };

    const newUnits: MeterUnit[] = generatedSerials.map(sn => ({
      serialNumber: sn,
      brand: resolvedBrand,
      phase,
      category,
      cartonBarcode: cartonBarcode.trim(),
      rackId: targetRackId,
      shelfLevel: targetLevel,
      dateInbound: nowStr,
      status: 'AVAILABLE',
    }));

    soundEffects.playSuccess();
    vibratePhone([100, 50, 100]);
    onSaveInbound(newCarton, newUnits);
    setCartonBarcode('');
    setStartSerial('');
    setGeneratedSerials([]);
    setNotes('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-500/30">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Penerimaan Karton Material (Inbound)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan barcode karton dus untuk mendeteksi merek, jumlah unit & nomor seri kWh meter
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:rotate-90 transition-all duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {targetSlotNumber && (
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-500/40 rounded-xl text-xs text-cyan-900 dark:text-cyan-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>
                  Mengisi <strong className="text-slate-900 dark:text-white">Slot Dus #{targetSlotNumber}</strong> di{' '}
                  <strong className="font-mono text-cyan-700 dark:text-cyan-300">{targetRackId}</strong> •{' '}
                  <strong className="text-slate-900 dark:text-white">
                    Tingkat {targetLevel} ({targetLevel === 1 ? 'Atas' : targetLevel === 4 ? 'Bawah' : 'Tengah'})
                  </strong>
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 shrink-0">
                Baris {targetSlotNumber <= 8 ? 1 : 2} • Kolom {((targetSlotNumber - 1) % 8) + 1}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Kassen KS-606 Scanner Status Banner */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/80 border border-cyan-200 dark:border-cyan-500/30 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-slate-700 dark:text-slate-200">
                <strong className="text-cyan-700 dark:text-cyan-300">Scanner Kassen KS-606 Siap:</strong> Arahkan laser dan tembak barcode dus karton.
              </span>
            </div>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              Dongle 2.4G Aktif
            </span>
          </div>

          {/* Section 1: Scan Barcode Karton */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                1. Barcode Label Karton Dus
              </label>
              <span className="text-[11px] text-cyan-600 dark:text-cyan-400">Scan label luar dus</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={cartonBarcode}
                onChange={(e) => setCartonBarcode(e.target.value)}
                placeholder="Contoh: MEL-BOX-202610-099 atau ITR-BOX-202610-911"
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
              <button
                type="button"
                onClick={() => onOpenScanner((scanned) => handleScannedBarcode(scanned))}
                className="btn-tactile px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Scan Barcode
              </button>
            </div>
          </div>

          {/* Section 2: Spesifikasi Merek & Kapasitas Karton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[20px]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Merek kWh Meter:
                </label>
                <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap truncate">
                  {isBrandManuallyEdited
                    ? 'Input manual'
                    : `Dedikasi ${targetRack?.id || 'rak'}`}
                </span>
              </div>
              <input
                type="text"
                value={brand}
                onChange={(e) => {
                  const val = e.target.value;
                  setBrand(val);
                  setIsBrandManuallyEdited(val.trim().length > 0);
                }}
                placeholder={`Sesuai dedikasi rak: ${targetRack?.primaryBrand || 'Melcoinda'}`}
                className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-xs sm:text-sm text-slate-900 dark:text-slate-100 rounded-xl px-3.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[20px]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Jumlah Per Karton:
                </label>
                <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap">
                  Maks. 10 unit / dus
                </span>
              </div>
              <div className="flex items-center h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus-within:border-cyan-500 dark:focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-500 dark:focus-within:ring-cyan-400 rounded-xl overflow-hidden transition-colors">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={unitsCount}
                  onChange={(e) => {
                    const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                    setUnitsCount(val);
                    if (startSerial) recomputeSerials(startSerial, val);
                  }}
                  className="flex-1 min-w-0 h-full bg-transparent text-slate-900 dark:text-slate-100 px-3.5 text-xs sm:text-sm font-mono tabular-nums focus:outline-none"
                  required
                />
                <span className="h-full px-3 flex items-center bg-slate-50 dark:bg-slate-900/80 border-l border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap shrink-0">
                  Pcs / Dus
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[20px]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Jenis Fase:
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  220V / 380V
                </span>
              </div>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as MeterPhase)}
                className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 focus:outline-none"
              >
                <option value="1 Phasa">1 Phasa (Tegangan Rendah 220V)</option>
                <option value="3 Phasa">3 Phasa (Tegangan Rendah 380V)</option>
              </select>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[20px]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Kategori kWh Meter:
                </label>
                <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap">
                  Prabayar / Paskabayar
                </span>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MeterCategory)}
                className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 focus:outline-none font-medium"
              >
                <option value="kWh Meter Prabayar">⚡ Prabayar (Token / Smart)</option>
                <option value="kWh Meter Paskabayar">🔌 Paskabayar (Reguler / Bulanan)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Serial Numbers in Carton */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                2. Nomor Seri (SN) kWh Meter Dalam Karton
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Otomatis berurutan sesuai kapasitas ({unitsCount} unit)
              </span>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={startSerial}
                  onChange={(e) => {
                    setStartSerial(e.target.value);
                    recomputeSerials(e.target.value, unitsCount);
                  }}
                  placeholder="Ketik SN awal, misal: 3214550051 (akan auto-increment)"
                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const seed = Math.floor(10000000 + Math.random() * 90000000);
                  const sn = brand === 'Melcoinda' ? `32${seed}` : brand === 'Itron' ? `45${seed}` : `14${seed}`;
                  setStartSerial(sn);
                  recomputeSerials(sn, unitsCount);
                }}
                className="btn-tactile h-10 px-3.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors"
              >
                Generate SN
              </button>
            </div>

            {/* Generated SN preview chips */}
            {generatedSerials.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>Daftar {generatedSerials.length} Nomor Seri yang akan disimpan:</span>
                  <span className="font-mono text-cyan-700 dark:text-cyan-300">
                    {generatedSerials[0]} &rarr; {generatedSerials[generatedSerials.length - 1]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-white dark:bg-slate-900/80 rounded-lg border border-slate-200 dark:border-slate-800">
                  {generatedSerials.map((sn, idx) => (
                    <span
                      key={sn}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/40 text-cyan-800 dark:text-cyan-300"
                    >
                      #{idx + 1}: {sn}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Target Rak & Shelf Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[20px]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Alokasi Rak Fisik Gudang:
                </label>
              </div>
              <select
                value={targetRackId}
                onChange={(e) => handleRackChange(e.target.value)}
                className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 focus:outline-none"
              >
                {racks.map((r) => {
                  const normId = r.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const normName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const displayName = normName.startsWith(normId) ? r.name : `${r.id} - ${r.name}`;
                  return (
                    <option key={r.id} value={r.id}>
                      {displayName} (Dedikasi: {r.primaryBrand})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[20px]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Tingkat Rak (Level):
                </label>
                <span className={`text-[11px] whitespace-nowrap tabular-nums ${isShelfFull ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                  Terisi: {currentCartonsInShelf.length}/{shelfCapacity} Dus
                </span>
              </div>
              <select
                value={targetLevel}
                onChange={(e) => handleLevelChange(Number(e.target.value))}
                className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 focus:outline-none"
              >
                <option value={1}>Tingkat 1 (Atas)</option>
                <option value={2}>Tingkat 2</option>
                <option value={3}>Tingkat 3</option>
                <option value={4}>Tingkat 4 (Bawah)</option>
              </select>
            </div>
          </div>

          {/* Section 4B: Interactive 16-Slot Position Selector */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Pilih Posisi Slot Dus pada Tingkat {targetLevel}:</span>
              </label>
              <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                {targetSlotNumber
                  ? `Slot #${targetSlotNumber} (${targetSlotNumber <= 8 ? 'Baris Atas' : 'Baris Bawah'} • Kolom ${((targetSlotNumber - 1) % 8) + 1})`
                  : 'Tingkat rak penuh'}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {resolvedShelfSlots.map(({ slotNumber, carton }) => {
                const isSelected = targetSlotNumber === slotNumber && !carton;
                if (carton) {
                  return (
                    <div
                      key={slotNumber}
                      title={`Slot #${slotNumber} sudah terisi (${carton.cartonBarcode})`}
                      className="h-9 rounded-lg border border-slate-300 dark:border-slate-700/70 bg-slate-200/80 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center text-[9px] font-mono cursor-not-allowed opacity-70"
                    >
                      <Box className="w-2.5 h-2.5" />
                      <span className="leading-none mt-0.5 font-semibold">#{slotNumber} ({carton.unitsCount}p)</span>
                    </div>
                  );
                }
                return (
                  <button
                    key={slotNumber}
                    type="button"
                    onClick={() => setTargetSlotNumber(slotNumber)}
                    title={`Pilih Slot Dus #${slotNumber} (Baris ${slotNumber <= 8 ? 'Atas' : 'Bawah'}, Kolom ${((slotNumber - 1) % 8) + 1})`}
                    className={`btn-tactile h-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 text-white border-2 border-cyan-400 ring-2 ring-cyan-500/40 shadow-md font-bold'
                        : 'bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500 dark:hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-700 dark:hover:text-cyan-300'
                    }`}
                  >
                    <span className="leading-none">#{slotNumber}</span>
                    <span className={`text-[8px] leading-none mt-0.5 ${isSelected ? 'text-cyan-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      {isSelected ? 'Dipilih' : 'Kosong'}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Klik kotak slot mana saja yang masih kosong (misal <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">#1</span> pojok kiri atas, <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">#8</span> pojok kanan atas, atau <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">#16</span> pojok kanan bawah).
            </p>
          </div>

          {/* Section 5: Staff & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 min-h-[20px] flex items-center">
                Petugas Penerima Gudang:
              </label>
              <input
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Nama Petugas Gudang"
                className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-xs sm:text-sm focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 min-h-[20px] flex items-center">
                Catatan Kondisi Dus:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Segel pabrik utuh, kondisi kardus baik"
                className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 text-xs sm:text-sm focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isShelfFull}
              className="btn-tactile px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-cyan-600/20 dark:shadow-cyan-900/40 hover:shadow-cyan-500/20 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Simpan & Masukkan ke Rak
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
