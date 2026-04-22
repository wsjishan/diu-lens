'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error';

type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type AdminToastContextValue = {
  showToast: (payload: Omit<ToastItem, 'id'>) => void;
};

const AdminToastContext = createContext<AdminToastContextValue | undefined>(undefined);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((payload: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: ToastItem = { ...payload, id };

    setToasts((current) => [...current, toast]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const value = useMemo<AdminToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[90] flex w-full max-w-sm flex-col gap-2 sm:right-6 sm:bottom-6">
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-xl border bg-card p-3 text-sm shadow-lg',
              toast.variant === 'success'
                ? 'border-emerald-300/40'
                : 'border-destructive/40'
            )}
          >
            <div className="flex items-start gap-2">
              {toast.variant === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div>
                <p className="font-medium text-foreground">{toast.title}</p>
                {toast.message ? <p className="mt-0.5 text-muted-foreground">{toast.message}</p> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  const context = useContext(AdminToastContext);

  if (!context) {
    throw new Error('useAdminToast must be used within an AdminToastProvider.');
  }

  return context;
}
