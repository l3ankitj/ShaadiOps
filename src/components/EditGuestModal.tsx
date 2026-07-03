import React, { useState, useEffect } from 'react';
import { X, Plane, Car, Train, Bus, MapPin } from 'lucide-react';
import { Button } from './UIComponents';
import { cn } from '../lib/utils';
import { Guest, InviteStatus, FamilySide, ArrivalMode } from '../types';
import { setDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { validatePhone, validateDateStr, validateTimeStr } from '../lib/validation';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useToast } from './Toast';

function parseSmartDate(s: string) {
  const y = String(new Date().getFullYear());
  if (!s) return `${y}-01-01`;
  if (s.includes('-') && s.split('-').length === 3) return s;
  const parts = s.split(/[./-]/);
  const day = parts[0]; const month = parts[1]; const year = parts[2] || y;
  if (!month) return `${y}-01-01`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseSmartTime(s: string) {
  if (!s) return '12:00';
  const parts = s.split(/[.:]/);
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isoToDateStr(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${d.getMonth() + 1}`;
}

function isoToTimeStr(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  guest: Guest;
  onClose: () => void;
}

export default function EditGuestModal({ guest, onClose }: Props) {
  const { showToast } = useToast();

  const [editPhoneError, setEditPhoneError] = useState<string | null>(null);
  const [editArrDateErr, setEditArrDateErr] = useState<string | null>(null);
  const [editArrTimeErr, setEditArrTimeErr] = useState<string | null>(null);
  const [editDepDateErr, setEditDepDateErr] = useState<string | null>(null);
  const [editDepTimeErr, setEditDepTimeErr] = useState<string | null>(null);

  const [editGroupName, setEditGroupName] = useState('');
  const [editIsLocal, setEditIsLocal] = useState(false);
  const [editShowTravel, setEditShowTravel] = useState(false);
  const [editArrivalMode, setEditArrivalMode] = useState<ArrivalMode>(ArrivalMode.CAR);
  const [editArrivalDateStr, setEditArrivalDateStr] = useState('');
  const [editArrivalTimeStr, setEditArrivalTimeStr] = useState('');
  const [editDepartureMode, setEditDepartureMode] = useState<ArrivalMode>(ArrivalMode.CAR);
  const [editDepartureDateStr, setEditDepartureDateStr] = useState('');
  const [editDepartureTimeStr, setEditDepartureTimeStr] = useState('');

  useEscapeKey(onClose);

  useEffect(() => {
    setEditIsLocal(guest.isLocal ?? false);
    setEditGroupName(guest.groupName ?? '');
    setEditArrivalMode(guest.arrivalMode ?? ArrivalMode.CAR);
    setEditDepartureMode(guest.departureMode ?? ArrivalMode.CAR);
    setEditArrivalDateStr(isoToDateStr(guest.arrivalDateTime));
    setEditArrivalTimeStr(isoToTimeStr(guest.arrivalDateTime));
    setEditDepartureDateStr(isoToDateStr(guest.departureDateTime));
    setEditDepartureTimeStr(isoToTimeStr(guest.departureDateTime));
    setEditShowTravel(!!guest.arrivalDateTime || !!guest.departureDateTime);
    setEditPhoneError(null); setEditArrDateErr(null); setEditArrTimeErr(null);
    setEditDepDateErr(null); setEditDepTimeErr(null);
  }, [guest.id]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const pErr = validatePhone(fd.get('phone') as string);
    const adErr = editShowTravel ? validateDateStr(editArrivalDateStr) : null;
    const atErr = editShowTravel && editArrivalDateStr ? validateTimeStr(editArrivalTimeStr) : null;
    const ddErr = editShowTravel ? validateDateStr(editDepartureDateStr) : null;
    const dtErr = editShowTravel && editDepartureDateStr ? validateTimeStr(editDepartureTimeStr) : null;
    setEditPhoneError(pErr); setEditArrDateErr(adErr); setEditArrTimeErr(atErr);
    setEditDepDateErr(ddErr); setEditDepTimeErr(dtErr);
    if (pErr || adErr || atErr || ddErr || dtErr) return;

    const travelFields: Partial<Guest> = {};
    if (editShowTravel && editArrivalDateStr) {
      travelFields.arrivalDateTime = `${parseSmartDate(editArrivalDateStr)}T${parseSmartTime(editArrivalTimeStr)}:00`;
      travelFields.arrivalMode = editArrivalMode;
      if (editArrivalMode === ArrivalMode.TRAIN) {
        travelFields.arrivalTrainName   = (fd.get('arrivalTrainName') as string)   || undefined;
        travelFields.arrivalTrainNumber = (fd.get('arrivalTrainNumber') as string) || undefined;
        travelFields.arrivalCoach       = (fd.get('arrivalCoach') as string)       || undefined;
        travelFields.arrivalSeat        = (fd.get('arrivalSeat') as string)        || undefined;
      } else if (editArrivalMode === ArrivalMode.FLIGHT) {
        travelFields.arrivalFlightNumber = (fd.get('arrivalFlightNumber') as string) || undefined;
      } else {
        travelFields.travelDetails = (fd.get('travelDetails') as string) || undefined;
      }
    }
    if (editShowTravel && editDepartureDateStr) {
      travelFields.departureDateTime = `${parseSmartDate(editDepartureDateStr)}T${parseSmartTime(editDepartureTimeStr)}:00`;
      travelFields.departureMode = editDepartureMode;
      if (editDepartureMode === ArrivalMode.TRAIN) {
        travelFields.departureTrainName   = (fd.get('departureTrainName') as string)   || undefined;
        travelFields.departureTrainNumber = (fd.get('departureTrainNumber') as string) || undefined;
        travelFields.departureCoach       = (fd.get('departureCoach') as string)       || undefined;
        travelFields.departureSeat        = (fd.get('departureSeat') as string)        || undefined;
      } else if (editDepartureMode === ArrivalMode.FLIGHT) {
        travelFields.departureFlightNumber = (fd.get('departureFlightNumber') as string) || undefined;
      } else {
        travelFields.departureDetails = (fd.get('departureDetails') as string) || undefined;
      }
    }

    const travelChanged = editShowTravel && (editArrivalDateStr || editDepartureDateStr);
    const newGroupName = editGroupName.trim() || undefined;
    const rawInvite = fd.get('inviteStatus') as string;
    const safeInviteStatus = Object.values(InviteStatus).includes(rawInvite as InviteStatus)
      ? (rawInvite as InviteStatus)
      : InviteStatus.PENDING;
    const rawSide = fd.get('familySide') as string;
    const safeFamilySide = Object.values(FamilySide).includes(rawSide as FamilySide)
      ? (rawSide as FamilySide)
      : guest.familySide;

    const updated: Guest = {
      ...guest,
      name: (fd.get('name') as string).trim(),
      phone: (fd.get('phone') as string).trim() || undefined,
      groupName: newGroupName,
      inviteStatus: safeInviteStatus,
      familySide: safeFamilySide,
      notes: (fd.get('notes') as string).trim() || undefined,
      isPrimaryContact: newGroupName ? (fd.get('isPrimaryContact') === 'on') : undefined,
      isLocal: editIsLocal || undefined,
      customTravel: newGroupName && travelChanged ? true : undefined,
      arrivalMode: undefined, arrivalDateTime: undefined,
      departureMode: undefined, departureDateTime: undefined,
      travelDetails: undefined, departureDetails: undefined,
      arrivalTrainName: undefined, arrivalTrainNumber: undefined,
      arrivalCoach: undefined, arrivalSeat: undefined,
      departureTrainName: undefined, departureTrainNumber: undefined,
      departureCoach: undefined, departureSeat: undefined,
      arrivalFlightNumber: undefined, departureFlightNumber: undefined,
      ...travelFields,
    };
    (Object.keys(updated) as (keyof Guest)[]).forEach(k => {
      if (updated[k] === undefined) delete updated[k];
    });

    try {
      await setDoc(doc(db, 'guests', guest.id), updated);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `guests/${guest.id}`);
      showToast('Failed to save guest changes', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <form onSubmit={handleSave}>
          <div className="px-6 py-5 border-b border-outline-variant flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Edit Guest</p>
              <h3 className="text-base font-bold text-primary mt-0.5">{guest.name}</h3>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-surface-container rounded-full text-outline">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Name *</label>
              <input name="name" required autoFocus defaultValue={guest.name}
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Phone</label>
              <input name="phone" type="tel" defaultValue={guest.phone ?? ''}
                onChange={() => setEditPhoneError(null)}
                className={`w-full p-3 border rounded-xl bg-surface-container-low text-sm focus:bg-white transition-all outline-none ${editPhoneError ? 'border-red-400 focus:border-red-400' : 'border-outline-variant focus:border-secondary'}`}
                placeholder="+91 XXXXX XXXXX" />
              {editPhoneError && <p className="text-[10px] font-bold text-red-600">{editPhoneError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Invite Status</label>
                <select name="inviteStatus" defaultValue={guest.inviteStatus}
                  className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none">
                  <option value={InviteStatus.PENDING}>Pending</option>
                  <option value={InviteStatus.CONFIRMED}>Confirmed</option>
                  <option value={InviteStatus.DECLINED}>Declined</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Side</label>
                <select name="familySide" defaultValue={guest.familySide}
                  className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none">
                  <option value={FamilySide.BRIDE}>Bride Side</option>
                  <option value={FamilySide.GROOM}>Groom Side</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Group / Family Name</label>
              <input
                value={editGroupName}
                onChange={e => setEditGroupName(e.target.value)}
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="e.g. Sharma Family (leave blank for solo)" />
              {editGroupName.trim() && editGroupName.trim() !== (guest.groupName ?? '') && (
                <p className="text-[10px] text-secondary font-bold">
                  {guest.groupName
                    ? `Will move from "${guest.groupName}" to "${editGroupName.trim()}"`
                    : `Will be added to "${editGroupName.trim()}"`}
                </p>
              )}
              {!editGroupName.trim() && guest.groupName && (
                <p className="text-[10px] text-amber-600 font-bold">Will be removed from "{guest.groupName}"</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Notes</label>
              <input name="notes" defaultValue={guest.notes ?? ''}
                className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                placeholder="Dietary, special needs, etc." />
            </div>

            {editGroupName.trim() && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" name="isPrimaryContact" defaultChecked={!!guest.isPrimaryContact}
                  className="w-4 h-4 accent-secondary" />
                <span className="text-sm font-bold text-on-surface">Primary contact for group</span>
              </label>
            )}

            <div className="space-y-3 border-t border-outline-variant pt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setEditIsLocal(!editIsLocal); if (!editIsLocal) setEditShowTravel(false); }}
                  className={cn('w-10 h-5 rounded-full transition-colors shrink-0 relative overflow-hidden',
                    editIsLocal ? 'bg-secondary' : 'bg-outline-variant')}
                >
                  <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    editIsLocal ? 'translate-x-5' : 'translate-x-0')} />
                </button>
                <span className="text-sm font-bold text-primary flex items-center gap-1.5"><MapPin size={13} className="text-secondary" />Local Guest</span>
              </div>

              {!editIsLocal && (
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Travel Itinerary</label>
                  <button type="button" onClick={() => setEditShowTravel(v => !v)}
                    className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                      editShowTravel ? 'bg-secondary text-on-secondary border-secondary' : 'border-outline-variant text-outline hover:border-secondary hover:text-secondary')}>
                    {editShowTravel ? 'Hide' : '+ Add Travel'}
                  </button>
                </div>
              )}

              {editShowTravel && !editIsLocal && (
                <div className="space-y-4">
                  <div className="bg-surface-container-low rounded-xl p-4 space-y-3 border border-outline-variant/60">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1.5"><Plane size={11} />Arrival</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <select value={editArrivalMode} onChange={e => setEditArrivalMode(e.target.value as ArrivalMode)}
                          className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none">
                          <option value={ArrivalMode.CAR}>Car</option>
                          <option value={ArrivalMode.BUS}>Bus</option>
                          <option value={ArrivalMode.TRAIN}>Train</option>
                          <option value={ArrivalMode.FLIGHT}>Flight</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Date (DD.MM)</p>
                        <input value={editArrivalDateStr} onChange={e => { setEditArrivalDateStr(e.target.value); setEditArrDateErr(null); }} placeholder="e.g. 25.6"
                          className={`w-full p-2.5 border rounded-lg bg-white text-sm outline-none ${editArrDateErr ? 'border-red-400' : 'border-outline-variant focus:border-secondary'}`} />
                        {editArrDateErr && <p className="text-[9px] font-bold text-red-600 mt-0.5">{editArrDateErr}</p>}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Time (24hr)</p>
                        <input value={editArrivalTimeStr} onChange={e => { setEditArrivalTimeStr(e.target.value); setEditArrTimeErr(null); }} placeholder="14:30"
                          className={`w-full p-2.5 border rounded-lg bg-white text-sm outline-none ${editArrTimeErr ? 'border-red-400' : 'border-outline-variant focus:border-secondary'}`} />
                        {editArrTimeErr && <p className="text-[9px] font-bold text-red-600 mt-0.5">{editArrTimeErr}</p>}
                      </div>
                    </div>
                    {editArrivalMode === ArrivalMode.TRAIN && (
                      <div className="grid grid-cols-2 gap-2">
                        {[['arrivalTrainName','Train Name',guest.arrivalTrainName],['arrivalTrainNumber','Train #',guest.arrivalTrainNumber],['arrivalCoach','Coach',guest.arrivalCoach],['arrivalSeat','Seat(s)',guest.arrivalSeat]].map(([n,l,v]) => (
                          <div key={n as string}>
                            <p className="text-[9px] font-bold text-outline uppercase mb-1">{l as string}</p>
                            <input name={n as string} defaultValue={(v as string) ?? ''} className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" />
                          </div>
                        ))}
                      </div>
                    )}
                    {editArrivalMode === ArrivalMode.FLIGHT && (
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Flight Number</p>
                        <input name="arrivalFlightNumber" defaultValue={guest.arrivalFlightNumber ?? ''}
                          className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" placeholder="e.g. 6E-201" />
                      </div>
                    )}
                    {(editArrivalMode === ArrivalMode.CAR || editArrivalMode === ArrivalMode.BUS) && (
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Details (optional)</p>
                        <input name="travelDetails" defaultValue={guest.travelDetails ?? ''}
                          className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" placeholder="Vehicle / driver info" />
                      </div>
                    )}
                  </div>

                  <div className="bg-surface-container-low rounded-xl p-4 space-y-3 border border-outline-variant/60">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5"><Plane size={11} className="rotate-90" />Departure</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <select value={editDepartureMode} onChange={e => setEditDepartureMode(e.target.value as ArrivalMode)}
                          className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none">
                          <option value={ArrivalMode.CAR}>Car</option>
                          <option value={ArrivalMode.BUS}>Bus</option>
                          <option value={ArrivalMode.TRAIN}>Train</option>
                          <option value={ArrivalMode.FLIGHT}>Flight</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Date (DD.MM)</p>
                        <input value={editDepartureDateStr} onChange={e => { setEditDepartureDateStr(e.target.value); setEditDepDateErr(null); }} placeholder="e.g. 28.6"
                          className={`w-full p-2.5 border rounded-lg bg-white text-sm outline-none ${editDepDateErr ? 'border-red-400' : 'border-outline-variant focus:border-secondary'}`} />
                        {editDepDateErr && <p className="text-[9px] font-bold text-red-600 mt-0.5">{editDepDateErr}</p>}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Time (24hr)</p>
                        <input value={editDepartureTimeStr} onChange={e => { setEditDepartureTimeStr(e.target.value); setEditDepTimeErr(null); }} placeholder="16:30"
                          className={`w-full p-2.5 border rounded-lg bg-white text-sm outline-none ${editDepTimeErr ? 'border-red-400' : 'border-outline-variant focus:border-secondary'}`} />
                        {editDepTimeErr && <p className="text-[9px] font-bold text-red-600 mt-0.5">{editDepTimeErr}</p>}
                      </div>
                    </div>
                    {editDepartureMode === ArrivalMode.TRAIN && (
                      <div className="grid grid-cols-2 gap-2">
                        {[['departureTrainName','Train Name',guest.departureTrainName],['departureTrainNumber','Train #',guest.departureTrainNumber],['departureCoach','Coach',guest.departureCoach],['departureSeat','Seat(s)',guest.departureSeat]].map(([n,l,v]) => (
                          <div key={n as string}>
                            <p className="text-[9px] font-bold text-outline uppercase mb-1">{l as string}</p>
                            <input name={n as string} defaultValue={(v as string) ?? ''} className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" />
                          </div>
                        ))}
                      </div>
                    )}
                    {editDepartureMode === ArrivalMode.FLIGHT && (
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Flight Number</p>
                        <input name="departureFlightNumber" defaultValue={guest.departureFlightNumber ?? ''}
                          className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" placeholder="e.g. AI-101" />
                      </div>
                    )}
                    {(editDepartureMode === ArrivalMode.CAR || editDepartureMode === ArrivalMode.BUS) && (
                      <div>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Details (optional)</p>
                        <input name="departureDetails" defaultValue={guest.departureDetails ?? ''}
                          className="w-full p-2.5 border border-outline-variant rounded-lg bg-white text-sm focus:border-secondary outline-none" placeholder="Drop-off / vehicle info" />
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={() => { setEditShowTravel(false); setEditArrivalDateStr(''); setEditDepartureDateStr(''); }}
                    className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors">
                    × Clear travel info
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 pb-6 flex justify-end gap-3 border-t border-outline-variant pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
