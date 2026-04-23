'use client';

import { useState } from 'react';

import {
  HeroSection,
  MobileHeroIntro,
  MobileOnboardingStepper,
} from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { cn } from '@/lib/utils';

export function HomeOnboardingSection() {
  const [activeStep, setActiveStep] = useState(0);
  const isVerificationStep = activeStep === 2;

  return (
    <section className="relative w-full">
      <div
        aria-hidden="true"
        className="landing-card-spotlight pointer-events-none absolute right-[-8%] top-1/2 hidden h-[26.5rem] w-[34rem] -translate-y-1/2 rounded-full blur-3xl lg:block"
      />

      <div className="mx-auto flex w-full max-w-[22.75rem] flex-col pt-1.5 pb-5 sm:hidden">
        <div
          className={cn(
            'w-full transition-all duration-400 ease-out',
            activeStep > 0 && !isVerificationStep ? 'opacity-88' : 'opacity-100'
          )}
        >
          <MobileHeroIntro />
        </div>

        <div className="mt-1.5 w-full">
          <RegistrationCard onStepIndexChange={setActiveStep} />
        </div>

        <div className="mt-4 w-full px-0.5">
          <MobileOnboardingStepper />
        </div>
      </div>

      <div className="hidden w-full grid-cols-1 gap-8 sm:grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] md:items-center md:gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-[4rem]">
        <div
          className={cn(
            'mx-auto w-full max-w-[22.75rem] transition-all duration-400 ease-out sm:max-w-[29rem] md:mx-0 md:max-w-[38.5rem] lg:pr-2',
            activeStep > 0 && !isVerificationStep
              ? 'lg:opacity-70 lg:blur-[1px]'
              : 'lg:opacity-100'
          )}
        >
          <HeroSection />
        </div>

        <div className="relative mx-auto flex w-full max-w-[22.75rem] justify-center sm:max-w-[27rem] md:mx-0 md:max-w-none md:justify-end lg:pr-1">
          <RegistrationCard onStepIndexChange={setActiveStep} />
        </div>
      </div>
    </section>
  );
}
