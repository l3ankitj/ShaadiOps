/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PIN-based access gate. Supports two PINs:
 *   - Full PIN  → read + write access
 *   - View PIN  → read-only access
 * Verified state is stored in sessionStorage (cleared on tab/browser close).
 */

import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { ACCESS_STORAGE_KEY, AccessLevel } from '../contexts/AccessContext';

const PIN_LENGTH = 6;

type Phase = 'loading' | 'setup' | 'entry' | 'verified';

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [storedPin, setStoredPin] = useState('');
  const [storedReadonlyPin, setStoredReadonlyPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('full');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(ACCESS_STORAGE_KEY) as AccessLevel | null;
    if (saved === 'full' || saved === 'readonly') {
      setAccessLevel(saved);
      setPhase('verified');
      return;
    }
    loadPin();
  }, []);

  useEffect(() => {
    if (phase === 'entry' || phase === 'setup') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  async function loadPin() {
    try {
      const snap = await getDoc(doc(db, 'config', 'access'));
      if (snap.exists() && snap.data()?.pin) {
        setStoredPin(snap.data().pin);
        setStoredReadonlyPin(snap.data().readonlyPin || '');
        setPhase('entry');
      } else {
        setPhase('setup');
      }
    } catch {
      setError('Cannot connect. Check your internet and try again.');
      setPhase('entry');
    }
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function handleSetup() {
    if (pin.length < PIN_LENGTH) { setError(`Enter all ${PIN_LENGTH} digits.`); return; }
    if (pin !== confirmPin) { setError('PINs do not match.'); triggerShake(); setConfirmPin(''); return; }
    try {
      await setDoc(doc(db, 'config', 'access'), { pin });
      sessionStorage.setItem(ACCESS_STORAGE_KEY, 'full');
      setAccessLevel('full');
      setPhase('verified');
    } catch {
      setError('Could not save PIN. Check your connection.');
    }
  }

  function handleEntry() {
    if (pin === storedPin) {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, 'full');
      setAccessLevel('full');
      setPhase('verified');
    } else if (storedReadonlyPin && pin === storedReadonlyPin) {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, 'readonly');
      setAccessLevel('readonly');
      setPhase('verified');
    } else {
      setError('Incorrect PIN.');
      triggerShake();
      setPin('');
    }
  }

  if (phase === 'verified') return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-primary flex flex-col items-center justify-center p-8 z-[999]">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">
        <div className="text-center">
          <p className="text-[10px] font-black text-on-primary/50 uppercase tracking-[0.4em] mb-2">Welcome to</p>
          <h1 className="text-4xl font-display font-bold text-on-primary tracking-tight">ShaadiOps</h1>
          <p className="text-[10px] font-bold text-on-primary/40 uppercase tracking-[0.2em] mt-1">Wedding Operations</p>
        </div>

        {phase === 'loading' && (
          <div className="w-8 h-8 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
        )}

        {(phase === 'entry' || phase === 'setup') && (
          <div className={cn(
            'w-full bg-white/10 backdrop-blur rounded-3xl p-8 space-y-6 border border-white/20',
            shake && 'animate-[shake_0.4s_ease-in-out]'
          )}>
            <div className="text-center">
              <p className="text-sm font-bold text-on-primary">
                {phase === 'setup' ? 'Create an access PIN' : 'Enter access PIN'}
              </p>
              {phase === 'setup' && (
                <p className="text-[10px] text-on-primary/50 mt-1">Anyone with the link will need this to enter</p>
              )}
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div key={i} className={cn(
                  'w-4 h-4 rounded-full border-2 transition-all',
                  i < pin.length ? 'bg-secondary-container border-secondary-container scale-110' : 'bg-transparent border-on-primary/30'
                )} />
              ))}
            </div>

            {/* Hidden input for keyboard */}
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              value={pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
                setPin(val);
                setError('');
              }}
              onKeyDown={e => { if (e.key === 'Enter' && phase === 'entry') handleEntry(); }}
              className="opacity-0 absolute w-0 h-0"
              aria-label="PIN entry"
            />

            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="w-full text-center text-[11px] text-on-primary/40 font-medium py-2 hover:text-on-primary/60 transition-colors"
            >
              Tap here then type your PIN
            </button>

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((key, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={key === ''}
                  onClick={() => {
                    if (key === '⌫') {
                      setPin(p => p.slice(0, -1));
                    } else if (key !== '' && pin.length < PIN_LENGTH) {
                      setPin(p => p + String(key));
                      setError('');
                    }
                  }}
                  className={cn(
                    'h-14 rounded-2xl font-bold text-lg transition-all',
                    key === '' ? 'invisible' : 'bg-white/10 text-on-primary hover:bg-white/20 active:scale-95 border border-white/10'
                  )}
                >
                  {key}
                </button>
              ))}
            </div>

            {error && <p className="text-center text-[11px] font-bold text-red-300">{error}</p>}

            {phase === 'setup' && pin.length === PIN_LENGTH && (
              <div className="space-y-4 pt-2 border-t border-white/10">
                <p className="text-[11px] text-on-primary/60 text-center">Confirm your PIN</p>
                <div className="flex justify-center gap-3">
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <div key={i} className={cn(
                      'w-4 h-4 rounded-full border-2 transition-all',
                      i < confirmPin.length ? 'bg-secondary-container border-secondary-container scale-110' : 'bg-transparent border-on-primary/30'
                    )} />
                  ))}
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setError(''); }}
                  placeholder="Re-enter PIN"
                  className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-on-primary text-center font-mono text-xl tracking-widest focus:outline-none focus:border-secondary-container placeholder:text-on-primary/20"
                />
                <button
                  type="button"
                  onClick={handleSetup}
                  className="w-full py-4 bg-secondary text-on-secondary rounded-2xl font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  Set PIN & Enter
                </button>
              </div>
            )}

            {phase === 'entry' && pin.length === PIN_LENGTH && (
              <button
                type="button"
                onClick={handleEntry}
                className="w-full py-4 bg-secondary text-on-secondary rounded-2xl font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all"
              >
                Enter
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
