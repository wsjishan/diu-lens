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
        'landing-card-surface flex w-full flex-col rounded-[1.65rem] border px-6 py-7 sm:px-8 sm:py-8',
        className
      )}
    >
      <CardContent className="space-y-7 p-0">
        <header className="space-y-4">
          <h2 className="landing-text-primary text-center text-[2.55rem] leading-none font-semibold tracking-[-0.02em]">
            Onboarding
          </h2>

          <div className="space-y-2.5">
            <p className="landing-text-secondary text-[1.04rem]">Step {activeIndex + 1} of 4</p>
            <div className="landing-progress-track h-2 w-full overflow-hidden rounded-full">
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
                    'text-[0.98rem] whitespace-nowrap',
                    index <= activeIndex ? 'landing-text-secondary' : 'landing-text-muted'
                  )}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="space-y-6">{children}</div>
      </CardContent>
    </Card>
  );
}
