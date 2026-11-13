/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  OutboundRecord, 
  OutboundType, 
  GantiMeterCategory, 
  MeterUnit, 
  MeterBrand,
  BRAND_CONFIGS 
} from '../types/warehouse';
import { 
  X, 
  Send, 
  Camera, 
  AlertTriangle, 
  CheckCircle, 
  Sparkles, 
  FileText,
  UserCheck,
  Zap,
  Tag,
  Clock,
  Radio
} from 'lucide-react';
import { soundEffects, vibratePhone } from '../services/notificationService';
import { hardwareScannerService } from '../services/hardwareScannerService';

interface OutboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableMeters: MeterUnit[];
  preselectedSn?: string;
  onSaveOutbound: (record: OutboundRecord) => void;
  onOpenScanner: (callback: (scannedText: string) => void) => void;
}

const PLN_TARIF_OPTIONS = [
  'R1 (Subsidi)',
  'R1M (Non-Subsidi)',
  'R2',
  'R3',
  'B1 (Bisnis Kecil)',
  'B2 (Bisnis Menengah)',
  'B3 (Bisnis Besar)',
  'I1 (Industri)',
  'I2 (Industri)',
  'P1 (Pemerintah)',
  'P2 (Penerangan Jalan)',
  'S1 (Sosial)',
  'S2 (Sosial)'
];

const PLN_DAYA_OPTIONS = [
  450, 900, 1300, 2200, 3500, 4400, 5500, 7700, 11000, 13200, 16500, 23000, 33000, 41500
];

export const OutboundModal: React.FC<OutboundModalProps> = ({
  isOpen,
  onClose,
  availableMeters,
  preselectedSn,
  onSaveOutbound,
  onOpenScanner,
}) => {
  const [jenisTransaksi, setJenisTransaksi] = useState<OutboundType>('PB');
  const [tanggal, setTanggal] = useState<string>('');
  const [idPelanggan, setIdPelanggan] = useState<string>('');
  const [noMeter, setNoMeter] = useState<string>('');
  const [nomorAgenda, setNomorAgenda] = useState<string>('');
  const [nama, setNama] = useState<string>('');
  const [tarif, setTarif] = useState<string>('R1M (Non-Subsidi)');
  const [daya, setDaya] = useState<number>(1300);
  const [snKwhMeter, setSnKwhMeter] = useState<string>('');
  const [snMcb, setSnMcb] = useState<string>('');
  const [segel, setSegel] = useState<string>('');
  const [kabelTw, setKabelTw] = useState<number>(25);
  const [petugas, setPetugas] = useState<string>('Dedi Kurniawan (Yanbung ULP)');

  // Ganti Meter specific fields
  const [gmKategori, setGmKategori] = useState<GantiMeterCategory>('METER_GANGGUAN');
  const [gmKeterangan, setGmKeterangan] = useState<string>('');
  const [noMeterLama, setNoMeterLama] = useState<string>('');
  const [standMeterLama, setStandMeterLama] = useState<string>('');
  const [snSegelLama, setSnSegelLama] = useState<string>('');

  const [selectedMeterUnit, setSelectedMeterUnit] = useState<MeterUnit | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize date & preselected SN
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      setTanggal(`${yr}-${mo}-${da} ${hr}:${mi}`);

      // Auto generate random sample agenda
      const agendaSeed = Math.floor(1000000000 + Math.random() * 9000000000);
      setNomorAgenda(`54${agendaSeed}`);

      // Auto generate segel suggestion
      const segelSeed = Math.floor(1000 + Math.random() * 9000);
      setSegel(`PLN-SGL-2026-${segelSeed}`);

      // Default MCB based on daya
      updateMcbForDaya(1300);

      if (preselectedSn) {
        handleSelectSerialNumber(preselectedSn);
      }
    }
  }, [isOpen, preselectedSn]);

  // Update MCB suggestion based on Daya
  const updateMcbForDaya = (valDaya: number) => {
    let ampere = '6A';
    if (valDaya === 450) ampere = '2A';
    else if (valDaya === 900) ampere = '4A';
    else if (valDaya === 1300) ampere = '6A';
    else if (valDaya === 2200) ampere = '10A';
    else if (valDaya === 3500) ampere = '16A';
    else if (valDaya === 4400) ampere = '20A';
    else if (valDaya === 5500) ampere = '25A';
    else if (valDaya >= 7700) ampere = '35A';

    setSnMcb(`MCB-SCH-${ampere}-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleSelectSerialNumber = (sn: string) => {
    const unit = availableMeters.find(m => m.serialNumber === sn && m.status === 'AVAILABLE');
    setSnKwhMeter(sn);
    setNoMeter(sn);
    setSelectedMeterUnit(unit || null);
  };

  // Listen for Kassen KS-606 hardware scanner trigger
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = hardwareScannerService.subscribe(({ code }) => {
      if (jenisTransaksi === 'GM' && snKwhMeter.trim() && !noMeterLama.trim()) {
        setNoMeterLama(code);
      } else {
        handleSelectSerialNumber(code);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, jenisTransaksi, snKwhMeter, noMeterLama]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!snKwhMeter.trim()) {
      setErrorMsg('SN kWh Meter yang dikeluarkan wajib dipilih atau di-scan.');
      return;
    }

    if (!idPelanggan.trim()) {
      setErrorMsg('ID Pelanggan (ID PEL) wajib diisi.');
      return;
    }

    if (!nama.trim()) {
      setErrorMsg('Nama Pelanggan wajib diisi.');
      return;
    }

    if (!petugas.trim()) {
      setErrorMsg('Nama Petugas / Pelaksana wajib diisi.');
      return;
    }

    // Validation for Ganti Meter
    if (jenisTransaksi === 'GM') {
      if (!noMeterLama.trim()) {
        setErrorMsg('Untuk transaksi Ganti Meter (GM), Nomor kWh Meter Lama wajib diisi.');
        return;
      }
      if (!gmKeterangan.trim()) {
        setErrorMsg('Harap lengkapi keterangan alasan ganti meter.');
        return;
      }
    }

    const outboundId = `OUT-${jenisTransaksi}-${Date.now().toString().slice(-6)}`;

    const newRecord: OutboundRecord = {
      id: outboundId,
      tanggal,
      jenisTransaksi,
      idPelanggan: idPelanggan.trim(),
      noMeter: noMeter.trim() || snKwhMeter.trim(),
      nomorAgenda: nomorAgenda.trim(),
      nama: nama.trim(),
      tarif: tarif.split(' ')[0], // Keep clean code e.g. R1M
      daya,
      snKwhMeter: snKwhMeter.trim(),
      snMcb: snMcb.trim(),
      segel: segel.trim(),
      kabelTw: Number(kabelTw) || 0,
      petugas: petugas.trim(),
      meterBrand: selectedMeterUnit?.brand,
      meterCategory: selectedMeterUnit?.category,
      rackSource: selectedMeterUnit ? `${selectedMeterUnit.rackId} / Tingkat ${selectedMeterUnit.shelfLevel}` : undefined,
    };

    if (jenisTransaksi === 'GM') {
      newRecord.gmKategori = gmKategori;
      newRecord.gmKeterangan = gmKeterangan.trim();
      newRecord.noMeterLama = noMeterLama.trim();
      newRecord.standMeterLama = standMeterLama.trim();
      newRecord.snSegelLama = snSegelLama.trim();
    }

    soundEffects.playSuccess();
    vibratePhone([80, 40, 80]);
    onSaveOutbound(newRecord);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Pengeluaran Material kWh Meter (Outbound)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pencatatan material keluar untuk Pasang Baru (PB) atau Ganti Meter (GM)
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
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Toggle Jenis Transaksi: PB vs GM */}
          <div className="bg-slate-100 dark:bg-slate-950/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-2">
            <button
              type="button"
              onClick={() => setJenisTransaksi('PB')}
              className={`btn-tactile flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                jenisTransaksi === 'PB'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              Pasang Baru (PB)
            </button>
            <button
              type="button"
              onClick={() => {
                setJenisTransaksi('GM');
                if (!gmKeterangan) setGmKeterangan('Error Periksa 1');
              }}
              className={`btn-tactile flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                jenisTransaksi === 'GM'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Ganti Meter (GM)
            </button>
          </div>

          {/* Kassen KS-606 Scanner Status Banner */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/80 border border-cyan-200 dark:border-cyan-500/30 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-slate-700 dark:text-slate-200">
                <strong className="text-cyan-700 dark:text-cyan-300">Scanner Kassen KS-606 Siap:</strong> Tembak nomor seri meter baru atau meter lama secara instan.
              </span>
            </div>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              Dongle 2.4G Aktif
            </span>
          </div>

          {/* Section 1: Scan & Pilih SN kWh Meter Baru */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                1. SN kWh Meter yang Dikeluarkan dari Gudang
              </label>
              <span className="text-[11px] text-cyan-600 dark:text-cyan-400">
                Stok tersedia: {availableMeters.length} unit
              </span>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={snKwhMeter}
                  onChange={(e) => handleSelectSerialNumber(e.target.value)}
                  placeholder="Ketik atau scan nomor seri kWh meter baru..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required
                />
              </div>

              <select
                onChange={(e) => handleSelectSerialNumber(e.target.value)}
                value={snKwhMeter}
                className="w-44 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-cyan-500 hidden sm:block font-mono"
              >
                <option value="">Pilih dari Stok...</option>
                {availableMeters.slice(0, 30).map((m) => {
                  const isPaska = m.category?.toLowerCase().includes('paska') || m.category?.toLowerCase().includes('pasca');
                  return (
                    <option key={m.serialNumber} value={m.serialNumber}>
                      {m.brand} • {isPaska ? '🔌 Paska' : '⚡ Pra'}: {m.serialNumber}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => onOpenScanner((sn) => handleSelectSerialNumber(sn))}
                className="btn-tactile px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shrink-0 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Scan SN
              </button>
            </div>

            {selectedMeterUnit && (
              <div className="p-2.5 bg-white dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 dark:text-slate-400">Merek:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedMeterUnit.brand}</span>
                  <span className="text-slate-400 dark:text-slate-500">•</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                    (selectedMeterUnit.category?.toLowerCase().includes('paska') || selectedMeterUnit.category?.toLowerCase().includes('pasca'))
                      ? 'bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300'
                      : 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}>
                    {(selectedMeterUnit.category?.toLowerCase().includes('paska') || selectedMeterUnit.category?.toLowerCase().includes('pasca'))
                      ? '🔌 kWh Meter Paskabayar'
                      : '⚡ kWh Meter Prabayar'}
                  </span>
                </div>
                <div className="text-cyan-600 dark:text-cyan-400 font-mono text-[11px]">
                  Lokasi: {selectedMeterUnit.rackId} / Tingkat {selectedMeterUnit.shelfLevel}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Data Pelanggan & Agenda PLN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tanggal & Waktu Pengeluaran:
              </label>
              <input
                type="text"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ID Pelanggan (ID PEL 12 Digit):
              </label>
              <input
                type="text"
                value={idPelanggan}
                onChange={(e) => setIdPelanggan(e.target.value)}
                placeholder="Contoh: 538100123456"
                maxLength={12}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nomor Agenda PLN:
              </label>
              <input
                type="text"
                value={nomorAgenda}
                onChange={(e) => setNomorAgenda(e.target.value)}
                placeholder="Contoh: 542410200001"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>
          </div>

          {/* Section 3: Nama, Tarif, Daya */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pelanggan:
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama lengkap pelanggan"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tarif Pelanggan:
              </label>
              <select
                value={tarif}
                onChange={(e) => setTarif(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                {PLN_TARIF_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Daya Pelanggan (VA):
              </label>
              <select
                value={daya}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDaya(val);
                  updateMcbForDaya(val);
                }}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                {PLN_DAYA_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} VA</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 4: Material Pelengkap (SN MCB, Segel, Kabel TW, Petugas) */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              2. Material Pelengkap & Petugas Pelaksana
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SN MCB:
                </label>
                <input
                  type="text"
                  value={snMcb}
                  onChange={(e) => setSnMcb(e.target.value)}
                  placeholder="Contoh: MCB-SCH-6A-8819"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Segel PLN:
                </label>
                <input
                  type="text"
                  value={segel}
                  onChange={(e) => setSegel(e.target.value)}
                  placeholder="Contoh: PLN-SGL-2026-8801"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kabel Twist (TW):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={kabelTw}
                    onChange={(e) => setKabelTw(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Meter</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Petugas / Yanbung:
                </label>
                <input
                  type="text"
                  value={petugas}
                  onChange={(e) => setPetugas(e.target.value)}
                  placeholder="Nama teknisi pelaksana"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 5: Specific Ganti Meter (GM) Details */}
          {jenisTransaksi === 'GM' && (
            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-600/40 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/50 pb-2">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Rincian Penggantian Meter (Ganti Meter / GM)
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                  Wajib isi keterangan & meter lama
                </span>
              </div>

              {/* Radio: Meter Gangguan vs Meter Tua */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  gmKategori === 'METER_GANGGUAN'
                    ? 'bg-amber-100/80 dark:bg-amber-500/20 border-amber-500 dark:border-amber-400 ring-1 ring-amber-500/30 dark:ring-amber-400/40 text-amber-900 dark:text-amber-200'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-50/50 dark:hover:bg-slate-900'
                }`}>
                  <input
                    type="radio"
                    name="gmCategory"
                    checked={gmKategori === 'METER_GANGGUAN'}
                    onChange={() => {
                      setGmKategori('METER_GANGGUAN');
                      setGmKeterangan('Error Periksa 1 (Tamper ground / LCD blank)');
                    }}
                    className="mt-0.5 text-amber-500 focus:ring-amber-400"
                  />
                  <div>
                    <span className="font-bold text-xs block text-slate-900 dark:text-white">Meter Gangguan</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      Meter rusak, error periksa, display blank, piringan macet, terbakar, dll.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  gmKategori === 'METER_TUA'
                    ? 'bg-amber-100/80 dark:bg-amber-500/20 border-amber-500 dark:border-amber-400 ring-1 ring-amber-500/30 dark:ring-amber-400/40 text-amber-900 dark:text-amber-200'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-50/50 dark:hover:bg-slate-900'
                }`}>
                  <input
                    type="radio"
                    name="gmCategory"
                    checked={gmKategori === 'METER_TUA'}
                    onChange={() => {
                      setGmKategori('METER_TUA');
                      setGmKeterangan('Peremajaan Meter Kadaluarsa (Masa Tera > 10 Tahun)');
                    }}
                    className="mt-0.5 text-amber-500 focus:ring-amber-400"
                  />
                  <div>
                    <span className="font-bold text-xs block text-slate-900 dark:text-white">Meter Tua</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      Peremajaan terencana (usia pakai & masa tera melebihi batas waktu PLN).
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    Nomor kWh Meter Lama: *
                  </label>
                  <input
                    type="text"
                    value={noMeterLama}
                    onChange={(e) => setNoMeterLama(e.target.value)}
                    placeholder="Contoh: 1410982341"
                    className="w-full bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-500/50 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    required={jenisTransaksi === 'GM'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    Stand Meter Lama (kWh):
                  </label>
                  <input
                    type="text"
                    value={standMeterLama}
                    onChange={(e) => setStandMeterLama(e.target.value)}
                    placeholder="Contoh: 18452.3"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    Nomor Segel Lama:
                  </label>
                  <input
                    type="text"
                    value={snSegelLama}
                    onChange={(e) => setSnSegelLama(e.target.value)}
                    placeholder="Contoh: PLN-LMA-44910"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Keterangan Penyebab / Alasan Ganti Meter: *
                </label>
                <input
                  type="text"
                  value={gmKeterangan}
                  onChange={(e) => setGmKeterangan(e.target.value)}
                  placeholder="Misal: Error periksa 1, display mati total, kover pecah, dll."
                  className="w-full bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-500/50 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required={jenisTransaksi === 'GM'}
                />
              </div>
            </div>
          )}

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
              className="btn-tactile px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-amber-600/20 dark:shadow-amber-900/40 hover:shadow-amber-500/20 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Keluarkan Material & Catat Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
