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
    <div className="space-y-7 sm:space-y-8">
      <header className="space-y-2.5">
        <h3 className="landing-text-primary text-[2rem] leading-[1.08] font-semibold tracking-[-0.026em] sm:text-[2.3rem]">
          Check Registration Status
        </h3>
        <p className="landing-text-secondary text-[1.03rem] leading-[1.45]">
          Enter your student ID to continue with DIU Lens.
        </p>
      </header>

      <div className="space-y-3">
        <Label htmlFor="student-id" className="sr-only">
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
        className="landing-button-bg landing-cta w-full gap-2 px-5 text-[1.02rem] text-white"
      >
        Continue
        <ArrowRight
          className="size-5 transition-transform duration-150 group-hover/button:translate-x-0.5"
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
