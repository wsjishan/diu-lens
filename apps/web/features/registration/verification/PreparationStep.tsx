import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { VerificationShell } from '@/features/registration/verification/VerificationShell';

type PreparationStepProps = {
  tips: string[];
  onOpenCamera: () => void;
};

export function PreparationStep({ tips, onOpenCamera }: PreparationStepProps) {
  return (
    <VerificationShell
      className="h-full"
      title="Prepare for Face Verification"
      description="You are about to start a guided biometric check. Follow each instruction and keep your face centered for the smoothest experience."
    >
      <div className="rounded-xl border border-blue-100/80 bg-blue-50/65 p-4 sm:p-5 dark:border-white/10 dark:bg-[#0b1220]">
        <p className="mb-2.5 inline-flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-slate-300">
          <ShieldCheck className="size-4" />
          Quick preparation tips
        </p>
        <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
          {tips.map((tip, index) => (
            <li
              key={tip}
              className="grid grid-cols-[1.5rem_1fr] items-start gap-2.5"
            >
              <span
                className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-auto border-t border-slate-200/80 pt-3 dark:border-white/10">
        <Button
          type="button"
          onClick={onOpenCamera}
          className="h-10 w-full rounded-lg bg-linear-to-r from-[#1e2a78] to-[#2f5bff] px-5 text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] sm:w-auto dark:bg-linear-to-r dark:from-[#1e3a8a] dark:to-[#2563eb]"
        >
          Open Camera
        </Button>
      </div>
    </VerificationShell>
  );
}
