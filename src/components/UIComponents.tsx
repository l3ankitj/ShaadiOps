/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '../lib/utils';

export function Card({ children, className, padded = true, ...props }: { children: React.ReactNode, className?: string, padded?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "bg-white border border-primary/10 rounded-xl shadow-sm relative overflow-hidden transition-all",
        padded && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'primary' | 'secondary' | 'error' | 'success' | 'ghost', className?: string }) {
  const variants = {
    default: "bg-surface-container text-on-surface-variant border-outline-variant",
    primary: "bg-primary-container text-on-primary-container border-primary/20",
    secondary: "bg-secondary-container text-on-secondary-container border-secondary/20",
    error: "bg-tertiary-container text-on-tertiary-container border-tertiary/20",
    success: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ghost: "bg-transparent text-outline border-outline-variant opacity-70",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

export function Button({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'error' }) {
  const variants = {
    primary: "bg-primary text-on-primary hover:opacity-90 shadow-md",
    secondary: "bg-secondary text-on-secondary hover:opacity-90 shadow-md",
    outline: "border-2 border-secondary text-secondary hover:bg-secondary-container hover:text-on-secondary-container",
    ghost: "bg-surface-container-high text-primary hover:bg-surface-container-highest",
    error: "bg-tertiary text-on-tertiary hover:opacity-90",
  };

  return (
    <button 
      className={cn(
        "px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatCard({ title, value, icon: Icon, trend, colorClass = "text-primary" }: { title: string, value: string | number, icon?: React.ElementType, trend?: { value: string, up?: boolean }, colorClass?: string }) {
  return (
    <Card className="flex flex-col justify-between h-40">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{title}</span>
        {Icon && <Icon className={cn("w-5 h-5 opacity-60", colorClass)} />}
      </div>
      <div>
        <div className={cn("text-3xl font-bold font-sans", colorClass)}>{value}</div>
        {trend && (
          <div className={cn("text-[10px] font-bold mt-1 flex items-center gap-1", trend.up ? "text-emerald-600" : "text-red-600")}>
            {trend.value}
          </div>
        )}
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
        {Icon && <Icon size={100} />}
      </div>
    </Card>
  );
}
