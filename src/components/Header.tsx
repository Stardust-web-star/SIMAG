/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { SimagSession } from '../types/auth';
import { 
  Zap, 
  Camera, 
  Plus, 
  Send, 
  FileSpreadsheet, 
  Bell, 
  Layers, 
  ListFilter, 
  BarChart3, 
  RotateCcw,
  ScanLine,
  ChevronDown,
  Sun,
  Moon,
  Users,
  UserCheck,
  LogOut,
  ShieldCheck
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'racks' | 'stock' | 'reports' | 'users';
  onTabChange: (tab: 'racks' | 'stock' | 'reports' | 'users') => void;
  onOpenScanner: () => void;
  onOpenKassenModal: () => void;
  onOpenInbound: () => void;
  onOpenOutbound: () => void;
  onOpenGoogleSheets: () => void;
  onOpenNotifications: () => void;
  unreadAlertCount: number;
  currentUser: User | null;
  autoSyncEnabled?: boolean;
  autoSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error' | 'needs-reauth';
  onResetData: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  simagSession: SimagSession;
  onLogoutSimag: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenScanner,
  onOpenKassenModal,
  onOpenInbound,
  onOpenOutbound,
  onOpenGoogleSheets,
  onOpenNotifications,
  unreadAlertCount,
  currentUser,
  autoSyncEnabled = false,
  autoSyncStatus = 'idle',
  onResetData,
  theme,
  onToggleTheme,
  simagSession,
  onLogoutSimag,
}) => {
  const [isScannerDropdownOpen, setIsScannerDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const scannerDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        scannerDropdownRef.current &&
        !scannerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsScannerDropdownOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    if (isScannerDropdownOpen || isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isScannerDropdownOpen, isUserMenuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl transition-colors duration-200">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 sm:h-11 w-9 sm:w-10 bg-white rounded-xl p-1 shadow-sm shadow-slate-300/60 dark:shadow-yellow-500/10 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700/80">
            <img 
              src="/assets/aistudio/Logo_PLN_67ac91e8.png" 
              alt="Logo Resmi PT PLN (Persero)" 
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight leading-tight truncate">
              SIMAG PLN <span className="text-cyan-600 dark:text-cyan-400 font-semibold text-xs sm:text-sm">kWh Meter</span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
              Sistem Manajemen Stok & Pelacakan Rak Material Distribusi
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

          {/* Unified Scanner Dropdown Menu (Kassen KS-606 & Kamera HP) */}
          <div className="relative" ref={scannerDropdownRef}>
            <button
              type="button"
              onClick={() => setIsScannerDropdownOpen(!isScannerDropdownOpen)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all shadow-sm cursor-pointer ${
                isScannerDropdownOpen
                  ? 'bg-cyan-50 dark:bg-cyan-950/90 border-cyan-500 dark:border-cyan-400 text-cyan-800 dark:text-cyan-200 ring-2 ring-cyan-500/25 shadow-cyan-500/10'
                  : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border-slate-300 dark:border-cyan-500/30 hover:border-cyan-500 dark:hover:border-cyan-400/50'
              }`}
              title="Menu Pemindai Barcode (Kamera HP & Scanner Kassen KS-606)"
              aria-expanded={isScannerDropdownOpen}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <ScanLine className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="font-semibold hidden sm:inline">Scan Barcode</span>
              <span className="sm:hidden font-semibold">Scan</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
                  isScannerDropdownOpen ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''
                }`}
              />
            </button>

            {/* Dropdown Popup with Smooth Scale Entrance */}
            {isScannerDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl p-2 z-50 animate-scale-in">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                      PILIH METODE SCANNER
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Gudang kWh Meter PLN
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    Siap
                  </span>
                </div>

                <div className="mt-1 space-y-1">
                  {/* Option 1: Kamera HP / Webcam */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsScannerDropdownOpen(false);
                      onOpenScanner();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-start gap-3 group border border-transparent hover:border-cyan-300 dark:hover:border-cyan-500/30 cursor-pointer"
                  >
                    <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/25 group-hover:scale-105 transition-all">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-700 dark:group-hover:text-cyan-300">
                          Kamera HP / Perangkat
                        </span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/20">
                          Optical
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        Pindai barcode / QR kode dari kamera smartphone atau webcam
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Scanner Fisik Kassen KS-606 */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsScannerDropdownOpen(false);
                      onOpenKassenModal();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-800 transition-all flex items-start gap-3 group border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-500/40 cursor-pointer"
                  >
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200/70 dark:group-hover:bg-emerald-500/25 group-hover:scale-105 transition-all">
                      <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 flex items-center gap-1.5">
                          Kassen KS-606
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">
                          Wireless 2.4G / USB
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        Status koneksi alat nirkabel, USB dongle, panduan & uji scan
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inbound Button */}
          <button
            onClick={onOpenInbound}
            className="btn-tactile px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-900/20 dark:shadow-cyan-950/40 hover:shadow-cyan-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Masuk (Inbound)</span>
            <span className="sm:hidden">Masuk</span>
          </button>

          {/* Outbound Button */}
          <button
            onClick={onOpenOutbound}
            className="btn-tactile px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-900/20 dark:shadow-amber-950/40 hover:shadow-amber-500/20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar (PB/GM)</span>
            <span className="sm:hidden">Keluar</span>
          </button>

          {/* Google Sheets Sync Button */}
          <button
            onClick={onOpenGoogleSheets}
            className={`btn-tactile px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
              currentUser
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-sm'
                : autoSyncEnabled
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-600'
            }`}
            title="Sinkronisasi Google Sheets"
          >
            {currentUser && autoSyncEnabled && (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  autoSyncStatus === 'syncing'
                    ? 'bg-cyan-500 animate-ping'
                    : autoSyncStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                }`}
              />
            )}
            <FileSpreadsheet className={`w-4 h-4 ${!currentUser && autoSyncEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
            <span className="hidden lg:inline">
              {currentUser
                ? autoSyncStatus === 'syncing'
                  ? 'Menyinkronkan...'
                  : autoSyncEnabled
                  ? 'Sheets Auto-Sync'
                  : 'Sheets Terhubung'
                : autoSyncEnabled
                ? 'Hubungkan Sheets'
                : 'Google Sheets'}
            </span>
          </button>

          {/* Theme Toggle (Light Mode / Dark Mode) */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn-tactile px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors"
            title={theme === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
            aria-label={theme === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="hidden md:inline">Dark</span>
              </>
            )}
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="btn-tactile relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 cursor-pointer"
            title="Notifikasi & Peringatan Stok"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce shadow-md">
                {unreadAlertCount}
              </span>
            )}
          </button>

          {/* Reset Demo Data Button */}
          <button
            onClick={onResetData}
            title="Muat Ulang Data Awal Gudang"
            className="btn-tactile p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hidden sm:block cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* SIMAG User Session & Logout Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(prev => !prev)}
              className={`btn-tactile px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isUserMenuOpen
                  ? 'bg-cyan-50 dark:bg-cyan-950/80 border-cyan-400 text-cyan-800 dark:text-cyan-200'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
              title={`Akun SIMAG: ${simagSession.nip} (${simagSession.role})`}
              aria-expanded={isUserMenuOpen}
            >
              <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="hidden xl:inline font-mono tabular-nums">{simagSession.nip}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl p-2 z-50 animate-scale-in">
                <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {simagSession.nama}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>{simagSession.nip}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans font-semibold text-cyan-700 dark:text-cyan-400 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {simagSession.role}
                    </span>
                  </div>
                </div>

                <div className="mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onTabChange('users');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Management User</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogoutSimag();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout (Keluar SIMAG)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex gap-2 border-t border-slate-200 dark:border-slate-800/80 pt-1.5 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onTabChange('racks')}
          className={`btn-tactile flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'racks'
              ? 'bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-300 shadow-xs dark:shadow-sm dark:shadow-cyan-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Layers className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'racks' ? 'scale-110 text-cyan-600 dark:text-cyan-400' : ''}`} />
          <span>Visualisasi Rak Gudang</span>
        </button>

        <button
          onClick={() => onTabChange('stock')}
          className={`btn-tactile flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'stock'
              ? 'bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-300 shadow-xs dark:shadow-sm dark:shadow-cyan-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <ListFilter className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'stock' ? 'scale-110 text-cyan-600 dark:text-cyan-400' : ''}`} />
          <span>Daftar Stok Meter</span>
        </button>

        <button
          onClick={() => onTabChange('reports')}
          className={`btn-tactile flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-300 shadow-xs dark:shadow-sm dark:shadow-cyan-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <BarChart3 className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'reports' ? 'scale-110 text-cyan-600 dark:text-cyan-400' : ''}`} />
          <span>Laporan Berkala & BAST</span>
        </button>

        <button
          onClick={() => onTabChange('users')}
          className={`btn-tactile flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-300 shadow-xs dark:shadow-sm dark:shadow-cyan-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Users className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'users' ? 'scale-110 text-cyan-600 dark:text-cyan-400' : ''}`} />
          <span>Management User</span>
        </button>
      </div>
    </header>
  );
};
