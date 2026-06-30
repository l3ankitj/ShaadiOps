/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Calendar, PlaneLanding, CalendarCheck, Plane, Clock, MapPin, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, X, FileDown, Search, Train, Car, Bus, BedDouble, Phone, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Card, Button, Badge } from '../components/UIComponents';
import { cn } from '../lib/utils';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Guest, GuestStatus, EventConfig, ItineraryItem, ArrivalMode } from '../types';
import { exportToPdf } from '../lib/exportPdf';
import { useToast } from '../components/Toast';

function ModeIcon({ mode }: { mode?: ArrivalMode }) {
  if (mode === ArrivalMode.TRAIN) return <Train size={13} />;
  if (mode === ArrivalMode.FLIGHT) return <Plane size={13} />;
  if (mode === ArrivalMode.BUS) return <Bus size={13} />;
  return <Car size={13} />;
}

function GuestDetailPanel({ guest, direction }: { guest: Guest; direction: 'arrival' | 'departure' }) {
  const isArr = direction === 'arrival';
  const mode = isArr ? guest.arrivalMode : guest.departureMode;
  const dt = isArr ? guest.arrivalDateTime : guest.departureDateTime;
  const trainName = isArr ? guest.arrivalTrainName : guest.departureTrainName;
  const trainNum = isArr ? guest.arrivalTrainNumber : guest.departureTrainNumber;
  const coach = isArr ? guest.arrivalCoach : guest.departureCoach;
  const seat = isArr ? guest.arrivalSeat : guest.departureSeat;
  const flightNum = isArr ? guest.arrivalFlightNumber : guest.departureFlightNumber;
  const notes = isArr ? guest.travelDetails : guest.departureDetails;

  const details: { label: string; value: string; icon?: React.ReactNode }[] = [];

  if (mode) details.push({ label: 'Mode', value: mode, icon: <ModeIcon mode={mode} /> });
  if (dt) details.push({ label: 'Date & Time', value: new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) });
  if (trainName) details.push({ label: 'Train', value: `${trainName}${trainNum ? ` (${trainNum})` : ''}` });
  if (coach || seat) details.push({ label: 'Coach / Seat', value: [coach, seat].filter(Boolean).join(' / ') });
  if (flightNum) details.push({ label: 'Flight', value: flightNum });
  if (notes) details.push({ label: 'Notes', value: notes });
  if (guest.hotelName) details.push({ label: 'Hotel', value: `${guest.hotelName}${guest.roomNumber ? ` · Room ${guest.roomNumber}` : ''}`, icon: <BedDouble size={13} /> });
  if (guest.phone) details.push({ label: 'Phone', value: guest.phone, icon: <Phone size={13} /> });
  if (guest.familySide) details.push({ label: 'Side', value: guest.familySide });

  return (
    <div className="px-4 pb-3 pt-0 ml-6 animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="bg-surface-container/60 rounded-xl p-3 space-y-1.5">
        {details.map(d => (
          <div key={d.label} className="flex items-center gap-2 text-[11px]">
            {d.icon && <span className="text-secondary shrink-0">{d.icon}</span>}
            <span className="font-bold text-on-surface-variant w-20 shrink-0">{d.label}</span>
            <span className="text-on-surface font-medium">{d.value}</span>
          </div>
        ))}
        {details.length === 0 && (
          <p className="text-[11px] text-outline italic">No additional details available</p>
        )}
      </div>
    </div>
  );
}

function SearchResultCard({ guest }: { key?: React.Key; guest: Guest }) {
  const arrDt = guest.arrivalDateTime ? new Date(guest.arrivalDateTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : null;
  const depDt = guest.departureDateTime ? new Date(guest.departureDateTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-on-surface">{guest.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {guest.groupName && <span className="text-[10px] text-outline">{guest.groupName}</span>}
            <Badge variant="default" className="text-[7px] px-1.5 py-0 uppercase">{guest.familySide}</Badge>
            <Badge variant={guest.inviteStatus === 'Confirmed' ? 'success' : 'default'} className="text-[7px] px-1.5 py-0 uppercase">{guest.inviteStatus}</Badge>
          </div>
        </div>
        {guest.phone && (
          <span className="text-[10px] text-outline flex items-center gap-1"><Phone size={10} /> {guest.phone}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50/80 rounded-lg p-2">
          <p className="text-[8px] font-black text-emerald-700 uppercase tracking-widest mb-1">Arrival</p>
          {arrDt ? (
            <div className="space-y-0.5 text-[10px]">
              <p className="font-bold text-emerald-900">{arrDt}</p>
              {guest.arrivalMode && <p className="text-emerald-700 flex items-center gap-1"><ModeIcon mode={guest.arrivalMode} /> {guest.arrivalMode}</p>}
              {guest.arrivalTrainName && <p className="text-emerald-700">{guest.arrivalTrainName}{guest.arrivalTrainNumber ? ` (${guest.arrivalTrainNumber})` : ''}</p>}
              {(guest.arrivalCoach || guest.arrivalSeat) && <p className="text-emerald-700">Coach {guest.arrivalCoach}{guest.arrivalSeat ? ` / Seat ${guest.arrivalSeat}` : ''}</p>}
              {guest.arrivalFlightNumber && <p className="text-emerald-700">Flight {guest.arrivalFlightNumber}</p>}
              {guest.travelDetails && <p className="text-emerald-600 italic">{guest.travelDetails}</p>}
            </div>
          ) : <p className="text-[10px] text-emerald-400 italic">{guest.isLocal ? 'Local guest' : 'Not set'}</p>}
        </div>
        <div className="bg-amber-50/80 rounded-lg p-2">
          <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest mb-1">Departure</p>
          {depDt ? (
            <div className="space-y-0.5 text-[10px]">
              <p className="font-bold text-amber-900">{depDt}</p>
              {guest.departureMode && <p className="text-amber-700 flex items-center gap-1"><ModeIcon mode={guest.departureMode} /> {guest.departureMode}</p>}
              {guest.departureTrainName && <p className="text-amber-700">{guest.departureTrainName}{guest.departureTrainNumber ? ` (${guest.departureTrainNumber})` : ''}</p>}
              {(guest.departureCoach || guest.departureSeat) && <p className="text-amber-700">Coach {guest.departureCoach}{guest.departureSeat ? ` / Seat ${guest.departureSeat}` : ''}</p>}
              {guest.departureFlightNumber && <p className="text-amber-700">Flight {guest.departureFlightNumber}</p>}
              {guest.departureDetails && <p className="text-amber-600 italic">{guest.departureDetails}</p>}
            </div>
          ) : <p className="text-[10px] text-amber-400 italic">{guest.isLocal ? 'Local guest' : 'Not set'}</p>}
        </div>
      </div>
      {guest.hotelName && (
        <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold">
          <BedDouble size={12} className="text-secondary" /> {guest.hotelName}{guest.roomNumber ? ` · Room ${guest.roomNumber}` : ''}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { showToast } = useToast();
  const [counts, setCounts] = useState({ guests: 0, checkins: 0 });
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [expandedGuests, setExpandedGuests] = useState<Set<string>>(new Set());
  const [globalSearch, setGlobalSearch] = useState('');

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const toggleGuest = (id: string) =>
    setExpandedGuests(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const expandAllGuests = (ids: string[]) => setExpandedGuests(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
  const collapseAllGuests = (ids: string[]) => setExpandedGuests(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'config', 'event'), (snap) => {
      if (snap.exists()) setEventConfig(snap.data() as EventConfig);
    }, (error) => console.warn('Config listener failed:', error.message));

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      const gList = snap.docs.map(d => d.data() as Guest);
      setGuests(gList);
      setCounts({
        guests: gList.length,
        checkins: gList.filter(g => g.status === GuestStatus.CHECKED_IN).length,
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'guests'));

    const unsubItinerary = onSnapshot(collection(db, 'itinerary'), (snap) => {
      setItinerary(snap.docs.map(d => d.data() as ItineraryItem).sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'itinerary'));

    return () => { unsubConfig(); unsubGuests(); unsubItinerary(); };
  }, []);

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const startTimeStr = formData.get('startTime') as string;
    const endTimeStr = formData.get('endTime') as string;
    const newItem: Record<string, string> = {
      id,
      title: formData.get('title') as string,
      venue: formData.get('venue') as string,
      startTime: `${selectedDate}T${startTimeStr.replace('.', ':')}:00`,
    };
    const desc = (formData.get('description') as string)?.trim();
    const cat = formData.get('category') as string;
    if (desc) newItem.description = desc;
    if (cat) newItem.category = cat;
    if (endTimeStr) newItem.endTime = `${selectedDate}T${endTimeStr.replace('.', ':')}:00`;
    try {
      await setDoc(doc(db, 'itinerary', id), newItem);
      setIsAddingEvent(false);
      showToast('Event added to itinerary');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `itinerary/${id}`);
      showToast('Failed to save event — check your connection and try again', 'error');
    }
  };

  const filteredArrivals = guests.filter(g => g.arrivalDateTime?.startsWith(selectedDate));
  const filteredDepartures = guests.filter(g => g.departureDateTime?.startsWith(selectedDate));
  const filteredItinerary = itinerary.filter(item => item.startTime.startsWith(selectedDate));

  const searchResults = globalSearch.trim().length >= 2
    ? guests.filter(g => {
        const q = globalSearch.toLowerCase();
        return g.name.toLowerCase().includes(q)
          || g.phone?.toLowerCase().includes(q)
          || g.groupName?.toLowerCase().includes(q)
          || g.hotelName?.toLowerCase().includes(q)
          || g.roomNumber?.toLowerCase().includes(q);
      })
    : [];

  const dateLabel = isToday ? 'Today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  const handleExportPdf = () => {
    const scheduleRows = filteredItinerary.map((item, i) => [
      String(i + 1),
      new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      item.endTime ? new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
      item.title,
      item.venue,
      item.category ?? '',
    ]);
    const arrivalRows = filteredArrivals.map((g, i) => [
      String(i + 1),
      g.name,
      g.groupName ?? '',
      g.arrivalDateTime ? new Date(g.arrivalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
      g.arrivalMode ?? '',
    ]);
    const departureRows = filteredDepartures.map((g, i) => [
      String(i + 1),
      g.name,
      g.groupName ?? '',
      g.departureDateTime ? new Date(g.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
      g.departureMode ?? '',
    ]);

    const allRows = [
      ...scheduleRows.map(r => ['SCHEDULE', ...r]),
      ...arrivalRows.map(r => ['ARRIVALS', ...r]),
      ...departureRows.map(r => ['DEPARTURES', ...r]),
    ];

    exportToPdf({
      title: `Day Brief — ${dateLabel}`,
      subtitle: `${filteredItinerary.length} events · ${filteredArrivals.length} arrivals · ${filteredDepartures.length} departures`,
      stats: [
        { label: 'Events', value: filteredItinerary.length },
        { label: 'Arrivals', value: filteredArrivals.length },
        { label: 'Departures', value: filteredDepartures.length },
      ],
      columns: [
        { header: 'Section', width: '80px' },
        { header: '#', width: '30px', align: 'center' },
        { header: 'Time' },
        { header: 'End / Group' },
        { header: 'Title / Name' },
        { header: 'Venue / Mode' },
        { header: 'Category' },
      ],
      rows: allRows,
    });
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Event Branding */}
      {eventConfig && (
        <div className="bg-primary/5 border-l-4 border-primary px-6 py-5 rounded-r-xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-[10px] font-black text-secondary tracking-[0.3em] uppercase opacity-70 mb-1">The Union Of</p>
            <h1 className="text-3xl md:text-5xl font-display font-bold text-primary tracking-tighter">
              {eventConfig.brideName} <span className="text-secondary">&</span> {eventConfig.groomName}
            </h1>
          </div>
          <div className="shrink-0">
            <span className="px-5 py-2 bg-secondary text-white text-sm font-bold tracking-widest rounded-full shadow">
              {eventConfig.hashtag}
            </span>
          </div>
        </div>
      )}

      {/* Date selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="relative z-30 p-2.5 rounded-xl border border-outline-variant bg-white hover:bg-primary-container hover:border-primary transition-all shadow-sm"
            title="Previous day"
          >
            <ChevronLeft size={16} className="text-primary" />
          </button>
          <div className="relative group overflow-hidden">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full h-full scale-150 origin-center"
              title="Select Date"
            />
            <div className={cn(
              'px-6 py-3 rounded-2xl text-xs font-black transition-all border uppercase tracking-widest flex items-center gap-2 bg-white shadow-sm pointer-events-none',
              isToday ? 'border-secondary text-secondary' : 'border-outline-variant text-primary'
            )}>
              <Calendar size={16} />
              {isToday ? 'Today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}
              <ChevronDown size={14} className="opacity-40" />
            </div>
          </div>
          <button
            onClick={() => shiftDate(1)}
            className="relative z-30 p-2.5 rounded-xl border border-outline-variant bg-white hover:bg-primary-container hover:border-primary transition-all shadow-sm"
            title="Next day"
          >
            <ChevronRight size={16} className="text-primary" />
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="text-[10px] font-black text-outline uppercase tracking-widest hover:text-primary transition-colors ml-1">
              Reset to Today
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold border border-primary text-primary rounded-full hover:bg-primary/5 transition-all"
          >
            <FileDown size={14} /> Export PDF
          </button>
          <Button onClick={() => setIsAddingEvent(true)} className="rounded-full flex items-center gap-2 shadow-sm">
            <Plus size={16} />
            Add Event
          </Button>
        </div>
      </div>

      {/* Global Search */}
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Search any guest by name, phone, group, or hotel..."
            className="w-full pl-11 pr-10 py-3 rounded-2xl border-2 border-outline-variant/50 bg-white text-sm focus:border-secondary outline-none transition-colors"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-container rounded-full">
              <X size={14} className="text-outline" />
            </button>
          )}
        </div>
        {searchResults.length > 0 && (
          <Card padded={false} className="absolute z-30 left-0 right-0 mt-2 shadow-2xl max-h-[70vh] overflow-y-auto border-2 border-secondary/20">
            <div className="px-4 py-2 bg-secondary/5 border-b border-outline-variant/30">
              <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {searchResults.map(g => <SearchResultCard key={g.id} guest={g} />)}
            </div>
          </Card>
        )}
        {globalSearch.trim().length >= 2 && searchResults.length === 0 && (
          <Card className="absolute z-30 left-0 right-0 mt-2 shadow-2xl text-center py-6">
            <p className="text-sm text-on-surface-variant italic">No guests found for "{globalSearch}"</p>
          </Card>
        )}
      </div>

      {/* Day stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Arrivals</span>
            <PlaneLanding size={15} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-display font-bold text-emerald-900">{filteredArrivals.length}</p>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Departures</span>
            <Plane size={15} className="text-amber-500" />
          </div>
          <p className="text-3xl font-display font-bold text-amber-900">{filteredDepartures.length}</p>
        </Card>
        <Card className="bg-violet-50 border-violet-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Functions</span>
            <CalendarCheck size={15} className="text-violet-500" />
          </div>
          <p className="text-3xl font-display font-bold text-violet-900">{filteredItinerary.length}</p>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Schedule */}
        <div className="lg:col-span-8 space-y-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} className="text-secondary" /> Daily Schedule
          </h3>

          {filteredItinerary.length > 0 ? (
            filteredItinerary.map((item) => (
              <Card key={item.id} className="relative overflow-hidden border-l-4 border-l-secondary" padded={false}>
                <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="min-w-[90px]">
                    <p className="text-base font-black text-primary">
                      {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                    <p className="text-[10px] font-bold text-outline uppercase">
                      {item.endTime ? `to ${new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-on-surface">{item.title}</h4>
                      {item.category && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-secondary/10 text-secondary border border-secondary/20">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-sm text-on-surface-variant mb-1">{item.description}</p>}
                    <div className="flex items-center gap-1 text-[10px] font-bold text-secondary">
                      <MapPin size={11} /> {item.venue}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="flex flex-col items-center justify-center py-10 border-dashed border-2 border-outline-variant/30">
              <Calendar className="text-outline-variant mb-3" size={28} />
              <p className="text-on-surface-variant font-medium text-sm">No functions scheduled for this date.</p>
            </Card>
          )}

          {/* Arrivals & Departures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {[
              { label: 'Guest Arrivals', guests: filteredArrivals, direction: 'arrival' as const, emptyMsg: 'No arrivals today', timeColor: 'text-secondary' },
              { label: 'Guest Departures', guests: filteredDepartures, direction: 'departure' as const, emptyMsg: 'No departures today', timeColor: 'text-primary' },
            ].map(({ label, guests: gList, direction, emptyMsg, timeColor }) => {
              const allIds = gList.map(g => g.id);
              const allExpanded = allIds.length > 0 && allIds.every(id => expandedGuests.has(id));
              return (
              <div key={label} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">{label}</h4>
                  {gList.length > 0 && (
                    <button
                      onClick={() => allExpanded ? collapseAllGuests(allIds) : expandAllGuests(allIds)}
                      className="flex items-center gap-1 text-[9px] font-bold text-outline hover:text-primary transition-colors uppercase tracking-wider"
                    >
                      {allExpanded ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
                      {allExpanded ? 'Collapse' : 'Expand'} All
                    </button>
                  )}
                </div>
                <Card padded={false}>
                  {gList.length > 0 ? (
                    <div className="divide-y divide-outline-variant/30">
                      {gList.map(guest => {
                        const isOpen = expandedGuests.has(guest.id);
                        const dt = direction === 'arrival' ? guest.arrivalDateTime : guest.departureDateTime;
                        const mode = direction === 'arrival' ? guest.arrivalMode : guest.departureMode;
                        return (
                        <div key={guest.id}>
                          <div
                            className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-container/50 transition-colors"
                            onClick={() => toggleGuest(guest.id)}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown size={14} className={cn('text-outline transition-transform', isOpen && 'rotate-180')} />
                              <div>
                                <p className="text-sm font-bold text-on-surface">{guest.name}</p>
                                {guest.groupName && <p className="text-[10px] text-outline">{guest.groupName}</p>}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn('text-xs font-black', timeColor)}>
                                {dt ? new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                              </p>
                              {mode && <p className="text-[9px] text-outline uppercase">{mode}</p>}
                            </div>
                          </div>
                          {isOpen && <GuestDetailPanel guest={guest} direction={direction} />}
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="p-6 text-center text-sm text-on-surface-variant italic">{emptyMsg}</p>
                  )}
                </Card>
              </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">Overall Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col items-center justify-center py-6">
              <Users size={18} className="text-primary mb-2" />
              <span className="text-2xl font-display font-bold text-primary">{counts.guests}</span>
              <span className="text-[8px] font-black text-outline uppercase tracking-widest">Total Guests</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-6">
              <UserCheck size={18} className="text-secondary mb-2" />
              <span className="text-2xl font-display font-bold text-secondary">{counts.checkins}</span>
              <span className="text-[8px] font-black text-outline uppercase tracking-widest">Checked In</span>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {isAddingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" onClick={() => setIsAddingEvent(false)} />
          <Card className="relative w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200" padded={false}>
            <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-primary/5">
              <div>
                <h3 className="text-xl font-display font-bold text-primary">New Event</h3>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button onClick={() => setIsAddingEvent(false)} className="p-2 hover:bg-surface-container rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest">Title</label>
                <input name="title" required
                  className="w-full p-3 border border-outline-variant rounded-xl bg-white text-sm focus:border-secondary outline-none"
                  placeholder="e.g. Sangeet Ceremony" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest">Start Time</label>
                  <input name="startTime" required
                    className="w-full p-3 border border-outline-variant rounded-xl bg-white text-sm focus:border-secondary outline-none"
                    placeholder="19.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest">End Time</label>
                  <input name="endTime"
                    className="w-full p-3 border border-outline-variant rounded-xl bg-white text-sm focus:border-secondary outline-none"
                    placeholder="23.30 (optional)" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest">Venue</label>
                <input name="venue" required
                  className="w-full p-3 border border-outline-variant rounded-xl bg-white text-sm focus:border-secondary outline-none"
                  placeholder="e.g. Grand Ballroom" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest">Description</label>
                  <input name="description"
                    className="w-full p-3 border border-outline-variant rounded-xl bg-white text-sm focus:border-secondary outline-none"
                    placeholder="Optional details" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest">Category</label>
                  <select name="category"
                    className="w-full p-3 border border-outline-variant rounded-xl bg-white text-sm focus:border-secondary outline-none">
                    <option>Function</option>
                    <option>Ritual</option>
                    <option>Meal</option>
                    <option>Logistics</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full py-3 rounded-xl font-bold shadow-lg mt-2">
                Save to Itinerary
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
