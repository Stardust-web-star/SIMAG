/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StockAlert, MeterBrand, BRAND_CONFIGS, getBrandConfig, MeterUnit } from '../types/warehouse';

/**
 * Audio chime generator using Web Audio API (no external file needed)
 */
class SoundEffects {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playScanSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1320, this.ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch {
      // Audio might be blocked until user interaction
    }
  }

  playWarning() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.setValueAtTime(330, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch {
      // Ignore
    }
  }

  playSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start();
      osc.stop(now + 0.45);
    } catch {
      // Ignore
    }
  }
}

export const soundEffects = new SoundEffects();

/**
 * Trigger mobile vibration if available
 */
export function vibratePhone(pattern: number | number[] = [80]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore
    }
  }
}

/**
 * Request Web Push / Browser Notification permission
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  return await Notification.requestPermission();
}

/**
 * Dispatch desktop/mobile push notification
 */
export function sendBrowserPushNotification(title: string, body: string, icon = '/favicon.ico') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      const options: any = {
        body,
        icon,
        badge: icon,
      };
      new Notification(title, options);
    } catch {
      // Web notification blocked in some iframe contexts
    }
  }
}

/**
 * Evaluate current stock against safety thresholds and produce alerts
 */
export function evaluateStockThresholds(meters: MeterUnit[]): StockAlert[] {
  if (meters.length === 0) {
    return [];
  }
  const alerts: StockAlert[] = [];
  const brands = Array.from(new Set([
    ...(Object.keys(BRAND_CONFIGS) as MeterBrand[]),
    ...meters.map(m => m.brand).filter(Boolean),
  ]));

  brands.forEach(brand => {
    const brandMeters = meters.filter(m => m.brand === brand);
    if (brandMeters.length === 0) return; // Belum ada stok merek ini yang di-inbound

    const config = getBrandConfig(brand);
    const available = brandMeters.filter(m => m.status === 'AVAILABLE').length;

    if (available === 0) {
      alerts.push({
        id: `alert-empty-${brand}-${Date.now()}`,
        type: 'EMPTY_STOCK',
        brand,
        title: `Stok Habis: kWh Meter ${brand}`,
        message: `Stok fisik meter merek ${brand} telah 0 unit di gudang! Harap segera lakukan permintaan pengadaan/inbound.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
        severity: 'critical'
      });
    } else if (available <= config.minSafetyStock) {
      alerts.push({
        id: `alert-low-${brand}-${Date.now()}`,
        type: 'LOW_STOCK',
        brand,
        title: `Peringatan Stok Minimum: ${brand}`,
        message: `Sisa stok ${brand} tinggal ${available} pcs (Batas minimum: ${config.minSafetyStock} pcs).`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
        severity: 'warning'
      });
    }
  });

  return alerts;
}
