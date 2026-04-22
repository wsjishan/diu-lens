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
    <div className="space-y-6 sm:space-y-7">
      <header className="space-y-2.5">
        <h2 className="landing-text-primary text-xl font-semibold tracking-tight sm:text-[1.35rem]">
          Check Registration Status
        </h2>
        <p className="landing-text-secondary text-sm leading-6">
          Enter your student ID to continue with DIU Lens.
        </p>
      </header>

      <div className="space-y-4 rounded-xl border border-slate-200/65 bg-white/45 p-3.5 dark:border-white/10 dark:bg-slate-900/36 sm:p-4">
        <Label
          htmlFor="student-id"
          className="landing-form-label text-[0.82rem] font-semibold tracking-[0.02em]"
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
          className="landing-form-input"
          required
        />
      </div>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!studentId}
        className="landing-button-bg landing-cta w-full gap-2 px-5 text-sm text-white"
      >
        Continue
        <ArrowRight
          className="size-4 transition-transform duration-150 group-hover/button:translate-x-0.5"
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
