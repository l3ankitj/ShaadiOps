/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Car, User, Phone, MessageSquare, PlaneLanding, Plus, X, Search } from 'lucide-react';
import { Card, Badge, Button } from '../components/UIComponents';
import { Vehicle, VehicleStatus, Guest, GuestStatus } from '../types';
import { cn } from '../lib/utils';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export default function TransportDesk() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(d => d.data() as Vehicle));
      setLoading(false);
    });

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      setGuests(snap.docs.map(d => d.data() as Guest));
    });

    return () => {
      unsubVehicles();
      unsubGuests();
    };
  }, []);

  const handleUpdateStatus = async (guestId: string, newStatus: GuestStatus) => {
    try {
      await updateDoc(doc(db, 'guests', guestId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `guests/${guestId}`);
    }
  };

  const getStatusColor = (status: VehicleStatus) => {
    switch (status) {
      case VehicleStatus.IN_TRANSIT: return 'bg-red-500';
      case VehicleStatus.ACTIVE: return 'bg-emerald-500';
      case VehicleStatus.AT_HOTEL: return 'bg-gray-400';
      case VehicleStatus.DELAYED: return 'bg-red-600';
      default: return 'bg-gray-400';
    }
  };

  const handleAddVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = `V${Date.now()}`;
    const newVehicle: Vehicle = {
      id,
      type: formData.get('type') as string,
      plate: formData.get('plate') as string,
      driver: formData.get('driver') as string,
      phone: formData.get('phone') as string,
      status: VehicleStatus.AT_HOTEL,
      category: formData.get('category') as string,
    };

    try {
      await setDoc(doc(db, 'vehicles', id), newVehicle);
      setIsAddingVehicle(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `vehicles/${id}`);
    }
  };

  const travelerQueue = guests
    .filter(g => (g.status === GuestStatus.PENDING || g.status === GuestStatus.IN_TRANSIT))
    .filter(g => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      const nameMatch = g.name.toLowerCase().includes(s);
      const membersMatch = g.memberNames?.some(m => m.toLowerCase().includes(s));
      return nameMatch || membersMatch;
    })
    .sort((a, b) => {
      const timeA = a.arrivalDateTime ? new Date(a.arrivalDateTime).getTime() : Infinity;
      const timeB = b.arrivalDateTime ? new Date(b.arrivalDateTime).getTime() : Infinity;
      return timeA - timeB;
    });

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <h2 className="text-3xl md:text-5xl font-display font-bold text-primary">Transport Desk</h2>
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input 
              type="text" 
              placeholder="Search guest in queue..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-outline-variant rounded-2xl bg-white shadow-sm focus:border-secondary outline-none text-sm font-medium transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-surface-container rounded-full text-outline"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-center px-8 border-r border-outline-variant">
            <span className="text-3xl font-display font-bold text-primary">{vehicles.length}</span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Vehicles</span>
          </div>
          <div className="flex flex-col items-center px-8 border-r border-outline-variant">
            <span className="text-3xl font-display font-bold text-secondary">
              {vehicles.filter(v => v.status === VehicleStatus.ACTIVE || v.status === VehicleStatus.IN_TRANSIT).length}
            </span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Active</span>
          </div>
          <div className="flex flex-col items-center px-8">
            <span className="text-3xl font-display font-bold text-tertiary">{travelerQueue.length}</span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Queue</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Fleet Console */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <Card padded={false} className="overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
              <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Fleet Management Console</h3>
              <div className="flex gap-2">
                <Button variant="primary" className="h-8 text-[10px]" onClick={() => setIsAddingVehicle(true)}>Add Vehicle</Button>
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                   <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant font-medium">
                  No vehicles registered in the fleet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="p-5 border border-outline-variant rounded-xl hover:shadow-lg transition-all group relative overflow-hidden bg-white">
                      <div className="absolute top-0 right-0 p-3">
                        <Badge variant="primary" className="text-[8px] bg-primary/5 text-primary border-primary/20">
                          {vehicle.category}
                        </Badge>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-surface-container rounded-lg flex items-center justify-center text-primary shrink-0">
                          <Car size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-md font-bold text-primary truncate leading-tight">{vehicle.type}</h4>
                          <p className="text-xs font-bold text-on-surface-variant mb-3 opacity-60 uppercase tracking-widest">{vehicle.plate}</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <User size={12} className="text-secondary" />
                              <span className="text-xs font-bold text-primary">{vehicle.driver}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone size={12} className="text-secondary" />
                              <span className="text-xs font-medium text-on-surface-variant">{vehicle.phone}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 pt-4 border-t border-outline-variant flex justify-between items-center">
                        <div className="flex gap-2">
                          <button className="p-2 border border-secondary text-secondary rounded-lg hover:bg-secondary-container transition-all">
                            <MessageSquare size={16} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(vehicle.status), vehicle.status === VehicleStatus.IN_TRANSIT || vehicle.status === VehicleStatus.DELAYED ? "animate-pulse" : "")} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{vehicle.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Traveler Queue */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white border border-secondary/20 rounded-xl overflow-hidden h-full flex flex-col shadow-sm">
            <div className="px-6 py-8 border-b border-outline-variant bg-surface-container-low/50">
              <h3 className="text-2xl font-display font-bold text-primary">Traveler Queue</h3>
              <p className="text-xs font-medium text-on-surface-variant opacity-70 mt-1">Pending arrivals needing transport</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {travelerQueue.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant text-xs font-medium italic">
                  No active arrivals in queue.
                </div>
              ) : (
                travelerQueue.map((item) => (
                  <div key={item.id} className="p-4 bg-surface-container-lowest border border-outline-variant rounded-lg hover:border-secondary transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="text-sm font-bold text-on-surface">{item.name} ({item.headcount})</h5>
                      <span className="text-[8px] font-bold text-tertiary-container bg-tertiary-container/10 px-2 py-0.5 rounded border border-tertiary/20 uppercase tracking-widest">{item.familySide}</span>
                    </div>
                    <div className="flex flex-col gap-1 mb-4">
                      <div className="flex items-center gap-2">
                        <PlaneLanding size={12} className="text-secondary" />
                        <span className="text-xs font-bold text-primary">{item.travelDetails}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                          {item.arrivalDateTime ? new Date(item.arrivalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'TBD'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleUpdateStatus(item.id, GuestStatus.IN_TRANSIT)}
                        className="flex-1 bg-primary-container text-on-primary-container py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all transform active:scale-[0.98]"
                      >Assign Driver</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {isAddingVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in" onClick={() => setIsAddingVehicle(false)} />
          <Card className="relative w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200" padded={false}>
            <form onSubmit={handleAddVehicle}>
              <div className="bg-primary text-on-primary px-6 py-6 border-b border-outline-variant flex justify-between items-center">
                <h3 className="text-xl font-bold font-display">Add Fleet Vehicle</h3>
                <button type="button" onClick={() => setIsAddingVehicle(false)} className="hover:bg-white/10 p-2 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Vehicle Type</label>
                    <input name="type" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" placeholder="Toyota Innova" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Plate Number</label>
                    <input name="plate" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" placeholder="DL 01 XX 0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Driver Name</label>
                    <input name="driver" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Driver Phone</label>
                    <input name="phone" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Category</label>
                  <select name="category" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all">
                    <option>Airport Pickup</option>
                    <option>Venue Shuttle</option>
                    <option>VIP Arrival</option>
                    <option>Emergency/Misc</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsAddingVehicle(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Add to Fleet</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* FAB */}
      <button 
        onClick={() => setIsAddingVehicle(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-secondary text-on-secondary rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all z-50"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

