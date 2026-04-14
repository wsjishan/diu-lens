'use client';

import { RegistrationFlow } from '@/features/registration/RegistrationFlow';

type RegistrationCardProps = {
  onStepIndexChange?: (index: number) => void;
};

export function RegistrationCard({ onStepIndexChange }: RegistrationCardProps) {
  return (
    <aside className="mx-auto w-full max-w-md lg:max-w-lg lg:justify-self-end lg:self-center lg:pl-2">
      <RegistrationFlow onStepIndexChange={onStepIndexChange} />
    </aside>
  );
}
