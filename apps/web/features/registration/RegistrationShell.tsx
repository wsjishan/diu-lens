import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RegistrationStepMeta } from '@/features/registration/types';

type RegistrationShellProps = {
  activeIndex: number;
  steps: RegistrationStepMeta[];
  className?: string;
  children: ReactNode;
};

export function RegistrationShell({
  activeIndex,
  steps,
  className,
  children,
}: RegistrationShellProps) {
  return (
    <Card
      className={cn(
        'flex w-full max-w-md flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.4),0_10px_24px_-20px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-white/80 backdrop-blur-sm sm:p-6 dark:border-white/10 dark:bg-[#0f172a]/90 dark:shadow-[0_14px_32px_-24px_rgba(0,0,0,0.6)] dark:ring-white/10',
        className
      )}
    >
      <CardContent className="space-y-5 p-0 sm:space-y-6">
        <div className="space-y-3 rounded-xl bg-slate-50/70 p-3 ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10">
          <div className="flex items-center justify-between text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <span>Onboarding</span>
            <span className="tracking-tight normal-case text-slate-600 dark:text-slate-300">
              Step {activeIndex + 1} of {steps.length}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#1e2a78] via-[#2743d2] to-[#2f5bff] shadow-[0_6px_18px_-10px_rgba(37,99,235,0.9)] transition-all duration-200 ease-out dark:bg-linear-to-r dark:from-[#1e3a8a] dark:via-[#2743d2] dark:to-[#2563eb]"
              style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <ol className="hidden gap-2 text-sm sm:grid sm:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={cn(
                  'truncate rounded-lg px-2 py-1 text-slate-500 ring-1 ring-transparent dark:text-slate-400',
                  index <= activeIndex
                    ? 'bg-white/90 font-semibold text-slate-900 ring-slate-200/80 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10'
                    : undefined
                )}
              >
                {step.label}
              </li>
            ))}
          </ol>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
