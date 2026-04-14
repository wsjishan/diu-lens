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

  return (
    <section className="relative h-full w-full overflow-hidden">
      <div
        className={cn(
          'absolute inset-0 z-0 transition-all duration-500 ease-in-out',
          focused ? 'scale-[0.995] opacity-100' : 'scale-100 opacity-100'
        )}
      >
        <div className="grid w-full grid-cols-1 gap-6 lg:h-full lg:grid-cols-2 lg:items-center">
          <div className="max-w-2xl lg:pr-8">
            <HeroSection highlights={registrationHighlights} />
          </div>
          <div
            aria-hidden="true"
            className="hidden lg:block"
          />
        </div>
      </div>

      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 z-10 bg-transparent backdrop-blur-xl backdrop-saturate-125 transition-all duration-500 ease-in-out',
          shouldBlur ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <div className="relative z-20 flex h-full items-center justify-center px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            'flex w-full items-center transition-all duration-500 ease-in-out lg:max-w-none',
            focused ? 'justify-center' : 'justify-center lg:justify-end'
          )}
        >
          <div
            className={cn(
              'w-full max-w-lg transform-gpu transition-all duration-500 ease-in-out',
              focused ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-6 scale-95 opacity-100 lg:translate-x-10'
            )}
          >
            <RegistrationCard onStepIndexChange={setActiveStep} />
          </div>
        </div>
      </div>
    </section>
  );
}
