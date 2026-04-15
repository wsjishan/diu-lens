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
    <section className="relative w-full min-h-0 lg:h-full">
      <div
        className={cn(
          'relative z-0 transition-all duration-500 ease-in-out lg:absolute lg:inset-0',
          focused
            ? 'scale-100 opacity-100 lg:scale-[0.995]'
            : 'scale-100 opacity-100'
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
          'absolute inset-0 z-10 hidden bg-transparent backdrop-blur-xl backdrop-saturate-125 transition-all duration-500 ease-in-out lg:block',
          shouldBlur ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <div className="relative z-20 mt-4 flex min-h-0 w-full justify-center pb-1 sm:mt-5 lg:absolute lg:inset-0 lg:mt-0 lg:h-full lg:items-center lg:px-8 lg:pb-0">
        <div
          className={cn(
            'flex min-h-0 w-full items-center transition-all duration-500 ease-in-out lg:max-w-none',
            focused ? 'justify-center' : 'justify-center lg:justify-end'
          )}
        >
          <div
            className={cn(
              'w-full transform-gpu transition-all duration-500 ease-in-out lg:min-h-0',
              isVerificationStep ? 'max-w-5xl' : 'max-w-lg',
              focused
                ? 'translate-x-0 scale-100 opacity-100'
                : 'translate-x-0 scale-100 opacity-100 lg:translate-x-10 lg:scale-95'
            )}
          >
            <RegistrationCard onStepIndexChange={setActiveStep} />
          </div>
        </div>
      </div>
    </section>
  );
}
