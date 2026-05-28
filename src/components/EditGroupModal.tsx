/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X, Users2, Trash2, Plus, CheckCircle2,
  Car, Train, Plane, Bus, AlertTriangle,
} from 'lucide-react';
import { Button } from './UIComponents';
import { Guest, GuestStatus, InviteStatus, FamilySide, ArrivalMode } from '../types';
import { collection, getDocs, query, where, writeBatch, doc, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { validatePhone } from '../lib/validation';
import { useEscapeKey } from '../lib/useEscapeKey';
import { cn } from '../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface NewRow { key: string; name: string; phone: string; }
function emptyRow(): NewRow {
  return { key: `r${Date.now()}-${Math.random()}`, name: '', phone: '' };
}

function parseSmartDate(s: string) {
  const y = String(new Date().getFullYear());
  if (!s) return `${y}-01-01`;
  if (s.includes('-') && s.split('-').length === 3) return s;
  const parts = s.split(/[./-]/);
  const day = parts[0], month = parts[1], year = parts[2] || y;
  if (!month) return `${y}-01-01`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
function parseSmartTime(s: string, period: 'AM' | 'PM') {
  if (!s) return '12:00';
  const parts = s.split(/[.:]/);
  let h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const TRAVEL_FIELDS = [
  'arrivalMode','arrivalDateTime','departureMode','departureDateTime',
  'travelDetails','departureDetails','arrivalTrainName','arrivalTrainNumber',
  'arrivalCoach','arrivalSeat','departureTrainName','departureTrainNumber',
  'departureCoach','departureSeat','arrivalFlightNumber','departureFlightNumber',
] as const;

const ModeBtn = ({ mode, active, onClick }: { mode: ArrivalMode; active: boolean; onClick: () => void; [key: string]: unknown }) => {
  const icon = mode === ArrivalMode.CAR ? <Car size={11} /> : mode === ArrivalMode.TRAIN ? <Train size={11} /> : mode === ArrivalMode.FLIGHT ? <Plane size={11} /> : <Bus size={11} />;
  return (
    <button type="button" onClick={onClick}
      className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1',
        active ? 'bg-secondary text-on-secondary border-secondary' : 'border-outline-variant text-outline hover:border-secondary')}>
      {icon}{mode}
    </button>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditGroupModalProps {
  groupName: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditGroupModal({ groupName: initialGroupName, onClose }: EditGroupModalProps) {
  const [members, setMembers]       = useState<Guest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Group-level fields
  const [groupName, setGroupName]       = useState(initialGroupName);
  const [familySide, setFamilySide]     = useState<FamilySide>(FamilySide.BRIDE);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | 'mixed'>('mixed');

  // Member management
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [newRows, setNewRows]       = useState<NewRow[]>([]);

  // Bulk travel
  const [applyTravel, setApplyTravel]       = useState(false);
  const [arrMode, setArrMode]               = useState<ArrivalMode>(ArrivalMode.CAR);
  const [depMode, setDepMode]               = useState<ArrivalMode>(ArrivalMode.CAR);
  const [arrDateStr, setArrDateStr]         = useState('');
  const [arrTimeStr, setArrTimeStr]         = useState('');
  const [arrAmPm, setArrAmPm]               = useState<'AM' | 'PM'>('AM');
  const [depDateStr, setDepDateStr]         = useState('');
  const [depTimeStr, setDepTimeStr]         = useState('');
  const [depAmPm, setDepAmPm]               = useState<'AM' | 'PM'>('PM');

  useEscapeKey(onClose);

  // Load group members once
  useEffect(() => {
    getDocs(query(collection(db, 'guests'), where('groupName', '==', initialGroupName)))
      .then(snap => {
        const gs = snap.docs.map(d => d.data() as Guest).sort((a, b) => {
          if (a.isPrimaryContact && !b.isPrimaryContact) return -1;
          if (!a.isPrimaryContact && b.isPrimaryContact) return 1;
          return a.name.localeCompare(b.name);
        });
        setMembers(gs);
        if (gs.length > 0) {
          setFamilySide(gs[0].familySide);
          const statuses = [...new Set(gs.map(g => g.inviteStatus ?? InviteStatus.PENDING))];
          setInviteStatus(statuses.length === 1 ? statuses[0] : 'mixed');
        }
        setLoading(false);
      })
      .catch(err => { handleFirestoreError(err, OperationType.LIST, 'guests'); setLoading(false); });
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = groupName.trim();
    if (!trimmed) { setError('Group name is required.'); return; }

    // Validate new row phones
    for (const row of newRows.filter(r => r.name.trim() && r.phone.trim())) {
      const pErr = validatePhone(row.phone);
      if (pErr) { setError(`Invalid phone for "${row.name}": ${pErr}`); return; }
    }
    setError(null);
    setSaving(true);

    try {
      const fd = new FormData(e.currentTarget);
      const batch = writeBatch(db);

      // ── Build the common update for existing members ──────────────────────
      const baseUpdate: Record<string, unknown> = { groupName: trimmed, familySide };
      if (inviteStatus !== 'mixed') baseUpdate.inviteStatus = inviteStatus;

      // ── Build travel data (for both existing + new members) ──────────────
      // existingTravel may contain deleteField() calls — only safe for update()
      const existingTravel: Record<string, unknown> = {};
      // newMemberTravel uses plain strings — safe for set()
      const newMemberTravel: Partial<Guest> = {};

      if (applyTravel) {
        // Clear every travel field on existing members
        TRAVEL_FIELDS.forEach(f => { existingTravel[f] = deleteField(); });
        existingTravel.customTravel = false;

        const arrDT = arrDateStr
          ? `${parseSmartDate(arrDateStr)}T${parseSmartTime(arrTimeStr, arrAmPm)}:00`
          : undefined;
        const depDT = depDateStr
          ? `${parseSmartDate(depDateStr)}T${parseSmartTime(depTimeStr, depAmPm)}:00`
          : undefined;

        if (arrDT) {
          existingTravel.arrivalDateTime = arrDT;
          existingTravel.arrivalMode     = arrMode;
          newMemberTravel.arrivalDateTime = arrDT;
          newMemberTravel.arrivalMode     = arrMode;

          if (arrMode === ArrivalMode.TRAIN) {
            const vals = { arrivalTrainName: fd.get('arrivalTrainName') as string, arrivalTrainNumber: fd.get('arrivalTrainNumber') as string, arrivalCoach: fd.get('arrivalCoach') as string, arrivalSeat: fd.get('arrivalSeat') as string };
            Object.entries(vals).forEach(([k, v]) => { if (v) { existingTravel[k] = v; (newMemberTravel as Record<string,unknown>)[k] = v; } });
          } else if (arrMode === ArrivalMode.FLIGHT) {
            const fn = fd.get('arrivalFlightNumber') as string;
            if (fn) { existingTravel.arrivalFlightNumber = fn; newMemberTravel.arrivalFlightNumber = fn; }
          } else {
            const td = fd.get('travelDetails') as string;
            if (td) { existingTravel.travelDetails = td; newMemberTravel.travelDetails = td; }
          }
        }

        if (depDT) {
          existingTravel.departureDateTime = depDT;
          existingTravel.departureMode     = depMode;
          newMemberTravel.departureDateTime = depDT;
          newMemberTravel.departureMode     = depMode;

          if (depMode === ArrivalMode.TRAIN) {
            const vals = { departureTrainName: fd.get('departureTrainName') as string, departureTrainNumber: fd.get('departureTrainNumber') as string, departureCoach: fd.get('departureCoach') as string, departureSeat: fd.get('departureSeat') as string };
            Object.entries(vals).forEach(([k, v]) => { if (v) { existingTravel[k] = v; (newMemberTravel as Record<string,unknown>)[k] = v; } });
          } else if (depMode === ArrivalMode.FLIGHT) {
            const fn = fd.get('departureFlightNumber') as string;
            if (fn) { existingTravel.departureFlightNumber = fn; newMemberTravel.departureFlightNumber = fn; }
          } else {
            const dd = fd.get('departureDetails') as string;
            if (dd) { existingTravel.departureDetails = dd; newMemberTravel.departureDetails = dd; }
          }
        }

        newMemberTravel.customTravel = false;
      }

      // ── Update active existing members ────────────────────────────────────
      for (const m of members) {
        if (removedIds.has(m.id)) continue;
        batch.update(doc(db, 'guests', m.id), { ...baseUpdate, ...existingTravel });
      }

      // ── Unlink removed members (don't delete) ─────────────────────────────
      for (const id of removedIds) {
        batch.update(doc(db, 'guests', id), {
          groupName: deleteField(),
          isPrimaryContact: deleteField(),
          customTravel: deleteField(),
        });
      }

      // ── Add new members ───────────────────────────────────────────────────
      newRows.filter(r => r.name.trim()).forEach((row, i) => {
        const id = `G${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        const guest: Guest = {
          id,
          name: row.name.trim(),
          groupName: trimmed,
          familySide,
          inviteStatus: inviteStatus === 'mixed' ? InviteStatus.PENDING : inviteStatus,
          status: GuestStatus.PENDING,
          isPrimaryContact: false,
          ...(row.phone.trim() ? { phone: row.phone.trim() } : {}),
          ...newMemberTravel,
        };
        // Strip undefined
        (Object.keys(guest) as (keyof Guest)[]).forEach(k => { if (guest[k] === undefined) delete guest[k]; });
        batch.set(doc(db, 'guests', id), guest);
      });

      await batch.commit();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${initialGroupName}`);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const activeMembers    = members.filter(m => !removedIds.has(m.id));
  const customCount      = activeMembers.filter(m => m.customTravel).length;

  const inputCls = 'px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-sm focus:border-secondary outline-none w-full';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-xl bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center">
              <Users2 size={17} className="text-on-primary-container" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Edit Group</p>
              <h3 className="text-base font-bold text-primary">{initialGroupName}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-surface-container rounded-full text-outline transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* ── Group name ─────────────────────────────────────────────── */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Group Name *</label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)}
                  className={inputCls.replace('bg-surface-container-low', 'bg-white')}
                  placeholder="e.g. Sharma Family" />
              </div>

              {/* ── Family side ────────────────────────────────────────────── */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Side (applies to all)</label>
                <div className="flex gap-2">
                  {[FamilySide.BRIDE, FamilySide.GROOM].map(side => (
                    <button key={side} type="button" onClick={() => setFamilySide(side)}
                      className={cn('flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                        familySide === side
                          ? side === FamilySide.BRIDE ? 'bg-pink-500 text-white border-pink-500' : 'bg-secondary text-on-secondary border-secondary'
                          : 'bg-surface-container-low border-outline-variant text-on-surface-variant')}>
                      {side === FamilySide.BRIDE ? '💗 Bride Side' : '💙 Groom Side'}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Invite status ──────────────────────────────────────────── */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Invite Status (applies to all)</label>
                <div className="flex gap-2">
                  {([InviteStatus.PENDING, InviteStatus.CONFIRMED, InviteStatus.DECLINED] as const).map(s => (
                    <button key={s} type="button" onClick={() => setInviteStatus(s)}
                      className={cn('flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                        inviteStatus === s
                          ? s === InviteStatus.CONFIRMED ? 'bg-emerald-600 text-white border-emerald-600'
                            : s === InviteStatus.DECLINED ? 'bg-red-500 text-white border-red-500'
                              : 'bg-primary text-white border-primary'
                          : 'bg-surface-container-low border-outline-variant text-on-surface-variant')}>
                      {s}
                    </button>
                  ))}
                </div>
                {inviteStatus === 'mixed' && (
                  <p className="text-[10px] text-outline">Members currently have mixed statuses — pick one above to set for all, or leave to keep as-is.</p>
                )}
              </div>

              {/* ── Members ────────────────────────────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">
                    Members ({activeMembers.length + newRows.filter(r => r.name.trim()).length})
                  </label>
                  {customCount > 0 && (
                    <span className="text-[10px] text-amber-600 font-bold">
                      {customCount} custom travel plan{customCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Active existing members */}
                {activeMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.isPrimaryContact && (
                          <span className="text-[8px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded uppercase">Primary</span>
                        )}
                        <span className="text-sm font-bold text-primary truncate">{m.name}</span>
                        {m.customTravel && (
                          <span className="text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Custom travel
                          </span>
                        )}
                      </div>
                      {m.phone && <p className="text-[10px] text-outline font-bold tracking-widest mt-0.5">{m.phone}</p>}
                    </div>
                    <button type="button" title="Remove from group"
                      onClick={() => setRemovedIds(prev => new Set([...prev, m.id]))}
                      className="p-1.5 rounded-lg text-outline hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {/* Removed (show with undo) */}
                {[...removedIds].map(id => {
                  const m = members.find(x => x.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                      <span className="text-xs text-red-600 line-through flex-1 opacity-70">{m.name} — will be unlinked from group</span>
                      <button type="button" onClick={() => setRemovedIds(prev => { const n = new Set(prev); n.delete(id); return n; })}
                        className="text-[10px] text-secondary font-bold hover:underline shrink-0">Undo</button>
                    </div>
                  );
                })}

                {/* New member rows */}
                {newRows.map((row, i) => (
                  <div key={row.key} className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold text-outline w-5 shrink-0">{activeMembers.length + i + 1}</span>
                    <input value={row.name} placeholder="Name *"
                      onChange={e => setNewRows(prev => prev.map(r => r.key === row.key ? { ...r, name: e.target.value } : r))}
                      className="flex-1 px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" />
                    <input value={row.phone} placeholder="Phone (opt)" type="tel"
                      onChange={e => setNewRows(prev => prev.map(r => r.key === row.key ? { ...r, phone: e.target.value } : r))}
                      className="flex-1 px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" />
                    <button type="button" onClick={() => setNewRows(prev => prev.filter(r => r.key !== row.key))}
                      className="p-1.5 rounded-lg text-outline hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <button type="button" onClick={() => setNewRows(prev => [...prev, emptyRow()])}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-outline-variant text-outline hover:border-secondary hover:text-secondary transition-all text-xs font-bold flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Member
                </button>
              </div>

              {/* ── Bulk Travel ────────────────────────────────────────────── */}
              <div className="space-y-3 border-t border-outline-variant pt-5">
                <button type="button" onClick={() => setApplyTravel(v => !v)}
                  className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                    applyTravel ? 'bg-secondary-container border-secondary' : 'border-outline-variant hover:border-secondary')}>
                  <div className="flex items-center gap-2">
                    <Plane size={15} className={applyTravel ? 'text-secondary' : 'text-outline'} />
                    <span className={cn('text-xs font-bold uppercase tracking-wider', applyTravel ? 'text-secondary' : 'text-outline')}>
                      {applyTravel ? 'Shared travel — editing' : 'Apply same travel to all members'}
                    </span>
                  </div>
                  {applyTravel && <CheckCircle2 size={16} className="text-secondary" />}
                </button>

                {applyTravel && (
                  <div className="space-y-5 pl-1">

                    {/* Warning about custom travel members */}
                    {customCount > 0 && (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-amber-800 font-bold">
                          {customCount} member{customCount > 1 ? 's have' : ' has'} a custom travel plan. Saving will override it and clear the custom flag.
                        </p>
                      </div>
                    )}

                    {/* ARRIVAL */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Arrival</p>
                      <div className="flex gap-2 flex-wrap">
                        {([ArrivalMode.CAR, ArrivalMode.TRAIN, ArrivalMode.FLIGHT, ArrivalMode.BUS] as const).map(m => (
                          <ModeBtn key={m} mode={m} active={arrMode === m} onClick={() => setArrMode(m)} />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input value={arrDateStr} onChange={e => setArrDateStr(e.target.value)}
                          placeholder="DD.MM" className={cn(inputCls, 'flex-1')} />
                        <input value={arrTimeStr} onChange={e => setArrTimeStr(e.target.value)}
                          placeholder="H.MM" className={cn(inputCls, 'w-24')} />
                        <button type="button" onClick={() => setArrAmPm(p => p === 'AM' ? 'PM' : 'AM')}
                          className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:border-secondary transition-all shrink-0">
                          {arrAmPm}
                        </button>
                      </div>
                      {arrMode === ArrivalMode.TRAIN && (
                        <div className="grid grid-cols-2 gap-2">
                          <input name="arrivalTrainName" placeholder="Train name" className={inputCls} />
                          <input name="arrivalTrainNumber" placeholder="Train no." className={inputCls} />
                          <input name="arrivalCoach" placeholder="Coach" className={inputCls} />
                          <input name="arrivalSeat" placeholder="Seat" className={inputCls} />
                        </div>
                      )}
                      {arrMode === ArrivalMode.FLIGHT && (
                        <input name="arrivalFlightNumber" placeholder="Flight number" className={inputCls} />
                      )}
                      {(arrMode === ArrivalMode.CAR || arrMode === ArrivalMode.BUS) && (
                        <input name="travelDetails" placeholder="Notes (optional)" className={inputCls} />
                      )}
                    </div>

                    {/* DEPARTURE */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Departure</p>
                      <div className="flex gap-2 flex-wrap">
                        {([ArrivalMode.CAR, ArrivalMode.TRAIN, ArrivalMode.FLIGHT, ArrivalMode.BUS] as const).map(m => (
                          <ModeBtn key={m} mode={m} active={depMode === m} onClick={() => setDepMode(m)} />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input value={depDateStr} onChange={e => setDepDateStr(e.target.value)}
                          placeholder="DD.MM" className={cn(inputCls, 'flex-1')} />
                        <input value={depTimeStr} onChange={e => setDepTimeStr(e.target.value)}
                          placeholder="H.MM" className={cn(inputCls, 'w-24')} />
                        <button type="button" onClick={() => setDepAmPm(p => p === 'AM' ? 'PM' : 'AM')}
                          className="px-3 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:border-secondary transition-all shrink-0">
                          {depAmPm}
                        </button>
                      </div>
                      {depMode === ArrivalMode.TRAIN && (
                        <div className="grid grid-cols-2 gap-2">
                          <input name="departureTrainName" placeholder="Train name" className={inputCls} />
                          <input name="departureTrainNumber" placeholder="Train no." className={inputCls} />
                          <input name="departureCoach" placeholder="Coach" className={inputCls} />
                          <input name="departureSeat" placeholder="Seat" className={inputCls} />
                        </div>
                      )}
                      {depMode === ArrivalMode.FLIGHT && (
                        <input name="departureFlightNumber" placeholder="Flight number" className={inputCls} />
                      )}
                      {(depMode === ArrivalMode.CAR || depMode === ArrivalMode.BUS) && (
                        <input name="departureDetails" placeholder="Notes (optional)" className={inputCls} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-outline-variant flex justify-end gap-3 shrink-0">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Group'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
