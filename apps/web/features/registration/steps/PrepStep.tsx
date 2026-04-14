import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { registrationPrepTips } from '@/features/registration/constants';

type PrepStepProps = {
  onContinue: () => void;
};

export function PrepStep({ onContinue }: PrepStepProps) {
  return (
    <div className="space-y-4">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Face Verification
        </h2>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
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
        className="h-10 rounded-lg bg-gradient-to-r from-[#1e2a78] to-[#2f5bff] px-5 text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] dark:bg-gradient-to-r dark:from-[#1e3a8a] dark:to-[#2563eb]"
      >
        Start Verification
      </Button>
    </div>
  );
}
