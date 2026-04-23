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
  const progressPercent = Math.max(
    0,
    Math.min(100, (activeIndex / (steps.length - 1)) * 100)
  );

  return (
    <Card
      className={cn(
        'landing-card-surface flex w-full flex-col rounded-[1.15rem] border px-4 py-[1.125rem] sm:rounded-[1.3rem] sm:px-[1.375rem] sm:py-[1.4rem]',
        className
      )}
    >
      <CardContent className="space-y-3 p-0 sm:space-y-[1.1rem]">
        <header className="space-y-2 sm:space-y-2.5">
          <h2 className="landing-text-primary text-center text-[1.5rem] leading-none font-semibold tracking-[-0.015em] sm:text-[1.72rem]">
            Onboarding
          </h2>

          <div className="space-y-1.5">
            <p className="landing-text-secondary text-[0.74rem] sm:text-[0.8rem]">Step {activeIndex + 1} of 4</p>
            <div className="landing-progress-track h-[0.3125rem] w-full overflow-hidden rounded-full">
              <span
                className="landing-progress-active block h-full rounded-full"
                style={{ width: `${progressPercent}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="landing-step-labels-grid">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={cn(
                    'text-[0.68rem] whitespace-nowrap sm:text-[0.72rem]',
                    index <= activeIndex ? 'landing-text-secondary' : 'landing-text-muted'
                  )}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="space-y-3.5 sm:space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
}
