/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WarehouseRack, InboundCarton, MeterUnit, OutboundRecord } from '../types/warehouse';

// Physical warehouse racks setup (empty shelves, ready for live real data recording)
export const INITIAL_RACKS: WarehouseRack[] = [
  {
    id: 'RAK-A',
    name: 'Rak A - Melcoinda 1 Phasa',
    zone: 'Zona Barat (Lorong 1)',
    primaryBrand: 'Melcoinda',
    brandColor: '#0284c7', // Sky Blue
    shelves: [
      { level: 1, label: 'Tingkat 1 (Atas)', cartonCapacity: 16, cartonIds: [] },
      { level: 2, label: 'Tingkat 2', cartonCapacity: 16, cartonIds: [] },
      { level: 3, label: 'Tingkat 3', cartonCapacity: 16, cartonIds: [] },
      { level: 4, label: 'Tingkat 4 (Bawah)', cartonCapacity: 16, cartonIds: [] },
    ],
  },
  {
    id: 'RAK-B',
    name: 'Rak B - Itron Prabayar',
    zone: 'Zona Barat (Lorong 2)',
    primaryBrand: 'Itron',
    brandColor: '#059669', // Emerald Green
    shelves: [
      { level: 1, label: 'Tingkat 1 (Atas)', cartonCapacity: 16, cartonIds: [] },
      { level: 2, label: 'Tingkat 2', cartonCapacity: 16, cartonIds: [] },
      { level: 3, label: 'Tingkat 3', cartonCapacity: 16, cartonIds: [] },
      { level: 4, label: 'Tingkat 4 (Bawah)', cartonCapacity: 16, cartonIds: [] },
    ],
  },
  {
    id: 'RAK-C',
    name: 'Rak C - Hexing Smart Meter',
    zone: 'Zona Timur (Lorong 1)',
    primaryBrand: 'Hexing',
    brandColor: '#d97706', // Amber Gold
    shelves: [
      { level: 1, label: 'Tingkat 1 (Atas)', cartonCapacity: 16, cartonIds: [] },
      { level: 2, label: 'Tingkat 2', cartonCapacity: 16, cartonIds: [] },
      { level: 3, label: 'Tingkat 3', cartonCapacity: 16, cartonIds: [] },
      { level: 4, label: 'Tingkat 4 (Bawah)', cartonCapacity: 16, cartonIds: [] },
    ],
  },
  {
    id: 'RAK-D',
    name: 'Rak D - Sanxing & 3 Phasa',
    zone: 'Zona Timur (Lorong 2)',
    primaryBrand: 'Sanxing',
    brandColor: '#8b5cf6', // Violet
    shelves: [
      { level: 1, label: 'Tingkat 1 (Atas)', cartonCapacity: 16, cartonIds: [] },
      { level: 2, label: 'Tingkat 2', cartonCapacity: 16, cartonIds: [] },
      { level: 3, label: 'Tingkat 3', cartonCapacity: 16, cartonIds: [] },
      { level: 4, label: 'Tingkat 4 (Bawah)', cartonCapacity: 16, cartonIds: [] },
    ],
  },
];

// Clean initial empty state for live real data entry
export const INITIAL_CARTONS: InboundCarton[] = [];

export const INITIAL_METERS: MeterUnit[] = [];

export const INITIAL_OUTBOUND: OutboundRecord[] = [];
