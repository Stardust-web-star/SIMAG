/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StockAlert } from '../types/warehouse';
import { 
  X, 
  Bell, 
  BellRing, 
  AlertTriangle, 
  AlertCircle, 
  CheckCheck, 
  Trash2, 
  Volume2, 
  VolumeX,
  Send
} from 'lucide-react';
import { 
  requestPushPermission, 
  sendBrowserPushNotification, 
  soundEffects 
} from '../services/notificationService';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: StockAlert[];
  onMarkAllRead: () => void;
  onClearAlerts: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  alerts,
  onMarkAllRead,
  onClearAlerts,
}) => {
  const [pushStatus, setPushStatus] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const handleEnablePush = async () => {
    const permission = await requestPushPermission();
    setPushStatus(permission);
    if (permission === 'granted') {
      sendBrowserPushNotification(
        'Notifikasi Gudang PLN Aktif',
        'Anda akan menerima peringatan otomatis saat stok mendekati batas minimum.'
      );
      soundEffects.playScanSuccess();
    }
  };

  const handleTestPush = () => {
    sendBrowserPushNotification(
      'Uji Coba Notifikasi Push PLN',
      'Sistem pemantauan stok real-time PLN gudang berfungsi dengan normal.'
    );
    soundEffects.playWarning();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/30">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Pusat Notifikasi Stok & Pemantauan</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Peringatan otomatis stok minimum & aktivitas gudang
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

        {/* Push Notification Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Notifikasi Push Browser & HP
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pushStatus === 'granted'
                    ? 'Status: Aktif menerima pemberitahuan langsung'
                    : 'Aktifkan notifikasi untuk memantau pembaruan di latar belakang'}
                </span>
              </div>
            </div>

            {pushStatus !== 'granted' ? (
              <button
                onClick={handleEnablePush}
                className="btn-tactile px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer"
              >
                Izinkan
              </button>
            ) : (
              <button
                onClick={handleTestPush}
                className="btn-tactile px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 rounded-lg text-[11px] font-semibold shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                Uji Notif
              </button>
            )}
          </div>
        </div>

        {/* Alert List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {alerts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <CheckCheck className="w-10 h-10 mx-auto text-emerald-600 dark:text-emerald-500 opacity-80" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Semua Stok Dalam Kondisi Aman</p>
              <p className="text-xs text-slate-500">
                Tidak ada peringatan stok kritis atau batas minimum saat ini.
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  alert.severity === 'critical'
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-600/40 text-rose-900 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-600/40 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {alert.severity === 'critical' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{alert.title}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60 shrink-0">
                    {alert.timestamp}
                  </span>
                </div>
                <p className="text-xs mt-1.5 opacity-90 leading-relaxed pl-6">
                  {alert.message}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            {alerts.length > 0 && (
              <button
                onClick={onClearAlerts}
                className="btn-tactile text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Semua
              </button>
            )}
          </div>
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
