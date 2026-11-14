/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  googleCloudSignIn,
  googleSignIn, 
  logout, 
  getAccessToken 
} from '../services/googleAuth';
import { 
  findOrCreateWarehouseSpreadsheet, 
  GoogleSheetsSyncResult 
} from '../services/googleSheets';
import { CloudSyncStatus } from '../services/firestoreSync';
import { 
  X, 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  Check,
  Copy,
  Zap,
  Cloud,
  UploadCloud,
  DownloadCloud
} from 'lucide-react';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  hasSheetsToken: boolean;
  onUserChange: (user: User | null, hasToken?: boolean) => void;
  cloudSyncStatus: CloudSyncStatus;
  onForceUploadCloud: () => Promise<void>;
  onPullFromCloud: () => Promise<void>;
  lastSyncResult: GoogleSheetsSyncResult | null;
  autoSyncEnabled: boolean;
  onAutoSyncChange: (enabled: boolean) => void;
  autoSyncState: {
    status: 'idle' | 'syncing' | 'synced' | 'error' | 'needs-reauth';
    message?: string;
    lastReason?: string;
  };
  onTriggerSyncNow: (reason?: string, overrideSpreadsheetId?: string) => Promise<GoogleSheetsSyncResult | null>;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  hasSheetsToken,
  onUserChange,
  cloudSyncStatus,
  onForceUploadCloud,
  onPullFromCloud,
  lastSyncResult,
  autoSyncEnabled,
  onAutoSyncChange,
  autoSyncState,
  onTriggerSyncNow,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [isOpeningSheet, setIsOpeningSheet] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'enable-auto-sync' | 'manual-sync' | null>(null);
  const [spreadsheetInfo, setSpreadsheetInfo] = useState<{ id: string; url: string; title: string } | null>(
    lastSyncResult ? { id: lastSyncResult.spreadsheetId, url: lastSyncResult.spreadsheetUrl, title: 'PLN Gudang - Sistem Stok & Transaksi kWh Meter' } : null
  );

  useEffect(() => {
    if (lastSyncResult) {
      setSpreadsheetInfo({
        id: lastSyncResult.spreadsheetId,
        url: lastSyncResult.spreadsheetUrl,
        title: 'PLN Gudang - Sistem Stok & Transaksi kWh Meter',
      });
    }
  }, [lastSyncResult]);

  // Auto-discover existing spreadsheet if logged in & Sheets token cached
  useEffect(() => {
    if (currentUser && hasSheetsToken && !spreadsheetInfo) {
      getAccessToken().then(token => {
        if (token) {
          findOrCreateWarehouseSpreadsheet()
            .then(info => setSpreadsheetInfo(info))
            .catch(() => {
              // Silently wait until sync or manual open
            });
        }
      });
    }
  }, [currentUser, hasSheetsToken, spreadsheetInfo]);

  // Reset transient confirmations when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmAction(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleOpenSpreadsheet = async () => {
    setErrorMsg(null);
    if (!hasSheetsToken) {
      setErrorMsg('Klik "Aktifkan Izin Google Sheets" terlebih dahulu agar aplikasi dapat membuka Spreadsheet di sesi browser ini.');
      return;
    }
    try {
      let target = spreadsheetInfo;
      if (!target) {
        setIsOpeningSheet(true);
        target = await findOrCreateWarehouseSpreadsheet();
        setSpreadsheetInfo(target);
      }

      // If auto-sync is already approved & sheet hasn't been populated in this session yet, populate before opening
      if (autoSyncEnabled && autoSyncState.status === 'idle') {
        await onTriggerSyncNow('Sinkronisasi sebelum buka sheet', target.id);
      }

      window.open(target.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('Error opening spreadsheet:', err);
      setErrorMsg(err.message || 'Gagal membuka Google Spreadsheet. Pastikan koneksi dan izin Google Sheets aktif.');
    } finally {
      setIsOpeningSheet(false);
    }
  };

  const handleCopyLink = () => {
    if (spreadsheetInfo?.url) {
      navigator.clipboard.writeText(spreadsheetInfo.url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleCloudConnect = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await googleCloudSignIn();
      onUserChange(res.user, res.hasSheetsToken);
      setSuccessMsg(
        `Terhubung sebagai ${res.user.email}. Sinkronisasi Cloud Dua Arah (Google AI Studio ⇄ Vercel) kini aktif!`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onUserChange(res.user, Boolean(res.accessToken));
        if (res.accessToken) {
          const info = await findOrCreateWarehouseSpreadsheet().catch(() => null);
          if (info) {
            setSpreadsheetInfo(info);
          }

          if (autoSyncEnabled) {
            setIsSyncing(true);
            try {
              const syncRes = await onTriggerSyncNow('Rekap otomatis saat terhubung', info?.id);
              if (syncRes) {
                setSuccessMsg(`Terhubung sebagai ${res.user.email}. Sinkronisasi Cloud Dua Arah & Google Sheets aktif (${syncRes.updatedAt})!`);
              } else {
                setSuccessMsg(`Berhasil terhubung dengan Google (${res.user.email}). Sinkronisasi Cloud Dua Arah aktif!`);
              }
            } finally {
              setIsSyncing(false);
            }
          } else {
            setConfirmAction('enable-auto-sync');
            setSuccessMsg(`Izin Google Sheets & Cloud Sync aktif (${res.user.email}).`);
          }
        } else {
          setSuccessMsg(`Terhubung dengan Cloud Sync (${res.user.email}). Klik "Aktifkan Izin Sheets" jika ingin sinkron ke Google Spreadsheet.`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleForceUploadCloud = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploadingCloud(true);
    try {
      await onForceUploadCloud();
      setSuccessMsg('Data gudang lokal berhasil diunggah ke Cloud dan disinkronkan dua arah (Google AI Studio ⇄ Vercel).');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunggah data lokal ke Cloud.');
    } finally {
      setIsUploadingCloud(false);
    }
  };

  const handlePullFromCloud = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsPullingCloud(true);
    try {
      await onPullFromCloud();
      setSuccessMsg('Data terbaru dari Cloud berhasil dimuat ke browser ini.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengambil data terbaru dari Cloud.');
    } finally {
      setIsPullingCloud(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onUserChange(null, false);
    setSpreadsheetInfo(null);
    setSuccessMsg(null);
    setConfirmAction(null);
  };

  const executeSync = async (enableAutoSyncToo: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setConfirmAction(null);
    if (!hasSheetsToken) {
      setErrorMsg('Sesi akses Google Sheets berakhir setelah refresh halaman. Silakan klik "Aktifkan Izin Google Sheets" terlebih dahulu.');
      return;
    }
    setIsSyncing(true);
    try {
      let targetSpreadsheet = spreadsheetInfo;
      if (!targetSpreadsheet) {
        targetSpreadsheet = await findOrCreateWarehouseSpreadsheet();
        setSpreadsheetInfo(targetSpreadsheet);
      }

      if (enableAutoSyncToo) {
        onAutoSyncChange(true);
      }

      const result = await onTriggerSyncNow(
        enableAutoSyncToo ? 'Aktivasi rekap otomatis' : 'Sinkronisasi manual',
        targetSpreadsheet.id
      );

      if (result) {
        setSuccessMsg(
          enableAutoSyncToo
            ? `Rekap otomatis aktif! Seluruh data berhasil disinkronkan pada ${result.updatedAt}.`
            : `Sinkronisasi Google Sheets berhasil pada ${result.updatedAt}!`
        );
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat sinkronisasi Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const isBusy = isSyncing || autoSyncState.status === 'syncing';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Sinkronisasi Cloud & Google Sheets</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sinkronisasi dua arah Google AI Studio ⇄ Vercel & rekap otomatis Google Sheets
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Account & Auto Cloud Sync Status */}
          {!currentUser ? (
            <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sinkronisasi Otomatis Membutuhkan Provider Anonymous di Firebase
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  Aktifkan provider <strong>Anonymous</strong> 1 kali di{' '}
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0109040418/authentication/providers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-bold text-cyan-600 dark:text-cyan-400"
                  >
                    Firebase Authentication Console
                  </a>{' '}
                  agar sinkronisasi Google AI Studio ⇄ Vercel berjalan otomatis tanpa klik tombol apapun. Atau gunakan tombol Google di bawah sebagai alternatif:
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloudConnect}
                  disabled={isSigningIn}
                  className="btn-tactile flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-slate-50 dark:hover:bg-slate-100 text-slate-800 border border-slate-300 dark:border-transparent rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all disabled:opacity-60 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected Session Card (either Anonymous Auto-Sync or Google Account) */}
              {!currentUser.isAnonymous ? (
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="Avatar"
                        className="w-9 h-9 rounded-full border border-cyan-500/40"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-cyan-100 dark:bg-cyan-600/30 text-cyan-700 dark:text-cyan-300 font-bold flex items-center justify-center text-xs">
                        {currentUser.displayName?.slice(0, 2).toUpperCase() || 'PLN'}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {currentUser.displayName || 'Petugas Gudang PLN'}
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{currentUser.email}</div>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Putuskan Akun Google Sheets"
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-500/35">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        Koneksi Cloud Otomatis Terpasang
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Sinkronisasi AI Studio ⇄ Vercel berjalan otomatis di latar belakang tanpa login Google
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Two-Way Cloud Sync Status Card */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${
                cloudSyncStatus.status === 'error'
                  ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/40'
                  : 'bg-cyan-50/60 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-500/40'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      cloudSyncStatus.status === 'error'
                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        : 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                    }`}>
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>Cloud Sync Dua Arah (AI Studio ⇄ Vercel)</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          cloudSyncStatus.status === 'synced'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                            : cloudSyncStatus.status === 'error'
                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            : 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                        }`}>
                          {cloudSyncStatus.status === 'synced'
                            ? 'OTOMATIS AKTIF'
                            : cloudSyncStatus.status === 'syncing' || cloudSyncStatus.status === 'connecting'
                            ? 'MENYINKRONKAN'
                            : cloudSyncStatus.status === 'error'
                            ? 'ERROR'
                            : 'MENUNGGU'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {cloudSyncStatus.message || 'Setiap update stok, rak, transaksi & user tersinkron otomatis ke semua domain.'}
                        {cloudSyncStatus.lastSyncedAt ? ` · Update terakhir: ${cloudSyncStatus.lastSyncedAt}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isPullingCloud || isUploadingCloud}
                    onClick={handlePullFromCloud}
                    className="btn-tactile px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <DownloadCloud className={`w-3.5 h-3.5 ${isPullingCloud ? 'animate-pulse' : ''}`} />
                    <span>{isPullingCloud ? 'Mengambil...' : 'Ambil Data dari Cloud'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isUploadingCloud || isPullingCloud}
                    onClick={handleForceUploadCloud}
                    className="btn-tactile px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isUploadingCloud ? 'animate-pulse' : ''}`} />
                    <span>{isUploadingCloud ? 'Mengunggah...' : 'Upload Browser Ini ke Cloud'}</span>
                  </button>
                </div>
              </div>

              {/* Sheets OAuth Authorization notice when no Sheets token is cached */}
              {!hasSheetsToken && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <div className="font-bold">Hubungkan Akun Google untuk Google Sheets</div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      Sinkronisasi Cloud AI Studio ⇄ Vercel sudah aktif otomatis. Hubungkan akun Google hanya jika ingin merekap data ke Google Spreadsheet pribadi Anda.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isSigningIn}
                    className="btn-tactile px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    {isSigningIn ? 'Menghubungkan...' : 'Aktifkan Izin Sheets'}
                  </button>
                </div>
              )}

              {/* Explicit Confirmation Dialog for Enabling Auto-Sync or Manual Sheet Mutation */}
              {confirmAction && (
                <div className="p-4 rounded-xl border-2 border-emerald-400 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30 space-y-3 animate-scale-in">
                  <div className="flex items-start gap-2.5">
                    <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {confirmAction === 'enable-auto-sync'
                          ? 'Aktifkan Rekap Otomatis ke Google Sheets?'
                          : 'Konfirmasi Pembaruan Data Google Sheets'}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {confirmAction === 'enable-auto-sync'
                          ? 'Dengan mengaktifkan fitur ini, setiap kali ada material masuk (Inbound) maupun keluar (Outbound), SIMAG PLN akan otomatis memperbarui spreadsheet "PLN Gudang - Sistem Stok & Transaksi kWh Meter".'
                          : 'Seluruh 4 tab (RANGKUMAN_STOK, PENGELUARAN_MATERIAL, PENERIMAAN_KARTON, PETA_LOKASI_RAK) pada Google Spreadsheet akan diperbarui sesuai data gudang terbaru.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="btn-tactile px-3.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      {confirmAction === 'enable-auto-sync' ? 'Nanti Saja (Manual)' : 'Batal'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => executeSync(confirmAction === 'enable-auto-sync')}
                      className="btn-tactile px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {confirmAction === 'enable-auto-sync'
                        ? 'Ya, Aktifkan Auto-Sync & Sinkronkan'
                        : 'Ya, Sinkronkan Sekarang'}
                    </button>
                  </div>
                </div>
              )}

              {/* Auto-Sync Status & Toggle Card */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                autoSyncEnabled
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-500/40'
                  : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
              }`}>
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    autoSyncEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Rekap Otomatis (Inbound & Outbound)</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        autoSyncEnabled
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {autoSyncEnabled ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      {autoSyncEnabled
                        ? 'Setiap barang masuk / keluar langsung terekap otomatis ke Google Sheet.'
                        : 'Aktifkan agar barang masuk & keluar langsung tercatat tanpa klik manual.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (autoSyncEnabled) {
                      onAutoSyncChange(false);
                      setSuccessMsg('Rekap otomatis dijeda. Anda masih dapat menyinkronkan secara manual.');
                    } else {
                      setConfirmAction('enable-auto-sync');
                    }
                  }}
                  className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                    autoSyncEnabled
                      ? 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  }`}
                >
                  {autoSyncEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>

              {/* Synchronized Sheet Info */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">File Spreadsheet Aktif:</span>
                  {spreadsheetInfo && (
                    <a
                      href={spreadsheetInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      <span>Buka Spreadsheet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 truncate">
                  📊 PLN Gudang - Sistem Stok & Transaksi kWh Meter
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p>Tab yang disinkronkan:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                    <li>RANGKUMAN_STOK (Rekapitulasi per merek & status)</li>
                    <li>PENGELUARAN_MATERIAL (Semua transaksi PB & GM)</li>
                    <li>PENERIMAAN_KARTON (Log dus masuk, isi unit & daftar SN)</li>
                    <li>PETA_LOKASI_RAK (Kapasitas & keterisian fisik rak)</li>
                  </ul>
                </div>
              </div>

              {lastSyncResult && (
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
                  <span>Sinkronisasi terakhir:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{lastSyncResult.updatedAt}</span>
                </div>
              )}

              {/* Sync Action Button */}
              <button
                type="button"
                onClick={() => setConfirmAction('manual-sync')}
                disabled={isBusy}
                className="btn-tactile w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                <span>{isBusy ? 'Menyinkronkan ke Google Sheets...' : 'Sinkronkan Sekarang ke Google Sheets'}</span>
              </button>

              {/* Direct Open Google Spreadsheet Feature */}
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800/80 mt-2">
                <button
                  type="button"
                  onClick={handleOpenSpreadsheet}
                  disabled={isOpeningSheet}
                  className="btn-tactile w-full py-3 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-750 hover:border-emerald-400 dark:hover:border-emerald-500/60 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm dark:shadow-md transition-all group cursor-pointer"
                >
                  {isOpeningSheet ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>Menyiapkan File Spreadsheet...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </div>
                      <span>Buka Google Spreadsheet (Tab Baru)</span>
                      <ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </>
                  )}
                </button>

                {/* Subtext with Quick Copy Link */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-0.5">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                    <span>Akses kolaboratif tim real-time</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    disabled={!spreadsheetInfo?.url}
                    className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 disabled:opacity-40 flex items-center gap-1 transition-colors font-medium cursor-pointer"
                    title="Salin tautan Google Spreadsheet"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tautan Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Link Spreadsheet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>
            {autoSyncEnabled
              ? 'Rekap otomatis aktif untuk setiap barang masuk & keluar'
              : 'Sinkronisasi otomatis saat pengeluaran / penerimaan barang'}
          </span>
          <button
            onClick={onClose}
            className="btn-tactile px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
