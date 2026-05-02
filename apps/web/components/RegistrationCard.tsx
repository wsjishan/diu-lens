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
        'mx-auto flex w-full transition-all duration-400 ease-out lg:mx-0',
        isVerificationStep
          ? 'max-w-5xl max-[639px]:max-w-full lg:max-w-5xl'
          : 'max-w-[22.75rem] max-[639px]:max-w-full sm:max-w-[27rem] md:max-w-[31rem] lg:max-w-[31rem]'
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
