/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { EventConfig } from '../types';
import { Card, Button } from '../components/UIComponents';
import { Heart, Save, Lock, Eye } from 'lucide-react';
import { useIsReadOnly } from '../contexts/AccessContext';

const PIN_LENGTH = 6;

export default function Settings() {
  const isReadOnly = useIsReadOnly();
  const [eventConfig, setEventConfig] = useState<EventConfig>({
    id: 'event',
    brideName: '',
    groomName: '',
    hashtag: '',
    eventName: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const [newReadonlyPin, setNewReadonlyPin] = useState('');
  const [readonlyPinError, setReadonlyPinError] = useState('');
  const [readonlyPinSaved, setReadonlyPinSaved] = useState(false);
  const [savingReadonlyPin, setSavingReadonlyPin] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'event'), (snap) => {
      if (snap.exists()) setEventConfig(snap.data() as EventConfig);
    }, (error) => console.warn('Config access limited:', error.message));
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'config', 'event'), eventConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/event');
    } finally {
      setSaving(false);
    }
  };

  if (isReadOnly) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Configuration</p>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-primary">Settings</h2>
        </div>
        <Card className="flex items-center gap-4 border-secondary/20">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
            <Eye size={18} className="text-on-secondary-container" />
          </div>
          <div>
            <p className="font-bold text-sm text-primary">View-only access</p>
            <p className="text-xs text-on-surface-variant mt-0.5">You are logged in with a read-only PIN. Settings can only be changed by an admin.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Configuration</p>
        <h2 className="text-3xl md:text-5xl font-display font-bold text-primary">Settings</h2>
      </div>

      {/* Event Branding */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Heart size={20} className="text-secondary" />
          <h3 className="text-sm font-black text-primary uppercase tracking-widest">Event Branding</h3>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-outline uppercase tracking-widest">Bride's Name</label>
              <input
                value={eventConfig.brideName}
                onChange={(e) => setEventConfig({ ...eventConfig, brideName: e.target.value })}
                required
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="e.g. Priya"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-outline uppercase tracking-widest">Groom's Name</label>
              <input
                value={eventConfig.groomName}
                onChange={(e) => setEventConfig({ ...eventConfig, groomName: e.target.value })}
                required
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="e.g. Arjun"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-outline uppercase tracking-widest">Wedding Hashtag</label>
              <input
                value={eventConfig.hashtag}
                onChange={(e) => setEventConfig({ ...eventConfig, hashtag: e.target.value })}
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm font-mono focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="#PriyaArjunWedding"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-outline uppercase tracking-widest">Event Name</label>
              <input
                value={eventConfig.eventName ?? ''}
                onChange={(e) => setEventConfig({ ...eventConfig, eventName: e.target.value })}
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="e.g. Royal Udaipur Celebration"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={saving} className="flex items-center gap-2 min-w-[140px]">
              <Save size={16} />
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Change PIN */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Lock size={20} className="text-secondary" />
          <h3 className="text-sm font-black text-primary uppercase tracking-widest">Change Access PIN</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-outline uppercase tracking-widest">New PIN (6 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={newPin}
                onChange={e => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setPinError(''); setPinSaved(false); }}
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm font-mono tracking-widest focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="——————"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-outline uppercase tracking-widest">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={confirmPin}
                onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setPinError(''); setPinSaved(false); }}
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm font-mono tracking-widest focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="——————"
              />
            </div>
          </div>

          {pinError && <p className="text-xs font-bold text-red-600">{pinError}</p>}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-outline">All devices will need to enter the new PIN on next visit.</p>
            <Button
              variant="primary"
              disabled={savingPin || newPin.length < PIN_LENGTH}
              className="flex items-center gap-2 min-w-[140px]"
              onClick={async () => {
                if (newPin.length < PIN_LENGTH) { setPinError(`PIN must be ${PIN_LENGTH} digits.`); return; }
                if (newPin !== confirmPin) { setPinError('PINs do not match.'); setConfirmPin(''); return; }
                setSavingPin(true);
                try {
                  await setDoc(doc(db, 'config', 'access'), { pin: newPin }, { merge: true });
                  sessionStorage.setItem('shaadiops_access', 'full');
                  setPinSaved(true);
                  setNewPin('');
                  setConfirmPin('');
                  setTimeout(() => setPinSaved(false), 3000);
                } catch (error) {
                  handleFirestoreError(error, OperationType.UPDATE, 'config/access');
                  setPinError('Could not save PIN. Check your connection.');
                } finally {
                  setSavingPin(false);
                }
              }}
            >
              <Save size={16} />
              {savingPin ? 'Saving…' : pinSaved ? 'PIN Updated ✓' : 'Update PIN'}
            </Button>
          </div>
        </div>
      </Card>

      {/* View-only PIN */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Eye size={20} className="text-secondary" />
          <h3 className="text-sm font-black text-primary uppercase tracking-widest">View-Only PIN</h3>
        </div>
        <p className="text-xs text-on-surface-variant mb-4">
          Anyone who enters this PIN gets read-only access — they can browse all data but cannot add, edit, or delete anything.
        </p>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-outline uppercase tracking-widest">View-Only PIN (6 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={newReadonlyPin}
              onChange={e => { setNewReadonlyPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setReadonlyPinError(''); setReadonlyPinSaved(false); }}
              className="w-full max-w-xs p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm font-mono tracking-widest focus:border-secondary focus:bg-white transition-all outline-none"
              placeholder="——————"
            />
          </div>

          {readonlyPinError && <p className="text-xs font-bold text-red-600">{readonlyPinError}</p>}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-outline">Must be different from the admin PIN.</p>
            <Button
              variant="primary"
              disabled={savingReadonlyPin || newReadonlyPin.length < PIN_LENGTH}
              className="flex items-center gap-2 min-w-[160px]"
              onClick={async () => {
                if (newReadonlyPin.length < PIN_LENGTH) { setReadonlyPinError(`PIN must be ${PIN_LENGTH} digits.`); return; }
                setSavingReadonlyPin(true);
                try {
                  await setDoc(doc(db, 'config', 'access'), { readonlyPin: newReadonlyPin }, { merge: true });
                  setReadonlyPinSaved(true);
                  setNewReadonlyPin('');
                  setTimeout(() => setReadonlyPinSaved(false), 3000);
                } catch (error) {
                  handleFirestoreError(error, OperationType.UPDATE, 'config/access');
                  setReadonlyPinError('Could not save PIN. Check your connection.');
                } finally {
                  setSavingReadonlyPin(false);
                }
              }}
            >
              <Save size={16} />
              {savingReadonlyPin ? 'Saving…' : readonlyPinSaved ? 'PIN Set ✓' : 'Set View-Only PIN'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
