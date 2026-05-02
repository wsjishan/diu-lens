import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RegistrationFormValues } from '@/features/registration/types';

type BasicInfoStepProps = {
  values: RegistrationFormValues;
  onFieldChange: (
    field: Exclude<keyof RegistrationFormValues, 'studentId'>,
    value: string
  ) => void;
  onBack: () => void;
  onContinue: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export function BasicInfoStep({
  values,
  onFieldChange,
  onBack,
  onContinue,
  isSubmitting = false,
  errorMessage,
}: BasicInfoStepProps) {
  return (
    <div className="flex h-full flex-col gap-4 max-[639px]:gap-2.5 sm:gap-5">
      <header className="space-y-2.5 max-[639px]:space-y-1">
        <h2 className="landing-text-primary text-xl font-semibold tracking-tight max-[639px]:text-[0.94rem] sm:text-[1.35rem]">
          Basic Information
        </h2>
        <p className="landing-text-secondary text-sm leading-6 max-[639px]:max-w-[29ch] max-[639px]:text-[0.68rem] max-[639px]:leading-[1.36]">
          Confirm your profile details before starting identity verification.
        </p>
        {errorMessage ? (
          <p
            role="alert"
            className="text-sm font-medium text-red-600 dark:text-red-400"
          >
            {errorMessage}
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-3.5 rounded-xl border border-slate-200/65 bg-white/45 p-3.5 max-[639px]:gap-2 max-[639px]:rounded-[0.75rem] max-[639px]:p-2.5 dark:border-white/10 dark:bg-slate-900/36 sm:gap-4 sm:p-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="basic-student-id"
            className="landing-form-label text-[0.82rem] font-semibold tracking-[0.02em] max-[639px]:text-[0.72rem] max-[639px]:font-medium"
          >
            Student ID
          </Label>
          <Input
            id="basic-student-id"
            value={values.studentId}
            readOnly
            className="landing-form-input landing-form-input-readonly w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="full-name"
            className="landing-form-label text-[0.82rem] font-semibold tracking-[0.02em] max-[639px]:text-[0.72rem] max-[639px]:font-medium"
          >
            Full Name
          </Label>
          <Input
            id="full-name"
            value={values.fullName}
            placeholder="Enter your full name"
            onChange={(event) => onFieldChange('fullName', event.target.value)}
            className="landing-form-input w-full"
            required
          />
        </div>

        <div className="col-span-1 flex flex-col gap-1.5 md:col-span-2">
          <Label
            htmlFor="phone-number"
            className="landing-form-label text-[0.82rem] font-semibold tracking-[0.02em] max-[639px]:text-[0.72rem] max-[639px]:font-medium"
          >
            Phone Number
          </Label>
          <Input
            id="phone-number"
            inputMode="tel"
            value={values.phoneNumber}
            placeholder="Enter your phone number"
            onChange={(event) =>
              onFieldChange('phoneNumber', event.target.value)
            }
            className="landing-form-input w-full"
            required
          />
        </div>

        <div className="col-span-1 flex flex-col gap-1.5 md:col-span-2">
          <Label
            htmlFor="university-email"
            className="landing-form-label text-[0.82rem] font-semibold tracking-[0.02em] max-[639px]:text-[0.72rem] max-[639px]:font-medium"
          >
            University Email
          </Label>
          <Input
            id="university-email"
            type="email"
            autoComplete="email"
            value={values.universityEmail}
            placeholder="Enter your university email"
            onChange={(event) =>
              onFieldChange('universityEmail', event.target.value)
            }
            className="landing-form-input w-full"
            required
          />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-4 border-t border-slate-200/80 pt-4 max-[639px]:gap-2 max-[639px]:pt-2.5 dark:border-white/10">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="landing-cta-outline h-11 w-full rounded-xl border-slate-300/80 bg-white/72 px-4 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/12 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900/85"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={
            isSubmitting ||
            !values.fullName.trim() ||
            !values.phoneNumber.trim() ||
            !values.universityEmail.trim()
          }
          className="landing-button-bg landing-cta h-11 w-full gap-2 rounded-xl px-5 text-sm text-white"
        >
          {isSubmitting ? 'Continuing...' : 'Continue'}
          <ArrowRight className="size-4 transition-transform duration-150 group-hover/button:translate-x-0.5" />
        </Button>
      </div>
    </div>
  );
}
