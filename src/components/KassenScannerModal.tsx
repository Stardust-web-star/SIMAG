/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  Zap, 
  HelpCircle, 
  Radio, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  Usb,
  Volume2
} from 'lucide-react';
import { hardwareScannerService, ScanEventDetail } from '../services/hardwareScannerService';
import { soundEffects } from '../services/notificationService';

interface KassenScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestScanSuccess?: (code: string) => void;
}

export const KassenScannerModal: React.FC<KassenScannerModalProps> = ({
  isOpen,
  onClose,
  onTestScanSuccess,
}) => {
  const [testResult, setTestResult] = useState<ScanEventDetail | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanEventDetail[]>([]);
  const [hidDeviceName, setHidDeviceName] = useState<string | null>(null);
  const [isPairingWebHid, setIsPairingWebHid] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus sandbox input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);

    // Subscribe to hardware scanner events
    const unsubscribe = hardwareScannerService.subscribe((detail) => {
      setTestResult(detail);
      setScanHistory((prev) => [detail, ...prev.slice(0, 9)]);
      if (onTestScanSuccess) {
        onTestScanSuccess(detail.code);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const handlePairWebHid = async () => {
    setIsPairingWebHid(true);
    setPairError(null);
    try {
      const name = await hardwareScannerService.requestWebHidConnection();
      if (name) {
        setHidDeviceName(name);
        soundEffects.playSuccess();
      }
    } catch (err: any) {
      setPairError(err.message || 'Gagal menyambungkan WebHID. Namun jangan khawatir, scanner Kassen KS-606 tetap aktif bekerja via mode USB Keyboard Wedge bawaan!');
    } finally {
      setIsPairingWebHid(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Alat Pemindai: Kassen KS-606</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  STANDBY SIAP SCAN
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pistol Barcode Wireless 2.4G & USB HID (Receiver Dongle KS-606)
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Device Profile Card with Photos */}
          <div className="bg-slate-50 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/assets/aistudio/WhatsApp_Image_2026-10-21_at_10.55.27_75dbe010.jpeg"
                alt="USB Dongle KS-606"
                className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-md"
              />
              <img
                src="/assets/aistudio/WhatsApp_Image_2026-10-21_at_10.55.29_31536400.jpeg"
                alt="Scanner Kassen KS-606"
                className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-md"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Kassen KS-606 2D Wireless Barcode Gun</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                  Receiver: KS-606
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Scanner ini telah <strong>didukung penuh secara otomatis</strong> di seluruh layar SIMAG PLN. Anda cukup menembakkan pelatuk scanner ke barcode tanpa perlu repot mengklik kolom input apapun!
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Plug & Play 2.4G
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Auto-Enter Suffix
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sinyal Laser & Kamera 2D
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Hardware Test Sandbox */}
          <div className="bg-slate-50 dark:bg-slate-950/90 p-4 rounded-xl border border-cyan-200 dark:border-cyan-500/40 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                Uji Tembak Scanner Kassen KS-606 Sekarang:
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Arahkan laser & tekan pelatuk
              </span>
            </div>

            {/* Test input (focused for convenience, but global listener also catches it) */}
            <input
              ref={inputRef}
              type="text"
              readOnly
              placeholder="Tarik pelatuk scanner Kassen KS-606 Anda ke barcode apa saja..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-center text-cyan-700 dark:text-cyan-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400"
            />

            {/* Test Scan Result Card */}
            {testResult ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/50 rounded-xl space-y-1.5 animate-scale-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Barcode Berhasil Diterima dari Kassen KS-606!
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    Kecepatan: {testResult.durationMs}ms
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-slate-800 font-mono text-sm font-extrabold text-slate-900 dark:text-white break-all flex items-center justify-between">
                  <span>{testResult.code}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 font-sans font-bold">
                    VALID
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada data scan yang diterima. Silakan arahkan Kassen KS-606 ke barcode kardus atau kWh meter.
              </div>
            )}
          </div>

          {/* Step-by-Step Connection Guide */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Cara Penggunaan Kassen KS-606 di Gudang PLN:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-cyan-600 dark:text-cyan-400 block font-mono">Langkah 1:</span>
                <p className="text-slate-600 dark:text-slate-300">
                  Colokkan USB Receiver dongle hitam bertuliskan <strong>"KS-606"</strong> ke port USB laptop/komputer.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-cyan-600 dark:text-cyan-400 block font-mono">Langkah 2:</span>
                <p className="text-slate-600 dark:text-slate-300">
                  Tekan pelatuk tembak Kassen KS-606 hingga lampu indikator biru di bagian atas scanner menyala.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-cyan-600 dark:text-cyan-400 block font-mono">Langkah 3:</span>
                <p className="text-slate-600 dark:text-slate-300">
                  Tembakkan laser ke barcode dus karton atau SN kWh meter. Data langsung terisi secara instan!
                </p>
              </div>
            </div>
          </div>

          {/* Optional WebHID Connect Button */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Usb className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Koneksi Langsung WebHID (Opsional Browser)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {hidDeviceName ? `Tersambung ke: ${hidDeviceName}` : 'Tingkat akurasi tinggi via WebHID API'}
                </span>
              </div>
            </div>

            <button
              onClick={handlePairWebHid}
              disabled={isPairingWebHid}
              className="btn-tactile px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Usb className="w-3.5 h-3.5" />
              {isPairingWebHid ? 'Menghubungkan...' : 'Deteksi USB'}
            </button>
          </div>
          {pairError && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/40 rounded-lg px-3 py-2">
              {pairError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>Kassen KS-606 siap digunakan di seluruh halaman SIMAG PLN</span>
          <button
            onClick={onClose}
            className="btn-tactile px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-colors shadow-sm cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
