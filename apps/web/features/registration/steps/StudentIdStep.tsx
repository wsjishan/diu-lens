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
    <div className="space-y-4 max-[639px]:space-y-3 sm:space-y-5">
      <header className="space-y-2 max-[639px]:space-y-1.5">
        <h3 className="landing-text-primary text-[1.3rem] leading-[1.1] font-semibold tracking-[-0.016em] max-[639px]:text-[0.98rem] max-[639px]:font-medium sm:text-[1.68rem]">
          Check Registration Status
        </h3>
        <p className="landing-text-secondary max-w-[29ch] text-[0.8rem] leading-[1.45] max-[639px]:text-[0.72rem] max-[639px]:leading-[1.35] sm:text-[0.86rem]">
          Enter your student ID to continue with DIU Lens.
        </p>
      </header>

      <div className="space-y-2">
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
        className="landing-button-bg landing-cta w-full gap-2 px-5 text-[0.9rem] text-white max-[639px]:h-[2.9rem]"
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
