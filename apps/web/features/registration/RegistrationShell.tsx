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
  const visualSteps = steps.slice(0, 3);
  const visualActiveIndex = Math.min(activeIndex, visualSteps.length - 1);
  const visualLabels = [
    'Student ID check',
    'Basic information',
    'Face verification',
  ] as const;

  return (
    <Card
      className={cn(
        'landing-card-surface flex w-full max-w-md flex-col rounded-2xl border p-6 sm:p-8',
        className
      )}
    >
      <CardContent className="space-y-5 p-0 sm:space-y-6">
        <div className="space-y-3.5 rounded-xl border border-slate-200/65 bg-white/70 p-3.5 dark:border-white/10 dark:bg-slate-900/42 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold tracking-[0.1em] uppercase">
            <span className="landing-text-muted">Onboarding</span>
            <span className="landing-text-secondary rounded-full border border-slate-300/70 bg-white/75 px-2.5 py-0.5 text-[0.65rem] dark:border-white/15 dark:bg-slate-900/70">
              Step {activeIndex + 1} of {steps.length}
            </span>
          </div>
          <div className="space-y-3">
            <div className="relative hidden grid-cols-3 items-center gap-2 sm:grid">
              <span
                aria-hidden="true"
                className="absolute left-[calc(16.666%-1.1rem)] right-[calc(16.666%-1.1rem)] top-1/2 h-px -translate-y-1/2 bg-slate-300/60 dark:bg-slate-600/65"
              />
              {visualSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="relative flex justify-center"
                >
                  <span
                    className={cn(
                      'inline-flex size-8 items-center justify-center rounded-full border text-[0.72rem] font-semibold transition-all duration-200',
                      index < visualActiveIndex &&
                        'border-blue-400 bg-blue-500 text-white',
                      index === visualActiveIndex &&
                        'border-blue-300 bg-blue-500 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.2)]',
                      index > visualActiveIndex &&
                        'border-slate-300/80 bg-white/70 text-slate-500 dark:border-slate-500/70 dark:bg-slate-900/80 dark:text-slate-300'
                    )}
                  >
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
            <div className="hidden grid-cols-3 gap-2 sm:grid">
              {visualSteps.map((step, index) => (
                <p
                  key={`${step.id}-label`}
                  className={cn(
                    'text-center text-[0.68rem] leading-4',
                    index <= visualActiveIndex
                      ? 'landing-text-secondary'
                      : 'landing-text-muted'
                  )}
                >
                  {visualLabels[index]}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3 sm:hidden">
              {visualSteps.map((step, index) => (
                <div
                  key={`${step.id}-mobile`}
                  className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                >
                  <span
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded-full border text-[0.68rem] font-semibold',
                      index <= visualActiveIndex
                        ? 'border-blue-400 bg-blue-500 text-white'
                        : 'border-slate-300/80 bg-white/70 text-slate-500 dark:border-slate-500/70 dark:bg-slate-900/80 dark:text-slate-300'
                    )}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      'text-[0.72rem] leading-4',
                      index <= visualActiveIndex
                        ? 'landing-text-secondary'
                        : 'landing-text-muted'
                    )}
                  >
                    {visualLabels[index]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/52 p-1 dark:bg-slate-900/18">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
