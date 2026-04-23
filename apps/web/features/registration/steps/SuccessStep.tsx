import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

type SuccessStepProps = {
  onDone?: () => void;
};

export function SuccessStep({ onDone }: SuccessStepProps) {
  return (
    <div className="space-y-5 pt-1 text-center max-[639px]:space-y-3.5 sm:space-y-6">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        <CheckCircle2 className="size-6" />
      </div>

      <header className="space-y-2 max-[639px]:space-y-1.5">
        <h2 className="landing-text-primary text-xl font-semibold tracking-tight max-[639px]:text-[1rem] max-[639px]:font-medium">
          Registration Complete
        </h2>
        <p className="landing-text-secondary text-sm leading-6 max-[639px]:text-[0.72rem] max-[639px]:leading-[1.35]">
          Your onboarding details have been saved. Face verification integration
          will be connected in the next release.
        </p>
      </header>

      <Button
        type="button"
        onClick={onDone}
        className="landing-button-bg landing-cta h-11 w-full px-8 text-white max-[639px]:h-[2.9rem] sm:w-auto sm:px-9"
      >
        Done
      </Button>
    </div>
  );
}
