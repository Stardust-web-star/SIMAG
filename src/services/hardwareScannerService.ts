/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { soundEffects, vibratePhone } from './notificationService';

export interface ScanEventDetail {
  code: string;
  source: 'kassen_ks606_hid' | 'kassen_webhid' | 'camera' | 'manual';
  durationMs: number;
}

type ScanListener = (detail: ScanEventDetail) => void;

class HardwareScannerService {
  private listeners: Set<ScanListener> = new Set();
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private scanStartTime: number = 0;
  private maxCharIntervalMs: number = 65; // Barcode scanners type very rapidly (< 50ms)
  private minBarcodeLength: number = 3;
  private isListening: boolean = false;
  private connectedHidDeviceName: string | null = null;

  constructor() {
    this.initGlobalKeyListener();
  }

  private initGlobalKeyListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const now = Date.now();

      // Ignore single modifier keys (Shift, Ctrl, Alt, Meta)
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
        return;
      }

      // If time between keystrokes is too long, reset buffer (it's human typing)
      const interval = now - this.lastKeyTime;
      if (interval > this.maxCharIntervalMs && this.buffer.length > 0) {
        // If it was human typing, clear old buffer
        this.buffer = '';
      }

      this.lastKeyTime = now;

      if (e.key === 'Enter') {
        // Barcode scanners typically send 'Enter' as the suffix
        if (this.buffer.length >= this.minBarcodeLength) {
          const duration = now - this.scanStartTime;
          const scannedCode = this.buffer.trim();
          this.buffer = '';

          // Only treat as scanner if scan took reasonable time or buffer was rapidly typed
          if (scannedCode) {
            this.notifyListeners({
              code: scannedCode,
              source: 'kassen_ks606_hid',
              durationMs: duration,
            });

            // Prevent default form submit if it was a rapid hardware scan
            e.preventDefault();
            e.stopPropagation();
          }
        } else {
          this.buffer = '';
        }
        return;
      }

      // If this is the start of a new rapid burst
      if (this.buffer.length === 0) {
        this.scanStartTime = now;
      }

      // Append printable single characters
      if (e.key.length === 1) {
        this.buffer += e.key;
      }
    }, true); // Capture phase to intercept scanner input before inputs
  }

  /**
   * Subscribe to hardware scan events
   */
  subscribe(listener: ScanListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(detail: ScanEventDetail) {
    soundEffects.playScanSuccess();
    vibratePhone([80, 40, 80]);

    this.listeners.forEach((fn) => {
      try {
        fn(detail);
      } catch (err) {
        console.error('Scan listener error:', err);
      }
    });

    // Also dispatch DOM custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kassen-ks606-scan', { detail }));
    }
  }

  /**
   * Optional WebHID Pairing for browsers that support it (Chrome, Edge, Opera)
   */
  async requestWebHidConnection(): Promise<string | null> {
    if (typeof navigator === 'undefined' || !('hid' in navigator)) {
      throw new Error('WebHID API tidak didukung pada browser ini. Namun, Kassen KS-606 tetap dapat langsung digunakan melalui USB Keyboard Wedge bawaan!');
    }

    try {
      const devices = await (navigator as any).hid.requestDevice({
        filters: [] // Allow user to select Kassen KS-606 USB receiver
      });

      if (devices && devices.length > 0) {
        const dev = devices[0];
        await dev.open();
        this.connectedHidDeviceName = dev.productName || 'Kassen KS-606 Wireless Receiver';
        return this.connectedHidDeviceName;
      }
      return null;
    } catch (err: any) {
      console.warn('WebHID pairing cancelled or failed:', err);
      throw err;
    }
  }

  getConnectedDeviceName(): string | null {
    return this.connectedHidDeviceName;
  }
}

export const hardwareScannerService = new HardwareScannerService();
