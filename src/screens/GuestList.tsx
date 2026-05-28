/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Search, X, Plane, Car, Train, Bus,
  Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Loader2, ChevronDown, ChevronUp, Users2, StickyNote, BedDouble, Trash2, Pencil,
} from 'lucide-react';
import { Card, StatCard, Badge, Button } from '../components/UIComponents';
import { collection, onSnapshot, orderBy, query, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Guest, GuestStatus, InviteStatus, FamilySide, ArrivalMode } from '../types';
import { cn } from '../lib/utils';
import { downloadGuestTemplate, parseGuestExcel, ParsedRow } from '../lib/guestExcel';
import { useIsReadOnly } from '../contexts/AccessContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dt: string | undefined) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
}

function ArrivalIcon({ mode, size = 14 }: { mode: ArrivalMode; size?: number }) {
  const cls = 'text-secondary';
  if (mode === ArrivalMode.FLIGHT) return <Plane size={size} className={cls} />;
  if (mode === ArrivalMode.TRAIN) return <Train size={size} className={cls} />;
  if (mode === ArrivalMode.BUS) return <Bus size={size} className={cls} />;
  return <Car size={size} className={cls} />;
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  if (status === InviteStatus.CONFIRMED)
    return <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Confirmed</span>;
  if (status === InviteStatus.DECLINED)
    return <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Declined</span>;
  return <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant text-outline uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-outline" />Pending</span>;
}

type FilterChip = 'all' | FamilySide | InviteStatus | 'travel';

// ─── Import modal ─────────────────────────────────────────────────────────────

interface ImportModalProps {
  rows: ParsedRow[];
  onConfirm: () => void;
  onCancel: () => void;
  importing: boolean;
  importDone: boolean;
  importCount: number;
}

function ImportModal({ rows, onConfirm, onCancel, importing, importDone, importCount }: ImportModalProps) {
  const warned = rows.filter(r => r.warnings.length > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={22} className="text-secondary" />
            <div>
              <h2 className="text-sm font-bold text-primary uppercase tracking-widest">Import Preview</h2>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">
                {rows.length} {rows.length === 1 ? 'person' : 'people'}
              </p>
            </div>
          </div>
          {!importing && !importDone && (
            <button onClick={onCancel} className="p-2 hover:bg-surface-container rounded-full text-outline"><X size={18} /></button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {importDone ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <CheckCircle2 size={48} className="text-emerald-500" />
              <p className="text-base font-bold text-primary">{importCount} guests imported successfully!</p>
            </div>
          ) : importing ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Saving to database…</p>
            </div>
          ) : (
            <>
              {warned.length > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">{warned.length} row{warned.length > 1 ? 's have' : ' has'} warnings — will still import.</p>
                </div>
              )}
              <div className="space-y-2">
                {rows.map(({ guest, rowIndex, warnings }) => (
                  <div key={guest.id} className={cn('flex items-center gap-3 px-4 py-3 rounded-lg border',
                    warnings.length ? 'bg-amber-50 border-amber-200' : 'bg-surface-container-low border-outline-variant/40')}>
                    <span className="text-[10px] font-mono text-outline w-6 flex-shrink-0">{rowIndex}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary truncate">{guest.name}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {guest.groupName ? `${guest.groupName} · ` : ''}{guest.familySide} · {guest.inviteStatus ?? InviteStatus.PENDING}
                        {guest.arrivalDateTime ? ` · ✈ ${formatDate(guest.arrivalDateTime)}` : ' · No travel yet'}
                      </p>
                      {warnings.length > 0 && <p className="text-[10px] text-amber-700 mt-0.5">⚠ {warnings.join(', ')}</p>}
                    </div>
                    <Badge variant={guest.familySide === FamilySide.BRIDE ? 'primary' : 'secondary'} className="text-[9px] flex-shrink-0">
                      {guest.familySide === FamilySide.BRIDE ? 'Bride' : 'Groom'}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {!importing && !importDone && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={onConfirm}><Upload size={14} />Import {rows.length} People</Button>
          </div>
        )}
        {importDone && (
          <div className="flex justify-end px-6 py-4 border-t border-outline-variant">
            <Button variant="primary" onClick={onCancel}>Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GuestList() {
  const isReadOnly = useIsReadOnly();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const initialCollapseSet = useRef(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 5000);
    const q = query(collection(db, 'guests'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      clearTimeout(fallback);
      setGuests(snap.docs.map(d => d.data() as Guest));
      setLoading(false);
    }, (err) => {
      clearTimeout(fallback);
      handleFirestoreError(err, OperationType.LIST, 'guests');
      setLoading(false);
    });
    return () => { clearTimeout(fallback); unsub(); };
  }, []);

  // Stats
  const totalPeople = guests.length;
  const totalGroups = new Set(guests.map(g => g.groupName).filter(Boolean)).size;
  const confirmedCount = guests.filter(g => (g.inviteStatus ?? InviteStatus.PENDING) === InviteStatus.CONFIRMED).length;
  const travelConfirmed = guests.filter(g => !!g.arrivalDateTime).length;
  const brideCount = guests.filter(g => g.familySide === FamilySide.BRIDE).length;
  const groomCount = guests.filter(g => g.familySide === FamilySide.GROOM).length;

  // Filter
  const filtered = guests.filter(g => {
    const invStatus = g.inviteStatus ?? InviteStatus.PENDING;
    if (filter === InviteStatus.CONFIRMED) { if (invStatus !== InviteStatus.CONFIRMED) return false; }
    else if (filter === InviteStatus.PENDING) { if (invStatus !== InviteStatus.PENDING) return false; }
    else if (filter === InviteStatus.DECLINED) { if (invStatus !== InviteStatus.DECLINED) return false; }
    else if (filter === FamilySide.BRIDE) { if (g.familySide !== FamilySide.BRIDE) return false; }
    else if (filter === FamilySide.GROOM) { if (g.familySide !== FamilySide.GROOM) return false; }
    else if (filter === 'travel') { if (!g.arrivalDateTime) return false; }

    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return g.name.toLowerCase().includes(s) ||
      (g.phone || '').includes(s) ||
      (g.groupName || '').toLowerCase().includes(s);
  });

  // Group filtered guests
  const groupMap = new Map<string, Guest[]>();
  for (const g of filtered) {
    const key = g.groupName?.trim() || '_solo';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(g);
  }
  // Sort members: primary first, then name
  for (const members of groupMap.values()) {
    members.sort((a, b) => {
      if (a.isPrimaryContact && !b.isPrimaryContact) return -1;
      if (!a.isPrimaryContact && b.isPrimaryContact) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  // Sort group keys: named groups alphabetically, solo last
  const sortedGroupKeys = Array.from(groupMap.keys()).sort((a, b) => {
    if (a === '_solo') return 1;
    if (b === '_solo') return -1;
    return a.localeCompare(b);
  });

  // Collapse all named groups on first load
  useEffect(() => {
    if (loading || initialCollapseSet.current) return;
    initialCollapseSet.current = true;
    const namedGroups = new Set(guests.map(g => g.groupName?.trim()).filter((n): n is string => !!n));
    setCollapsedGroups(namedGroups);
  }, [loading, guests]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setParseError(null);
    setImportDone(false);
    setImportCount(0);
    try {
      const result = await parseGuestExcel(file);
      if (result.rows.length === 0) {
        setParseError("No valid guest rows found. Make sure you're using the provided template.");
        return;
      }
      setImportRows(result.rows);
    } catch {
      setParseError('Could not read the file. Please use a valid .xlsx or .xls file.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importRows) return;
    setImporting(true);
    let saved = 0;
    for (const { guest } of importRows) {
      try { await setDoc(doc(db, 'guests', guest.id), guest); saved++; }
      catch (err) { handleFirestoreError(err as Error, OperationType.CREATE, `guests/${guest.id}`); }
    }
    setImporting(false);
    setImportDone(true);
    setImportCount(saved);
  };

  const handleCloseImport = () => { setImportRows(null); setImportDone(false); setImporting(false); };

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGuest) return;
    const fd = new FormData(e.currentTarget);
    const phone = (fd.get('phone') as string).trim();
    const notes = (fd.get('notes') as string).trim();
    const updated: Guest = {
      ...editingGuest,
      name: (fd.get('name') as string).trim(),
      phone: phone || undefined,
      inviteStatus: fd.get('inviteStatus') as InviteStatus,
      familySide: fd.get('familySide') as FamilySide,
      notes: notes || undefined,
      isPrimaryContact: fd.get('isPrimaryContact') === 'on',
    };
    if (!updated.phone) delete updated.phone;
    if (!updated.notes) delete updated.notes;
    try {
      await setDoc(doc(db, 'guests', editingGuest.id), updated);
      setEditingGuest(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `guests/${editingGuest.id}`);
    }
  };

  const handleDelete = async (guestId: string) => {
    try {
      await deleteDoc(doc(db, 'guests', guestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `guests/${guestId}`);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const chips: { label: string; value: FilterChip }[] = [
    { label: 'All', value: 'all' },
    { label: 'Confirmed', value: InviteStatus.CONFIRMED },
    { label: 'Pending', value: InviteStatus.PENDING },
    { label: 'Declined', value: InviteStatus.DECLINED },
    { label: 'Bride Side', value: FamilySide.BRIDE },
    { label: 'Groom Side', value: FamilySide.GROOM },
    { label: 'Has Travel', value: 'travel' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
      {importRows && (
        <ImportModal rows={importRows} onConfirm={handleConfirmImport} onCancel={handleCloseImport}
          importing={importing} importDone={importDone} importCount={importCount} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-primary tracking-tight">Guest List</h1>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1 opacity-70">
            Invitation & Travel Registry
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={downloadGuestTemplate}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg border-2 border-secondary text-secondary hover:bg-secondary-container transition-all font-bold text-xs uppercase tracking-widest">
            <Download size={15} /><span className="hidden sm:inline">Excel Template</span>
          </button>
          {!isReadOnly && (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-secondary text-on-secondary hover:opacity-90 transition-all shadow-md font-bold text-xs uppercase tracking-widest">
              <Upload size={15} /><span className="hidden sm:inline">Import Excel</span>
            </button>
          )}
        </div>
      </div>

      {parseError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">{parseError}</p>
          <button onClick={() => setParseError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total People" value={totalPeople} icon={Users} />
        <StatCard title="Confirmed Coming" value={confirmedCount} icon={CheckCircle2} colorClass="text-emerald-600" />
        <StatCard title="Travel Confirmed" value={travelConfirmed} icon={Plane} colorClass="text-secondary" />
        <StatCard title="Families / Groups" value={totalGroups} icon={Users2} colorClass="text-primary" />
      </div>

      {/* Search + filter */}
      <Card padded={false} className="px-4 pt-4 pb-0">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, or group..."
            className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary transition-all" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-container rounded-full text-outline">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
          {chips.map(chip => (
            <button key={chip.value} onClick={() => setFilter(chip.value)}
              className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all',
                filter === chip.value
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high')}>
              {chip.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
          {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
          {totalGroups > 0 && ` · ${sortedGroupKeys.filter(k => k !== '_solo').length} group${sortedGroupKeys.filter(k => k !== '_solo').length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
          <span className="text-pink-500">Bride: {brideCount}</span>
          <span className="text-secondary">Groom: {groomCount}</span>
        </div>
      </div>

      {/* Grouped list */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-on-surface-variant font-medium text-sm">
            {guests.length === 0
              ? 'No guests registered yet. Import from Excel or add via Guest Ops.'
              : 'No guests match the current filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedGroupKeys.map(groupKey => {
            const members = groupMap.get(groupKey)!;
            const isNamedGroup = groupKey !== '_solo';
            const isCollapsed = collapsedGroups.has(groupKey);
            const groupFamilySide = members[0]?.familySide;
            const confirmedInGroup = members.filter(m => (m.inviteStatus ?? InviteStatus.PENDING) === InviteStatus.CONFIRMED).length;
            const travelInGroup = members.filter(m => !!m.arrivalDateTime).length;

            return (
              <div key={groupKey} className="bg-white rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
                {/* Group header (only for named groups) */}
                {isNamedGroup && (
                  <div
                    className="flex items-center justify-between px-5 py-3.5 bg-surface-container cursor-pointer hover:bg-surface-container-high transition-colors"
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Users2 size={13} className="text-on-primary" />
                      </div>
                      <span className="font-bold text-sm text-primary">{groupKey}</span>
                      <Badge variant={groupFamilySide === FamilySide.BRIDE ? 'primary' : 'secondary'} className="text-[9px]">
                        {groupFamilySide === FamilySide.BRIDE ? 'Bride' : 'Groom'}
                      </Badge>
                      <span className="text-[10px] text-outline">{members.length} {members.length === 1 ? 'person' : 'people'}</span>
                      {confirmedInGroup > 0 && (
                        <span className="text-[10px] text-emerald-600 font-bold">{confirmedInGroup} confirmed</span>
                      )}
                      {travelInGroup > 0 && (
                        <span className="text-[10px] text-secondary font-bold">{travelInGroup} travel ✓</span>
                      )}
                    </div>
                    {isCollapsed
                      ? <ChevronDown size={16} className="text-outline shrink-0" />
                      : <ChevronUp size={16} className="text-outline shrink-0" />}
                  </div>
                )}

                {/* Solo section header */}
                {!isNamedGroup && members.length > 0 && sortedGroupKeys.some(k => k !== '_solo') && (
                  <div className="px-5 py-2.5 bg-surface-container/50 border-b border-outline-variant/40">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Individual guests (no group)</span>
                  </div>
                )}

                {/* Member rows */}
                {(!isNamedGroup || !isCollapsed) && (
                  <div className="divide-y divide-outline-variant/20">
                    {members.map(guest => {
                      const invStatus = guest.inviteStatus ?? InviteStatus.PENDING;
                      return (
                        <div
                          key={guest.id}
                          className={cn(
                            'group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-container-low',
                            isNamedGroup && 'pl-8'
                          )}
                        >
                          {/* Name + phone */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {guest.isPrimaryContact && isNamedGroup && (
                                <span className="text-[8px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Primary</span>
                              )}
                              <span className="text-sm font-bold text-primary truncate">{guest.name}</span>
                              {guest.notes && <StickyNote size={11} className="text-secondary/60 shrink-0" title={guest.notes} />}
                            </div>
                            {guest.phone && (
                              <span className="text-[10px] text-outline font-bold tracking-widest">{guest.phone}</span>
                            )}
                            {guest.roomNumber && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/8 px-1.5 py-0.5 rounded mt-0.5">
                                <BedDouble size={9} />{guest.hotelName ? `${guest.hotelName} · ` : ''}Room {guest.roomNumber}
                              </span>
                            )}
                            {!isNamedGroup && guest.groupName === undefined && guest.familySide && (
                              <span className="hidden" />
                            )}
                          </div>

                          {/* Family side (only for ungrouped) */}
                          {!isNamedGroup && (
                            <Badge variant={guest.familySide === FamilySide.BRIDE ? 'primary' : 'secondary'} className="text-[9px] shrink-0">
                              {guest.familySide === FamilySide.BRIDE ? 'Bride' : 'Groom'}
                            </Badge>
                          )}

                          {/* Invite Status */}
                          <div className="shrink-0">
                            <InviteStatusBadge status={invStatus} />
                          </div>

                          {/* Travel indicator — hidden on mobile to keep name readable */}
                          <div className="shrink-0 w-20 text-center hidden sm:block">
                            {guest.arrivalDateTime ? (
                              <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600">
                                <CheckCircle2 size={11} />Travel
                              </span>
                            ) : (
                              <span className="text-[10px] text-outline/40">No travel</span>
                            )}
                          </div>

                          {/* Arrival date + mode */}
                          <div className="shrink-0 hidden sm:flex items-center gap-1.5 w-28">
                            {guest.arrivalDateTime ? (
                              <>
                                <ArrivalIcon mode={guest.arrivalMode || ArrivalMode.CAR} size={12} />
                                <span className="text-xs font-bold text-on-surface">{formatDate(guest.arrivalDateTime)}</span>
                              </>
                            ) : (
                              <span className="text-xs text-outline/40">—</span>
                            )}
                          </div>

                          {/* Edit + Delete */}
                          {!isReadOnly && (
                            <div className="shrink-0 flex items-center gap-1">
                              {confirmDeleteId === guest.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleDelete(guest.id)}
                                    className="text-[9px] font-bold text-white bg-red-500 px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[9px] font-bold text-outline hover:text-on-surface"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setEditingGuest(guest)}
                                    className="p-1.5 rounded text-outline hover:text-primary hover:bg-surface-container transition-all"
                                    title="Edit guest"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(guest.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-outline hover:text-red-500 transition-all"
                                    title="Delete guest"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-center text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">
          {confirmedCount} confirmed · {totalPeople - confirmedCount} pending/declined
        </p>
      )}

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setEditingGuest(null)} />
          <div className="relative w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <form onSubmit={handleEditSave}>
              <div className="px-6 py-5 border-b border-outline-variant flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Edit Guest</p>
                  <h3 className="text-base font-bold text-primary mt-0.5">{editingGuest.name}</h3>
                </div>
                <button type="button" onClick={() => setEditingGuest(null)} className="p-2 hover:bg-surface-container rounded-full text-outline">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Name *</label>
                  <input name="name" required autoFocus defaultValue={editingGuest.name}
                    className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none" />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Phone</label>
                  <input name="phone" type="tel" defaultValue={editingGuest.phone ?? ''}
                    className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                    placeholder="+91 XXXXX XXXXX" />
                </div>

                {/* Invite Status + Family Side */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Invite Status</label>
                    <select name="inviteStatus" defaultValue={editingGuest.inviteStatus}
                      className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none">
                      <option value={InviteStatus.PENDING}>Pending</option>
                      <option value={InviteStatus.CONFIRMED}>Confirmed</option>
                      <option value={InviteStatus.DECLINED}>Declined</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Side</label>
                    <select name="familySide" defaultValue={editingGuest.familySide}
                      className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none">
                      <option value={FamilySide.BRIDE}>Bride Side</option>
                      <option value={FamilySide.GROOM}>Groom Side</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Notes</label>
                  <input name="notes" defaultValue={editingGuest.notes ?? ''}
                    className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                    placeholder="Dietary, special needs, etc." />
                </div>

                {/* Primary contact toggle (only for group members) */}
                {editingGuest.groupName && (
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input type="checkbox" name="isPrimaryContact" defaultChecked={!!editingGuest.isPrimaryContact}
                      className="w-4 h-4 accent-secondary" />
                    <span className="text-sm font-bold text-on-surface">Primary contact for group</span>
                  </label>
                )}
              </div>

              <div className="px-6 pb-6 flex justify-end gap-3 border-t border-outline-variant pt-4">
                <Button type="button" variant="ghost" onClick={() => setEditingGuest(null)}>Cancel</Button>
                <Button type="submit" variant="primary">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
