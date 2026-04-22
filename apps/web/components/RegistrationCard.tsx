'use client';

import { useState } from 'react';

import { RegistrationFlow } from '@/features/registration/RegistrationFlow';
import { cn } from '@/lib/utils';

type RegistrationCardProps = {
  onStepIndexChange?: (index: number) => void;
};

export function RegistrationCard({ onStepIndexChange }: RegistrationCardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const isVerificationStep = activeStep === 2;

  return (
    <aside
      className={cn(
        'mx-auto flex min-h-0 w-full transition-all duration-400 ease-out lg:self-center',
        isVerificationStep
          ? 'max-w-5xl lg:h-full lg:max-w-5xl'
          : 'max-w-md lg:max-w-xl lg:justify-self-end'
      )}
    >
      <RegistrationFlow
        onStepIndexChange={(index) => {
          setActiveStep(index);
          onStepIndexChange?.(index);
        }}
      />
    </aside>
  );
}
