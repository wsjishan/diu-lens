import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { registrationPrepTips } from '@/features/registration/constants';

type PrepStepProps = {
  onContinue: () => void;
};

export function PrepStep({ onContinue }: PrepStepProps) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="landing-text-primary text-xl font-semibold tracking-tight sm:text-[1.35rem]">
          Face Verification
        </h2>
        <p className="landing-text-secondary text-sm leading-6">
          Before continuing, make sure your environment is ready for a quick and
          accurate face verification scan.
        </p>
      </header>

      <div className="rounded-xl border border-blue-100/80 bg-blue-50/70 p-3.5 dark:border-white/10 dark:bg-[#0b1220]">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-slate-300">
          <ShieldCheck className="size-4" />
          Quick preparation tips
        </p>
        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          {registrationPrepTips.map((tip) => (
            <li
              key={tip}
              className="inline-flex items-start gap-2"
            >
              <span
                className="mt-2 size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                aria-hidden="true"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        type="button"
        onClick={onContinue}
        className="landing-button-bg landing-cta w-full px-5 text-white sm:w-auto"
      >
        Start Verification
      </Button>
    </div>
  );
}
