/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search, Calendar, UserPlus, ChevronRight, X,
  Train, Car, PlaneLanding, Plane, AlertTriangle,
  CheckCircle2, Bus, ChevronDown, Users2, StickyNote,
  LogOut, Trash2,
} from 'lucide-react';
import { Card, Badge, Button } from '../components/UIComponents';
import AddGroupModal from '../components/AddGroupModal';
import { validatePhone, validateDateStr, validateTimeStr } from '../lib/validation';
import { cn } from '../lib/utils';
import { Guest, GuestStatus, InviteStatus, FamilySide, ArrivalMode } from '../types';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy, deleteField, writeBatch, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useIsReadOnly } from '../contexts/AccessContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayTime(isoString: string | undefined) {
  if (!isoString) return '--:--';
  try { return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return '--:--'; }
}

function formatDisplayDate(isoString: string | undefined) {
  if (!isoString) return '--';
  try { return new Date(isoString).toLocaleDateString([], { day: '2-digit', month: 'short' }); }
  catch { return '--'; }
}

function parseSmartDate(s: string) {
  const fallbackYear = String(new Date().getFullYear());
  if (!s) return `${fallbackYear}-01-01`;
  if (s.includes('-') && s.split('-').length === 3) return s;
  const parts = s.split(/[./-]/);
  const day = parts[0];
  const month = parts[1];
  const year = parts[2] || fallbackYear;
  if (!month) return `${fallbackYear}-01-01`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseSmartTime(s: string, period: 'AM' | 'PM') {
  if (!s) return '12:00';
  const parts = s.split(/[.:]/);
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  if (status === InviteStatus.CONFIRMED)
    return <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Confirmed</span>;
  if (status === InviteStatus.DECLINED)
    return <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Declined</span>;
  return <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant text-outline uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-outline" />Pending</span>;
}

function ModeIcon({ mode, size = 14 }: { mode: ArrivalMode; size?: number }) {
  if (mode === ArrivalMode.FLIGHT) return <Plane size={size} className="text-secondary" />;
  if (mode === ArrivalMode.TRAIN) return <Train size={size} className="text-secondary" />;
  if (mode === ArrivalMode.BUS) return <Bus size={size} className="text-secondary" />;
  return <Car size={size} className="text-secondary" />;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GuestOps() {
  const isReadOnly = useIsReadOnly();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArrivingToday, setFilterArrivingToday] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [formInviteStatus, setFormInviteStatus] = useState<InviteStatus>(InviteStatus.PENDING);
  const [formIsPrimary, setFormIsPrimary] = useState(true);
  const [formGroupName, setFormGroupName] = useState('');
  const [showTravelSection, setShowTravelSection] = useState(false);
  const [formArrivalMode, setFormArrivalMode] = useState<ArrivalMode>(ArrivalMode.CAR);
  const [formDepartureMode, setFormDepartureMode] = useState<ArrivalMode>(ArrivalMode.CAR);
  const [arrivalAmPm, setArrivalAmPm] = useState<'AM' | 'PM'>('AM');
  const [departureAmPm, setDepartureAmPm] = useState<'AM' | 'PM'>('AM');
  const [familySideChoice, setFamilySideChoice] = useState<FamilySide>(FamilySide.BRIDE);
  const [arrivalDateStr, setArrivalDateStr] = useState('');
  const [arrivalTimeStr, setArrivalTimeStr] = useState('');
  const [departureDateStr, setDepartureDateStr] = useState('');
  const [departureTimeStr, setDepartureTimeStr] = useState('');
  const [formPhoneError, setFormPhoneError] = useState<string | null>(null);

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 5000);
    const q = query(collection(db, 'guests'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(fallback);
      setGuests(snapshot.docs.map(d => d.data() as Guest));
      setLoading(false);
    }, (error) => {
      clearTimeout(fallback);
      handleFirestoreError(error, OperationType.LIST, 'guests');
      setLoading(false);
    });
    return () => { clearTimeout(fallback); unsubscribe(); };
  }, []);

  const resetForm = () => {
    setFormGroupName('');
    setFormIsPrimary(true);
    setFormInviteStatus(InviteStatus.PENDING);
    setFamilySideChoice(FamilySide.BRIDE);
    setFormArrivalMode(ArrivalMode.CAR);
    setFormDepartureMode(ArrivalMode.CAR);
    setShowTravelSection(false);
    setArrivalDateStr('');
    setArrivalTimeStr('');
    setDepartureDateStr('');
    setDepartureTimeStr('');
    setFormPhoneError(null);
  };

  const handleUpdateStatus = async (guestId: string, newStatus: GuestStatus) => {
    try {
      const guest = guests.find(g => g.id === guestId);
      if (newStatus === GuestStatus.CHECKED_OUT && guest?.roomId) {
        // Release the room if no other guests remain in it
        const roomId = guest.roomId;
        const otherRoomGuests = guests.filter(g => g.id !== guestId && g.roomId === roomId);
        const batch = writeBatch(db);
        batch.update(doc(db, 'guests', guestId), {
          status: newStatus,
          roomId: deleteField(),
          roomNumber: deleteField(),
          hotelName: deleteField(),
        });
        if (otherRoomGuests.length === 0) {
          batch.update(doc(db, 'rooms', roomId), { status: 'Empty' });
        }
        await batch.commit();
      } else {
        await updateDoc(doc(db, 'guests', guestId), { status: newStatus });
      }
      if (selectedGuest?.id === guestId) setSelectedGuest({ ...selectedGuest, status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `guests/${guestId}`);
    }
  };

  const handleUpdateInviteStatus = async (guestId: string, newStatus: InviteStatus) => {
    try {
      await updateDoc(doc(db, 'guests', guestId), { inviteStatus: newStatus });
      if (selectedGuest?.id === guestId) setSelectedGuest({ ...selectedGuest, inviteStatus: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `guests/${guestId}`);
    }
  };

  const handleBulkUpdateStatus = async (newStatus: GuestStatus) => {
    const ids = [...selectedIds];
    await Promise.all(ids.map(id =>
      updateDoc(doc(db, 'guests', id), { status: newStatus }).catch(e =>
        handleFirestoreError(e, OperationType.UPDATE, `guests/${id}`)
      )
    ));
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteGuest = async (guestId: string) => {
    try {
      await deleteDoc(doc(db, 'guests', guestId));
      setSelectedGuest(null);
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `guests/${guestId}`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(g => g.id)));
    }
  };

  const handleAddGuest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phoneVal = formData.get('phone') as string;
    const pErr = validatePhone(phoneVal);
    if (pErr) { setFormPhoneError(pErr); return; }
    if (showTravelSection) {
      const adErr = validateDateStr(arrivalDateStr);
      const atErr = arrivalDateStr ? validateTimeStr(arrivalTimeStr) : null;
      const ddErr = validateDateStr(departureDateStr);
      const dtErr = departureDateStr ? validateTimeStr(departureTimeStr) : null;
      if (adErr || atErr || ddErr || dtErr) return; // errors shown inline via preview
    }
    setFormPhoneError(null);
    const id = `G${Date.now()}`;
    const groupName = formGroupName.trim();

    let travelFields: Partial<Guest> = {};
    if (showTravelSection) {
      const arrivalDate = parseSmartDate(arrivalDateStr);
      const arrivalTime = parseSmartTime(arrivalTimeStr, arrivalAmPm);
      const departureDate = parseSmartDate(departureDateStr);
      const departureTime = parseSmartTime(departureTimeStr, departureAmPm);
      travelFields = {
        arrivalMode: formArrivalMode,
        departureMode: formDepartureMode,
        arrivalDateTime: `${arrivalDate}T${arrivalTime}:00`,
        departureDateTime: `${departureDate}T${departureTime}:00`,
        travelDetails: (formData.get('arrivalDetails') as string) || undefined,
        departureDetails: (formData.get('departureDetails') as string) || undefined,
        arrivalTrainName: (formData.get('arrivalTrainName') as string) || undefined,
        arrivalTrainNumber: (formData.get('arrivalTrainNumber') as string) || undefined,
        arrivalCoach: (formData.get('arrivalCoach') as string) || undefined,
        arrivalSeat: (formData.get('arrivalSeat') as string) || undefined,
        departureTrainName: (formData.get('departureTrainName') as string) || undefined,
        departureTrainNumber: (formData.get('departureTrainNumber') as string) || undefined,
        departureCoach: (formData.get('departureCoach') as string) || undefined,
        departureSeat: (formData.get('departureSeat') as string) || undefined,
        arrivalFlightNumber: (formData.get('arrivalFlightNumber') as string) || undefined,
        departureFlightNumber: (formData.get('departureFlightNumber') as string) || undefined,
      };
    }

    const newGuest: Guest = {
      id,
      name: formData.get('name') as string,
      phone: (formData.get('phone') as string) || undefined,
      groupName: groupName || undefined,
      isPrimaryContact: groupName ? formIsPrimary : undefined,
      familySide: familySideChoice,
      inviteStatus: formInviteStatus,
      status: GuestStatus.PENDING,
      dietary: (formData.get('dietary') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
      ...travelFields,
    };

    Object.keys(newGuest).forEach(k => {
      if ((newGuest as unknown as Record<string, unknown>)[k] === undefined)
        delete (newGuest as unknown as Record<string, unknown>)[k];
    });

    try {
      await setDoc(doc(db, 'guests', id), newGuest);
      setIsAddingGuest(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `guests/${id}`);
    }
  };

  const filtered = guests.filter(guest => {
    if (filterArrivingToday) {
      if (!guest.arrivalDateTime) return false;
      const today = new Date().toISOString().split('T')[0];
      if (guest.arrivalDateTime.split('T')[0] !== today) return false;
    }
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return guest.name.toLowerCase().includes(s) ||
      (guest.phone || '').includes(s) ||
      (guest.groupName || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Guest Management</p>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-primary">Registry</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isReadOnly && (
              <>
                <Button variant="primary" className="rounded-full flex items-center gap-2 h-12 px-6 shadow-lg shadow-primary/20" onClick={() => setIsAddingGuest(true)}>
                  <UserPlus size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">New Guest</span>
                </Button>
                <Button variant="secondary" className="rounded-full flex items-center gap-2 h-12 px-6 shadow-lg shadow-secondary/20" onClick={() => setIsAddingGroup(true)}>
                  <Users2 size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Add Group</span>
                </Button>
              </>
            )}
            <Button
              variant={filterArrivingToday ? 'secondary' : 'ghost'}
              className={cn('rounded-full flex items-center gap-2 border h-12 px-6 transition-all',
                filterArrivingToday ? 'border-secondary' : 'border-outline-variant text-outline')}
              onClick={() => setFilterArrivingToday(!filterArrivingToday)}
            >
              <Calendar size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">
                {filterArrivingToday ? "Today's Arrivals" : 'Arriving Today'}
              </span>
            </Button>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-primary/5 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
          <div className="relative flex items-center">
            <Search className="absolute left-5 text-outline group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search by name, phone, or group..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-12 py-5 border border-outline-variant rounded-[2rem] bg-white shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none text-base font-medium placeholder:text-outline/50"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-4 p-2 hover:bg-surface-container rounded-full transition-colors text-outline">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant font-medium text-sm">
            {guests.length === 0 ? 'No guests registered. Tap + New Guest to add one.' : 'No guests match the search.'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container rounded-xl">
              <input type="checkbox" className="rounded accent-secondary w-4 h-4"
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll} />
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex-1">
                {selectedIds.size > 0 ? `${selectedIds.size} of ${filtered.length} selected` : `${filtered.length} guests`}
              </span>
            </div>
            {filtered.map(guest => {
              const isSelected = selectedIds.has(guest.id);
              return (
                <div
                  key={guest.id}
                  className={cn(
                    'bg-white rounded-2xl border border-outline-variant/50 shadow-sm overflow-hidden',
                    isSelected && 'border-secondary/50 bg-secondary/5'
                  )}
                >
                  <div className="flex items-center gap-3 p-4" onClick={() => setSelectedGuest(guest)}>
                    <div className="shrink-0" onClick={e => { e.stopPropagation(); toggleSelect(guest.id); }}>
                      <input type="checkbox" className="rounded accent-secondary w-4 h-4 cursor-pointer"
                        checked={isSelected} onChange={() => toggleSelect(guest.id)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-bold text-primary truncate">{guest.name}</span>
                        {guest.notes && <StickyNote size={11} className="text-secondary/60 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={guest.familySide === FamilySide.BRIDE ? 'primary' : 'secondary'} className="text-[8px] px-1.5 py-0">
                          {guest.familySide === FamilySide.BRIDE ? 'Bride' : 'Groom'}
                        </Badge>
                        {guest.groupName && (
                          <span className="text-[9px] text-secondary font-bold truncate max-w-[120px]">{guest.groupName}</span>
                        )}
                        {guest.arrivalDateTime && (
                          <span className="flex items-center gap-0.5 text-[9px] text-outline">
                            <ModeIcon mode={guest.arrivalMode!} size={10} />
                            {formatDisplayDate(guest.arrivalDateTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', {
                        'bg-secondary': guest.status === GuestStatus.PICKED_UP,
                        'bg-primary': guest.status === GuestStatus.CHECKED_IN,
                        'bg-red-500 animate-pulse': guest.status === GuestStatus.IN_TRANSIT,
                        'bg-outline/40': guest.status === GuestStatus.PENDING,
                        'bg-gray-400': guest.status === GuestStatus.CHECKED_OUT,
                      })} />
                      <ChevronRight size={16} className="text-outline" />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-hidden" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant">
                {!isReadOnly && (
                  <th className="pl-5 pr-2 py-4">
                    <input type="checkbox" className="rounded accent-secondary"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll} />
                  </th>
                )}
                <th className="px-6 py-4">Guest</th>
                <th className="px-6 py-4">Family Side</th>
                <th className="px-6 py-4">Invite Status</th>
                <th className="px-6 py-4">Travel?</th>
                <th className="px-6 py-4">Arrival</th>
                <th className="px-6 py-4">Hotel Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant font-medium">
                  {guests.length === 0 ? 'No guests registered. Start by adding a guest.' : 'No guests match the search.'}
                </td></tr>
              ) : (
                filtered.map(guest => {
                  const invStatus = guest.inviteStatus ?? InviteStatus.PENDING;
                  return (
                    <tr
                      key={guest.id}
                      className={cn('hover:bg-surface-container-low transition-colors group',
                        selectedGuest?.id === guest.id && 'bg-surface-container-low',
                        selectedIds.has(guest.id) && 'bg-secondary/5')}
                    >
                      {!isReadOnly && (
                        <td className="pl-5 pr-2 py-4" onClick={e => { e.stopPropagation(); toggleSelect(guest.id); }}>
                          <input type="checkbox" className="rounded accent-secondary cursor-pointer"
                            checked={selectedIds.has(guest.id)} onChange={() => toggleSelect(guest.id)} />
                        </td>
                      )}
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-primary">{guest.name}</span>
                            {guest.notes && <StickyNote size={11} className="text-secondary/60 shrink-0" />}
                          </div>
                          {guest.groupName && (
                            <span className="flex items-center gap-1 text-[10px] text-secondary font-bold">
                              <Users2 size={10} />
                              {guest.groupName}
                              {guest.isPrimaryContact && <span className="text-outline font-normal">· Primary</span>}
                            </span>
                          )}
                          {guest.phone && (
                            <span className="text-[10px] text-outline font-bold tracking-widest uppercase">{guest.phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                        <Badge variant={guest.familySide === FamilySide.BRIDE ? 'primary' : 'secondary'} className="text-[9px] px-2">
                          {guest.familySide === FamilySide.BRIDE ? 'Bride' : 'Groom'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                        <InviteStatusBadge status={invStatus} />
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                        {guest.arrivalDateTime ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
                            <CheckCircle2 size={12} />Travel ✓
                          </span>
                        ) : (
                          <span className="text-[10px] text-outline/40">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                        {guest.arrivalDateTime ? (
                          <div className="flex items-center gap-1.5">
                            <ModeIcon mode={guest.arrivalMode!} size={13} />
                            <span className="text-xs font-bold">{formatDisplayDate(guest.arrivalDateTime)}</span>
                            <span className="text-[10px] text-outline">{formatDisplayTime(guest.arrivalDateTime)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-outline/40">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', {
                            'bg-secondary': guest.status === GuestStatus.PICKED_UP,
                            'bg-primary': guest.status === GuestStatus.CHECKED_IN,
                            'bg-red-500 animate-pulse': guest.status === GuestStatus.IN_TRANSIT,
                            'bg-outline/40': guest.status === GuestStatus.PENDING,
                            'bg-gray-400': guest.status === GuestStatus.CHECKED_OUT,
                          })} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{guest.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                        <ChevronRight size={18} className="text-outline group-hover:text-primary group-hover:translate-x-1 transition-all inline-block" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Group Modal */}
      {isAddingGroup && <AddGroupModal onClose={() => setIsAddingGroup(false)} />}

      {/* Add Guest Modal */}
      {isAddingGuest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md animate-in fade-in" onClick={() => { setIsAddingGuest(false); resetForm(); }} />
          <Card className="relative w-full max-w-3xl h-full md:h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col p-0 overflow-hidden rounded-none md:rounded-3xl" padded={false}>
            <form onSubmit={handleAddGuest} noValidate className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="bg-primary text-on-primary px-8 py-6 border-b border-outline-variant flex justify-between items-center relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold font-display tracking-tight">Register New Guest</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-1">Guest Registry</p>
                </div>
                <button type="button" onClick={() => { setIsAddingGuest(false); resetForm(); }} className="hover:bg-white/10 p-3 rounded-full transition-colors relative z-10">
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 md:px-10 py-8 space-y-10 custom-scrollbar bg-surface-container-lowest min-h-0">

                {/* SECTION 01: IDENTITY */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm">01</div>
                    <h4 className="text-sm font-black text-primary uppercase tracking-widest">Guest Identity</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-primary uppercase tracking-[0.1em] ml-1">Full Name *</label>
                      <input name="name" required className="w-full px-4 py-4 border border-outline-variant rounded-2xl bg-white text-base focus:border-secondary focus:ring-4 focus:ring-secondary/5 transition-all outline-none" placeholder="e.g. Amit Sethia" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-primary uppercase tracking-[0.1em] ml-1">Phone Number</label>
                      <input name="phone" onChange={() => setFormPhoneError(null)}
                        className={`w-full px-4 py-4 border rounded-2xl bg-white text-base focus:ring-4 transition-all outline-none ${formPhoneError ? 'border-red-400 focus:ring-red-100' : 'border-outline-variant focus:border-secondary focus:ring-secondary/5'}`}
                        placeholder="+91 XXXXX XXXXX (optional)" />
                      {formPhoneError && <p className="text-xs font-bold text-red-600 ml-1">{formPhoneError}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-primary uppercase tracking-[0.1em] ml-1">Group / Family Name</label>
                      <input
                        value={formGroupName}
                        onChange={e => setFormGroupName(e.target.value)}
                        className="w-full px-4 py-4 border border-outline-variant rounded-2xl bg-white text-base focus:border-secondary focus:ring-4 focus:ring-secondary/5 transition-all outline-none"
                        placeholder="e.g. Sethia Family (leave blank for solo)"
                      />
                      {formGroupName && (
                        <p className="text-[10px] text-secondary font-bold ml-1">All members with this name are linked together</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-primary uppercase tracking-[0.1em] ml-1">Family Association *</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setFamilySideChoice(FamilySide.BRIDE)}
                          className={cn('py-4 px-4 rounded-2xl border-2 transition-all font-bold text-sm',
                            familySideChoice === FamilySide.BRIDE ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-primary border-outline-variant')}>
                          Bride Side
                        </button>
                        <button type="button" onClick={() => setFamilySideChoice(FamilySide.GROOM)}
                          className={cn('py-4 px-4 rounded-2xl border-2 transition-all font-bold text-sm',
                            familySideChoice === FamilySide.GROOM ? 'bg-secondary text-white border-secondary shadow-lg' : 'bg-white text-secondary border-outline-variant')}>
                          Groom Side
                        </button>
                      </div>
                      <input type="hidden" name="familySide" value={familySideChoice} />
                    </div>
                  </div>

                  {formGroupName && (
                    <div className="flex items-center gap-4 bg-secondary/5 px-6 py-4 rounded-2xl border border-secondary/10">
                      <button
                        type="button"
                        onClick={() => setFormIsPrimary(!formIsPrimary)}
                        className={cn('w-12 h-6 rounded-full transition-colors shrink-0 relative overflow-hidden',
                          formIsPrimary ? 'bg-secondary' : 'bg-outline-variant')}
                      >
                        <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                          formIsPrimary ? 'translate-x-6' : 'translate-x-0')} />
                      </button>
                      <div>
                        <p className="text-sm font-bold text-primary">Primary Contact for this group</p>
                        <p className="text-[10px] text-outline">The person others call — mark one per group</p>
                      </div>
                    </div>
                  )}
                </section>

                {/* SECTION 02: INVITE STATUS */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm">02</div>
                    <h4 className="text-sm font-black text-primary uppercase tracking-widest">Invite Status</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[InviteStatus.PENDING, InviteStatus.CONFIRMED, InviteStatus.DECLINED].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormInviteStatus(s)}
                        className={cn('py-4 px-4 rounded-2xl border-2 transition-all font-bold text-sm',
                          formInviteStatus === s
                            ? s === InviteStatus.CONFIRMED
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg'
                              : s === InviteStatus.DECLINED
                                ? 'bg-red-600 text-white border-red-600 shadow-lg'
                                : 'bg-primary text-white border-primary shadow-lg'
                            : 'bg-white border-outline-variant text-on-surface-variant')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </section>

                {/* SECTION 03: TRAVEL DETAILS (optional) */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-outline-variant pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm">03</div>
                      <h4 className="text-sm font-black text-primary uppercase tracking-widest">Travel Details</h4>
                      <span className="text-[10px] text-outline font-medium">(optional — can be added later)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTravelSection(!showTravelSection)}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all',
                        showTravelSection ? 'bg-secondary text-on-secondary border-secondary' : 'border-outline-variant text-outline hover:border-secondary hover:text-secondary')}
                    >
                      {showTravelSection ? 'Hide' : '+ Add Travel'}
                      <ChevronDown size={14} className={cn('transition-transform', showTravelSection && 'rotate-180')} />
                    </button>
                  </div>

                  {showTravelSection && (
                    <div className="space-y-8">
                      {/* Arrival */}
                      <div className="bg-white p-6 md:p-8 rounded-3xl border border-outline-variant/30 shadow-sm space-y-6">
                        <p className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2"><PlaneLanding size={12} />Arrival</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Mode</label>
                            <select value={formArrivalMode} onChange={e => setFormArrivalMode(e.target.value as ArrivalMode)}
                              className="w-full p-4 border border-outline-variant rounded-2xl bg-surface-container-lowest text-sm focus:border-secondary outline-none font-bold">
                              <option value={ArrivalMode.CAR}>🚗 Car</option>
                              <option value={ArrivalMode.BUS}>🚌 Bus</option>
                              <option value={ArrivalMode.TRAIN}>🚆 Train</option>
                              <option value={ArrivalMode.FLIGHT}>✈️ Flight</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Date (DD.MM)</label>
                            <input type="text" value={arrivalDateStr} onChange={e => setArrivalDateStr(e.target.value)}
                              className={`w-full p-4 border rounded-2xl bg-surface-container-lowest text-sm outline-none font-bold ${validateDateStr(arrivalDateStr) && arrivalDateStr ? 'border-red-400' : 'border-outline-variant focus:border-secondary'}`}
                              placeholder="e.g. 15.6" autoComplete="off" />
                            {arrivalDateStr && (validateDateStr(arrivalDateStr)
                              ? <p className="text-[10px] font-bold text-red-600 ml-2">{validateDateStr(arrivalDateStr)}</p>
                              : <p className="text-[10px] font-bold text-secondary flex items-center gap-1 ml-2"><CheckCircle2 size={10} />{formatDisplayDate(`${parseSmartDate(arrivalDateStr)}T12:00:00`)}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Time</label>
                            <div className="flex items-center gap-2">
                              <input type="text" value={arrivalTimeStr} onChange={e => setArrivalTimeStr(e.target.value)}
                                className="flex-1 min-w-0 p-4 border border-outline-variant rounded-2xl bg-surface-container-lowest text-sm focus:border-secondary outline-none font-bold" placeholder="10.15" autoComplete="off" />
                              <div className="flex bg-surface-container rounded-2xl p-1 border border-outline-variant shrink-0">
                                {(['AM', 'PM'] as const).map(p => (
                                  <button key={p} type="button" onClick={() => setArrivalAmPm(p)}
                                    className={cn('px-3 py-1.5 rounded-xl text-[10px] font-black transition-all',
                                      arrivalAmPm === p ? 'bg-white shadow-md text-primary' : 'text-outline')}>{p}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10">
                          {formArrivalMode === ArrivalMode.TRAIN && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              {[['arrivalTrainName', 'Train Name', 'Rajdhani'], ['arrivalTrainNumber', 'Train #', '12301'], ['arrivalCoach', 'Coach', 'B2'], ['arrivalSeat', 'Seat(s)', '45']].map(([n, l, p]) => (
                                <div key={n} className="space-y-1">
                                  <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">{l}</label>
                                  <input name={n} className="w-full p-4 border border-outline-variant rounded-xl text-sm bg-white" placeholder={p} />
                                </div>
                              ))}
                            </div>
                          )}
                          {formArrivalMode === ArrivalMode.FLIGHT && (
                            <input name="arrivalFlightNumber" className="w-full p-4 border border-outline-variant rounded-xl text-sm bg-white" placeholder="Flight Number (e.g. 6E-201)" />
                          )}
                          {(formArrivalMode === ArrivalMode.CAR || formArrivalMode === ArrivalMode.BUS) && (
                            <input name="arrivalDetails" className="w-full p-4 border border-outline-variant rounded-xl text-sm bg-white" placeholder="Vehicle / driver details (optional)" />
                          )}
                        </div>
                      </div>

                      {/* Departure */}
                      <div className="bg-white p-6 md:p-8 rounded-3xl border border-outline-variant/30 shadow-sm space-y-6">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><Plane size={12} />Departure</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Mode</label>
                            <select value={formDepartureMode} onChange={e => setFormDepartureMode(e.target.value as ArrivalMode)}
                              className="w-full p-4 border border-outline-variant rounded-2xl bg-surface-container-lowest text-sm focus:border-secondary outline-none font-bold">
                              <option value={ArrivalMode.CAR}>🚗 Car</option>
                              <option value={ArrivalMode.BUS}>🚌 Bus</option>
                              <option value={ArrivalMode.TRAIN}>🚆 Train</option>
                              <option value={ArrivalMode.FLIGHT}>✈️ Flight</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Date (DD.MM)</label>
                            <input type="text" value={departureDateStr} onChange={e => setDepartureDateStr(e.target.value)}
                              className={`w-full p-4 border rounded-2xl bg-surface-container-lowest text-sm outline-none font-bold ${validateDateStr(departureDateStr) && departureDateStr ? 'border-red-400' : 'border-outline-variant focus:border-secondary'}`}
                              placeholder="e.g. 18.6" autoComplete="off" />
                            {departureDateStr && (validateDateStr(departureDateStr)
                              ? <p className="text-[10px] font-bold text-red-600 ml-2">{validateDateStr(departureDateStr)}</p>
                              : <p className="text-[10px] font-bold text-secondary flex items-center gap-1 ml-2"><CheckCircle2 size={10} />{formatDisplayDate(`${parseSmartDate(departureDateStr)}T12:00:00`)}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Time</label>
                            <div className="flex items-center gap-2">
                              <input type="text" value={departureTimeStr} onChange={e => setDepartureTimeStr(e.target.value)}
                                className="flex-1 min-w-0 p-4 border border-outline-variant rounded-2xl bg-surface-container-lowest text-sm focus:border-secondary outline-none font-bold" placeholder="4.30" autoComplete="off" />
                              <div className="flex bg-surface-container rounded-2xl p-1 border border-outline-variant shrink-0">
                                {(['AM', 'PM'] as const).map(p => (
                                  <button key={p} type="button" onClick={() => setDepartureAmPm(p)}
                                    className={cn('px-3 py-1.5 rounded-xl text-[10px] font-black transition-all',
                                      departureAmPm === p ? 'bg-white shadow-md text-primary' : 'text-outline')}>{p}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                          {formDepartureMode === ArrivalMode.TRAIN && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              {[['departureTrainName', 'Train Name', 'Shatabdi'], ['departureTrainNumber', 'Train #', ''], ['departureCoach', 'Coach', ''], ['departureSeat', 'Seat(s)', '']].map(([n, l, p]) => (
                                <div key={n} className="space-y-1">
                                  <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">{l}</label>
                                  <input name={n} className="w-full p-4 border border-outline-variant rounded-xl text-sm bg-white" placeholder={p} />
                                </div>
                              ))}
                            </div>
                          )}
                          {formDepartureMode === ArrivalMode.FLIGHT && (
                            <input name="departureFlightNumber" className="w-full p-4 border border-outline-variant rounded-xl text-sm bg-white" placeholder="Flight # (e.g. AI-101)" />
                          )}
                          {(formDepartureMode === ArrivalMode.CAR || formDepartureMode === ArrivalMode.BUS) && (
                            <input name="departureDetails" className="w-full p-4 border border-outline-variant rounded-xl text-sm bg-white" placeholder="Vehicle / drop-off notes (optional)" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* SECTION 04: DIETARY & NOTES */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm">04</div>
                    <h4 className="text-sm font-black text-primary uppercase tracking-widest">Dietary & Notes</h4>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-primary uppercase tracking-[0.1em] ml-1">Dietary Requirements</label>
                    <textarea name="dietary" className="w-full p-5 border border-outline-variant rounded-2xl bg-white text-base focus:border-secondary transition-all h-24 outline-none resize-none" placeholder="e.g. Jain food only, Wheelchair access, No nuts (optional)" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-primary uppercase tracking-[0.1em] ml-1">Internal Notes</label>
                    <textarea name="notes" className="w-full p-5 border border-outline-variant rounded-2xl bg-white text-base focus:border-secondary transition-all h-24 outline-none resize-none" placeholder="Any notes for the team — room preferences, VIP, special assistance, etc. (optional)" />
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 bg-white border-t border-outline-variant flex justify-end items-center gap-4 shrink-0">
                <Button type="button" variant="ghost" onClick={() => { setIsAddingGuest(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" variant="primary" className="px-12 h-14 rounded-2xl shadow-xl shadow-primary/30 font-bold">
                  Add to Registry
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Bulk Action Bar */}
      {!isReadOnly && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-on-primary px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl shadow-primary/40 animate-in slide-in-from-bottom duration-200 max-w-[95vw]">
          <span className="text-xs font-bold opacity-70">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-white/20" />
          {[
            { label: 'Picked Up', status: GuestStatus.PICKED_UP, color: 'bg-secondary text-on-secondary' },
            { label: 'Checked In', status: GuestStatus.CHECKED_IN, color: 'bg-white text-primary' },
            { label: 'In Transit', status: GuestStatus.IN_TRANSIT, color: 'bg-red-500 text-white' },
            { label: 'Checked Out', status: GuestStatus.CHECKED_OUT, color: 'bg-gray-500 text-white' },
          ].map(({ label, status, color }) => (
            <button key={status} onClick={() => handleBulkUpdateStatus(status)}
              className={cn('px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105', color)}>
              {label}
            </button>
          ))}
          <div className="w-px h-5 bg-white/20" />
          <button onClick={() => setSelectedIds(new Set())} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedGuest && (
        <>
          <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setSelectedGuest(null)} />
          <div className="fixed top-0 right-0 h-screen w-full md:w-96 bg-white shadow-2xl border-l border-outline-variant z-[70] animate-in slide-in-from-right duration-300">
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-primary text-on-primary">
                <div>
                  <h3 className="text-xl font-display font-bold">{selectedGuest.name}</h3>
                  {selectedGuest.groupName && (
                    <p className="text-[10px] font-bold opacity-70 flex items-center gap-1 mt-0.5">
                      <Users2 size={10} />{selectedGuest.groupName}
                      {selectedGuest.isPrimaryContact && ' · Primary Contact'}
                    </p>
                  )}
                </div>
                <button className="hover:bg-white/10 p-2 rounded-full transition-colors" onClick={() => setSelectedGuest(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Identity */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-outline uppercase tracking-[0.15em]">Identity</h4>
                  <div className="bg-surface-container-low p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={selectedGuest.familySide === FamilySide.BRIDE ? 'primary' : 'secondary'}>
                        {selectedGuest.familySide}
                      </Badge>
                      <InviteStatusBadge status={selectedGuest.inviteStatus ?? InviteStatus.PENDING} />
                    </div>
                    {selectedGuest.phone && <p className="text-sm text-on-surface-variant">📞 {selectedGuest.phone}</p>}
                    {selectedGuest.dietary && <p className="text-sm text-on-surface-variant">🍽 {selectedGuest.dietary}</p>}
                    {selectedGuest.notes && (
                      <div className="pt-2 border-t border-outline-variant/30">
                        <p className="text-[9px] font-bold text-outline uppercase mb-1 flex items-center gap-1"><StickyNote size={9} />Notes</p>
                        <p className="text-xs text-on-surface-variant">{selectedGuest.notes}</p>
                      </div>
                    )}
                    {selectedGuest.groupName && (
                      <div className="pt-2 border-t border-outline-variant/30">
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Group</p>
                        <p className="text-xs font-bold text-secondary">{selectedGuest.groupName}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Change Invite Status */}
                {!isReadOnly && <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-outline uppercase tracking-[0.15em]">Update Invite Status</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[InviteStatus.PENDING, InviteStatus.CONFIRMED, InviteStatus.DECLINED].map(s => (
                      <button
                        key={s}
                        onClick={() => handleUpdateInviteStatus(selectedGuest.id, s)}
                        className={cn('py-2.5 px-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all',
                          (selectedGuest.inviteStatus ?? InviteStatus.PENDING) === s
                            ? s === InviteStatus.CONFIRMED ? 'bg-emerald-600 text-white border-emerald-600'
                              : s === InviteStatus.DECLINED ? 'bg-red-600 text-white border-red-600'
                                : 'bg-primary text-white border-primary'
                            : 'bg-white border-outline-variant text-outline hover:border-secondary')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>}

                {/* Travel Details */}
                {selectedGuest.arrivalDateTime && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-outline uppercase tracking-[0.15em]">Travel Details</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded border border-outline-variant/30">
                        <p className="text-[8px] font-bold text-outline uppercase mb-1.5">Arrival · {selectedGuest.arrivalMode}</p>
                        {selectedGuest.arrivalMode === ArrivalMode.TRAIN ? (
                          <div className="text-[10px] space-y-0.5">
                            <p className="font-bold text-primary">{selectedGuest.arrivalTrainName}</p>
                            <p className="text-secondary">#{selectedGuest.arrivalTrainNumber}</p>
                            <p className="text-on-surface-variant">Coach {selectedGuest.arrivalCoach}, Seat {selectedGuest.arrivalSeat}</p>
                          </div>
                        ) : selectedGuest.arrivalMode === ArrivalMode.FLIGHT ? (
                          <p className="text-xs font-bold text-primary">Flight: {selectedGuest.arrivalFlightNumber}</p>
                        ) : (
                          <p className="text-xs text-on-surface-variant">{selectedGuest.travelDetails || '—'}</p>
                        )}
                        <p className="text-[9px] font-bold text-secondary mt-1.5">
                          {formatDisplayDate(selectedGuest.arrivalDateTime)} @ {formatDisplayTime(selectedGuest.arrivalDateTime)}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded border border-outline-variant/30">
                        <p className="text-[8px] font-bold text-outline uppercase mb-1.5">Departure · {selectedGuest.departureMode}</p>
                        {selectedGuest.departureMode === ArrivalMode.TRAIN ? (
                          <div className="text-[10px] space-y-0.5">
                            <p className="font-bold text-primary">{selectedGuest.departureTrainName}</p>
                            <p className="text-secondary">#{selectedGuest.departureTrainNumber}</p>
                            <p className="text-on-surface-variant">Coach {selectedGuest.departureCoach}, Seat {selectedGuest.departureSeat}</p>
                          </div>
                        ) : selectedGuest.departureMode === ArrivalMode.FLIGHT ? (
                          <p className="text-xs font-bold text-primary">Flight: {selectedGuest.departureFlightNumber}</p>
                        ) : (
                          <p className="text-xs text-on-surface-variant">{selectedGuest.departureDetails || '—'}</p>
                        )}
                        {selectedGuest.departureDateTime && (
                          <p className="text-[9px] font-bold text-secondary mt-1.5">
                            {formatDisplayDate(selectedGuest.departureDateTime)} @ {formatDisplayTime(selectedGuest.departureDateTime)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Hotel Status */}
                {!isReadOnly && <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-outline uppercase tracking-[0.15em]">Hotel Status (Day-of)</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedGuest.id, GuestStatus.PICKED_UP)}
                      className={cn('w-full flex justify-between items-center p-4 border border-outline-variant rounded-lg transition-colors',
                        selectedGuest.status === GuestStatus.PICKED_UP ? 'bg-secondary-container border-secondary' : 'hover:border-secondary')}
                    >
                      <div className="flex items-center gap-3">
                        <Car size={20} className="text-secondary" />
                        <span className="font-bold text-sm">Mark Picked Up</span>
                      </div>
                      {selectedGuest.status === GuestStatus.PICKED_UP && <CheckCircle2 size={18} className="text-secondary" />}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedGuest.id, GuestStatus.CHECKED_IN)}
                      className={cn('w-full flex justify-between items-center p-4 border border-outline-variant rounded-lg transition-all shadow-sm',
                        selectedGuest.status === GuestStatus.CHECKED_IN ? 'bg-primary text-on-primary border-primary shadow-lg' : 'hover:border-primary')}
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={20} className={selectedGuest.status === GuestStatus.CHECKED_IN ? 'text-white' : 'text-primary'} />
                        <span className="font-bold text-sm">Mark Checked In</span>
                      </div>
                      {selectedGuest.status === GuestStatus.CHECKED_IN && <CheckCircle2 size={18} className="opacity-50" />}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedGuest.id, GuestStatus.IN_TRANSIT)}
                      className={cn('w-full flex justify-between items-center p-4 border border-outline-variant rounded-lg transition-colors',
                        selectedGuest.status === GuestStatus.IN_TRANSIT ? 'bg-red-50 border-red-500' : 'hover:bg-tertiary-container')}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={20} className="text-tertiary" />
                        <span className="font-bold text-sm">Mark In Transit</span>
                      </div>
                      {selectedGuest.status === GuestStatus.IN_TRANSIT && <AlertTriangle size={18} className="text-tertiary" />}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedGuest.id, GuestStatus.CHECKED_OUT)}
                      className={cn('w-full flex justify-between items-center p-4 border border-outline-variant rounded-lg transition-colors',
                        selectedGuest.status === GuestStatus.CHECKED_OUT ? 'bg-gray-100 border-gray-400' : 'hover:border-gray-400')}
                    >
                      <div className="flex items-center gap-3">
                        <LogOut size={20} className="text-gray-500" />
                        <span className="font-bold text-sm">Mark Checked Out</span>
                      </div>
                      {selectedGuest.status === GuestStatus.CHECKED_OUT && <CheckCircle2 size={18} className="text-gray-500" />}
                    </button>
                  </div>
                </div>}
              </div>

              <div className="p-6 border-t border-outline-variant bg-surface-container-low/30 space-y-2">
                {!isReadOnly && confirmDeleteId === selectedGuest.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600 flex-1">Delete {selectedGuest.name}?</span>
                    <button
                      onClick={() => handleDeleteGuest(selectedGuest.id)}
                      className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-4 py-2 border border-outline-variant text-xs font-bold rounded-lg hover:bg-surface-container transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 h-10" onClick={() => setSelectedGuest(null)}>Close</Button>
                    {!isReadOnly && <button
                      onClick={() => setConfirmDeleteId(selectedGuest.id)}
                      className="px-4 py-2 border border-red-200 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Delete
                    </button>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
