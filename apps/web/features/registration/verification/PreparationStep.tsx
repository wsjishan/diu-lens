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
      title="Prepare for Face Verification"
      description="You are about to start a guided biometric check. Follow each instruction and keep your face centered for the smoothest experience."
    >
      <div className="rounded-xl border border-blue-100/80 bg-blue-50/70 p-3.5 dark:border-white/10 dark:bg-[#0b1220]">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-slate-300">
          <ShieldCheck className="size-4" />
          Quick preparation tips
        </p>
        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          {tips.map((tip) => (
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
        onClick={onOpenCamera}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-[#1e2a78] to-[#2f5bff] px-5 text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] dark:bg-gradient-to-r dark:from-[#1e3a8a] dark:to-[#2563eb] sm:w-auto"
      >
        Open Camera
      </Button>
    </VerificationShell>
  );
}
