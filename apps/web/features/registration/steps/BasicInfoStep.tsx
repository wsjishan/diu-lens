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
};

export function BasicInfoStep({
  values,
  onFieldChange,
  onBack,
  onContinue,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-4">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Basic Information
        </h2>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          Confirm your profile details before starting identity verification.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
          <Label
            htmlFor="basic-student-id"
            className="text-[0.82rem] font-semibold tracking-[0.02em] text-slate-700 dark:text-slate-300"
          >
            Student ID
          </Label>
          <Input
            id="basic-student-id"
            value={values.studentId}
            readOnly
            className="h-10 w-full rounded-lg border-slate-300/80 bg-slate-100/80 px-3.5 text-sm text-slate-700 transition-all duration-200 ease-out dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-300"
          />
        </div>

          <div className="flex flex-col gap-1">
          <Label
            htmlFor="full-name"
            className="text-[0.82rem] font-semibold tracking-[0.02em] text-slate-700 dark:text-slate-300"
          >
            Full Name
          </Label>
          <Input
            id="full-name"
            value={values.fullName}
            onChange={(event) => onFieldChange('fullName', event.target.value)}
            className="h-10 w-full rounded-lg border-slate-300/90 bg-white/65 px-3.5 text-sm text-slate-900 transition-all duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/30"
            required
          />
        </div>

          <div className="flex flex-col gap-1">
          <Label
            htmlFor="phone-number"
            className="text-[0.82rem] font-semibold tracking-[0.02em] text-slate-700 dark:text-slate-300"
          >
            Phone Number
          </Label>
          <Input
            id="phone-number"
            inputMode="tel"
            value={values.phoneNumber}
            onChange={(event) =>
              onFieldChange('phoneNumber', event.target.value)
            }
            className="h-10 w-full rounded-lg border-slate-300/90 bg-white/65 px-3.5 text-sm text-slate-900 transition-all duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/30"
            required
          />
        </div>

          <div className="col-span-1 flex flex-col gap-1 md:col-span-2">
          <Label
            htmlFor="university-email"
            className="text-[0.82rem] font-semibold tracking-[0.02em] text-slate-700 dark:text-slate-300"
          >
            University Email
          </Label>
          <Input
            id="university-email"
            type="email"
            autoComplete="email"
            value={values.universityEmail}
            onChange={(event) =>
              onFieldChange('universityEmail', event.target.value)
            }
            className="h-10 w-full rounded-lg border-slate-300/90 bg-white/65 px-3.5 text-sm text-slate-900 transition-all duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/30"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-10 rounded-lg px-4"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={
            !values.fullName || !values.phoneNumber || !values.universityEmail
          }
          className="h-10 gap-2 rounded-lg bg-linear-to-r from-[#1e2a78] to-[#2f5bff] px-5 text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] dark:bg-linear-to-r dark:from-[#1e3a8a] dark:to-[#2563eb]"
        >
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
