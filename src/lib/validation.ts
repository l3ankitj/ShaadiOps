/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Indian mobile number — 10 digits starting 6-9, optional +91/91/0 prefix */
export function validatePhone(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null; // optional field — caller decides if required
  const cleaned = v.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  const digits =
    cleaned.startsWith('91') && cleaned.length === 12 ? cleaned.slice(2) :
    cleaned.startsWith('0')  && cleaned.length === 11 ? cleaned.slice(1) :
    cleaned;
  if (!/^[6-9]\d{9}$/.test(digits))
    return 'Enter a valid 10-digit mobile number (e.g. 98765 43210)';
  return null;
}

/** DD.MM or D.M — day 1-31, month 1-12 */
export function validateDateStr(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const parts = v.split(/[./\-]/);
  if (parts.length < 2) return 'Use DD.MM format (e.g. 25.6)';
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(day)   || day   < 1 || day   > 31) return 'Day must be 1–31';
  if (isNaN(month) || month < 1 || month > 12) return 'Month must be 1–12';
  return null;
}

/** H or H.MM or HH.MM — hour 1-12, minutes 0-59 */
export function validateTimeStr(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const parts = v.split(/[.:]/);
  const h = parseInt(parts[0], 10);
  const m = parts[1] !== undefined ? parseInt(parts[1], 10) : 0;
  if (isNaN(h) || h < 1 || h > 12) return 'Hour must be 1–12';
  if (isNaN(m) || m < 0 || m > 59) return 'Minutes must be 0–59';
  return null;
}
