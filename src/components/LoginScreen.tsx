/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  Clock,
  Info,
  Sun,
  Moon,
} from 'lucide-react';
import { SimagSession, SimagUser } from '../types/auth';
import { authenticateSimagUser } from '../services/simagAuthService';

interface LoginScreenProps {
  onLoginSuccess: (session: SimagSession, users: SimagUser[]) => void;
  inactivityNotice?: string | null;
  onDismissNotice?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  inactivityNotice,
  onDismissNotice,
  theme,
  onToggleTheme,
}) => {
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [bgError, setBgError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (onDismissNotice) onDismissNotice();

    setIsSubmitting(true);
    try {
      const result = authenticateSimagUser(nip, password);
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      onLoginSuccess(result.session, result.users);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 bg-[#070f1d] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      {/* Real PLN Warehouse Photo Background */}
      {!bgError && (
        <img
          src="/assets/aistudio/IMG-20251028-WA0032_35f1ff2c.jpg"
          alt="Latar Belakang Gudang Material PLN"
          referrerPolicy="no-referrer"
          onError={() => setBgError(true)}
          className="pointer-events-none fixed inset-0 w-full h-full object-cover object-center select-none"
        />
      )}

      {/* Measured Scrim Overlay so warehouse photo remains visible & login card stays crisp */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            theme === 'dark'
              ? 'linear-gradient(135deg, rgba(4, 15, 24, 0.72) 0%, rgba(6, 28, 36, 0.56) 50%, rgba(4, 12, 24, 0.76) 100%)'
              : 'linear-gradient(135deg, rgba(15, 23, 42, 0.45) 0%, rgba(6, 42, 48, 0.35) 50%, rgba(15, 23, 42, 0.50) 100%)',
        }}
      />

      {/* Top-right Theme Toggle */}
      <button
        type="button"
        onClick={onToggleTheme}
        className="fixed top-4 right-4 z-20 px-3 py-2 rounded-xl bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
        title={theme === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Light</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Dark</span>
          </>
        )}
      </button>

      {/* Main Split Portal Card */}
      <div className="relative z-10 w-full max-w-[920px] rounded-3xl overflow-hidden border border-slate-300/80 dark:border-slate-700/60 shadow-[0_24px_70px_rgba(15,23,42,0.18)] dark:shadow-[0_28px_80px_rgba(2,6,23,0.85)] grid grid-cols-1 md:grid-cols-12 animate-scale-in">
        {/* Left Brand Panel */}
        <div className="md:col-span-5 relative bg-gradient-to-br from-[#084c4e] via-[#06343c] to-[#051d26] text-white p-7 sm:p-9 flex flex-col justify-between md:border-r border-emerald-400/20">
          {/* Subtle Dot Matrix Overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage: 'radial-gradient(rgba(94, 234, 212, 0.28) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />

          <div className="relative z-10 space-y-6">
            {/* Organization Pill */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#042127]/85 border border-emerald-400/25 shadow-lg">
              <div className="w-8 h-8 rounded-lg bg-[#fff200] p-1 flex items-center justify-center shrink-0 shadow-xs">
                {!logoError ? (
                  <img
                    src="/assets/aistudio/Logo_PLN_67ac91e8.png"
                    alt="Logo PT PLN (Persero)"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="font-extrabold text-[11px] text-sky-800">PLN</span>
                )}
              </div>
              <div className="leading-tight">
                <div className="text-sm font-extrabold tracking-wide text-cyan-300">PLN</div>
                <div className="text-[10px] font-bold tracking-wider text-slate-200 uppercase">
                  ULP BAGUALA
                </div>
              </div>
            </div>

            {/* Central Glowing Emblem */}
            <div className="pt-2">
              <div className="w-24 h-24 rounded-full bg-white p-3 flex items-center justify-center shadow-[0_0_32px_rgba(45,212,191,0.45)] ring-4 ring-teal-400/30">
                {!logoError ? (
                  <img
                    src="/assets/aistudio/Logo_PLN_67ac91e8.png"
                    alt="Emblem SIMAG PLN"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <ShieldCheck className="w-12 h-12 text-teal-700" />
                )}
              </div>

              <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                SIMAG
              </h1>
              <p className="mt-1 text-xs font-bold tracking-wider text-emerald-300 uppercase">
                SISTEM MANAJEMEN GUDANG
              </p>
              <p className="mt-1 text-xs sm:text-[13px] font-semibold text-cyan-100/95">
                Pemantauan Stok &amp; Pelacakan Rak kWh Meter PLN
              </p>
              <p className="mt-4 text-xs text-slate-200/80 leading-relaxed">
                Sistem Terpadu Manajemen Stok Material Distribusi, Pelacakan Rak Karton &amp; Transaksi kWh Meter ULP Baguala PT PLN (Persero).
              </p>
            </div>
          </div>

          {/* Left Panel Footer */}
          <div className="relative z-10 mt-8 pt-4 border-t border-emerald-400/20 flex items-center justify-between text-[11px] font-mono text-emerald-100/80">
            <span>PLN ULP Baguala</span>
            <span>2026 Edition</span>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="md:col-span-7 bg-white dark:bg-[#0b1526] p-6 sm:p-10 flex flex-col justify-between transition-colors duration-200">
          <div>
            {/* Form Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Login Sistem SIMAG
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Silakan masukkan akun terdaftar Anda
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold whitespace-nowrap shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Secure Portal</span>
              </div>
            </div>

            {/* Inactivity Auto-Logout Notice */}
            {inactivityNotice && (
              <div className="mt-5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>{inactivityNotice}</span>
              </div>
            )}

            {/* Login Error Alert */}
            {errorMsg && (
              <div className="mt-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* NIP / User ID */}
              <div>
                <label
                  htmlFor="simag-login-nip"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2"
                >
                  NIP / User ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="simag-login-nip"
                    type="text"
                    value={nip}
                    onChange={(e) => {
                      setNip(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Masukkan NIP (contoh: 9925045ZY)"
                    autoComplete="username"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-[#223047] border border-slate-300 dark:border-slate-600/70 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25 outline-none text-sm font-mono font-medium text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="simag-login-password"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotHelp(prev => !prev)}
                    className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    Lupa Password?
                  </button>
                </div>

                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="simag-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Masukkan password Anda"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-50 dark:bg-[#223047] border border-slate-300 dark:border-slate-600/70 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25 outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    className="absolute right-2.5 p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {showForgotHelp && (
                  <div className="mt-2.5 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-500/30 text-[11px] text-sky-800 dark:text-sky-200 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                    <span>
                      Silakan hubungi <strong>Administrator</strong> atau <strong>Kepala Gudang</strong> untuk melakukan reset password akun Anda melalui menu <strong>Management User</strong>.
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-tactile w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-blue-600/25 dark:shadow-blue-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk ke Dashboard SIMAG'}</span>
              </button>
            </form>
          </div>

          {/* Right Panel Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Enkripsi Terproteksi · Auto-Logout 5 Menit</span>
            </span>
            <span className="font-mono tabular-nums">PLN ULP Baguala • 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};
