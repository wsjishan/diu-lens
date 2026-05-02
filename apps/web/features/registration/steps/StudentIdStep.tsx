import { ArrowRight, IdCard } from 'lucide-react';

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
    <div className="space-y-4 max-[639px]:space-y-2.5 sm:space-y-5">
      <header className="space-y-2 max-[639px]:space-y-1">
        <h3 className="landing-text-primary text-[1.3rem] leading-[1.1] font-semibold tracking-[-0.016em] max-[639px]:text-[1rem] max-[639px]:leading-[1.2] sm:text-[1.68rem]">
          Check Registration Status
        </h3>
        <p className="landing-text-secondary max-w-[29ch] text-[0.8rem] leading-[1.45] max-[639px]:hidden sm:text-[0.86rem]">
          Enter your student ID to continue with DIU Lens.
        </p>
      </header>

      <div className="space-y-1.5">
        <Label
          htmlFor="student-id"
          className="sr-only"
        >
          Student ID
        </Label>
        <div className="relative">
          <IdCard
            className="pointer-events-none absolute left-3 top-1/2 hidden size-[0.86rem] -translate-y-1/2 text-[#859bb3] max-[639px]:block"
            aria-hidden="true"
          />
          <Input
            id="student-id"
            name="student-id"
            placeholder="e.g. 221-15-0001"
            autoComplete="off"
            inputMode="numeric"
            value={studentId}
            onChange={(event) => onStudentIdChange(event.target.value)}
            className="landing-form-input landing-form-input-with-icon"
            required
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!studentId}
        className="landing-button-bg landing-cta w-full gap-1.5 px-5 text-[0.9rem] text-white max-[639px]:h-[2.62rem] max-[639px]:text-[0.85rem]"
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
