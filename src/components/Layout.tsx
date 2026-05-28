/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Hotel,
  Car,
  PhoneCall,
  Settings,
  Menu,
  RefreshCw,
  HelpCircle,
  X,
  LayoutDashboard as DashIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useIsReadOnly } from '../contexts/AccessContext';

const sidebarLinks = [
  { to: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/guest-list',     label: 'Guest List',     icon: ClipboardList },
  { to: '/guest-ops',      label: 'Guest Ops',      icon: Users },
  { to: '/hotel-tracker',  label: 'Hotel Tracker',  icon: Hotel },
  { to: '/transport-desk', label: 'Transport Desk', icon: Car },
  { to: '/vendor-sos',     label: 'Contacts',        icon: PhoneCall },
  { to: '/settings',       label: 'Settings',       icon: Settings },
];

export function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const isReadOnly = useIsReadOnly();
  return (
    <aside className={cn(
      'flex flex-col h-full py-6 px-4 bg-surface-container-low border-r border-outline-variant',
      className
    )}>
      <div className="mb-10 px-2 pt-4">
        <h1 className="text-2xl font-display font-bold text-primary">ShaadiOps</h1>
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1 opacity-60">
          Wedding Operations
        </p>
      </div>

      <nav className="flex-grow space-y-1">
        {sidebarLinks
          .filter(link => !(isReadOnly && link.to === '/settings'))
          .map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-bold',
                isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              )}
            >
              <link.icon size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">{link.label}</span>
            </NavLink>
          ))}
      </nav>

      {isReadOnly && (
        <div className="mx-2 mb-4 px-3 py-2 rounded-lg bg-secondary-container/30 border border-secondary/20">
          <p className="text-[9px] font-bold text-secondary uppercase tracking-widest">View-only access</p>
        </div>
      )}
    </aside>
  );
}

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center w-full px-4 md:px-10 h-14 bg-surface border-b border-outline-variant">
      <button onClick={onMenuClick} className="md:hidden text-primary">
        <Menu size={24} />
      </button>

      <div className="flex items-center gap-2 ml-auto">
        {/* Refresh */}
        <button
          onClick={handleRefresh}
          title="Refresh"
          className="hover:bg-surface-container-high p-2 rounded-full transition-colors text-on-surface-variant"
        >
          <RefreshCw size={18} className={cn(refreshing && 'animate-spin')} />
        </button>

        {/* Help */}
        <div className="relative" ref={helpRef}>
          <button
            onClick={() => setShowHelp(v => !v)}
            title="Help"
            className={cn('hover:bg-surface-container-high p-2 rounded-full transition-colors text-on-surface-variant', showHelp && 'bg-surface-container-high')}
          >
            <HelpCircle size={18} />
          </button>
          {showHelp && (
            <div className="absolute right-0 top-11 w-72 bg-surface border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-low">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Quick Reference</span>
                <button onClick={() => setShowHelp(false)} className="text-outline hover:text-on-surface"><X size={14} /></button>
              </div>
              <div className="px-4 py-3 space-y-3">
                {[
                  { icon: DashIcon,    label: 'Dashboard',      desc: 'Itinerary & daily arrivals' },
                  { icon: ClipboardList, label: 'Guest List',   desc: 'Groups, invite status, import' },
                  { icon: Users,       label: 'Guest Ops',      desc: 'Add guests, track check-in' },
                  { icon: Hotel,       label: 'Hotel Tracker',  desc: 'Room inventory & assignment' },
                  { icon: Car,         label: 'Transport Desk', desc: 'Vehicle & pickup tracking' },
                  { icon: PhoneCall,   label: 'Contacts',        desc: 'Who is responsible for what' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary-container flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={13} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">{label}</p>
                      <p className="text-[10px] text-on-surface-variant">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SOS */}
        <button
          onClick={() => navigate('/vendor-sos')}
          className="hidden lg:flex items-center px-5 py-1.5 bg-tertiary-container text-on-tertiary-container font-bold rounded-lg hover:opacity-80 transition-all text-xs tracking-widest"
        >
          SOS
        </button>
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative">
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 md:hidden animate-in fade-in"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <Sidebar
        className={cn(
          'fixed inset-y-0 left-0 w-60 z-50 transition-transform md:hidden',
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        onClose={() => setIsMenuOpen(false)}
      />

      <Sidebar className="hidden md:flex sticky top-0 w-60 h-screen" />

      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <TopNav onMenuClick={() => setIsMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-10 pb-24 md:pb-10 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant flex justify-around items-center h-14 z-40">
        <NavLink to="/dashboard" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 flex-1', isActive ? 'text-primary' : 'text-on-surface-variant opacity-60')}>
          <LayoutDashboard size={18} />
          <span className="text-[8px] font-bold uppercase">Home</span>
        </NavLink>
        <NavLink to="/guest-list" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 flex-1', isActive ? 'text-primary' : 'text-on-surface-variant opacity-60')}>
          <ClipboardList size={18} />
          <span className="text-[8px] font-bold uppercase">List</span>
        </NavLink>
        <NavLink to="/guest-ops" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 flex-1', isActive ? 'text-primary' : 'text-on-surface-variant opacity-60')}>
          <Users size={18} />
          <span className="text-[8px] font-bold uppercase">Guests</span>
        </NavLink>
        <NavLink to="/hotel-tracker" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 flex-1', isActive ? 'text-primary' : 'text-on-surface-variant opacity-60')}>
          <Hotel size={18} />
          <span className="text-[8px] font-bold uppercase">Hotel</span>
        </NavLink>
        <NavLink to="/transport-desk" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 flex-1', isActive ? 'text-primary' : 'text-on-surface-variant opacity-60')}>
          <Car size={18} />
          <span className="text-[8px] font-bold uppercase">Transport</span>
        </NavLink>
        <NavLink to="/vendor-sos" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 flex-1', isActive ? 'text-primary' : 'text-on-surface-variant opacity-60')}>
          <PhoneCall size={18} />
          <span className="text-[8px] font-bold uppercase">Contacts</span>
        </NavLink>
      </nav>
    </div>
  );
}
