'use client';

import { useState } from 'react';

import { HeroSection } from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { cn } from '@/lib/utils';

export function HomeOnboardingSection() {
  const [activeStep, setActiveStep] = useState(0);
  const isVerificationStep = activeStep === 2;

  return (
    <section className="relative w-full">
      <div
        aria-hidden="true"
        className="landing-card-spotlight pointer-events-none absolute right-[-10%] top-1/2 hidden h-[32rem] w-[42rem] -translate-y-1/2 rounded-full blur-3xl lg:block"
      />

      <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] md:items-center md:gap-14 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:gap-24">
        <div
          className={cn(
            'max-w-[44rem] transition-all duration-400 ease-out lg:pr-2',
            activeStep > 0 && !isVerificationStep
              ? 'lg:opacity-70 lg:blur-[1px]'
              : 'lg:opacity-100'
          )}
        >
          <HeroSection />
        </div>

        <div className="relative flex w-full justify-center md:justify-end lg:pr-2">
          <RegistrationCard onStepIndexChange={setActiveStep} />
        </div>
      </div>
    </section>
  );
}
