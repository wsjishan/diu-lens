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
        'landing-card-surface flex w-full flex-col rounded-[1.15rem] border px-4 py-[1.125rem] shadow-[0_22px_36px_-24px_rgba(30,64,175,0.34)] max-[639px]:rounded-[0.6rem] max-[639px]:border-[#1a334d] max-[639px]:bg-[#0c1b2b]/92 max-[639px]:px-[0.9375rem] max-[639px]:py-[0.9375rem] max-[639px]:shadow-[0_18px_38px_-18px_rgba(0,0,0,0.42),0_0_22px_rgba(40,121,214,0.08)] sm:rounded-[1.3rem] sm:px-[1.375rem] sm:py-[1.4rem] sm:shadow-none',
        className
      )}
    >
      <CardContent className="space-y-3 p-0 max-[639px]:space-y-[0.8125rem] sm:space-y-[1.1rem]">
        <header className="space-y-2 max-[639px]:space-y-0 sm:space-y-2.5">
          <div className="max-[639px]:flex max-[639px]:items-center max-[639px]:justify-between">
            <h2 className="landing-text-primary text-center text-[1.5rem] leading-none font-semibold tracking-[-0.015em] max-[639px]:text-left max-[639px]:text-[1.06rem] max-[639px]:font-bold max-[639px]:text-[#cbd9eb] sm:text-[1.72rem]">
              Onboarding
            </h2>
            <span className="hidden rounded-full bg-[#15385c]/92 px-2.25 py-[0.27rem] text-[0.46rem] leading-none font-bold tracking-[0.12em] text-[#58a9ff] uppercase max-[639px]:inline-flex">
              Step {activeIndex + 1} of 4
            </span>
          </div>

          <div className="space-y-1.5 max-[639px]:hidden">
            <p className="landing-text-secondary text-[0.74rem] max-[639px]:text-[0.66rem] max-[639px]:font-medium sm:text-[0.8rem]">
              Step {activeIndex + 1} of 4
            </p>
            <div className="landing-progress-track h-[0.3125rem] w-full overflow-hidden rounded-full max-[639px]:h-[0.25rem]">
              <span
                className="landing-progress-active block h-full rounded-full"
                style={{ width: `${progressPercent}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="hidden grid-cols-4 gap-[0.45rem] sm:grid">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={cn(
                    'text-[0.68rem] whitespace-nowrap max-[639px]:text-[0.62rem] sm:text-[0.72rem]',
                    index <= activeIndex
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

        <div className="space-y-3.5 max-[639px]:space-y-2 sm:space-y-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
