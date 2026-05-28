/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Car, User, Phone, Plus, X } from 'lucide-react';
import { Card, Badge, Button } from '../components/UIComponents';
import { Vehicle, VehicleStatus } from '../types';
import { cn } from '../lib/utils';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export default function TransportDesk() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(d => d.data() as Vehicle));
      setLoading(false);
    });

    return () => {
      unsubVehicles();
    };
  }, []);

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

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-primary">Transport Desk</h2>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-center px-8 border-r border-outline-variant">
            <span className="text-3xl font-display font-bold text-primary">{vehicles.length}</span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Vehicles</span>
          </div>
          <div className="flex flex-col items-center px-8">
            <span className="text-3xl font-display font-bold text-secondary">
              {vehicles.filter(v => v.status === VehicleStatus.ACTIVE || v.status === VehicleStatus.IN_TRANSIT).length}
            </span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Fleet Console */}
        <div className="col-span-12 space-y-8">
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
                          <a
                            href={`https://wa.me/${vehicle.phone.replace(/[\s\-+() ]/g, '')}?text=Hi, regarding transport for the wedding`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 border border-emerald-500 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-all flex items-center justify-center"
                            title="WhatsApp"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
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

