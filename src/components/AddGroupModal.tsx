/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Users2 } from 'lucide-react';
import { Button } from './UIComponents';
import { Guest, GuestStatus, InviteStatus, FamilySide } from '../types';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { validatePhone } from '../lib/validation';
import { useEscapeKey } from '../lib/useEscapeKey';
import { cn } from '../lib/utils';

interface MemberRow {
  key: string;
  name: string;
  phone: string;
  inviteStatus: InviteStatus;
}

function emptyRow(): MemberRow {
  return { key: `r${Date.now()}-${Math.random()}`, name: '', phone: '', inviteStatus: InviteStatus.PENDING };
}

interface AddGroupModalProps {
  onClose: () => void;
}

export default function AddGroupModal({ onClose }: AddGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [familySide, setFamilySide] = useState<FamilySide>(FamilySide.BRIDE);
  const [members, setMembers] = useState<MemberRow[]>([emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);
  const addRow = () => setMembers(prev => [...prev, emptyRow()]);

  const removeRow = (key: string) => {
    if (members.length <= 1) return;
    setMembers(prev => prev.filter(r => r.key !== key));
  };

  const updateRow = (key: string, field: keyof Omit<MemberRow, 'key'>, value: string) => {
    setMembers(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = members.filter(r => r.name.trim());
    if (!groupName.trim()) { setError('Group name is required.'); return; }
    if (filled.length === 0) { setError('Add at least one member name.'); return; }
    const badPhone = filled.find(r => r.phone.trim() && validatePhone(r.phone));
    if (badPhone) { setError(`Invalid phone for "${badPhone.name}": ${validatePhone(badPhone.phone)}`); return; }
    setError(null);
    setSaving(true);

    try {
      const batch = writeBatch(db);
      filled.forEach((row, i) => {
        const id = `G${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        const guest: Guest = {
          id,
          name: row.name.trim(),
          groupName: groupName.trim(),
          familySide,
          inviteStatus: row.inviteStatus,
          status: GuestStatus.PENDING,
          isPrimaryContact: i === 0,
          ...(row.phone.trim() ? { phone: row.phone.trim() } : {}),
        };
        batch.set(doc(db, 'guests', id), guest);
      });
      await batch.commit();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'guests/batch');
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inviteOptions = [
    { value: InviteStatus.PENDING,   label: 'Pending' },
    { value: InviteStatus.CONFIRMED, label: 'Confirmed' },
    { value: InviteStatus.DECLINED,  label: 'Declined' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center">
              <Users2 size={17} className="text-on-primary-container" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">New Group</p>
              <h3 className="text-base font-bold text-primary">Add Group</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-surface-container rounded-full text-outline transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Group name + side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Group / Family Name *</label>
                <input
                  autoFocus
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. Sharma Family, Delhi Group"
                  className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Side (applies to all)</label>
                <div className="flex gap-2">
                  {[FamilySide.BRIDE, FamilySide.GROOM].map(side => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setFamilySide(side)}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                        familySide === side
                          ? side === FamilySide.BRIDE
                            ? 'bg-pink-500 text-white border-pink-500'
                            : 'bg-secondary text-on-secondary border-secondary'
                          : 'bg-surface-container-low border-outline-variant text-on-surface-variant'
                      )}
                    >
                      {side === FamilySide.BRIDE ? '💗 Bride Side' : '💙 Groom Side'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Member rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Members</label>
                <span className="text-[10px] text-outline">First member = primary contact</span>
              </div>

              {members.map((row, i) => (
                <div key={row.key} className="flex items-start gap-2 p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                  {/* Index */}
                  <span className="text-[10px] font-bold text-outline w-4 mt-3.5 shrink-0">{i + 1}</span>

                  <div className="flex-1 space-y-2">
                    {/* Name */}
                    <input
                      value={row.name}
                      onChange={e => updateRow(row.key, 'name', e.target.value)}
                      placeholder={i === 0 ? 'Name (primary contact) *' : 'Name'}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary transition-all outline-none"
                    />
                    {/* Phone + Status */}
                    <div className="flex gap-2">
                      <input
                        value={row.phone}
                        onChange={e => updateRow(row.key, 'phone', e.target.value)}
                        placeholder="Phone (optional)"
                        type="tel"
                        className="flex-1 px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary transition-all outline-none"
                      />
                      <select
                        value={row.inviteStatus}
                        onChange={e => updateRow(row.key, 'inviteStatus', e.target.value)}
                        className="px-2 py-2 border border-outline-variant rounded-lg bg-white text-xs font-bold focus:border-secondary transition-all outline-none text-on-surface"
                      >
                        {inviteOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={members.length <= 1}
                    className="mt-2 p-1.5 rounded-lg text-outline hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-outline-variant text-outline hover:border-secondary hover:text-secondary transition-all text-xs font-bold flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Add Member
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600 font-bold">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 border-t border-outline-variant flex justify-end gap-3 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : `Save ${members.filter(r => r.name.trim()).length || ''} Members`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
