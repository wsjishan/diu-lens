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
        'w-full max-w-md rounded-2xl border border-slate-200/95 bg-white p-6 shadow-[0_14px_26px_-20px_rgba(15,23,42,0.44),0_6px_12px_-10px_rgba(15,23,42,0.3),inset_0_1px_0_0_rgba(255,255,255,0.92)] dark:border dark:border-white/10 dark:bg-[#0f172a] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col',
        className
      )}
    >
      <CardContent className="space-y-4 p-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-gray-400 dark:text-slate-400">
            <span>Onboarding</span>
            <span>
              Step {activeIndex + 1} of {steps.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#1e2a78] to-[#2f5bff] transition-all duration-200 ease-out dark:bg-linear-to-r dark:from-[#1e3a8a] dark:to-[#2563eb]"
              style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <ol className="hidden gap-1 text-sm sm:grid sm:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={cn(
                  'truncate text-gray-400 dark:text-slate-400',
                  index <= activeIndex
                    ? 'font-semibold text-slate-800 dark:text-slate-100'
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
