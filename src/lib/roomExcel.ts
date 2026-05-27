/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utility for downloading a hotel room import template and parsing uploaded Excel files.
 */

import * as XLSX from 'xlsx';
import { Room, RoomStatus } from '../types';

// ─── Column definitions ───────────────────────────────────────────────────────

export const ROOM_COLUMNS = [
  'Hotel Name',
  'Room Number',
  'Floor',
  'Category',
  'Capacity',
  'Status',
] as const;

const HINTS = [
  'e.g. Taj Lake Palace',
  'e.g. 101  or  R-101',
  'e.g. Ground Floor  or  1st Floor',
  'Deluxe / Semi-Deluxe / Suite / Superior / Standard',
  'e.g. 2  (max guests in room)',
  'Empty / Occupied / Cleaning / Maintenance  (leave blank for Empty)',
];

const SAMPLE_ROWS = [
  ['Taj Lake Palace', '101', 'Ground Floor', 'Deluxe', 2, 'Empty'],
  ['Taj Lake Palace', '102', 'Ground Floor', 'Suite', 4, 'Empty'],
  ['Taj Lake Palace', '201', '1st Floor', 'Deluxe', 2, 'Empty'],
  ['Taj Lake Palace', '202', '1st Floor', 'Semi-Deluxe', 2, 'Maintenance'],
  ['The Leela Palace', '301', '3rd Floor', 'Superior', 3, 'Empty'],
  ['The Leela Palace', '302', '3rd Floor', 'Standard', 2, 'Empty'],
];

// ─── Template download ────────────────────────────────────────────────────────

export function downloadRoomTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Room Template ───────────────────────────────────────────────
  const wsData = [
    [...ROOM_COLUMNS],
    HINTS,
    ...SAMPLE_ROWS,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 24 }, // Hotel Name
    { wch: 14 }, // Room Number
    { wch: 18 }, // Floor
    { wch: 20 }, // Category
    { wch: 12 }, // Capacity
    { wch: 16 }, // Status
  ];

  // Freeze header + hints rows
  ws['!freeze'] = { xSplit: 0, ySplit: 2 };

  XLSX.utils.book_append_sheet(wb, ws, 'Room Template');

  // ── Sheet 2: Reference ───────────────────────────────────────────────────
  const refData = [
    ['Field', 'Valid Values', 'Notes'],
    ['Category', 'Deluxe', ''],
    ['', 'Semi-Deluxe', ''],
    ['', 'Suite', ''],
    ['', 'Superior', ''],
    ['', 'Standard', ''],
    ['', '', ''],
    ['Status', 'Empty', 'Default when left blank'],
    ['', 'Occupied', 'Room already taken'],
    ['', 'Cleaning', 'Being serviced'],
    ['', 'Maintenance', 'Under repair'],
    ['', '', ''],
    ['Capacity', 'Number ≥ 1', 'Max guests the room can hold'],
    ['', '', ''],
    ['⚠ Required columns', 'Hotel Name, Room Number, Floor, Category, Capacity', ''],
  ];

  const wsRef = XLSX.utils.aoa_to_sheet(refData);
  wsRef['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');

  XLSX.writeFile(wb, 'ShaadiOps_Hotel_Room_Template.xlsx');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCategory(raw: unknown): string {
  const s = String(raw || '').trim();
  const valid = ['Deluxe', 'Semi-Deluxe', 'Suite', 'Superior', 'Standard'];
  const match = valid.find(v => v.toLowerCase() === s.toLowerCase());
  return match || (s || 'Deluxe');
}

function parseRoomStatus(raw: unknown): RoomStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'occupied') return RoomStatus.OCCUPIED;
  if (s === 'cleaning') return RoomStatus.CLEANING;
  if (s === 'maintenance') return RoomStatus.MAINTENANCE;
  return RoomStatus.EMPTY; // default
}

function str(v: unknown): string {
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

// ─── Parse result ─────────────────────────────────────────────────────────────

export interface ParsedRoomRow {
  room: Room;
  rowIndex: number;
  warnings: string[];
}

export interface RoomParseResult {
  rows: ParsedRoomRow[];
  errors: Array<{ rowIndex: number; message: string }>;
}

// ─── Main parse function ──────────────────────────────────────────────────────

export function parseRoomExcel(file: File): Promise<RoomParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });

        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: false,
        });

        if (aoa.length < 2) return resolve({ rows: [], errors: [] });

        // Find header row (contains "hotel" or "room" in first few rows)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(aoa.length, 5); i++) {
          const first = String(aoa[i][0]).toLowerCase();
          if (first.includes('hotel') || first.includes('room')) {
            headerRowIdx = i;
            break;
          }
        }

        const headers = aoa[headerRowIdx].map(h => String(h).trim().toLowerCase());
        const col = (name: string) => headers.indexOf(name.toLowerCase());

        const rows: ParsedRoomRow[] = [];
        const errors: RoomParseResult['errors'] = [];

        for (let i = headerRowIdx + 1; i < aoa.length; i++) {
          const row = aoa[i];
          const rowIndex = i - headerRowIdx;

          // Skip blank rows and the hints row
          if (row.join('').trim() === '') continue;

          const hotelName = str(row[col('hotel name')]);
          const roomNumber = str(row[col('room number')]);

          // Skip hints / example rows
          if (!hotelName || hotelName.toLowerCase().startsWith('e.g')) continue;
          if (!roomNumber || roomNumber.toLowerCase().startsWith('e.g')) continue;

          const warnings: string[] = [];
          const floor = str(row[col('floor')]);
          if (!floor) warnings.push('Floor is empty');

          const capacityRaw = row[col('capacity')];
          const capacity = parseInt(String(capacityRaw)) || 2;

          const room: Room = {
            id: `R${Date.now()}_${i}`,
            hotel: hotelName,
            number: roomNumber,
            floor: floor || 'Ground Floor',
            category: parseCategory(row[col('category')]),
            capacity,
            status: parseRoomStatus(row[col('status')]),
          };

          rows.push({ room, rowIndex, warnings });
        }

        resolve({ rows, errors });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
