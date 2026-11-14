/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  WarehouseRack, 
  InboundCarton, 
  MeterUnit, 
  OutboundRecord, 
  StockAlert 
} from './types/warehouse';
import { 
  INITIAL_RACKS, 
} from './data/initialData';
import { 
  initAuth,
  ensureAutoCloudSession,
  CloudAutoAuthDisabledError,
  googleCloudSignIn,
  getAccessToken,
  hasCachedSheetsToken,
  clearAccessToken
} from './services/googleAuth';
import {
  bootstrapAndSubscribeWarehouse,
  forceUploadLocalToCloud,
  pullLatestFromCloud,
  pushInboundToCloud,
  pushAddUnitsToCartonToCloud,
  pushUpdateCartonBrandToCloud,
  pushOutboundToCloud,
  pushMoveCartonToCloud,
  pushUpdateRackToCloud,
  pushResetWarehouseToCloud,
  pushUpsertSimagUserToCloud,
  pushDeleteSimagUserFromCloud,
  pushSimagUserLoginTimeToCloud,
  CloudSyncStatus,
} from './services/firestoreSync';
import { 
  findOrCreateWarehouseSpreadsheet,
  syncWarehouseToGoogleSheets,
  GoogleSheetsAuthError,
  GoogleSheetsSyncResult 
} from './services/googleSheets';
import { 
  evaluateStockThresholds, 
  sendBrowserPushNotification, 
  soundEffects, 
  vibratePhone 
} from './services/notificationService';

import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { RackVisualizer } from './components/RackVisualizer';
import { StockListTab } from './components/StockListTab';
import { ReportDashboard } from './components/ReportDashboard';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { InboundCartonModal } from './components/InboundCartonModal';
import { OutboundModal } from './components/OutboundModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { PrintBastModal } from './components/PrintBastModal';
import { KassenScannerModal } from './components/KassenScannerModal';
import { LoginScreen } from './components/LoginScreen';
import { UserManagementTab } from './components/UserManagementTab';
import { SimagSession, SimagUser } from './types/auth';
import {
  INACTIVITY_TIMEOUT_MS,
  ensureSeededUsers,
  getActiveSimagSession,
  logoutSimagSession,
  touchSimagSessionActivity,
  overwriteLocalSimagUsers,
} from './services/simagAuthService';
import { hardwareScannerService } from './services/hardwareScannerService';
import { Zap, X, Camera, Plus, Send, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Clock, Cloud } from 'lucide-react';

export default function App() {
  // Theme (Light Mode & Dark Mode)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pln_warehouse_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    localStorage.setItem('pln_warehouse_theme', theme);
  }, [theme]);

  // SIMAG Authentication & Inactivity Auto-Logout (5 minutes)
  const [simagUsers, setSimagUsers] = useState<SimagUser[]>(() => ensureSeededUsers());
  const initialSessionInfo = useRef(getActiveSimagSession());
  const [simagSession, setSimagSession] = useState<SimagSession | null>(
    () => initialSessionInfo.current.session
  );
  const [loginNotice, setLoginNotice] = useState<string | null>(() =>
    initialSessionInfo.current.expiredByInactivity
      ? 'Sesi Anda berakhir otomatis karena tidak ada interaksi selama 5 menit. Silakan login kembali.'
      : null
  );
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);
  const lastActivityAtRef = useRef<number>(
    initialSessionInfo.current.session?.lastActivityAt || Date.now()
  );
  const lastTouchPersistRef = useRef<number>(0);

  // Navigation
  const [activeTab, setActiveTab] = useState<'racks' | 'stock' | 'reports' | 'users'>('racks');
  const [rackSearchQuery, setRackSearchQuery] = useState('');

  // Warehouse Data with LocalStorage Persistence & Version Check for Real Data
  const STORAGE_VERSION = 'pln_warehouse_real_v2';

  const [racks, setRacks] = useState<WarehouseRack[]>(() => {
    const version = localStorage.getItem('pln_warehouse_storage_ver');
    if (version !== STORAGE_VERSION) {
      localStorage.setItem('pln_warehouse_storage_ver', STORAGE_VERSION);
      localStorage.removeItem('pln_warehouse_racks');
      localStorage.removeItem('pln_warehouse_cartons');
      localStorage.removeItem('pln_warehouse_meters');
      localStorage.removeItem('pln_warehouse_outbounds');
      return INITIAL_RACKS;
    }
    const saved = localStorage.getItem('pln_warehouse_racks');
    if (saved) {
      try {
        const parsed: WarehouseRack[] = JSON.parse(saved);
        return parsed.map(r => ({
          ...r,
          shelves: [...r.shelves]
            .sort((a, b) => a.level - b.level)
            .map(s => ({
              ...s,
              label:
                s.level === 1
                  ? 'Tingkat 1 (Atas)'
                  : s.level === 4
                  ? 'Tingkat 4 (Bawah)'
                  : `Tingkat ${s.level}`,
              cartonCapacity: 16,
            })),
        }));
      } catch {
        return INITIAL_RACKS;
      }
    }
    return INITIAL_RACKS;
  });

  const [cartons, setCartons] = useState<InboundCarton[]>(() => {
    const version = localStorage.getItem('pln_warehouse_storage_ver');
    if (version !== STORAGE_VERSION) return [];
    const saved = localStorage.getItem('pln_warehouse_cartons');
    return saved ? JSON.parse(saved) : [];
  });

  const [meters, setMeters] = useState<MeterUnit[]>(() => {
    const version = localStorage.getItem('pln_warehouse_storage_ver');
    if (version !== STORAGE_VERSION) return [];
    const saved = localStorage.getItem('pln_warehouse_meters');
    return saved ? JSON.parse(saved) : [];
  });

  const [outbounds, setOutbounds] = useState<OutboundRecord[]>(() => {
    const version = localStorage.getItem('pln_warehouse_storage_ver');
    if (version !== STORAGE_VERSION) return [];
    const saved = localStorage.getItem('pln_warehouse_outbounds');
    return saved ? JSON.parse(saved) : [];
  });

  // Alerts
  const [alerts, setAlerts] = useState<StockAlert[]>(() => []);

  // Google Auth, Two-Way Cloud Sync & Sheets State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasSheetsToken, setHasSheetsToken] = useState<boolean>(() => hasCachedSheetsToken());
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>({
    status: 'connecting',
    message: 'Menghubungkan sinkronisasi otomatis dua arah...',
  });
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [cloudConnectError, setCloudConnectError] = useState<string | null>(null);
  const [cloudAutoNeedsSetup, setCloudAutoNeedsSetup] = useState(false);
  const [isCloudBannerDismissed, setIsCloudBannerDismissed] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<GoogleSheetsSyncResult | null>(() => {
    const saved = localStorage.getItem('pln_sheets_last_sync');
    return saved ? JSON.parse(saved) : null;
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pln_sheets_auto_sync') === 'true';
  });
  const [autoSyncState, setAutoSyncState] = useState<{
    status: 'idle' | 'syncing' | 'synced' | 'error' | 'needs-reauth';
    message?: string;
    lastReason?: string;
  }>({ status: 'idle' });
  const [syncToast, setSyncToast] = useState<{
    type: 'syncing' | 'synced' | 'error' | 'needs-reauth';
    title: string;
    subtitle?: string;
    sheetUrl?: string;
  } | null>(null);

  const latestSnapshotRef = useRef({ racks, cartons, meters, outbounds });
  latestSnapshotRef.current = { racks, cartons, meters, outbounds };
  const latestSimagUsersRef = useRef<SimagUser[]>(simagUsers);
  latestSimagUsersRef.current = simagUsers;

  const lastSpreadsheetIdRef = useRef<string | null>(lastSyncResult?.spreadsheetId || null);
  const syncInFlightRef = useRef(false);
  const pendingSyncReasonRef = useRef<string | null>(null);
  const syncToastTimerRef = useRef<number | null>(null);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerCallback, setScannerCallback] = useState<((text: string) => void) | null>(null);
  const [scannerExpectedType, setScannerExpectedType] = useState<'carton' | 'meter' | 'any'>('any');

  const [isInboundOpen, setIsInboundOpen] = useState(false);
  const [inboundTarget, setInboundTarget] = useState<{ rackId: string; level: number; slotNumber?: number } | null>(null);
  const [isOutboundOpen, setIsOutboundOpen] = useState(false);
  const [outboundPreselectedSn, setOutboundPreselectedSn] = useState<string | undefined>(undefined);

  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [bastRecordToPrint, setBastRecordToPrint] = useState<OutboundRecord | null>(null);
  const [isKassenModalOpen, setIsKassenModalOpen] = useState(false);
  const [kassenToast, setKassenToast] = useState<{ code: string; type: 'carton' | 'meter' } | null>(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('pln_warehouse_racks', JSON.stringify(racks));
  }, [racks]);

  useEffect(() => {
    localStorage.setItem('pln_warehouse_cartons', JSON.stringify(cartons));
  }, [cartons]);

  useEffect(() => {
    localStorage.setItem('pln_warehouse_meters', JSON.stringify(meters));
    const newAlerts = evaluateStockThresholds(meters);
    setAlerts(newAlerts);
  }, [meters]);

  useEffect(() => {
    localStorage.setItem('pln_warehouse_outbounds', JSON.stringify(outbounds));
  }, [outbounds]);

  useEffect(() => {
    if (lastSyncResult) {
      localStorage.setItem('pln_sheets_last_sync', JSON.stringify(lastSyncResult));
      lastSpreadsheetIdRef.current = lastSyncResult.spreadsheetId;
    }
  }, [lastSyncResult]);

  useEffect(() => {
    localStorage.setItem('pln_sheets_auto_sync', String(autoSyncEnabled));
  }, [autoSyncEnabled]);

  useEffect(() => {
    return () => {
      if (syncToastTimerRef.current) {
        window.clearTimeout(syncToastTimerRef.current);
      }
    };
  }, []);

  const showSyncToast = useCallback((
    toast: {
      type: 'syncing' | 'synced' | 'error' | 'needs-reauth';
      title: string;
      subtitle?: string;
      sheetUrl?: string;
    },
    autoDismissMs?: number
  ) => {
    if (syncToastTimerRef.current) {
      window.clearTimeout(syncToastTimerRef.current);
      syncToastTimerRef.current = null;
    }
    setSyncToast(toast);
    if (autoDismissMs) {
      syncToastTimerRef.current = window.setTimeout(() => {
        setSyncToast(null);
      }, autoDismissMs);
    }
  }, []);

  const runWarehouseSync = useCallback(async (
    reason = 'Perubahan data',
    overrideSpreadsheetId?: string
  ): Promise<GoogleSheetsSyncResult | null> => {
    if (overrideSpreadsheetId) {
      lastSpreadsheetIdRef.current = overrideSpreadsheetId;
    }

    if (syncInFlightRef.current) {
      pendingSyncReasonRef.current = reason;
      return null;
    }

    const token = await getAccessToken();
    if (!token) {
      const msg = 'Sesi Google Sheets perlu disambungkan ulang agar rekap otomatis berjalan.';
      setAutoSyncState({ status: 'needs-reauth', message: msg, lastReason: reason });
      showSyncToast({
        type: 'needs-reauth',
        title: 'Rekap Otomatis Google Sheets Tertunda',
        subtitle: msg,
      }, 9000);
      return null;
    }

    syncInFlightRef.current = true;
    setAutoSyncState({ status: 'syncing', message: `Menyinkronkan: ${reason}...`, lastReason: reason });
    showSyncToast({
      type: 'syncing',
      title: 'Merekap ke Google Sheets...',
      subtitle: reason,
    });

    try {
      let spreadsheetId = overrideSpreadsheetId || lastSpreadsheetIdRef.current;
      if (!spreadsheetId) {
        const sheetInfo = await findOrCreateWarehouseSpreadsheet();
        spreadsheetId = sheetInfo.id;
      }
      lastSpreadsheetIdRef.current = spreadsheetId;

      const snapshot = latestSnapshotRef.current;
      let result: GoogleSheetsSyncResult;
      try {
        result = await syncWarehouseToGoogleSheets(spreadsheetId, snapshot);
      } catch (err: any) {
        const errMsg = String(err?.message || '').toLowerCase();
        const isNotFound = !(err instanceof GoogleSheetsAuthError) && (
          errMsg.includes('not found') ||
          errMsg.includes('requested entity') ||
          errMsg.includes('404')
        );
        if (!isNotFound) throw err;

        lastSpreadsheetIdRef.current = null;
        const recreated = await findOrCreateWarehouseSpreadsheet();
        lastSpreadsheetIdRef.current = recreated.id;
        result = await syncWarehouseToGoogleSheets(recreated.id, snapshot);
      }

      lastSpreadsheetIdRef.current = result.spreadsheetId;
      setLastSyncResult(result);
      setAutoSyncState({
        status: 'synced',
        message: `Terekap pada ${result.updatedAt}`,
        lastReason: reason,
      });
      showSyncToast({
        type: 'synced',
        title: 'Terekap ke Google Sheets',
        subtitle: `${reason} • ${result.updatedAt}`,
        sheetUrl: result.spreadsheetUrl,
      }, 5000);
      return result;
    } catch (err: any) {
      if (err instanceof GoogleSheetsAuthError) {
        clearAccessToken();
        setHasSheetsToken(false);
        setAutoSyncState({
          status: 'needs-reauth',
          message: err.message,
          lastReason: reason,
        });
        showSyncToast({
          type: 'needs-reauth',
          title: 'Sesi Google Sheets Berakhir',
          subtitle: err.message,
        }, 9000);
      } else {
        const msg = err?.message || 'Gagal menyinkronkan ke Google Sheets.';
        setAutoSyncState({
          status: 'error',
          message: msg,
          lastReason: reason,
        });
        showSyncToast({
          type: 'error',
          title: 'Gagal Rekap ke Google Sheets',
          subtitle: msg,
        }, 9000);
      }
      return null;
    } finally {
      syncInFlightRef.current = false;
      const queuedReason = pendingSyncReasonRef.current;
      if (queuedReason) {
        pendingSyncReasonRef.current = null;
        void runWarehouseSync(queuedReason);
      }
    }
  }, [showSyncToast]);

  const runCloudPush = useCallback((task: () => Promise<void>) => {
    task().catch((err) => {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pembaruan ke Cloud.';
      setCloudSyncStatus({ status: 'error', message: msg });
    });
  }, []);

  const handleForceUploadCloud = useCallback(async () => {
    if (!currentUser) return;
    setCloudSyncStatus({ status: 'syncing', message: 'Mengunggah data browser ini ke Cloud...' });
    await forceUploadLocalToCloud(currentUser, {
      ...latestSnapshotRef.current,
      simagUsers: latestSimagUsersRef.current,
    });
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setCloudSyncStatus({
      status: 'synced',
      message: 'Sinkronisasi dua arah aktif (Google AI Studio ⇄ Vercel)',
      lastSyncedAt: nowTime,
    });
  }, [currentUser]);

  const handlePullFromCloud = useCallback(async () => {
    if (!currentUser) return;
    setCloudSyncStatus({ status: 'syncing', message: 'Mengambil data terbaru dari Cloud...' });
    const payload = await pullLatestFromCloud(currentUser, {
      racks: latestSnapshotRef.current.racks,
      simagUsers: latestSimagUsersRef.current,
    });
    latestSnapshotRef.current = {
      racks: payload.racks,
      cartons: payload.cartons,
      meters: payload.meters,
      outbounds: payload.outbounds,
    };
    latestSimagUsersRef.current = payload.simagUsers;
    setRacks(payload.racks);
    setCartons(payload.cartons);
    setMeters(payload.meters);
    setOutbounds(payload.outbounds);
    setSimagUsers(payload.simagUsers);
    overwriteLocalSimagUsers(payload.simagUsers);
    setCloudSyncStatus({
      status: 'synced',
      message: 'Sinkronisasi dua arah aktif (Google AI Studio ⇄ Vercel)',
      lastSyncedAt: payload.lastSyncedAt,
    });
  }, [currentUser]);

  const startAutoCloudAuth = useCallback(async () => {
    setIsConnectingCloud(true);
    setCloudConnectError(null);
    setCloudSyncStatus({
      status: 'connecting',
      message: 'Menghubungkan sinkronisasi otomatis dua arah...',
    });
    try {
      const user = await ensureAutoCloudSession();
      setCurrentUser(user);
      setCloudAutoNeedsSetup(false);
      setIsCloudBannerDismissed(false);
    } catch (err: any) {
      const msg = err?.message || 'Gagal menghubungkan sinkronisasi cloud otomatis.';
      if (err instanceof CloudAutoAuthDisabledError) {
        setCloudAutoNeedsSetup(true);
      }
      setCloudConnectError(msg);
      setCloudSyncStatus({ status: 'error', message: msg });
    } finally {
      setIsConnectingCloud(false);
    }
  }, []);

  const handleQuickCloudConnect = useCallback(async () => {
    setIsConnectingCloud(true);
    setCloudConnectError(null);
    try {
      const res = await googleCloudSignIn();
      setCurrentUser(res.user);
      setHasSheetsToken(res.hasSheetsToken);
      setCloudAutoNeedsSetup(false);
      setIsCloudBannerDismissed(false);
    } catch (err: any) {
      setCloudConnectError(err?.message || 'Gagal menghubungkan akun Google Cloud.');
    } finally {
      setIsConnectingCloud(false);
    }
  }, []);

  const handleSimagLogout = useCallback((expiredMessage?: string) => {
    logoutSimagSession();
    setSimagSession(null);
    setIdleWarningSeconds(null);
    setIsScannerOpen(false);
    setIsInboundOpen(false);
    setInboundTarget(null);
    setIsOutboundOpen(false);
    setIsSheetsModalOpen(false);
    setIsNotificationsOpen(false);
    setBastRecordToPrint(null);
    setIsKassenModalOpen(false);
    setKassenToast(null);
    setLoginNotice(expiredMessage ?? null);
  }, []);

  const recordSimagActivity = useCallback(() => {
    if (!simagSession) return;
    const now = Date.now();
    lastActivityAtRef.current = now;
    setIdleWarningSeconds(prev => (prev !== null ? null : prev));
    if (now - lastTouchPersistRef.current >= 1000) {
      lastTouchPersistRef.current = now;
      touchSimagSessionActivity(now);
    }
  }, [simagSession]);

  // 5-Minute Inactivity Auto-Logout Monitor
  useEffect(() => {
    if (!simagSession) return;

    lastActivityAtRef.current = simagSession.lastActivityAt || Date.now();
    lastTouchPersistRef.current = Date.now();

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
      'pointerdown',
      'click',
    ];

    const onActivity = () => recordSimagActivity();
    activityEvents.forEach(evt => {
      window.addEventListener(evt, onActivity, { passive: true });
    });

    const checkInactivity = () => {
      const elapsed = Date.now() - lastActivityAtRef.current;
      const remaining = INACTIVITY_TIMEOUT_MS - elapsed;
      if (remaining <= 0) {
        handleSimagLogout(
          'Sesi Anda berakhir otomatis karena tidak ada interaksi selama 5 menit. Silakan login kembali.'
        );
        return;
      }
      if (remaining <= 30_000) {
        setIdleWarningSeconds(Math.ceil(remaining / 1000));
      } else {
        setIdleWarningSeconds(prev => (prev !== null ? null : prev));
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onStorageSync = (e: StorageEvent) => {
      if (e.key === 'pln_simag_session_v1' && !e.newValue) {
        handleSimagLogout('Sesi SIMAG Anda telah berakhir. Silakan login kembali.');
      }
    };
    window.addEventListener('storage', onStorageSync);

    const timerId = window.setInterval(checkInactivity, 1000);

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, onActivity);
      });
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', onStorageSync);
      window.clearInterval(timerId);
    };
  }, [simagSession, recordSimagActivity, handleSimagLogout]);

  // Global listener for Kassen KS-606 hardware scanner (Wireless 2.4G & USB HID)
  useEffect(() => {
    if (!simagSession) return;
    const unsubscribe = hardwareScannerService.subscribe(({ code }) => {
      // If camera scanner modal is open, pass result and close camera
      if (isScannerOpen) {
        if (scannerCallback) {
          scannerCallback(code);
        }
        setIsScannerOpen(false);
        return;
      }

      // If Inbound, Outbound, or Kassen Modal is open, they handle it directly
      if (isInboundOpen || isOutboundOpen || isKassenModalOpen) {
        return;
      }

      // When scanned from the main warehouse dashboard:
      const upper = code.toUpperCase();
      const isCarton = upper.includes('BOX') || upper.includes('CTN') || upper.includes('MEL') || upper.includes('ITR') || upper.includes('HEX') || upper.includes('SNX') || upper.includes('STR') || upper.includes('FDE') || upper.startsWith('C-');

      if (isCarton) {
        setInboundTarget(null);
        setIsInboundOpen(true);
      } else {
        // Meter Serial Number: locate in visual racks & show quick dispatch option
        setRackSearchQuery(code);
        setActiveTab('racks');
        setKassenToast({ code, type: 'meter' });
        setTimeout(() => setKassenToast(null), 9000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [simagSession, isScannerOpen, scannerCallback, isInboundOpen, isOutboundOpen, isKassenModalOpen]);

  // Initialize Firebase Auth listener & automatic zero-click cloud sync session
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, hasToken) => {
        setCurrentUser(user);
        setHasSheetsToken(hasToken);
        setCloudAutoNeedsSetup(false);
        setCloudConnectError(null);
      },
      () => {
        setCurrentUser(null);
        setHasSheetsToken(false);
      }
    );

    void startAutoCloudAuth();

    const handleOnline = () => {
      void startAutoCloudAuth();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (unsubscribe) unsubscribe();
    };
  }, [startAutoCloudAuth]);

  // Two-way Real-Time Cloud Sync (Google AI Studio <-> Vercel via Firestore)
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isCancelled = false;
    let unsubCloud: (() => void) | undefined;

    bootstrapAndSubscribeWarehouse(
      currentUser,
      () => ({
        ...latestSnapshotRef.current,
        simagUsers: latestSimagUsersRef.current,
      }),
      (payload) => {
        if (isCancelled) return;
        latestSnapshotRef.current = {
          racks: payload.racks,
          cartons: payload.cartons,
          meters: payload.meters,
          outbounds: payload.outbounds,
        };
        latestSimagUsersRef.current = payload.simagUsers;
        setRacks(payload.racks);
        setCartons(payload.cartons);
        setMeters(payload.meters);
        setOutbounds(payload.outbounds);
        setSimagUsers(payload.simagUsers);
        overwriteLocalSimagUsers(payload.simagUsers);
      },
      (status) => {
        if (!isCancelled) {
          setCloudSyncStatus(status);
        }
      }
    )
      .then((unsub) => {
        if (isCancelled) {
          unsub();
        } else {
          unsubCloud = unsub;
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setCloudSyncStatus({
            status: 'error',
            message: err instanceof Error ? err.message : 'Gagal menghubungkan Cloud Sync dua arah.',
          });
        }
      });

    return () => {
      isCancelled = true;
      if (unsubCloud) unsubCloud();
    };
  }, [currentUser]);

  // Global Escape key listener to close any active modal cleanly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isScannerOpen) setIsScannerOpen(false);
      else if (isInboundOpen) {
        setIsInboundOpen(false);
        setInboundTarget(null);
      }
      else if (isOutboundOpen) setIsOutboundOpen(false);
      else if (isSheetsModalOpen) setIsSheetsModalOpen(false);
      else if (isNotificationsOpen) setIsNotificationsOpen(false);
      else if (bastRecordToPrint) setBastRecordToPrint(null);
      else if (isKassenModalOpen) setIsKassenModalOpen(false);
      else if (kassenToast) setKassenToast(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isScannerOpen,
    isInboundOpen,
    isOutboundOpen,
    isSheetsModalOpen,
    isNotificationsOpen,
    bastRecordToPrint,
    isKassenModalOpen,
    kassenToast,
  ]);

  // Generic Open Scanner handler
  const handleOpenScanner = (callback?: (text: string) => void, expected: 'carton' | 'meter' | 'any' = 'any') => {
    if (callback) {
      setScannerCallback(() => callback);
    } else {
      // Default global scan behavior: Search in rack visualizer or detect
      setScannerCallback(() => (scannedText: string) => {
        setRackSearchQuery(scannedText);
        setActiveTab('racks');
      });
    }
    setScannerExpectedType(expected);
    setIsScannerOpen(true);
  };

  // Inbound Handlers
  const handleSaveInbound = (newCarton: InboundCarton, newUnits: MeterUnit[]) => {
    const snap = latestSnapshotRef.current;
    const nextRacks = snap.racks.map(rack => {
      if (rack.id !== newCarton.rackId) return rack;
      return {
        ...rack,
        shelves: rack.shelves.map(shelf => {
          if (shelf.level !== newCarton.shelfLevel) return shelf;
          return {
            ...shelf,
            cartonIds: [...shelf.cartonIds, newCarton.id]
          };
        })
      };
    });
    const nextCartons = [newCarton, ...snap.cartons];
    const nextMeters = [...newUnits, ...snap.meters];

    latestSnapshotRef.current = {
      ...snap,
      racks: nextRacks,
      cartons: nextCartons,
      meters: nextMeters,
    };

    setRacks(nextRacks);
    setCartons(nextCartons);
    setMeters(nextMeters);

    if (currentUser) {
      const updatedRack = nextRacks.find(r => r.id === newCarton.rackId);
      runCloudPush(() => pushInboundToCloud(currentUser, newCarton, newUnits, updatedRack));
    }

    // Send push notification
    sendBrowserPushNotification(
      'Material Inbound Berhasil',
      `Karton ${newCarton.cartonBarcode} (${newCarton.brand} - ${newCarton.unitsCount} pcs) berhasil disimpan di ${newCarton.rackId} Tk ${newCarton.shelfLevel}.`
    );

    if (autoSyncEnabled) {
      void runWarehouseSync(`Material Masuk (${newCarton.cartonBarcode} • ${newCarton.unitsCount} unit)`);
    }
  };

  // Add more meter units into an existing carton (up to 10 pcs/carton)
  const handleAddUnitsToCarton = (cartonId: string, newUnits: MeterUnit[]) => {
    const snap = latestSnapshotRef.current;
    const targetCarton = snap.cartons.find(c => c.id === cartonId);
    if (!targetCarton || newUnits.length === 0) return;

    const addedSerials = newUnits.map(u => u.serialNumber);
    const nextCartons = snap.cartons.map(c => {
      if (c.id !== cartonId) return c;
      const mergedSerials = [...c.meterSerials, ...addedSerials];
      return {
        ...c,
        meterSerials: mergedSerials,
        unitsCount: mergedSerials.length,
      };
    });
    const nextMeters = [...newUnits, ...snap.meters];

    latestSnapshotRef.current = {
      ...snap,
      cartons: nextCartons,
      meters: nextMeters,
    };

    setCartons(nextCartons);
    setMeters(nextMeters);

    if (currentUser) {
      const updatedCarton = nextCartons.find(c => c.id === cartonId);
      if (updatedCarton) {
        runCloudPush(() => pushAddUnitsToCartonToCloud(currentUser, updatedCarton, newUnits));
      }
    }

    soundEffects.playSuccess();
    vibratePhone([100, 50, 100]);
    sendBrowserPushNotification(
      'Isi Dus Diperbarui',
      `${newUnits.length} unit kWh meter ditambahkan ke karton ${targetCarton.cartonBarcode} (${targetCarton.rackId} Tk ${targetCarton.shelfLevel}).`
    );

    if (autoSyncEnabled) {
      void runWarehouseSync(`Tambah Isi Dus (${targetCarton.cartonBarcode} +${newUnits.length} unit)`);
    }
  };

  // Update kWh meter brand for a carton and all units inside it
  const handleUpdateCartonBrand = (cartonId: string, newBrand: string) => {
    const trimmed = newBrand.trim();
    if (!trimmed) return;

    const snap = latestSnapshotRef.current;
    const targetCarton = snap.cartons.find(c => c.id === cartonId);
    if (!targetCarton || targetCarton.brand === trimmed) return;

    const serialSet = new Set(targetCarton.meterSerials);

    const nextCartons = snap.cartons.map(c => (
      c.id === cartonId ? { ...c, brand: trimmed } : c
    ));
    const nextMeters = snap.meters.map(m => (
      m.cartonBarcode === targetCarton.cartonBarcode || serialSet.has(m.serialNumber)
        ? { ...m, brand: trimmed }
        : m
    ));

    latestSnapshotRef.current = {
      ...snap,
      cartons: nextCartons,
      meters: nextMeters,
    };

    setCartons(nextCartons);
    setMeters(nextMeters);

    if (currentUser) {
      const updatedCarton = nextCartons.find(c => c.id === cartonId);
      const updatedMeters = nextMeters.filter(
        m => m.cartonBarcode === targetCarton.cartonBarcode || serialSet.has(m.serialNumber)
      );
      if (updatedCarton) {
        runCloudPush(() => pushUpdateCartonBrandToCloud(currentUser, updatedCarton, updatedMeters));
      }
    }

    soundEffects.playSuccess();
    vibratePhone();
    sendBrowserPushNotification(
      'Merek kWh Meter Diperbarui',
      `Merek karton ${targetCarton.cartonBarcode} diubah menjadi "${trimmed}".`
    );

    if (autoSyncEnabled) {
      void runWarehouseSync(`Ubah Merek (${targetCarton.cartonBarcode} → ${trimmed})`);
    }
  };

  // Outbound Handlers
  const handleSaveOutbound = (record: OutboundRecord) => {
    const snap = latestSnapshotRef.current;
    const nextMeters = snap.meters.map(m => {
      if (m.serialNumber === record.snKwhMeter) {
        return {
          ...m,
          status: 'DISPATCHED' as const,
          dispatchId: record.id
        };
      }
      return m;
    });
    const nextOutbounds = [record, ...snap.outbounds];

    latestSnapshotRef.current = {
      ...snap,
      meters: nextMeters,
      outbounds: nextOutbounds,
    };

    setMeters(nextMeters);
    setOutbounds(nextOutbounds);

    if (currentUser) {
      const updatedMeter = nextMeters.find(m => m.serialNumber === record.snKwhMeter);
      runCloudPush(() => pushOutboundToCloud(currentUser, record, updatedMeter));
    }

    // Send push notification
    const actionDesc = record.jenisTransaksi === 'PB' 
      ? `Pasang Baru (IDPEL: ${record.idPelanggan})` 
      : `Ganti Meter (${record.gmKategori === 'METER_GANGGUAN' ? 'Gangguan' : 'Meter Tua'})`;
    sendBrowserPushNotification(
      'Material Keluar Tercatat',
      `kWh Meter SN ${record.snKwhMeter} untuk ${actionDesc} petugas ${record.petugas}.`
    );

    if (autoSyncEnabled) {
      void runWarehouseSync(`Material Keluar ${record.jenisTransaksi} (${record.snKwhMeter})`);
    }

    // Open BAST print preview for convenience
    setBastRecordToPrint(record);
  };

  // Move Carton between shelves
  const handleMoveCarton = (cartonId: string, targetRackId: string, targetLevel: number) => {
    const snap = latestSnapshotRef.current;
    const carton = snap.cartons.find(c => c.id === cartonId);
    if (!carton) return;

    // Check target rack capacity
    const targetRack = snap.racks.find(r => r.id === targetRackId);
    const targetShelf = targetRack?.shelves.find(s => s.level === targetLevel);
    const existingInTarget = snap.cartons.filter(c => c.rackId === targetRackId && c.shelfLevel === targetLevel);

    if (targetShelf && existingInTarget.length >= targetShelf.cartonCapacity) {
      showSyncToast({
        type: 'error',
        title: 'Tingkat Rak Sudah Penuh',
        subtitle: `Tingkat ${targetLevel} pada ${targetRack?.name} sudah penuh (${targetShelf.cartonCapacity} dus).`,
      }, 5000);
      return;
    }

    const nextCartons = snap.cartons.map(c => {
      if (c.id === cartonId) {
        return { ...c, rackId: targetRackId, shelfLevel: targetLevel };
      }
      return c;
    });

    const nextMeters = snap.meters.map(m => {
      if (m.cartonBarcode === carton.cartonBarcode) {
        return { ...m, rackId: targetRackId, shelfLevel: targetLevel };
      }
      return m;
    });

    const nextRacks = snap.racks.map(r => ({
      ...r,
      shelves: r.shelves.map(s => {
        const removed = s.cartonIds.filter(id => id !== cartonId);
        if (r.id === targetRackId && s.level === targetLevel) {
          return { ...s, cartonIds: [...removed, cartonId] };
        }
        return { ...s, cartonIds: removed };
      })
    }));

    latestSnapshotRef.current = {
      ...snap,
      racks: nextRacks,
      cartons: nextCartons,
      meters: nextMeters,
    };

    setCartons(nextCartons);
    setMeters(nextMeters);
    setRacks(nextRacks);

    if (currentUser) {
      const updatedCarton = nextCartons.find(c => c.id === cartonId);
      const updatedMeters = nextMeters.filter(m => m.cartonBarcode === carton.cartonBarcode);
      const affectedRacks = nextRacks.filter(r => r.id === carton.rackId || r.id === targetRackId);
      if (updatedCarton) {
        runCloudPush(() => pushMoveCartonToCloud(currentUser, updatedCarton, updatedMeters, affectedRacks));
      }
    }

    soundEffects.playScanSuccess();
    vibratePhone();

    if (autoSyncEnabled) {
      void runWarehouseSync(`Pindah Rak (${carton.cartonBarcode} → ${targetRackId} Tk ${targetLevel})`);
    }
  };

  // Update Rack info (Name, Zone, Dedication brand)
  const handleUpdateRack = (updatedRack: WarehouseRack) => {
    const snap = latestSnapshotRef.current;
    const nextRacks = snap.racks.map(r => r.id === updatedRack.id ? updatedRack : r);
    latestSnapshotRef.current = {
      ...snap,
      racks: nextRacks,
    };
    setRacks(nextRacks);
    localStorage.setItem('pln_warehouse_racks', JSON.stringify(nextRacks));
    if (currentUser) {
      runCloudPush(() => pushUpdateRackToCloud(currentUser, updatedRack));
    }
    soundEffects.playSuccess();
    sendBrowserPushNotification(
      'Nama Rak Berhasil Diperbarui',
      `Identitas rak ${updatedRack.id} kini bernama "${updatedRack.name}".`
    );

    if (autoSyncEnabled) {
      void runWarehouseSync(`Ubah Identitas Rak (${updatedRack.id})`);
    }
  };

  // Reset to clean state for real warehouse logging
  const handleResetData = () => {
    if (window.confirm('Kosongkan semua data stok kWh meter? Data akan di-reset ke 0 untuk memulai pendataan riil gudang PLN.')) {
      const prevSnap = latestSnapshotRef.current;
      const prevCartonIds = prevSnap.cartons.map(c => c.id);
      const prevMeterSns = prevSnap.meters.map(m => m.serialNumber);
      const prevOutboundIds = prevSnap.outbounds.map(o => o.id);

      latestSnapshotRef.current = {
        racks: INITIAL_RACKS,
        cartons: [],
        meters: [],
        outbounds: [],
      };
      setRacks(INITIAL_RACKS);
      setCartons([]);
      setMeters([]);
      setOutbounds([]);
      setAlerts([]);
      localStorage.setItem('pln_warehouse_storage_ver', STORAGE_VERSION);
      localStorage.setItem('pln_warehouse_racks', JSON.stringify(INITIAL_RACKS));
      localStorage.setItem('pln_warehouse_cartons', JSON.stringify([]));
      localStorage.setItem('pln_warehouse_meters', JSON.stringify([]));
      localStorage.setItem('pln_warehouse_outbounds', JSON.stringify([]));
      if (currentUser) {
        runCloudPush(() =>
          pushResetWarehouseToCloud(
            currentUser,
            INITIAL_RACKS,
            prevCartonIds,
            prevMeterSns,
            prevOutboundIds
          )
        );
      }
      soundEffects.playSuccess();
    }
  };

  if (!simagSession) {
    return (
      <LoginScreen
        onLoginSuccess={(session, updatedUsers) => {
          lastActivityAtRef.current = session.lastActivityAt;
          lastTouchPersistRef.current = Date.now();
          latestSimagUsersRef.current = updatedUsers;
          setSimagUsers(updatedUsers);
          setSimagSession(session);
          setLoginNotice(null);
          setIdleWarningSeconds(null);
          setActiveTab('racks');
          if (currentUser) {
            const loggedUser = updatedUsers.find(u => u.id === session.userId);
            if (loggedUser) {
              void pushSimagUserLoginTimeToCloud(currentUser, loggedUser);
            }
          }
        }}
        inactivityNotice={loginNotice}
        onDismissNotice={() => setLoginNotice(null)}
        theme={theme}
        onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
        cloudUser={currentUser}
        cloudStatus={cloudSyncStatus}
        onConnectCloud={handleQuickCloudConnect}
        isConnectingCloud={isConnectingCloud}
        cloudError={cloudConnectError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenScanner={() => handleOpenScanner()}
        onOpenKassenModal={() => setIsKassenModalOpen(true)}
        onOpenInbound={() => {
          setInboundTarget(null);
          setIsInboundOpen(true);
        }}
        onOpenOutbound={() => {
          setOutboundPreselectedSn(undefined);
          setIsOutboundOpen(true);
        }}
        onOpenGoogleSheets={() => setIsSheetsModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadAlertCount={alerts.length}
        currentUser={currentUser}
        hasSheetsToken={hasSheetsToken}
        cloudSyncStatus={cloudSyncStatus}
        autoSyncEnabled={autoSyncEnabled}
        autoSyncStatus={autoSyncState.status}
        onResetData={handleResetData}
        theme={theme}
        onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
        simagSession={simagSession}
        onLogoutSimag={() => handleSimagLogout()}
      />

      {/* Main Body Content */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3 sm:px-6 py-5 pb-24 sm:pb-6 space-y-6">
        {/* One-time Firebase Console setup notice ONLY if Anonymous provider isn't enabled yet */}
        {!currentUser && cloudAutoNeedsSetup && !isCloudBannerDismissed && (
          <div className="p-3.5 sm:px-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Aktifkan 1 Pengaturan di Firebase Console agar Sinkronisasi Otomatis Tanpa Klik
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
                    Buka{' '}
                    <a
                      href="https://console.firebase.google.com/project/gen-lang-client-0109040418/authentication/providers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold text-amber-700 dark:text-amber-300"
                    >
                      Firebase Authentication → Sign-in method
                    </a>{' '}
                    lalu aktifkan provider <strong>Anonymous</strong>. Setelah aktif, Google AI Studio &amp; Vercel otomatis tersinkron tanpa klik tombol apapun.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  disabled={isConnectingCloud}
                  onClick={() => void startAutoCloudAuth()}
                  className="btn-tactile px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isConnectingCloud ? 'Mencoba...' : 'Coba Otomatis Lagi'}
                </button>
                <button
                  type="button"
                  disabled={isConnectingCloud}
                  onClick={() => void handleQuickCloudConnect()}
                  className="btn-tactile px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Masuk Google
                </button>
                <button
                  type="button"
                  onClick={() => setIsCloudBannerDismissed(true)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-amber-100/70 dark:hover:bg-slate-800 cursor-pointer"
                  title="Tutup sementara"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cloud Sync Error Alert if Firestore reports an issue */}
        {currentUser && cloudSyncStatus.status === 'error' && cloudSyncStatus.message && (
          <div className="p-3.5 sm:px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div>
                <p className="font-bold text-rose-800 dark:text-rose-200">Gangguan Sinkronisasi Cloud</p>
                <p className="mt-0.5">{cloudSyncStatus.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handlePullFromCloud()}
              className="btn-tactile px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              Coba Sinkronkan Ulang
            </button>
          </div>
        )}

        {/* Real-time KPI Stats Overview */}
        <StatCards
          racks={racks}
          cartons={cartons}
          meters={meters}
          outbounds={outbounds}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />

        {/* Tab View Switching with Smooth Animation */}
        <div key={activeTab} className="w-full min-w-0 animate-slide-up">
          {activeTab === 'racks' && (
            <RackVisualizer
              racks={racks}
              cartons={cartons}
              meters={meters}
              searchQuery={rackSearchQuery}
              onSearchChange={setRackSearchQuery}
              onMoveCarton={handleMoveCarton}
              onSelectCartonForOutbound={(sn) => {
                setOutboundPreselectedSn(sn);
                setIsOutboundOpen(true);
              }}
              onUpdateRack={handleUpdateRack}
              onOpenInboundForSlot={(rackId, level, slotNumber) => {
                setInboundTarget({ rackId, level, slotNumber });
                setIsInboundOpen(true);
              }}
              onAddUnitsToCarton={handleAddUnitsToCarton}
              onUpdateCartonBrand={handleUpdateCartonBrand}
            />
          )}

          {activeTab === 'stock' && (
            <StockListTab
              meters={meters}
              cartons={cartons}
              onSelectForOutbound={(sn) => {
                setOutboundPreselectedSn(sn);
                setIsOutboundOpen(true);
              }}
              onLocateInRack={(sn) => {
                setRackSearchQuery(sn);
                setActiveTab('racks');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportDashboard
              outbounds={outbounds}
              cartons={cartons}
              meters={meters}
              onOpenPrintBast={(rec) => setBastRecordToPrint(rec)}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementTab
              currentSession={simagSession}
              users={simagUsers}
              onUsersChange={(next) => {
                latestSimagUsersRef.current = next;
                setSimagUsers(next);
              }}
              onUserUpsert={(u) => {
                if (currentUser) {
                  runCloudPush(() => pushUpsertSimagUserToCloud(currentUser, u));
                }
              }}
              onUserDelete={(userId) => {
                if (currentUser) {
                  runCloudPush(() => pushDeleteSimagUserFromCloud(userId));
                }
              }}
            />
          )}
        </div>
      </main>

      {/* Bottom Sticky Mobile Quick Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-[0_-8px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_-8px_24px_rgba(2,6,23,0.6)]">
        <button
          onClick={() => handleOpenScanner()}
          className="btn-tactile flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer"
        >
          <div className="w-10 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-xs">
            <Camera className="w-4 h-4" />
          </div>
          <span>Scan</span>
        </button>

        <button
          onClick={() => {
            setInboundTarget(null);
            setIsInboundOpen(true);
          }}
          className="btn-tactile flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer"
        >
          <div className="w-10 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-cyan-900/20 dark:shadow-cyan-950/60">
            <Plus className="w-4 h-4" />
          </div>
          <span>Inbound</span>
        </button>

        <button
          onClick={() => {
            setOutboundPreselectedSn(undefined);
            setIsOutboundOpen(true);
          }}
          className="btn-tactile flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
        >
          <div className="w-10 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-900/20 dark:shadow-amber-950/60">
            <Send className="w-4 h-4" />
          </div>
          <span>Outbound</span>
        </button>

        <button
          onClick={() => setIsSheetsModalOpen(true)}
          className="btn-tactile flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
        >
          <div className="w-10 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span>Sheets</span>
        </button>
      </div>

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          if (scannerCallback) {
            scannerCallback(decodedText);
          }
        }}
        expectedType={scannerExpectedType}
      />

      <InboundCartonModal
        isOpen={isInboundOpen}
        onClose={() => {
          setIsInboundOpen(false);
          setInboundTarget(null);
        }}
        racks={racks}
        existingCartons={cartons}
        existingMeters={meters}
        onSaveInbound={handleSaveInbound}
        onOpenScanner={(cb) => handleOpenScanner(cb, 'carton')}
        initialRackId={inboundTarget?.rackId}
        initialLevel={inboundTarget?.level}
        initialSlotNumber={inboundTarget?.slotNumber}
      />

      <OutboundModal
        isOpen={isOutboundOpen}
        onClose={() => setIsOutboundOpen(false)}
        availableMeters={meters.filter(m => m.status === 'AVAILABLE')}
        preselectedSn={outboundPreselectedSn}
        onSaveOutbound={handleSaveOutbound}
        onOpenScanner={(cb) => handleOpenScanner(cb, 'meter')}
      />

      <GoogleSheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        currentUser={currentUser}
        hasSheetsToken={hasSheetsToken}
        onUserChange={(user, hasToken) => {
          setCurrentUser(user);
          setHasSheetsToken(Boolean(hasToken));
        }}
        cloudSyncStatus={cloudSyncStatus}
        onForceUploadCloud={handleForceUploadCloud}
        onPullFromCloud={handlePullFromCloud}
        lastSyncResult={lastSyncResult}
        autoSyncEnabled={autoSyncEnabled}
        onAutoSyncChange={setAutoSyncEnabled}
        autoSyncState={autoSyncState}
        onTriggerSyncNow={runWarehouseSync}
      />

      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        alerts={alerts}
        onMarkAllRead={() => setAlerts([])}
        onClearAlerts={() => setAlerts([])}
      />

      <PrintBastModal
        isOpen={!!bastRecordToPrint}
        onClose={() => setBastRecordToPrint(null)}
        record={bastRecordToPrint}
      />

      <KassenScannerModal
        isOpen={isKassenModalOpen}
        onClose={() => setIsKassenModalOpen(false)}
        onTestScanSuccess={(code) => {
          // If tested in modal, keep it active
        }}
      />

      {/* Floating Kassen KS-606 Quick Detection Toast */}
      {kassenToast && (
        <div className="fixed top-20 right-4 z-50 bg-white dark:bg-slate-900 border-2 border-cyan-500 text-slate-900 dark:text-white p-4 rounded-2xl shadow-2xl animate-slide-down flex items-start gap-3 max-w-sm">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-200 dark:border-cyan-500/30">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400 font-mono flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                Scan Kassen KS-606:
              </span>
              <button
                onClick={() => setKassenToast(null)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-1 break-all">
              {kassenToast.code}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => {
                  setOutboundPreselectedSn(kassenToast.code);
                  setIsOutboundOpen(true);
                  setKassenToast(null);
                }}
                className="btn-tactile px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
              >
                Keluarkan Material
              </button>
              <button
                onClick={() => {
                  setActiveTab('racks');
                  setRackSearchQuery(kassenToast.code);
                  setKassenToast(null);
                }}
                className="btn-tactile px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Lacak di Rak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Google Sheets Auto-Sync Toast */}
      {syncToast && (
        <div
          className={`fixed bottom-20 sm:bottom-5 left-3 right-3 sm:right-auto sm:left-5 z-50 sm:max-w-sm bg-white dark:bg-slate-900 border-2 rounded-2xl shadow-2xl p-3.5 flex items-start gap-3 animate-slide-up ${
            syncToast.type === 'synced'
              ? 'border-emerald-500/80'
              : syncToast.type === 'syncing'
              ? 'border-cyan-500/80'
              : syncToast.type === 'needs-reauth'
              ? 'border-amber-500/80'
              : 'border-rose-500/80'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              syncToast.type === 'synced'
                ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : syncToast.type === 'syncing'
                ? 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                : syncToast.type === 'needs-reauth'
                ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}
          >
            {syncToast.type === 'syncing' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : syncToast.type === 'synced' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                {syncToast.title}
              </p>
              <button
                type="button"
                onClick={() => setSyncToast(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded cursor-pointer"
                aria-label="Tutup notifikasi sinkronisasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {syncToast.subtitle && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug break-words">
                {syncToast.subtitle}
              </p>
            )}
            {(syncToast.sheetUrl || syncToast.type === 'needs-reauth' || syncToast.type === 'error') && (
              <div className="mt-2 flex items-center gap-2">
                {syncToast.sheetUrl && (
                  <a
                    href={syncToast.sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold shadow-xs"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {syncToast.type === 'needs-reauth' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSyncToast(null);
                      setIsSheetsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold shadow-xs cursor-pointer"
                  >
                    <span>Hubungkan Ulang</span>
                  </button>
                )}
                {syncToast.type === 'error' && (
                  <button
                    type="button"
                    onClick={() => void runWarehouseSync(autoSyncState.lastReason || 'Sinkronisasi ulang')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Coba Lagi</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inactivity Auto-Logout Warning Toast (Last 30 seconds) */}
      {idleWarningSeconds !== null && (
        <div className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 sm:max-w-sm bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl p-3.5 flex items-start gap-3 animate-slide-up">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Tidak Ada Aktivitas Terdeteksi
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
              Dashboard akan otomatis logout dalam{' '}
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {idleWarningSeconds} detik
              </span>
              .
            </p>
            <div className="mt-2">
              <button
                type="button"
                onClick={recordSimagActivity}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold shadow-xs cursor-pointer"
              >
                Tetap Masuk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
