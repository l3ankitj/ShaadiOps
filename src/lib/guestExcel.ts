/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utility for downloading a guest import template and parsing uploaded Excel files.
 */

import * as XLSX from 'xlsx';
import { Guest, GuestStatus, InviteStatus, FamilySide, ArrivalMode } from '../types';

// ─── Column definitions ──────────────────────────────────────────────────────

export const TEMPLATE_COLUMNS = [
  'Name *',
  'Phone',
  'Group Name',
  'Is Primary Contact',
  'Family Side *',
  'Invite Status',
  'Arrival Date',
  'Arrival Time',
  'Arrival Mode',
  'Departure Date',
  'Departure Time',
  'Departure Mode',
  'Arrival Train Name',
  'Arrival Train Number',
  'Arrival Coach',
  'Arrival Seat',
  'Departure Train Name',
  'Departure Train Number',
  'Departure Coach',
  'Departure Seat',
  'Arrival Flight Number',
  'Departure Flight Number',
  'Dietary',
  'Travel Details (Arrival)',
  'Departure Details',
] as const;

const HINTS = [
  'Full name  e.g. Amit Sethia',
  'Mobile number  e.g. 9876543210  (optional)',
  'Group/family name  e.g. Sethia Family  (leave blank for solo guests)',
  'Yes  or  No  — one primary per group (the contact person)',
  'Bride Side  or  Groom Side',
  'Confirmed  /  Declined  /  Pending  (default: Pending)',
  'DD.MM  or  YYYY-MM-DD  e.g. 15.6  (optional — fill later)',
  '24-hr or 12-hr  e.g. 14:30  or  2:30 PM',
  'Car  /  Train  /  Flight  /  Bus',
  'DD.MM  or  YYYY-MM-DD  e.g. 18.6',
  'e.g. 11:00',
  'Car  /  Train  /  Flight  /  Bus',
  'Only if Arrival Mode = Train',
  'Only if Arrival Mode = Train',
  'Only if Arrival Mode = Train  e.g. B2',
  'Only if Arrival Mode = Train  e.g. 45',
  'Only if Departure Mode = Train',
  'Only if Departure Mode = Train',
  'Only if Departure Mode = Train',
  'Only if Departure Mode = Train',
  'Only if Arrival Mode = Flight  e.g. AI 202',
  'Only if Departure Mode = Flight  e.g. 6E 304',
  'e.g. Vegetarian  /  No nuts  (optional)',
  'Cab / vehicle info for arrival pickup  (optional)',
  'Cab / vehicle info for departure drop  (optional)',
];

// Family group example — all share "Sethia Family"
const SAMPLE_ROW_1 = [
  'Amit Sethia', '9876543210', 'Sethia Family', 'Yes', 'Bride Side', 'Confirmed',
  '15.6', '14:30', 'Train', '18.6', '11:00', 'Car',
  'Rajdhani Express', '12301', 'B2', '45', '', '', '', '', '', '',
  'Vegetarian', '', '',
];

const SAMPLE_ROW_2 = [
  'Sunita Sethia', '', 'Sethia Family', 'No', 'Bride Side', 'Confirmed',
  '15.6', '14:30', 'Train', '18.6', '11:00', 'Car',
  'Rajdhani Express', '12301', 'B2', '46', '', '', '', '', '', '',
  '', '', '',
];

const SAMPLE_ROW_3 = [
  'Aryan Sethia', '', 'Sethia Family', 'No', 'Bride Side', 'Pending',
  '', '', '', '', '', '',
  '', '', '', '', '', '', '', '', '', '',
  '', '', '',
];

// Solo guest — no group name
const SAMPLE_ROW_4 = [
  'Verma Ji', '9123456780', '', 'Yes', 'Groom Side', 'Confirmed',
  '15.6', '16:00', 'Flight', '19.6', '09:00', 'Car',
  '', '', '', '', '', '', '', '', 'AI 202', '6E 304',
  '', '', '',
];

// Another solo — invite not yet confirmed, no travel yet
const SAMPLE_ROW_5 = [
  'Gupta Uncle', '9988776655', '', 'Yes', 'Bride Side', 'Pending',
  '', '', '', '', '', '',
  '', '', '', '', '', '', '', '', '', '',
  'No onion no garlic', '', '',
];

// ─── Template download ────────────────────────────────────────────────────────

export function downloadGuestTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Guest Template ──────────────────────────────────────────────
  const wsData: (string | number)[][] = [
    TEMPLATE_COLUMNS as unknown as string[],
    HINTS,
    SAMPLE_ROW_1,
    SAMPLE_ROW_2,
    SAMPLE_ROW_3,
    SAMPLE_ROW_4,
    SAMPLE_ROW_5,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = [22, 15, 20, 18, 14, 14, 14, 14, 12, 14, 14, 12, 22, 18, 10, 10, 22, 18, 10, 10, 18, 18, 22, 22, 22];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 2 };

  XLSX.utils.book_append_sheet(wb, ws, 'Guest Template');

  // ── Sheet 2: Reference ───────────────────────────────────────────────────
  const refData = [
    ['Field', 'Valid Values', 'Notes'],
    ['', '', ''],
    ['★ REQUIRED COLUMNS', '', ''],
    ['Name *', 'Any text', 'Full name of the individual person'],
    ['Family Side *', 'Bride Side', ''],
    ['', 'Groom Side', ''],
    ['', '', ''],
    ['☆ OPTIONAL AT IMPORT — fill later', '', ''],
    ['Phone', 'Any number string', 'Recommended for primary contacts'],
    ['Group Name', 'Free text', 'Same name links people into a family/group'],
    ['Is Primary Contact', 'Yes', 'The person to call for this group'],
    ['', 'No', ''],
    ['Invite Status', 'Confirmed', 'Guest has confirmed they are coming'],
    ['', 'Declined', 'Guest cannot attend'],
    ['', 'Pending', 'No response yet (default)'],
    ['', '', ''],
    ['✈ TRAVEL DETAILS (all optional at import)', '', ''],
    ['Arrival/Departure Date', '15.6  or  2026-06-15', 'DD.MM  or  YYYY-MM-DD'],
    ['Arrival/Departure Time', '14:30  or  2:30 PM', '24-hr or 12-hr both accepted'],
    ['Arrival/Departure Mode', 'Car', ''],
    ['', 'Train', '→ also fill Train Name, Number, Coach, Seat'],
    ['', 'Flight', '→ also fill Flight Number'],
    ['', 'Bus', ''],
    ['Train columns', 'Name, Number, Coach, Seat', 'Only when Mode = Train'],
    ['Flight columns', 'Flight Number', 'Only when Mode = Flight'],
    ['', '', ''],
    ['TIPS', '', ''],
    ['One row = one person', '', 'Add each family member as their own row'],
    ['Group linking', '', 'All rows with same Group Name are one family'],
    ['Primary contact', '', 'Mark one person per group as primary (Yes) — their phone is the contact number'],
    ['Travel later', '', 'Leave arrival/departure blank — fill from the app once they confirm'],
  ];

  const wsRef = XLSX.utils.aoa_to_sheet(refData);
  wsRef['!cols'] = [{ wch: 32 }, { wch: 35 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');

  XLSX.writeFile(wb, 'ShaadiOps_Guest_Template.xlsx');
}

// ─── Date / time parsers ──────────────────────────────────────────────────────

function parseDate(raw: unknown): string | undefined {
  if (!raw || String(raw).trim() === '') return undefined;

  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parts = str.split(/[./-]/);
  if (parts.length >= 2) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2] || String(new Date().getFullYear());
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

function parseTime(raw: unknown): string {
  if (!raw || String(raw).trim() === '') return '12:00';

  if (raw instanceof Date) {
    const h = String(raw.getHours()).padStart(2, '0');
    const m = String(raw.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  const str = String(raw).trim();
  const pmMatch = str.match(/^(\d{1,2})[.:](\d{2})\s*PM$/i);
  const amMatch = str.match(/^(\d{1,2})[.:](\d{2})\s*AM$/i);
  const plainMatch = str.match(/^(\d{1,2})[.:](\d{2})$/);

  if (pmMatch) {
    let h = parseInt(pmMatch[1]);
    if (h < 12) h += 12;
    return `${String(h).padStart(2, '0')}:${pmMatch[2]}`;
  }
  if (amMatch) {
    let h = parseInt(amMatch[1]);
    if (h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${amMatch[2]}`;
  }
  if (plainMatch) return `${plainMatch[1].padStart(2, '0')}:${plainMatch[2]}`;

  return '12:00';
}

function parseFamilySide(raw: unknown): FamilySide {
  const s = String(raw || '').toLowerCase();
  return s.includes('groom') ? FamilySide.GROOM : FamilySide.BRIDE;
}

function parseInviteStatus(raw: unknown): InviteStatus {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'confirmed') return InviteStatus.CONFIRMED;
  if (s === 'declined') return InviteStatus.DECLINED;
  return InviteStatus.PENDING;
}

function parseArrivalMode(raw: unknown): ArrivalMode {
  const s = String(raw || '').toLowerCase();
  if (s === 'train') return ArrivalMode.TRAIN;
  if (s === 'flight') return ArrivalMode.FLIGHT;
  if (s === 'bus') return ArrivalMode.BUS;
  return ArrivalMode.CAR;
}

function str(v: unknown): string {
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

function bool(v: unknown): boolean {
  const s = String(v || '').toLowerCase().trim();
  return s === 'yes' || s === 'true' || s === '1';
}

// ─── Parse result ────────────────────────────────────────────────────────────

export interface ParsedRow {
  guest: Guest;
  rowIndex: number;
  warnings: string[];
}

export interface ParseError {
  rowIndex: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

// ─── Main parse function ─────────────────────────────────────────────────────

export function parseGuestExcel(file: File): Promise<ParseResult> {
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
          dateNF: 'yyyy-mm-dd',
        });

        if (aoa.length < 2) return resolve({ rows: [], errors: [] });

        // Detect header row — find row with "Name" in col 0
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(aoa.length, 5); i++) {
          if (String(aoa[i][0]).toLowerCase().includes('name')) {
            headerRowIdx = i;
            break;
          }
        }

        // Strip trailing * and whitespace from header names
        const headers = aoa[headerRowIdx].map(h => String(h).trim().replace(/\s*\*$/, '').toLowerCase());
        const col = (name: string) => headers.indexOf(name.toLowerCase());

        const rows: ParsedRow[] = [];
        const errors: ParseError[] = [];

        for (let i = headerRowIdx + 1; i < aoa.length; i++) {
          const row = aoa[i];
          const rowIndex = i - headerRowIdx;

          if (row.join('').trim() === '') continue;

          const name = str(row[col('name')]);
          if (!name || name.toLowerCase().startsWith('e.g') || name.toLowerCase().startsWith('full name')) continue;

          const warnings: string[] = [];

          const phone = str(row[col('phone')]);
          const groupName = str(row[col('group name')]);
          const isPrimary = bool(row[col('is primary contact')]);
          const familySide = parseFamilySide(row[col('family side')]);
          const inviteStatus = parseInviteStatus(row[col('invite status')]);

          // Travel fields — only set if date is present
          const arrivalDateRaw = row[col('arrival date')];
          const departureDateRaw = row[col('departure date')];
          const arrivalDate = parseDate(arrivalDateRaw);
          const departureDate = parseDate(departureDateRaw);

          const hasTravelDetails = !!(arrivalDate && departureDate);
          const arrivalMode = parseArrivalMode(row[col('arrival mode')]);
          const departureMode = parseArrivalMode(row[col('departure mode')]);

          const guest: Guest = {
            id: `G${Date.now()}_${i}`,
            name,
            ...(phone ? { phone } : {}),
            ...(groupName ? { groupName } : {}),
            ...(groupName ? { isPrimaryContact: isPrimary } : {}),
            familySide,
            inviteStatus,
            status: GuestStatus.PENDING,
            ...(str(row[col('dietary')]) ? { dietary: str(row[col('dietary')]) } : {}),
            // Travel details only if dates provided
            ...(hasTravelDetails ? {
              arrivalMode,
              departureMode,
              arrivalDateTime: `${arrivalDate}T${parseTime(row[col('arrival time')])}:00`,
              departureDateTime: `${departureDate}T${parseTime(row[col('departure time')])}:00`,
              ...(str(row[col('travel details (arrival)')]) ? { travelDetails: str(row[col('travel details (arrival)')]) } : {}),
              ...(str(row[col('departure details')]) ? { departureDetails: str(row[col('departure details')]) } : {}),
              // Train
              ...(str(row[col('arrival train name')]) ? { arrivalTrainName: str(row[col('arrival train name')]) } : {}),
              ...(str(row[col('arrival train number')]) ? { arrivalTrainNumber: str(row[col('arrival train number')]) } : {}),
              ...(str(row[col('arrival coach')]) ? { arrivalCoach: str(row[col('arrival coach')]) } : {}),
              ...(str(row[col('arrival seat')]) ? { arrivalSeat: str(row[col('arrival seat')]) } : {}),
              ...(str(row[col('departure train name')]) ? { departureTrainName: str(row[col('departure train name')]) } : {}),
              ...(str(row[col('departure train number')]) ? { departureTrainNumber: str(row[col('departure train number')]) } : {}),
              ...(str(row[col('departure coach')]) ? { departureCoach: str(row[col('departure coach')]) } : {}),
              ...(str(row[col('departure seat')]) ? { departureSeat: str(row[col('departure seat')]) } : {}),
              // Flight
              ...(str(row[col('arrival flight number')]) ? { arrivalFlightNumber: str(row[col('arrival flight number')]) } : {}),
              ...(str(row[col('departure flight number')]) ? { departureFlightNumber: str(row[col('departure flight number')]) } : {}),
            } : {}),
          };

          rows.push({ guest, rowIndex, warnings });
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
