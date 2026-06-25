import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

interface ToastContextValue {
  showToast: (message: string, variant?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, variant }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-10 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { key?: React.Key; toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={cn(
      'pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-bold animate-in slide-in-from-right fade-in duration-200',
      toast.variant === 'error'
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    )}>
      {toast.variant === 'error'
        ? <AlertTriangle size={16} className="text-red-500 shrink-0" />
        : <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
      <span className="flex-1 min-w-0">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-50 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
