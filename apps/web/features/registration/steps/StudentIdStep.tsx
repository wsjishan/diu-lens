import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type StudentIdStepProps = {
  studentId: string;
  onStudentIdChange: (value: string) => void;
  onContinue: () => void;
};

export function StudentIdStep({
  studentId,
  onStudentIdChange,
  onContinue,
}: StudentIdStepProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Check Registration Status
        </h2>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          Enter your student ID to continue with DIU Lens.
        </p>
      </header>

      <div className="space-y-2.5">
        <Label
          htmlFor="student-id"
          className="text-[0.82rem] font-semibold tracking-[0.02em] text-slate-700 dark:text-slate-300"
        >
          Student ID
        </Label>
        <Input
          id="student-id"
          name="student-id"
          placeholder="e.g. 221-15-0001"
          autoComplete="off"
          inputMode="numeric"
          value={studentId}
          onChange={(event) => onStudentIdChange(event.target.value)}
          className="h-10 rounded-lg border-slate-300/90 bg-white/65 px-3.5 text-sm text-slate-900 placeholder:text-slate-500/90 transition-all duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/30"
          required
        />
      </div>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!studentId}
        className="h-10 w-full gap-2 rounded-lg bg-linear-to-r from-[#1e2a78] to-[#2f5bff] px-5 text-sm font-semibold tracking-tight text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] sm:w-auto dark:bg-linear-to-r dark:from-[#1e3a8a] dark:to-[#2563eb]"
      >
        Continue
        <ArrowRight
          className="size-4"
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
