/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MeterBrand, 
  MeterPhase, 
  MeterCategory, 
  getBrandConfig, 
  WarehouseRack, 
  InboundCarton, 
  MeterUnit 
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
  const [receivedBy, setReceivedBy] = useState<string>('Ahmad Supriyadi (Gudang)');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync target rack, shelf level, brand dedication, and reset fields whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const resolvedRackId = initialRackId || racks[0]?.id || 'RAK-A';
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
      setTargetLevel(initialLevel ?? 1);
      setIsBrandManuallyEdited(false);
      setCartonBarcode('');
      setStartSerial('');
      setGeneratedSerials([]);
      setNotes('');
      setErrorMsg(null);
    }
  }, [isOpen, initialRackId, initialLevel]);

  // When rack changes and user hasn't manually typed a brand yet, adjust brand to match rack dedication
  const handleRackChange = (newRackId: string) => {
    setTargetRackId(newRackId);
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

  // Check target shelf capacity
  const targetRack = racks.find(r => r.id === targetRackId);
  const targetShelf = targetRack?.shelves.find(s => s.level === targetLevel);
  const currentCartonsInShelf = existingCartons.filter(c => c.rackId === targetRackId && c.shelfLevel === targetLevel);
  const isShelfFull = targetShelf ? currentCartonsInShelf.length >= targetShelf.cartonCapacity : false;

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

    const resolvedBrand = brand.trim() || targetRack?.primaryBrand || '';
    if (!resolvedBrand) {
      setErrorMsg('Merek kWh Meter wajib diisi.');
      return;
    }

    const brandCode = resolvedBrand.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'KWH';
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

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
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
          {initialSlotNumber && (
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-500/40 rounded-xl text-xs text-cyan-900 dark:text-cyan-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>
                  Mengisi <strong className="text-slate-900 dark:text-white">Slot Dus #{initialSlotNumber}</strong> di{' '}
                  <strong className="font-mono text-cyan-700 dark:text-cyan-300">{targetRackId}</strong> •{' '}
                  <strong className="text-slate-900 dark:text-white">
                    Tingkat {targetLevel} ({targetLevel === 1 ? 'Atas' : targetLevel === 4 ? 'Bawah' : 'Tengah'})
                  </strong>
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 shrink-0">
                Slot Terpilih
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Merek kWh Meter:
                </label>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
                  {isBrandManuallyEdited
                    ? 'Diketik manual'
                    : `Sesuai dedikasi ${targetRack?.id || 'rak'}`}
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
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 text-xs sm:text-sm text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Jumlah kWh Meter Per Karton:</span>
                <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-normal">
                  Maksimal 10 kWh meter / dus
                </span>
              </label>
              <div className="flex items-center gap-2">
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
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-cyan-500"
                  required
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold shrink-0">Pcs / Dus</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jenis Fase:
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as MeterPhase)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="1 Phasa">1 Phasa (Tegangan Rendah 220V)</option>
                <option value="3 Phasa">3 Phasa (Tegangan Rendah 380V)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Kategori kWh Meter:</span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-normal">Prabayar / Paskabayar</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MeterCategory)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="kWh Meter Prabayar">⚡ kWh Meter Prabayar (Token / Smart)</option>
                <option value="kWh Meter Paskabayar">🔌 kWh Meter Paskabayar (Reguler / Bulanan)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Serial Numbers in Carton */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
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
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                className="btn-tactile px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Alokasi Rak Fisik Gudang:
              </label>
              <select
                value={targetRackId}
                onChange={(e) => handleRackChange(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                {racks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} - {r.name} (Dedikasi: {r.primaryBrand})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Tingkat Rak (Level):</span>
                <span className={`text-[11px] ${isShelfFull ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                  Terisi: {currentCartonsInShelf.length}/{targetShelf?.cartonCapacity || 16} Dus
                </span>
              </label>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value={1}>Tingkat 1 (Atas)</option>
                <option value={2}>Tingkat 2</option>
                <option value={3}>Tingkat 3</option>
                <option value={4}>Tingkat 4 (Bawah)</option>
              </select>
            </div>
          </div>

          {/* Section 5: Staff & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Petugas Penerima Gudang:
              </label>
              <input
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Nama Petugas Gudang"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Catatan Kondisi Dus:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Segel pabrik utuh, kondisi kardus baik"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
      </div>
    </div>
  );
};
