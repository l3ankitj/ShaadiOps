/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PdfColumn {
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface PdfOptions {
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string | number }[];
  columns: PdfColumn[];
  rows: string[][];
  orientation?: 'portrait' | 'landscape';
}

export function exportToPdf(opts: PdfOptions) {
  const { title, subtitle, stats, columns, rows, orientation = 'portrait' } = opts;
  const now = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const statsHtml = stats?.length
    ? `<div class="stats">${stats.map(s => `<div class="stat"><span class="stat-val">${s.value}</span><span class="stat-lbl">${s.label}</span></div>`).join('')}</div>`
    : '';

  const thHtml = columns.map(c =>
    `<th style="text-align:${c.align ?? 'left'};${c.width ? `width:${c.width}` : ''}">${c.header}</th>`
  ).join('');

  const tbodyHtml = rows.map(row =>
    `<tr>${row.map((cell, i) =>
      `<td style="text-align:${columns[i]?.align ?? 'left'}">${cell}</td>`
    ).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${title} — ShaadiOps</title>
<style>
@page { size: ${orientation}; margin: 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; font-size: 11px; }
.header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #1a1a2e; }
.header h1 { font-size: 22px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }
.header .sub { font-size: 10px; color: #666; letter-spacing: 1.5px; text-transform: uppercase; }
.header .date { font-size: 9px; color: #999; margin-top: 4px; }
.stats { display: flex; justify-content: center; gap: 32px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
.stat { text-align: center; }
.stat-val { display: block; font-size: 20px; font-weight: 800; color: #1a1a2e; }
.stat-lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
th { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #666; padding: 8px 10px; border-bottom: 2px solid #1a1a2e; }
td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
tr:nth-child(even) td { background: #fafafa; }
.footer { text-align: center; margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 8px; color: #aaa; letter-spacing: 1px; text-transform: uppercase; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="header">
  <h1>${title}</h1>
  ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
  <div class="date">Generated ${now} · ${rows.length} record${rows.length !== 1 ? 's' : ''}</div>
</div>
${statsHtml}
<table>
  <thead><tr>${thHtml}</tr></thead>
  <tbody>${tbodyHtml}</tbody>
</table>
<div class="footer">ShaadiOps · Wedding Operations</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
