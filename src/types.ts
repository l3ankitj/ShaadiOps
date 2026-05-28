/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GuestStatus {
  PICKED_UP = 'Picked Up',
  CHECKED_IN = 'Checked In',
  CHECKED_OUT = 'Checked Out',
  IN_TRANSIT = 'In Transit',
  PENDING = 'Pending',
}

export enum InviteStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  DECLINED = 'Declined',
}

export enum FamilySide {
  BRIDE = 'Bride Side',
  GROOM = 'Groom Side',
}

export enum ArrivalMode {
  CAR = 'Car',
  TRAIN = 'Train',
  FLIGHT = 'Flight',
  BUS = 'Bus',
}

export interface Guest {
  id: string;
  name: string;
  phone?: string;
  groupName?: string;
  isPrimaryContact?: boolean;
  familySide: FamilySide;
  inviteStatus: InviteStatus;
  status: GuestStatus;
  dietary?: string;
  notes?: string;
  // Room assignment — set by HotelTracker
  roomId?: string;
  roomNumber?: string;
  hotelName?: string;
  // Travel details — optional, filled when they confirm travel
  arrivalMode?: ArrivalMode;
  departureMode?: ArrivalMode;
  arrivalDateTime?: string;
  departureDateTime?: string;
  travelDetails?: string;
  departureDetails?: string;
  // Train specific
  arrivalTrainName?: string;
  arrivalTrainNumber?: string;
  arrivalCoach?: string;
  arrivalSeat?: string;
  departureTrainName?: string;
  departureTrainNumber?: string;
  departureCoach?: string;
  departureSeat?: string;
  // Flight specific
  arrivalFlightNumber?: string;
  departureFlightNumber?: string;
  // Group travel flag — set when this member's travel was individually edited
  // after a bulk group travel was applied. Cleared on next bulk group update.
  customTravel?: boolean;
}

export enum VehicleStatus {
  IN_TRANSIT = 'In Transit',
  ACTIVE = 'Active',
  AT_HOTEL = 'At Hotel',
  DELAYED = 'Delayed',
}

export interface Vehicle {
  id: string;
  type: string;
  plate: string;
  driver: string;
  phone: string;
  status: VehicleStatus;
  category: string;
}

export enum RoomStatus {
  OCCUPIED = 'Occupied',
  EMPTY = 'Empty',
  CLEANING = 'Cleaning',
  MAINTENANCE = 'Maintenance',
}

export interface Room {
  id: string;
  number: string;
  floor: string;
  category: string;
  capacity: number;
  status: RoomStatus;
  hotel: string;
}

export interface Vendor {
  id: string;
  name: string;
  role: string;
  phone: string;
  notes?: string;
}

export enum UserRole {
  ADMIN = 'Admin',
  COORDINATOR = 'Coordinator',
  VIEWER = 'Viewer',
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
}

export interface ItineraryItem {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO String
  endTime?: string;   // ISO String
  venue: string;
  category?: string;
}

export interface EventConfig {
  id: string;
  brideName: string;
  groomName: string;
  hashtag: string;
  eventName?: string;
  eventDate?: string;
}
