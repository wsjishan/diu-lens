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
  const totalSteps = Math.max(steps.length, 1);
  const normalizedActiveIndex = Math.max(0, Math.min(activeIndex, totalSteps - 1));
  const progressPercent = Math.max(
    0,
    Math.min(100, (normalizedActiveIndex / (totalSteps - 1 || 1)) * 100)
  );

  return (
    <Card
      className={cn(
        'landing-card-surface flex w-full flex-col rounded-[1.3rem] border px-[1.375rem] py-[1.4rem] shadow-none',
        className
      )}
    >
      <CardContent className="space-y-[1.1rem] p-0">
        <header className="space-y-2.5">
          <div>
            <h2 className="landing-text-primary text-center text-[1.72rem] leading-none font-semibold tracking-[-0.015em]">
              Onboarding
            </h2>
          </div>

          <div className="space-y-1.5">
            <p className="landing-text-secondary text-[0.8rem]">
              Step {normalizedActiveIndex + 1} of {totalSteps}
            </p>
            <div className="landing-progress-track h-[0.3125rem] w-full overflow-hidden rounded-full">
              <span
                className="landing-progress-active block h-full rounded-full"
                style={{ width: `${progressPercent}%` }}
                aria-hidden="true"
              />
            </div>
            <div
              className="grid gap-[0.45rem]"
              style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}
            >
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={cn(
                    'text-[0.72rem] whitespace-nowrap',
                    index <= normalizedActiveIndex
                      ? 'landing-text-secondary'
                      : 'landing-text-muted'
                  )}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="space-y-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
