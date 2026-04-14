import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { VerificationShell } from '@/features/registration/verification/VerificationShell';

type VerificationCompleteStepProps = {
  onFinish: () => void;
};

export function VerificationCompleteStep({
  onFinish,
}: VerificationCompleteStepProps) {
  return (
    <VerificationShell
      title="Verification Complete"
      description="All required angles and captures were completed successfully. You can now finish registration."
    >
      <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/10">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" />5 angles captured with 15 accepted
          shots
        </div>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Final backend validation and face matching will be connected in a
          future integration phase.
        </p>
      </div>

      <Button
        type="button"
        onClick={onFinish}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-[#1e2a78] to-[#2f5bff] px-5 text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] dark:bg-gradient-to-r dark:from-[#1e3a8a] dark:to-[#2563eb] sm:w-auto"
      >
        Finish Registration
      </Button>
    </VerificationShell>
  );
}
