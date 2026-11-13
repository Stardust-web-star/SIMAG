/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, Upload, Keyboard, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { soundEffects, vibratePhone } from '../services/notificationService';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  subtitle?: string;
  expectedType?: 'carton' | 'meter' | 'any';
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Pindai Barcode / QR Code',
  subtitle = 'Arahkan kamera ke barcode dus karton atau nomor seri kWh meter',
  expectedType = 'any',
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'pln-barcode-reader';

  // Handle successful scan
  const handleDecoded = (decodedText: string) => {
    soundEffects.playScanSuccess();
    vibratePhone([80, 50, 80]);
    stopScanner();
    onScanSuccess(decodedText.trim());
    onClose();
  };

  // Start Camera
  const startScanner = async (cameraId?: string) => {
    setErrorMsg(null);
    try {
      if (html5QrCodeRef.current && isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = html5QrCode;

      const targetCam = cameraId || selectedCameraId || { facingMode: 'environment' };

      await html5QrCode.start(
        targetCam,
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.333,
        },
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {
          // Frame scan error - ignore to keep scanning smoothly
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsScanning(false);
      setErrorMsg('Kamera tidak dapat diakses atau diblokir. Anda dapat menggunakan tab Unggah Foto atau Input Manual.');
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        // Ignore stop errors
      }
      setIsScanning(false);
    }
  };

  // Initialize cameras
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length) {
            setCameras(devices);
            // Prefer back camera if available
            const backCam = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('belakang') || 
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
            );
            const chosenId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(chosenId);
            startScanner(chosenId);
          } else {
            startScanner();
          }
        })
        .catch(() => {
          startScanner();
        });
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab]);

  // Clean up on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setManualInput('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Handle image file scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMsg(null);
      const scanner = new Html5Qrcode('file-scan-temp');
      const result = await scanner.scanFile(file, true);
      handleDecoded(result);
    } catch (err: any) {
      setErrorMsg('Barcode tidak terbaca dari gambar ini. Pastikan gambar jelas dan tidak silau.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:rotate-90 transition-all duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/50 p-1.5 gap-1">
          <button
            onClick={() => setActiveTab('camera')}
            className={`btn-tactile flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Kamera Langsung
          </button>
          <button
            onClick={() => {
              stopScanner();
              setActiveTab('upload');
            }}
            className={`btn-tactile flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Unggah Gambar
          </button>
          <button
            onClick={() => {
              stopScanner();
              setActiveTab('manual');
            }}
            className={`btn-tactile flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Input Manual
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-4/3 max-h-[300px] bg-slate-950 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 flex items-center justify-center shadow-inner">
                <div id={readerElementId} className="w-full h-full overflow-hidden"></div>
                
                {/* Aiming Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-36 border-2 border-cyan-400/80 rounded-xl relative shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-300"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-300"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-300"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-300"></div>
                    <div className="w-full h-0.5 bg-cyan-400/70 absolute top-1/2 -translate-y-1/2 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {cameras.length > 1 && (
                <div className="mt-3 w-full flex items-center gap-2">
                  <label className="text-xs text-slate-600 dark:text-slate-400 shrink-0">Pilih Lensa:</label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startScanner(e.target.value);
                    }}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
                  >
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Kamera ${cam.id.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-950/40">
              <Upload className="w-12 h-12 text-cyan-600 dark:text-cyan-400 mb-3 animate-bounce" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center">
                Pilih atau Ambil Foto Barcode
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs mt-1 mb-4">
                Foto label barcode pada kardus karton atau stiker serial number kWh meter PLN.
              </p>
              <label className="cursor-pointer px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow transition-colors flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Pilih Berkas Foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <div id="file-scan-temp" className="hidden"></div>
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Ketik Nomor Barcode / Serial Number:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualInput.trim()) {
                        handleDecoded(manualInput);
                      }
                    }}
                    placeholder="Contoh: MEL-BOX-202610-001 atau 3214550005"
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    autoFocus
                  />
                  <button
                    onClick={() => manualInput.trim() && handleDecoded(manualInput)}
                    disabled={!manualInput.trim()}
                    className="btn-tactile px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Pakai
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Barcode Simulator for Warehouse Testing */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Simulasi Cepat Barcode Gudang PLN (Demo Barcode):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {expectedType !== 'meter' && (
                <>
                  <button
                    onClick={() => handleDecoded('MEL-BOX-202610-088')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950 hover:border-cyan-400 dark:hover:border-cyan-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-cyan-700 dark:text-cyan-300 transition-colors cursor-pointer"
                  >
                    📦 Melcoinda (10 pcs)
                  </button>
                  <button
                    onClick={() => handleDecoded('ITR-BOX-202610-911')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:border-emerald-400 dark:hover:border-emerald-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                  >
                    📦 Itron (12 pcs)
                  </button>
                  <button
                    onClick={() => handleDecoded('HEX-BOX-202610-605')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 hover:border-amber-400 dark:hover:border-amber-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
                  >
                    📦 Hexing AMI (10 pcs)
                  </button>
                  <button
                    onClick={() => handleDecoded('STR-BOX-202610-101')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-pink-50 dark:hover:bg-pink-950 hover:border-pink-400 dark:hover:border-pink-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-pink-700 dark:text-pink-300 transition-colors cursor-pointer"
                  >
                    📦 Smart/Star (8 pcs)
                  </button>
                </>
              )}
              {expectedType !== 'carton' && (
                <>
                  <button
                    onClick={() => handleDecoded('3214550003')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950 hover:border-cyan-400 dark:hover:border-cyan-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-sky-700 dark:text-sky-300 transition-colors cursor-pointer"
                  >
                    ⚡ SN Meter 3214550003
                  </button>
                  <button
                    onClick={() => handleDecoded('4520980005')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:border-emerald-400 dark:hover:border-emerald-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                  >
                    ⚡ SN Meter 4520980005
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>Gunakan pencahayaan yang cukup di area rak gudang</span>
          <button
            onClick={onClose}
            className="btn-tactile px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
