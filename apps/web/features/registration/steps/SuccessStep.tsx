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
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Registration Complete
        </h2>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          Your onboarding details have been saved. Face verification integration
          will be connected in the next release.
        </p>
      </header>

      <Button
        type="button"
        onClick={onDone}
        className="h-10 rounded-lg bg-linear-to-r from-[#1e2a78] to-[#2f5bff] px-8 text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] sm:px-9 dark:bg-linear-to-r dark:from-[#1e3a8a] dark:to-[#2563eb]"
      >
        Done
      </Button>
    </div>
  );
}
