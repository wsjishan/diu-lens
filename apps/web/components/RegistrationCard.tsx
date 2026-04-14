'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registrationFields } from '@/features/registration/constants';

export function RegistrationCard() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');

  const formatStudentId = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 9);

    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 5) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push('/register');
  };

  return (
    <aside className="w-full lg:justify-self-end lg:self-center lg:pl-2">
      <Card className="rounded-2xl border border-slate-200/95 bg-white shadow-[0_14px_26px_-20px_rgba(15,23,42,0.44),0_6px_12px_-10px_rgba(15,23,42,0.3),inset_0_1px_0_0_rgba(255,255,255,0.92)] dark:border-slate-600/45 dark:bg-slate-900/80 dark:shadow-[0_14px_28px_-18px_rgba(2,6,23,0.72),0_6px_14px_-10px_rgba(14,116,144,0.24),inset_0_1px_0_0_rgba(148,163,184,0.18)]">
        <CardHeader className="space-y-2 px-6 pt-6 pb-1 sm:px-7">
          <CardTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Check Registration Status
          </CardTitle>
          <CardDescription className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            Enter your student ID to continue with DIU Lens.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-5 sm:px-7">
          <form
            className="space-y-4"
            aria-label="Student registration form"
            onSubmit={handleSubmit}
          >
            {registrationFields.map((field) => (
              <div
                key={field.id}
                className="space-y-2"
              >
                <Label
                  htmlFor={field.id}
                  className="text-[0.82rem] font-semibold tracking-[0.02em] text-slate-700 dark:text-slate-300"
                >
                  {field.label}
                </Label>
                <Input
                  id={field.id}
                  name={field.id}
                  type={field.type ?? 'text'}
                  placeholder="e.g. 221-15-0001"
                  autoComplete="off"
                  inputMode="numeric"
                  value={studentId}
                  onChange={(event) =>
                    setStudentId(formatStudentId(event.target.value))
                  }
                  className="h-11 rounded-lg border-slate-300/90 bg-white/65 px-3.5 text-sm text-slate-900 placeholder:text-slate-500/90 transition-colors duration-150 focus-visible:border-blue-600 focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-blue-100/80 dark:border-slate-600/45 dark:bg-slate-950/65 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-sky-400 dark:focus-visible:bg-slate-950 dark:focus-visible:ring-sky-400/35"
                  required
                />
              </div>
            ))}
            <Button
              type="submit"
              className="mt-1 h-11 w-full gap-2 rounded-lg bg-linear-to-r from-blue-900 via-blue-800 to-indigo-700 text-sm font-semibold tracking-tight text-white shadow-[0_8px_14px_-10px_rgba(15,23,42,0.42),0_4px_10px_-8px_rgba(37,99,235,0.36),inset_0_1px_0_0_rgba(255,255,255,0.22)] transition-colors duration-150 hover:brightness-105 hover:shadow-[0_10px_16px_-10px_rgba(15,23,42,0.45),0_6px_12px_-10px_rgba(37,99,235,0.4),inset_0_1px_0_0_rgba(255,255,255,0.25)] active:brightness-100 focus-visible:ring-3 focus-visible:ring-blue-300/70 dark:from-sky-500 dark:via-blue-500 dark:to-indigo-500 dark:text-slate-950 dark:shadow-[0_10px_18px_-12px_rgba(2,6,23,0.76),0_0_0_1px_rgba(125,211,252,0.22),0_0_16px_rgba(56,189,248,0.22)] dark:hover:brightness-110 dark:hover:shadow-[0_12px_20px_-12px_rgba(2,6,23,0.8),0_0_0_1px_rgba(125,211,252,0.3),0_0_20px_rgba(56,189,248,0.28)] dark:focus-visible:ring-sky-300/45"
            >
              Continue
              <ArrowRight
                className="size-4"
                aria-hidden="true"
              />
            </Button>
          </form>
        </CardContent>
      </Card>
    </aside>
  );
}
