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
    <section className="relative h-full w-full overflow-y-auto lg:overflow-hidden">
      <div
        className={cn(
<<<<<<< HEAD
          'absolute inset-0 z-0 transition-all duration-500 ease-in-out',
          focused ? 'scale-[0.995] opacity-100' : 'scale-100 opacity-100'
=======
          'z-0 transition-all duration-500 ease-in-out lg:absolute lg:inset-0',
          focused ? 'scale-100 opacity-100 lg:scale-[0.98] lg:opacity-40' : 'scale-100 opacity-100'
>>>>>>> 804e5a4094b92cdd4ee929f437524ed80a3435a0
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
<<<<<<< HEAD
          'absolute inset-0 z-10 bg-transparent backdrop-blur-xl backdrop-saturate-125 transition-all duration-500 ease-in-out',
          shouldBlur ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <div className="relative z-20 flex h-full items-center justify-center px-4 sm:px-6 lg:px-8">
=======
          'absolute inset-0 z-5 hidden bg-black/20 backdrop-blur-md transition-opacity duration-500 ease-in-out lg:block',
          focused ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <div className="z-10 mt-6 flex w-full justify-center px-4 pb-2 sm:px-6 lg:absolute lg:inset-0 lg:mt-0 lg:items-center lg:px-8 lg:pb-0">
>>>>>>> 804e5a4094b92cdd4ee929f437524ed80a3435a0
        <div
          className={cn(
            'flex w-full items-center transition-all duration-500 ease-in-out lg:max-w-none',
            focused ? 'justify-center' : 'justify-center lg:justify-end'
          )}
        >
          <div
            className={cn(
<<<<<<< HEAD
              'w-full max-w-lg transform-gpu transition-all duration-500 ease-in-out',
              focused ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-6 scale-95 opacity-100 lg:translate-x-10'
=======
              'w-full max-w-md transform-gpu transition-all duration-500 ease-in-out',
              focused
                ? 'translate-x-0 scale-100 opacity-100'
                : 'translate-x-0 scale-100 opacity-100 lg:translate-x-10 lg:scale-95'
>>>>>>> 804e5a4094b92cdd4ee929f437524ed80a3435a0
            )}
          >
            <RegistrationCard onStepIndexChange={setActiveStep} />
          </div>
        </div>
      </div>
    </section>
  );
}
