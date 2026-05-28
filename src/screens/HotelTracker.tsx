/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Building2, PlusCircle, Lock, Wrench, X, Search, UserPlus, Layers, Users, Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, LogOut, Trash2, UserMinus, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Badge, Button } from '../components/UIComponents';
import { cn } from '../lib/utils';
import { Room, RoomStatus, Guest, GuestStatus, InviteStatus } from '../types';
import { collection, onSnapshot, doc, setDoc, writeBatch, deleteField, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useIsReadOnly } from '../contexts/AccessContext';
import { useEscapeKey } from '../lib/useEscapeKey';
import { downloadRoomTemplate, parseRoomExcel, ParsedRoomRow } from '../lib/roomExcel';

export default function HotelTracker() {
  const isReadOnly = useIsReadOnly();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [occupiedRoom, setOccupiedRoom] = useState<Room | null>(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);
  const [collapsedHotels, setCollapsedHotels] = useState<Set<string>>(new Set());
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set());
  const initialCollapsed = useRef(false);

  // Collapse all hotels and floors on first load
  useEffect(() => {
    if (loading || initialCollapsed.current || rooms.length === 0) return;
    initialCollapsed.current = true;
    const hotelSet = new Set(rooms.map(r => r.hotel));
    const floorSet = new Set(rooms.map(r => `${r.hotel}::${r.floor}`));
    setCollapsedHotels(hotelSet);
    setCollapsedFloors(floorSet);
  }, [loading, rooms]);

  useEscapeKey(() => {
    if (occupiedRoom) { setOccupiedRoom(null); return; }
    if (selectedRoom) { setSelectedRoom(null); setSelectedGuestIds([]); return; }
    if (isAddingRoom) { setIsAddingRoom(false); return; }
    if (importRows) handleCloseImport();
  });

  const toggleHotel = (hotel: string) =>
    setCollapsedHotels(prev => { const n = new Set(prev); n.has(hotel) ? n.delete(hotel) : n.add(hotel); return n; });

  const toggleFloor = (key: string) =>
    setCollapsedFloors(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ParsedRoomRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 5000);

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      clearTimeout(fallback);
      setRooms(snap.docs.map(d => d.data() as Room));
      setLoading(false);
    }, (error) => {
      clearTimeout(fallback);
      handleFirestoreError(error, OperationType.LIST, 'rooms');
      setLoading(false);
    });

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      setGuests(snap.docs.map(d => d.data() as Guest));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'guests');
    });

    return () => {
      clearTimeout(fallback);
      unsubRooms();
      unsubGuests();
    };
  }, []);

  const getStatusColor = (status: RoomStatus) => {
    switch (status) {
      case RoomStatus.OCCUPIED: return 'border-l-red-600';
      case RoomStatus.EMPTY: return 'border-l-emerald-600';
      case RoomStatus.CLEANING: return 'border-l-secondary';
      case RoomStatus.MAINTENANCE: return 'border-l-secondary';
      default: return 'border-l-gray-400';
    }
  };

  const getBadgeVariant = (status: RoomStatus) => {
    switch (status) {
      case RoomStatus.OCCUPIED: return 'error';
      case RoomStatus.EMPTY: return 'success';
      case RoomStatus.CLEANING: return 'secondary';
      default: return 'default';
    }
  };

  const handleAssignGuests = async () => {
    if (!selectedRoom || selectedGuestIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'rooms', selectedRoom.id), { status: RoomStatus.OCCUPIED });
      for (const guestId of selectedGuestIds) {
        batch.update(doc(db, 'guests', guestId), {
          status: GuestStatus.CHECKED_IN,
          inviteStatus: InviteStatus.CONFIRMED,
          roomId: selectedRoom.id,
          roomNumber: selectedRoom.number,
          hotelName: selectedRoom.hotel,
        });
      }
      await batch.commit();
      setSelectedRoom(null);
      setSelectedGuestIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${selectedRoom.id}`);
    }
  };

  const handleReleaseRoom = async (room: Room) => {
    try {
      const batch = writeBatch(db);
      const roomGuests = guestsByRoom.get(room.id) || [];
      for (const guest of roomGuests) {
        batch.update(doc(db, 'guests', guest.id), {
          status: GuestStatus.CHECKED_OUT,
          roomId: deleteField(),
          roomNumber: deleteField(),
          hotelName: deleteField(),
        });
      }
      batch.update(doc(db, 'rooms', room.id), { status: RoomStatus.EMPTY });
      await batch.commit();
      setOccupiedRoom(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${room.id}`);
    }
  };

  const handleDeleteRoom = async (room: Room) => {
    try {
      const batch = writeBatch(db);
      const roomGuests = guestsByRoom.get(room.id) || [];
      for (const guest of roomGuests) {
        batch.update(doc(db, 'guests', guest.id), {
          roomId: deleteField(),
          roomNumber: deleteField(),
          hotelName: deleteField(),
          status: GuestStatus.PENDING,   // no longer checked in if room is deleted
        });
      }
      batch.delete(doc(db, 'rooms', room.id));
      await batch.commit();
      setConfirmDeleteRoomId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `rooms/${room.id}`);
    }
  };

  const handleUnassignGuest = async (guest: Guest, room: Room) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'guests', guest.id), {
        roomId: deleteField(),
        roomNumber: deleteField(),
        hotelName: deleteField(),
        status: GuestStatus.PENDING,   // no longer checked in if removed from room
      });
      const remainingGuests = (guestsByRoom.get(room.id) || []).filter(g => g.id !== guest.id);
      if (remainingGuests.length === 0) {
        batch.update(doc(db, 'rooms', room.id), { status: RoomStatus.EMPTY });
        setOccupiedRoom(null);
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `guests/${guest.id}`);
    }
  };

  const toggleGuestSelection = (guestId: string) => {
    setSelectedGuestIds(prev =>
      prev.includes(guestId) ? prev.filter(id => id !== guestId) : [...prev, guestId]
    );
  };

  const handleAddRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = `R${Date.now()}`;
    const newRoom: Room = {
      id,
      number: formData.get('number') as string,
      hotel: formData.get('hotel') as string,
      floor: formData.get('floor') as string,
      category: formData.get('category') as string,
      capacity: Number(formData.get('capacity')),
      status: RoomStatus.EMPTY,
    };

    try {
      await setDoc(doc(db, 'rooms', id), newRoom);
      setIsAddingRoom(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${id}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setParseError(null);
    setImportDone(false);
    setImportCount(0);
    try {
      const result = await parseRoomExcel(file);
      if (result.rows.length === 0) {
        setParseError("No valid room rows found. Make sure you're using the provided template.");
        return;
      }
      setImportRows(result.rows);
    } catch {
      setParseError('Could not read the file. Please use a valid .xlsx or .xls file.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importRows) return;
    setImporting(true);
    let saved = 0;
    for (const { room } of importRows) {
      try {
        await setDoc(doc(db, 'rooms', room.id), room);
        saved++;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `rooms/${room.id}`);
      }
    }
    setImporting(false);
    setImportDone(true);
    setImportCount(saved);
  };

  const handleCloseImport = () => {
    setImportRows(null);
    setImportDone(false);
    setImporting(false);
  };

  const guestsByRoom = new Map<string, Guest[]>();
  for (const guest of guests) {
    if (guest.roomId) {
      const list = guestsByRoom.get(guest.roomId) || [];
      list.push(guest);
      guestsByRoom.set(guest.roomId, list);
    }
  }

  const hotels: string[] = Array.from(new Set(rooms.map(r => r.hotel)));
  const unassignedGuests = guests.filter(g => !g.roomId && g.status !== GuestStatus.CHECKED_OUT);
  const filteredGuests = unassignedGuests.filter(g => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return g.name.toLowerCase().includes(s) || (g.groupName || '').toLowerCase().includes(s);
  });

  const stats = {
    total: rooms.length,
    occupied: rooms.filter(r => r.status === RoomStatus.OCCUPIED).length,
    empty: rooms.filter(r => r.status === RoomStatus.EMPTY).length
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import Modal */}
      {importRows && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={22} className="text-secondary" />
                <div>
                  <h2 className="text-sm font-bold text-primary uppercase tracking-widest">Import Preview</h2>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">
                    {importRows.length} rooms across {new Set(importRows.map(r => r.room.hotel)).size} hotel{new Set(importRows.map(r => r.room.hotel)).size > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {!importing && !importDone && (
                <button onClick={handleCloseImport} className="p-2 hover:bg-surface-container rounded-full text-outline">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {importDone ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <CheckCircle2 size={48} className="text-emerald-500" />
                  <p className="text-base font-bold text-primary">{importCount} rooms imported successfully!</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Hotel inventory has been updated</p>
                </div>
              ) : importing ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 size={40} className="text-primary animate-spin" />
                  <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Saving to database…</p>
                </div>
              ) : (
                <>
                  {importRows.filter(r => r.warnings.length > 0).length > 0 && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">
                        {importRows.filter(r => r.warnings.length > 0).length} row(s) have warnings — they will still import.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {importRows.map(({ room, rowIndex, warnings }) => (
                      <div
                        key={room.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg border',
                          warnings.length
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-surface-container-low border-outline-variant/40'
                        )}
                      >
                        <span className="text-[10px] font-mono text-outline w-6 flex-shrink-0">{rowIndex}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-primary truncate">{room.hotel} — Room {room.number}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {room.floor} · {room.category} · {room.capacity} pax
                          </p>
                          {warnings.length > 0 && (
                            <p className="text-[10px] text-amber-700 mt-0.5">⚠ {warnings.join(', ')}</p>
                          )}
                        </div>
                        <Badge
                          variant={room.status === RoomStatus.EMPTY ? 'success' : room.status === RoomStatus.OCCUPIED ? 'error' : 'default'}
                          className="text-[9px] flex-shrink-0"
                        >
                          {room.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {!importing && !importDone && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant">
                <Button variant="ghost" onClick={handleCloseImport}>Cancel</Button>
                <Button variant="primary" onClick={handleConfirmImport}>
                  <Upload size={14} />
                  Import {importRows.length} Rooms
                </Button>
              </div>
            )}
            {importDone && (
              <div className="flex justify-end px-6 py-4 border-t border-outline-variant">
                <Button variant="primary" onClick={handleCloseImport}>Done</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner */}
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-8 relative overflow-hidden bg-background border-secondary/20 shadow-xl" padded={true}>
        <div className="absolute right-0 top-0 opacity-10 h-full pointer-events-none">
          <div className="h-full w-40 bg-repeat opacity-20" style={{ backgroundImage: 'radial-gradient(#7a580f 0.5px, transparent 0.5px)', backgroundSize: '8px 8px' }} />
        </div>
        <div className="relative z-10 flex items-center justify-between w-full md:w-auto">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-primary">Hotel Tracker</h1>
            <div className="flex items-center gap-4 mt-1 md:hidden">
              <span className="text-[10px] font-bold text-on-surface-variant">{stats.total} rooms · {stats.occupied} occupied · {stats.empty} free</span>
            </div>
            <p className="hidden md:block text-on-surface-variant font-medium mt-1">Live Inventory & Allotment Manager</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch md:items-center z-10 w-full md:w-auto">
          <div className="hidden md:flex gap-12 items-center border-l border-outline-variant pl-12">
            <div className="text-center">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">TOTAL</span>
              <span className="text-xl font-bold text-primary">{stats.total}</span>
            </div>
            <div className="h-10 w-[1px] bg-outline-variant" />
            <div className="text-center">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">OCCUPIED</span>
              <span className="text-xl font-bold text-secondary">{stats.occupied}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <button
              onClick={downloadRoomTemplate}
              className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg border-2 border-secondary text-secondary hover:bg-secondary-container hover:text-on-secondary-container transition-all font-bold text-xs uppercase tracking-widest"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Excel Template</span>
            </button>
            {!isReadOnly && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg bg-secondary text-on-secondary hover:opacity-90 transition-all shadow-md font-bold text-xs uppercase tracking-widest"
                >
                  <Upload size={15} />
                  <span className="hidden sm:inline">Import Excel</span>
                </button>
                <Button variant="primary" onClick={() => setIsAddingRoom(true)}>
                  <PlusCircle size={18} />
                  <span className="hidden sm:inline">Add Room</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {parseError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">{parseError}</p>
          <button onClick={() => setParseError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : hotels.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-outline-variant/30">
          <Building2 size={48} className="mx-auto text-outline-variant mb-4" />
          <h3 className="text-xl font-bold text-primary">No Hotels Configured</h3>
          <p className="text-on-surface-variant mt-2 max-w-sm mx-auto">Start by adding rooms to your hotels using the "Manage Inventory" button.</p>
        </Card>
      ) : (
        hotels.map((hotel) => {
          const hotelRooms = rooms.filter(r => r.hotel === hotel);
          const floors = Array.from(new Set(hotelRooms.map(r => r.floor))).sort();
          const hotelCollapsed = collapsedHotels.has(hotel);
          const hotelOccupied = hotelRooms.filter(r => r.status === RoomStatus.OCCUPIED).length;

          return (
            <section key={hotel} className="space-y-3">
              {/* Hotel header — clickable */}
              <div
                className="flex items-center gap-3 cursor-pointer select-none group"
                onClick={() => toggleHotel(hotel)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-on-primary-container" />
                </div>
                <h2 className="text-lg font-display font-bold text-primary uppercase tracking-[0.1em]">{hotel}</h2>
                <div className="flex-1 h-[1px] bg-gradient-to-r from-outline-variant to-transparent opacity-50" />
                <span className="text-[10px] font-bold text-on-surface-variant shrink-0">
                  {hotelOccupied}/{hotelRooms.length} occupied
                </span>
                {hotelCollapsed
                  ? <ChevronRight size={16} className="text-outline shrink-0 group-hover:text-primary transition-colors" />
                  : <ChevronDown size={16} className="text-outline shrink-0 group-hover:text-primary transition-colors" />}
              </div>

              {!hotelCollapsed && (
              <div className="space-y-2 pl-4 border-l border-outline-variant/30">
                {floors.map(floor => {
                  const floorKey = `${hotel}::${floor}`;
                  const floorCollapsed = collapsedFloors.has(floorKey);
                  const floorRooms = hotelRooms.filter(r => r.floor === floor);
                  const floorOccupied = floorRooms.filter(r => r.status === RoomStatus.OCCUPIED).length;

                  return (
                  <div key={floor} className="space-y-3">
                    {/* Floor header — clickable */}
                    <div
                      className="flex items-center gap-2 cursor-pointer select-none group py-1"
                      onClick={() => toggleFloor(floorKey)}
                    >
                      <Layers size={13} className="text-on-surface-variant shrink-0" />
                      <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{floor}</h3>
                      <span className="text-[10px] text-outline">
                        {floorOccupied}/{floorRooms.length} occupied
                      </span>
                      <div className="flex-1 h-[1px] bg-outline-variant/30" />
                      {floorCollapsed
                        ? <ChevronRight size={13} className="text-outline shrink-0 group-hover:text-primary transition-colors" />
                        : <ChevronDown size={13} className="text-outline shrink-0 group-hover:text-primary transition-colors" />}
                    </div>

                    {!floorCollapsed && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                      {hotelRooms.filter(r => r.floor === floor).map((room) => {
                        const roomGuests = guestsByRoom.get(room.id) || [];
                        return (
                        <div
                          key={room.id}
                          className={cn(
                            "bg-white border border-primary/10 p-4 rounded-lg border-l-4 shadow-sm transition-all relative group",
                            getStatusColor(room.status),
                            confirmDeleteRoomId === room.id ? "ring-2 ring-red-400" : ""
                          )}
                        >
                          {confirmDeleteRoomId === room.id ? (
                            <div className="flex flex-col gap-2 h-full justify-center">
                              <p className="text-[9px] font-bold text-red-600 leading-tight">Delete room {room.number}?</p>
                              {roomGuests.length > 0 && (
                                <p className="text-[8px] text-outline leading-tight">{roomGuests.length} guest(s) will be unassigned.</p>
                              )}
                              <div className="flex gap-1 mt-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room); }}
                                  className="flex-1 text-[8px] font-bold bg-red-600 text-white rounded px-1 py-1 hover:bg-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoomId(null); }}
                                  className="flex-1 text-[8px] font-bold bg-surface-container-high text-primary rounded px-1 py-1 hover:bg-surface-container transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-start mb-1">
                                <span
                                  className={cn(
                                    "text-sm font-mono font-bold text-primary cursor-pointer",
                                    (room.status === RoomStatus.EMPTY || room.status === RoomStatus.OCCUPIED) && "hover:text-secondary"
                                  )}
                                  onClick={() => {
                                    if (room.status === RoomStatus.EMPTY && !isReadOnly) setSelectedRoom(room);
                                    else if (room.status === RoomStatus.OCCUPIED) setOccupiedRoom(room);
                                  }}
                                >
                                  {room.number}
                                </span>
                                <div className="flex items-center gap-1">
                                  {!isReadOnly && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoomId(room.id); }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-600 text-outline rounded"
                                      title="Delete room"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                  {room.status === RoomStatus.EMPTY ? (
                                    <PlusCircle size={14} className="text-primary group-hover:text-secondary cursor-pointer" onClick={() => setSelectedRoom(room)} />
                                  ) : room.status === RoomStatus.MAINTENANCE || room.status === RoomStatus.CLEANING ? (
                                    <Wrench size={14} className="text-on-surface-variant" />
                                  ) : (
                                    <Lock size={14} className="text-on-surface-variant opacity-40 group-hover:opacity-80 cursor-pointer" onClick={() => setOccupiedRoom(room)} />
                                  )}
                                </div>
                              </div>

                              <div
                                className="cursor-pointer"
                                onClick={() => {
                                  if (room.status === RoomStatus.EMPTY && !isReadOnly) setSelectedRoom(room);
                                  else if (room.status === RoomStatus.OCCUPIED) setOccupiedRoom(room);
                                }}
                              >
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Badge variant="default" className="text-[7px] px-1 py-0 bg-surface-container-high border-none uppercase tracking-tighter">
                                    {room.category}
                                  </Badge>
                                  <div className="flex items-center gap-0.5 text-[8px] font-bold text-on-surface-variant/70">
                                    <Users size={10} />
                                    {room.capacity}
                                  </div>
                                </div>

                                {roomGuests.length > 0 && (
                                  <div className="mb-2 space-y-0.5">
                                    {roomGuests.slice(0, 3).map(g => (
                                      <p key={g.id} className="text-[8px] text-primary font-bold truncate">{g.name}</p>
                                    ))}
                                    {roomGuests.length > 3 && (
                                      <p className="text-[8px] text-outline">+{roomGuests.length - 3} more</p>
                                    )}
                                  </div>
                                )}

                                <Badge
                                  variant={getBadgeVariant(room.status)}
                                  className="text-[8px] px-2 py-0.5 w-full justify-center"
                                >
                                  {room.status}
                                </Badge>
                              </div>
                            </>
                          )}
                        </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
              )}
            </section>
          );
        })
      )}

      {/* Manage Inventory Modal */}
      {isAddingRoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in" onClick={() => setIsAddingRoom(false)} />
          <Card className="relative w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200" padded={false}>
            <form onSubmit={handleAddRoom}>
              <div className="bg-primary text-on-primary px-6 py-6 border-b border-outline-variant flex justify-between items-center">
                <h3 className="text-xl font-bold font-display">Add Hotel Room</h3>
                <button type="button" onClick={() => setIsAddingRoom(false)} className="hover:bg-white/10 p-2 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Hotel Name</label>
                  <input name="hotel" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" placeholder="e.g. Taj Lake Palace" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Room Number</label>
                    <input name="number" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" placeholder="R-101" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Floor</label>
                    <input name="floor" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" placeholder="1st Floor" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Category</label>
                    <select name="category" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all">
                      <option>Deluxe</option>
                      <option>Semi-Deluxe</option>
                      <option>Suite</option>
                      <option>Superior</option>
                      <option>Standard</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Max Occupancy</label>
                    <input name="capacity" type="number" min="1" defaultValue="2" required className="w-full p-3 border border-outline-variant rounded bg-white text-sm focus:border-secondary transition-all" />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsAddingRoom(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Add Room</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Assignment Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in" onClick={() => { setSelectedRoom(null); setSelectedGuestIds([]); }} />
          <Card className="relative w-full max-w-lg shadow-2xl border-2 border-secondary/20 animate-in zoom-in-95 duration-200" padded={false}>
            <div className="bg-surface-container-low px-6 py-4 flex justify-between items-center border-b border-outline-variant">
              <div>
                <h3 className="text-lg font-bold text-primary font-display">Room {selectedRoom.number} — {selectedRoom.hotel}</h3>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">
                  {selectedRoom.category} · {selectedRoom.floor} · Capacity: {selectedRoom.capacity} PAX
                </p>
              </div>
              <button className="hover:bg-surface-container-high p-2 rounded-full transition-colors" onClick={() => { setSelectedRoom(null); setSelectedGuestIds([]); }}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Capacity indicator */}
              {selectedGuestIds.length > 0 && (
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-bold',
                  selectedGuestIds.length > selectedRoom.capacity
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                )}>
                  {selectedGuestIds.length > selectedRoom.capacity
                    ? <AlertTriangle size={16} />
                    : <CheckCircle2 size={16} />}
                  {selectedGuestIds.length} selected / {selectedRoom.capacity} capacity
                  {selectedGuestIds.length > selectedRoom.capacity && ' — over capacity, but will save'}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-primary mb-2 block uppercase tracking-widest">Search Guest</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface border border-outline-variant rounded px-10 py-3 focus:outline-none focus:border-secondary transition-colors text-sm font-medium"
                    placeholder="Name or group..."
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Guests Awaiting Allotment</label>
                  {selectedGuestIds.length > 0 && (
                    <button onClick={() => setSelectedGuestIds([])} className="text-[10px] text-outline hover:text-primary font-bold uppercase tracking-wider">
                      Clear selection
                    </button>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                  {filteredGuests.length === 0 ? (
                    <div className="text-center py-8 text-xs text-on-surface-variant font-medium">No matching unassigned guests.</div>
                  ) : (
                    filteredGuests.map(g => {
                      const isSelected = selectedGuestIds.includes(g.id);
                      return (
                        <div
                          key={g.id}
                          onClick={() => toggleGuestSelection(g.id)}
                          className={cn(
                            'flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'border-outline-variant hover:bg-surface-container-low'
                          )}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                            isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-outline-variant bg-white'
                          )}>
                            {isSelected && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-on-surface">{g.name}</p>
                            <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest opacity-70">
                              {g.groupName ? `${g.groupName} · ` : ''}{g.familySide}
                            </p>
                          </div>
                          <UserPlus size={16} className={cn('shrink-0 transition-colors', isSelected ? 'text-emerald-600' : 'text-outline/40')} />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface-container-low/30 border-t border-outline-variant flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setSelectedRoom(null); setSelectedGuestIds([]); }}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleAssignGuests}
                className={cn(selectedGuestIds.length === 0 && 'opacity-50 cursor-not-allowed')}
              >
                <UserPlus size={16} />
                Assign {selectedGuestIds.length > 0 ? `${selectedGuestIds.length} Guest${selectedGuestIds.length > 1 ? 's' : ''}` : 'Guests'}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {/* Occupied Room Detail Modal */}
      {occupiedRoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in" onClick={() => setOccupiedRoom(null)} />
          <Card className="relative w-full max-w-md shadow-2xl border-2 border-red-200 animate-in zoom-in-95 duration-200" padded={false}>
            <div className="bg-red-50 px-6 py-4 flex justify-between items-center border-b border-red-100">
              <div>
                <h3 className="text-lg font-bold text-primary font-display">Room {occupiedRoom.number} — {occupiedRoom.hotel}</h3>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">
                  {occupiedRoom.category} · {occupiedRoom.floor} · {RoomStatus.OCCUPIED}
                </p>
              </div>
              <button className="hover:bg-red-100 p-2 rounded-full transition-colors" onClick={() => setOccupiedRoom(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h4 className="text-[10px] font-bold text-outline uppercase tracking-[0.15em]">Assigned Guests</h4>
              <div className="space-y-2">
                {(guestsByRoom.get(occupiedRoom.id) || []).length === 0 ? (
                  <p className="text-sm text-on-surface-variant italic">No guest data linked. Room may have been assigned via an older flow.</p>
                ) : (
                  (guestsByRoom.get(occupiedRoom.id) || []).map(g => (
                    <div key={g.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary truncate">{g.name}</p>
                        {g.groupName && <p className="text-[10px] text-outline">{g.groupName}</p>}
                      </div>
                      <Badge variant={g.status === GuestStatus.CHECKED_IN ? 'primary' : 'default'} className="text-[9px] shrink-0">
                        {g.status}
                      </Badge>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleUnassignGuest(g, occupiedRoom)}
                          className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-outline hover:text-red-600 border border-outline-variant hover:border-red-300 rounded px-2 py-1 transition-colors"
                          title="Remove from room"
                        >
                          <UserMinus size={11} />
                          Remove
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-6 bg-surface-container-low/30 border-t border-outline-variant flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOccupiedRoom(null)}>Close</Button>
              {!isReadOnly && (
                <Button
                  variant="secondary"
                  onClick={() => handleReleaseRoom(occupiedRoom)}
                  className="bg-red-600 text-white hover:bg-red-700 border-red-600"
                >
                  <LogOut size={16} />
                  Check Out & Release Room
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
