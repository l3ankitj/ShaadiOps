/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Calendar, PlaneLanding, CalendarCheck, Plane, Clock, MapPin, ChevronDown, Plus, X } from 'lucide-react';
import { Card, Button } from '../components/UIComponents';
import { cn } from '../lib/utils';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Guest, Room, GuestStatus, RoomStatus, EventConfig, ItineraryItem } from '../types';

export default function Dashboard() {
  const [counts, setCounts] = useState({ guests: 0, checkins: 0, emptyRooms: 0 });
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'config', 'event'), (snap) => {
      if (snap.exists()) setEventConfig(snap.data() as EventConfig);
    }, (error) => console.warn('Config listener failed:', error.message));

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      const gList = snap.docs.map(d => d.data() as Guest);
      setGuests(gList);
      setCounts(prev => ({
        ...prev,
        guests: gList.length,
        checkins: gList.filter(g => g.status === GuestStatus.CHECKED_IN).length,
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'guests'));

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      const rooms = snap.docs.map(d => d.data() as Room);
      setCounts(prev => ({ ...prev, emptyRooms: rooms.filter(r => r.status === RoomStatus.EMPTY).length }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rooms'));

    const unsubItinerary = onSnapshot(collection(db, 'itinerary'), (snap) => {
      setItinerary(snap.docs.map(d => d.data() as ItineraryItem).sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'itinerary'));

    return () => { unsubConfig(); unsubGuests(); unsubRooms(); unsubItinerary(); };
  }, []);

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const startTimeStr = formData.get('startTime') as string;
    const endTimeStr = formData.get('endTime') as string;
    const newItem: ItineraryItem = {
      id,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      venue: formData.get('venue') as string,
      category: formData.get('category') as string,
      startTime: `${selectedDate}T${startTimeStr.replace('.', ':')}:00`,
      endTime: endTimeStr ? `${selectedDate}T${endTimeStr.replace('.', ':')}:00` : undefined,
    };
    try {
      await setDoc(doc(db, 'itinerary', id), newItem);
      setIsAddingEvent(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `itinerary/${id}`);
    }
  };

  const filteredArrivals = guests.filter(g => g.arrivalDateTime?.startsWith(selectedDate));
  const filteredDepartures = guests.filter(g => g.departureDateTime?.startsWith(selectedDate));
  const filteredItinerary = itinerary.filter(item => item.startTime.startsWith(selectedDate));

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
        <div className="flex items-center gap-3">
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
          {!isToday && (
            <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="text-[10px] font-black text-outline uppercase tracking-widest hover:text-primary transition-colors">
              Reset to Today
            </button>
          )}
        </div>
        <Button onClick={() => setIsAddingEvent(true)} className="rounded-full flex items-center gap-2 shadow-sm">
          <Plus size={16} />
          Add Event
        </Button>
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
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Guest Arrivals</h4>
              <Card padded={false}>
                {filteredArrivals.length > 0 ? (
                  <div className="divide-y divide-outline-variant/30">
                    {filteredArrivals.map(guest => (
                      <div key={guest.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{guest.name}</p>
                          {guest.groupName && <p className="text-[10px] text-outline">{guest.groupName}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-secondary">
                            {guest.arrivalDateTime
                              ? new Date(guest.arrivalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                              : '—'}
                          </p>
                          {guest.arrivalMode && <p className="text-[9px] text-outline uppercase">{guest.arrivalMode}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-6 text-center text-sm text-on-surface-variant italic">No arrivals today</p>
                )}
              </Card>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Guest Departures</h4>
              <Card padded={false}>
                {filteredDepartures.length > 0 ? (
                  <div className="divide-y divide-outline-variant/30">
                    {filteredDepartures.map(guest => (
                      <div key={guest.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{guest.name}</p>
                          {guest.groupName && <p className="text-[10px] text-outline">{guest.groupName}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-primary">
                            {guest.departureDateTime
                              ? new Date(guest.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                              : '—'}
                          </p>
                          {guest.departureMode && <p className="text-[9px] text-outline uppercase">{guest.departureMode}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-6 text-center text-sm text-on-surface-variant italic">No departures today</p>
                )}
              </Card>
            </div>
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
                  {new Date(selectedDate).toLocaleDateString([], { day: 'numeric', month: 'long' })}
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
