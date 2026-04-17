'use client';

import { useState } from 'react';

import { HeroSection } from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { registrationHighlights } from '@/features/registration/constants';
import { cn } from '@/lib/utils';

export function HomeOnboardingSection() {
  const [activeStep, setActiveStep] = useState(0);
  const step = activeStep + 1;
  const focused = step > 1;
  const shouldBlur = step >= 2;
  const isVerificationStep = activeStep === 2;

  return (
    <section className="relative w-full min-h-0">
      <div className="grid min-h-0 grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div
          className={cn(
            'relative z-0 transition-transform duration-500 ease-in-out lg:pr-6',
            focused ? 'lg:translate-y-1' : 'lg:translate-y-0'
          )}
        >
          <div
            className={cn(
              'rounded-3xl bg-white/60 p-4 shadow-[0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/70 backdrop-blur-sm transition-all duration-500 dark:bg-[#0f172a]/80 dark:ring-white/10 sm:p-6',
              shouldBlur ? 'opacity-70 lg:grayscale' : 'opacity-100'
            )}
          >
            <HeroSection highlights={registrationHighlights} />
          </div>
        </div>

        <div className="relative z-10 flex min-h-0 w-full items-center justify-center lg:justify-end">
          <div
            className={cn(
              'w-full transform-gpu transition-all duration-500 ease-in-out',
              isVerificationStep ? 'max-w-5xl lg:max-w-5xl' : 'max-w-xl sm:max-w-2xl lg:max-w-lg',
              focused
                ? 'translate-x-0 scale-100 opacity-100'
                : 'translate-x-0 scale-100 opacity-100 lg:translate-x-4 lg:scale-[0.99]'
            )}
          >
            <RegistrationCard onStepIndexChange={setActiveStep} />
          </div>
        </div>
      </div>
    </section>
  );
}
