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
  const isVerificationStep = activeStep === 2;
  const shouldBlur = step >= 2 && !isVerificationStep;

  return (
    <section className="relative w-full min-h-0 lg:h-full">
      <div className="relative z-0 transition-all duration-500 ease-in-out">
        <div className="grid w-full grid-cols-1 gap-10 sm:gap-12 lg:h-full lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14">
          <div
            className={cn(
              'max-w-xl transition-all duration-500 ease-in-out lg:max-w-xl lg:pr-3',
              shouldBlur ? 'lg:scale-[0.988] lg:opacity-70 lg:blur-[1.5px]' : ''
            )}
          >
            <HeroSection highlights={registrationHighlights} />
          </div>
          <div className="relative mt-6 flex min-h-0 w-full justify-center sm:mt-8 lg:mt-0 lg:justify-end lg:pl-8">
            <div
              aria-hidden="true"
              className="landing-card-spotlight pointer-events-none absolute -inset-y-14 -right-12 -left-6 hidden rounded-[2.5rem] blur-2xl lg:block"
            />
            <div
              className={cn(
                'relative mx-auto w-full transform-gpu transition-all duration-500 ease-in-out',
                isVerificationStep ? 'max-w-5xl' : 'max-w-md lg:max-w-[36.5rem]',
                focused
                  ? 'translate-x-0 scale-100 opacity-100'
                  : 'translate-x-0 scale-100 opacity-100 lg:translate-x-4'
              )}
            >
              <RegistrationCard onStepIndexChange={setActiveStep} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
