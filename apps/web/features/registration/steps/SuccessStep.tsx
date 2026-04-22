import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

type SuccessStepProps = {
  onDone?: () => void;
};

export function SuccessStep({ onDone }: SuccessStepProps) {
  return (
    <div className="space-y-5 pt-1 text-center sm:space-y-6">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        <CheckCircle2 className="size-6" />
      </div>

      <header className="space-y-2">
        <h2 className="landing-text-primary text-xl font-semibold tracking-tight">
          Registration Complete
        </h2>
        <p className="landing-text-secondary text-sm leading-6">
          Your onboarding details have been saved. Face verification integration
          will be connected in the next release.
        </p>
      </header>

      <Button
        type="button"
        onClick={onDone}
        className="landing-button-bg landing-cta h-11 w-full px-8 text-white sm:w-auto sm:px-9"
      >
        Done
      </Button>
    </div>
  );
}
